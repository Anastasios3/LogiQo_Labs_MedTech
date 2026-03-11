-- Migration 002: Ingestion tracking table for external API syncs
-- Tracks FDA OpenFDA, GUDID, and EUDAMED sync history

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source               TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'running',
  records_ingested     INTEGER NOT NULL DEFAULT 0,
  records_skipped      INTEGER NOT NULL DEFAULT 0,
  error_message        TEXT,
  started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at         TIMESTAMPTZ,
  triggered_by         TEXT NOT NULL DEFAULT 'manual',
  triggered_by_user_id UUID
);

CREATE INDEX IF NOT EXISTS ingestion_runs_source_idx
  ON ingestion_runs(source, started_at DESC);

-- Grant app_user the right to read/write ingestion_runs
GRANT SELECT, INSERT, UPDATE ON ingestion_runs TO app_user;
