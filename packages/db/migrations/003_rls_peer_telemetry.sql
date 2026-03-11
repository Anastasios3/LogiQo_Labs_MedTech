-- ============================================================
-- Migration 003: RLS Policies for Peer Telemetry Tables
-- ─────────────────────────────────────────────────────────────
-- Extends migration 001 to cover the 7 new tables added in the
-- Phase 2 Peer Telemetry sprint:
--   comments, annotation_votes, comment_votes,
--   annotation_flags, annotation_tag_links,
--   annotation_endorsements, user_reputations
--
-- Run with:
--   docker exec -i logiqo_postgres psql -U logiqo -d logiqo_medtech \
--     < packages/db/migrations/003_rls_peer_telemetry.sql
--
-- Tenant context (set per-request by the API before any query):
--   SET LOCAL app.current_tenant_id = '<uuid>';
-- Wired in db plugin via withTenant() helper → Prisma interactive tx.
-- ============================================================

-- ============================================================
-- PART 1: ENABLE RLS
-- ============================================================

-- comments has a direct "tenantId" column
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- The following tables are scoped via their parent annotation
ALTER TABLE annotation_votes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotation_flags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotation_tag_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotation_endorsements ENABLE ROW LEVEL SECURITY;

-- comment_votes scoped via comment → tenantId
ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;

-- user_reputations scoped via user → tenantId
ALTER TABLE user_reputations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART 2: POLICIES
-- ============================================================

-- ── comments ─────────────────────────────────────────────────
-- Direct tenantId, same pattern as users / sops / audit_logs
CREATE POLICY tenant_isolation_comments ON comments
  USING (
    "tenantId" = current_setting('app.current_tenant_id', true)::uuid
  );

-- ── annotation_votes ─────────────────────────────────────────
-- Visible if the parent annotation belongs to the current tenant
-- OR has platform-wide visibility (replicates annotation policy)
CREATE POLICY tenant_isolation_annotation_votes ON annotation_votes
  USING (
    EXISTS (
      SELECT 1 FROM annotations a
      WHERE a.id = annotation_votes."annotationId"
        AND (
          a."tenantId" = current_setting('app.current_tenant_id', true)::uuid
          OR a.visibility = 'platform'
        )
    )
  );

-- ── annotation_flags ─────────────────────────────────────────
CREATE POLICY tenant_isolation_annotation_flags ON annotation_flags
  USING (
    EXISTS (
      SELECT 1 FROM annotations a
      WHERE a.id = annotation_flags."annotationId"
        AND (
          a."tenantId" = current_setting('app.current_tenant_id', true)::uuid
          OR a.visibility = 'platform'
        )
    )
  );

-- ── annotation_tag_links ──────────────────────────────────────
CREATE POLICY tenant_isolation_annotation_tag_links ON annotation_tag_links
  USING (
    EXISTS (
      SELECT 1 FROM annotations a
      WHERE a.id = annotation_tag_links."annotationId"
        AND (
          a."tenantId" = current_setting('app.current_tenant_id', true)::uuid
          OR a.visibility = 'platform'
        )
    )
  );

-- ── annotation_endorsements ───────────────────────────────────
-- This table was in migration 001's schema but not covered by it.
CREATE POLICY tenant_isolation_annotation_endorsements ON annotation_endorsements
  USING (
    EXISTS (
      SELECT 1 FROM annotations a
      WHERE a.id = annotation_endorsements."annotationId"
        AND (
          a."tenantId" = current_setting('app.current_tenant_id', true)::uuid
          OR a.visibility = 'platform'
        )
    )
  );

-- ── comment_votes ─────────────────────────────────────────────
-- Scoped via comment.tenantId
CREATE POLICY tenant_isolation_comment_votes ON comment_votes
  USING (
    EXISTS (
      SELECT 1 FROM comments c
      WHERE c.id = comment_votes."commentId"
        AND c."tenantId" = current_setting('app.current_tenant_id', true)::uuid
    )
  );

-- ── user_reputations ──────────────────────────────────────────
-- Scoped via user.tenantId — only your own tenant's clinician
-- reputation scores are visible
CREATE POLICY tenant_isolation_user_reputations ON user_reputations
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_reputations."userId"
        AND u."tenantId" = current_setting('app.current_tenant_id', true)::uuid
    )
  );

-- ============================================================
-- PART 3: PERFORMANCE INDEXES FOR NEW TABLES
-- ============================================================

-- annotation_votes
CREATE INDEX IF NOT EXISTS idx_annotation_votes_annotation
  ON annotation_votes ("annotationId");
CREATE INDEX IF NOT EXISTS idx_annotation_votes_user
  ON annotation_votes ("userId");

-- comments
CREATE INDEX IF NOT EXISTS idx_comments_annotation_depth
  ON comments ("annotationId", depth);
CREATE INDEX IF NOT EXISTS idx_comments_tenant_created
  ON comments ("tenantId", "createdAt" DESC);

-- comment_votes
CREATE INDEX IF NOT EXISTS idx_comment_votes_comment
  ON comment_votes ("commentId");
CREATE INDEX IF NOT EXISTS idx_comment_votes_user
  ON comment_votes ("userId");

-- annotation_flags
CREATE INDEX IF NOT EXISTS idx_annotation_flags_annotation
  ON annotation_flags ("annotationId");
CREATE INDEX IF NOT EXISTS idx_annotation_flags_status
  ON annotation_flags ("resolvedAt");

-- annotation_tag_links
CREATE INDEX IF NOT EXISTS idx_annotation_tag_links_tag
  ON annotation_tag_links ("tagId");

-- annotation_endorsements
CREATE INDEX IF NOT EXISTS idx_annotation_endorsements_annotation
  ON annotation_endorsements ("annotationId");
CREATE INDEX IF NOT EXISTS idx_annotation_endorsements_user
  ON annotation_endorsements ("userId");

-- user_reputations
CREATE INDEX IF NOT EXISTS idx_user_reputations_total_score
  ON user_reputations ("totalScore" DESC);
