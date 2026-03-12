-- ============================================================
-- 004_alerts_severity_rank.sql
-- ============================================================
--
-- Adds a denormalized severity_rank integer column to the alerts
-- table so the canonical alert feed (GET /alerts) can paginate
-- entirely at the database level without loading the full table
-- into the Node.js heap.
--
-- Severity rank mapping (set by the application at write time):
--   critical = 4 | high = 3 | medium = 2 | low = 1
--
-- A composite index on (severity_rank DESC, published_at DESC)
-- matches the ORDER BY clause used by the listing query, enabling
-- index-only pagination for the common case (no extra filters).
--
-- Idempotent: uses IF NOT EXISTS / DO NOTHING guards throughout.
-- ============================================================

BEGIN;

-- 1. Add column (safe to re-run — IF NOT EXISTS guard)
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS severity_rank INTEGER NOT NULL DEFAULT 1;

-- 2. Backfill any existing rows that still carry the default.
--    Re-running is harmless — the CASE result equals the current value.
UPDATE alerts
SET severity_rank = CASE severity
  WHEN 'critical' THEN 4
  WHEN 'high'     THEN 3
  WHEN 'medium'   THEN 2
  ELSE                 1   -- low + unknown values
END;

-- 3. Composite index for the canonical feed sort order.
--    Covers ORDER BY severity_rank DESC, published_at DESC with optional
--    equality predicates on severity / alert_type / source pushed down
--    via a partial index in a future migration if selectivity warrants it.
CREATE INDEX IF NOT EXISTS alerts_severity_rank_published_at_idx
  ON alerts (severity_rank DESC, published_at DESC);

COMMIT;
