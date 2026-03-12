-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 6 — Annotation System Extensions
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds:
--   • status lifecycle field (draft | published | flagged | removed)
--   • publishedAt timestamp
--   • flaggedReason text (most-recent flag summary for quick moderator access)
--   • endorsementCount denormalized counter (fast sorting / ranking)
--   • flagCount denormalized counter (auto-escalation threshold check)
--   • annotationCount denormalized counter on devices (fast device-level stat)
--
-- Apply:
--   psql "$DATABASE_URL" -f packages/db/migrations/20260312000002_phase6_annotations/migration.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Annotation: new lifecycle and counter columns ─────────────────────────

ALTER TABLE annotations
  ADD COLUMN IF NOT EXISTS status            VARCHAR(20) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flagged_reason    TEXT,
  ADD COLUMN IF NOT EXISTS endorsement_count INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flag_count        INT         NOT NULL DEFAULT 0;

-- Backfill status from the legacy isPublished boolean
UPDATE annotations
SET  status       = CASE WHEN "isPublished" = true THEN 'published' ELSE 'draft' END,
     published_at = CASE WHEN "isPublished" = true THEN "createdAt" ELSE NULL END;

-- Backfill endorsement_count from existing annotation_endorsements rows
UPDATE annotations a
SET    endorsement_count = (
  SELECT COUNT(*)
  FROM   annotation_endorsements ae
  WHERE  ae."annotationId" = a.id
);

-- Backfill flag_count from existing annotation_flags rows
UPDATE annotations a
SET    flag_count = (
  SELECT COUNT(*)
  FROM   annotation_flags af
  WHERE  af."annotationId" = a.id
);

-- ── 2. Device: annotation_count denormalized counter ─────────────────────────

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS annotation_count INT NOT NULL DEFAULT 0;

-- Backfill from published annotations only
UPDATE devices d
SET    annotation_count = (
  SELECT COUNT(*)
  FROM   annotations a
  WHERE  a."deviceId" = d.id
    AND  a.status = 'published'
);

-- ── 3. Performance indexes ────────────────────────────────────────────────────

-- Global feed: newest + by status
CREATE INDEX IF NOT EXISTS annotations_status_created_idx
  ON annotations (status, "createdAt" DESC);

-- Device-scoped listing: most common query pattern
CREATE INDEX IF NOT EXISTS annotations_device_status_idx
  ON annotations ("deviceId", status, "createdAt" DESC);

-- Device-scoped listing sorted by endorsement count
CREATE INDEX IF NOT EXISTS annotations_device_endorsement_idx
  ON annotations ("deviceId", endorsement_count DESC)
  WHERE status = 'published';
