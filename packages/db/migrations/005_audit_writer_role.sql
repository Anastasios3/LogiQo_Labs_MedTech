-- ============================================================
-- 005_audit_writer_role.sql
-- ============================================================
--
-- 1. Creates the audit_writer PostgreSQL role with INSERT + SELECT
--    ONLY on audit_logs — no UPDATE or DELETE — making the audit
--    log immutable at the database privilege level.
--
-- 2. Fixes the userId column type: UUID → TEXT.
--    The application stores the Auth0 subject string (e.g. "auth0|…")
--    in userId. Postgres UUID type rejects non-UUID strings at INSERT,
--    causing a runtime error on every audit write. TEXT accepts any
--    identifier and existing data is preserved.
--
-- 3. Adds the three new HTTP request context columns:
--      responseStatus   INTEGER   — HTTP status code returned
--      requestBody      JSONB     — sanitized request payload
--      metadata         JSONB     — reserved for future enrichment
--
-- 4. Adds targeted indexes for the audit log viewer filters and the
--    BRIN index on createdAt (ideal for append-only, time-ordered rows).
--
-- Idempotent: all DDL uses IF NOT EXISTS / DO NOTHING guards.
-- ============================================================

BEGIN;

-- ── 1. Create audit_writer role ──────────────────────────────────────────────
DO $$
BEGIN
  CREATE ROLE audit_writer;
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- already exists — safe to continue
END
$$;

-- Grant INSERT + SELECT ONLY so the application process can write and read
-- audit records but can never modify or delete them.
GRANT INSERT, SELECT ON TABLE audit_logs TO audit_writer;

-- ── 2. Defense-in-depth: revoke mutation rights from app_user ────────────────
-- This is also referenced in 001_rls_and_audit_protection.sql (commented out
-- pending production role setup). Applied unconditionally here so that when
-- app_user is provisioned in staging / production this protection is in effect.
DO $$
BEGIN
  REVOKE UPDATE, DELETE ON TABLE audit_logs FROM app_user;
EXCEPTION
  WHEN undefined_object THEN NULL;  -- app_user doesn't exist in dev — harmless
END
$$;

-- ── 3. Fix userId column type: UUID → TEXT ───────────────────────────────────
-- The Auth0 subject string ("auth0|abc123") is not a valid UUID.
-- Postgres silently allows the ALTER even if an index on the column exists
-- because TEXT is a compatible cast target from UUID.
ALTER TABLE audit_logs
  ALTER COLUMN "userId" TYPE TEXT;

-- ── 4. Add HTTP request context columns ─────────────────────────────────────
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS "responseStatus" INTEGER,
  ADD COLUMN IF NOT EXISTS "requestBody"    JSONB,
  ADD COLUMN IF NOT EXISTS metadata         JSONB;

-- ── 5. Targeted indexes for the audit log viewer ─────────────────────────────

-- userId lookups (filter by actor)
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx
  ON audit_logs ("userId");

-- action lookups (filter by operation type)
CREATE INDEX IF NOT EXISTS audit_logs_action_idx
  ON audit_logs (action);

-- BRIN index on createdAt — far more space-efficient than B-tree for an
-- append-only table with monotonically increasing timestamps.
-- Covers ORDER BY createdAt DESC and date-range filter queries.
CREATE INDEX IF NOT EXISTS audit_logs_created_at_brin_idx
  ON audit_logs USING BRIN ("createdAt");

COMMIT;
