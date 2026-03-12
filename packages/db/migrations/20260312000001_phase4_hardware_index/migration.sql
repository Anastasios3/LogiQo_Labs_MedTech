-- Phase 4: Hardware Index Core
-- Adds view_count to devices and a GIN full-text search index.
--
-- NOTE: Prisma does NOT add @map to most Device fields, so Postgres stores them
-- as camelCase identifiers (e.g. "modelNumber", "approvalStatus").
-- All column references must be double-quoted to preserve case.

-- ── 1. view_count column ──────────────────────────────────────────────────────
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0;

-- ── 2. GIN expression index for pg_tsvector full-text search ─────────────────
-- Drop the narrower legacy index (name + sku + description only) and replace
-- with a broader one that also covers modelNumber for part-number searches.
DROP INDEX IF EXISTS idx_devices_fts;

CREATE INDEX IF NOT EXISTS devices_fts_gin_idx ON devices
  USING GIN (
    to_tsvector('english',
      name                                       || ' ' ||
      sku                                        || ' ' ||
      COALESCE("modelNumber", '')                || ' ' ||
      COALESCE(description,   '')
    )
  );
