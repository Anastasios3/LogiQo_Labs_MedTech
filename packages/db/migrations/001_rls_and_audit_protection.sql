-- ============================================================
-- Migration: Row-Level Security + Audit Log Immutability
-- Run AFTER: prisma migrate dev/deploy
-- Updated to use Prisma camelCase column names
-- ============================================================

-- NOTE: The app_user role is for production deployments only.
-- In dev, the logiqo superuser is used directly.
-- Uncomment and configure for production:
-- CREATE ROLE app_user WITH LOGIN PASSWORD '${APP_DB_PASSWORD}';
-- GRANT CONNECT ON DATABASE logiqo_medtech TO app_user;
-- GRANT USAGE ON SCHEMA public TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- REVOKE UPDATE, DELETE ON audit_logs FROM app_user;

-- ============================================================
-- AUDIT LOG IMMUTABILITY (dev: applies to logiqo user directly)
-- ============================================================
-- In production with app_user role, run:
-- REVOKE UPDATE, DELETE ON audit_logs FROM app_user;

-- ============================================================
-- ROW-LEVEL SECURITY (Multi-tenant isolation)
-- Uses camelCase column names as created by Prisma
-- ============================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_alert_acknowledgements ENABLE ROW LEVEL SECURITY;

-- The application sets the tenant context at the start of each request:
--   SET LOCAL app.current_tenant_id = '<uuid>';
-- (Phase 2: wire into Prisma $transaction middleware in db plugin)

-- RLS policy: users can only see their tenant's data
CREATE POLICY tenant_isolation_users ON users
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_annotations ON annotations
  USING (
    "tenantId" = current_setting('app.current_tenant_id', true)::uuid
    OR visibility = 'platform'
  );

CREATE POLICY tenant_isolation_sops ON sops
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_alert_ack ON tenant_alert_acknowledgements
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

-- Full-text search on device name + SKU (already created by first SQL run)
-- DROP INDEX IF EXISTS idx_devices_fts; -- already created
-- CREATE INDEX idx_devices_fts ON devices
--   USING GIN (to_tsvector('english', name || ' ' || sku || ' ' || COALESCE(description, '')));

-- Device lookups (camelCase column names)
CREATE INDEX IF NOT EXISTS idx_devices_manufacturer ON devices ("manufacturerId");
CREATE INDEX IF NOT EXISTS idx_devices_category     ON devices ("categoryId");
CREATE INDEX IF NOT EXISTS idx_devices_reg_status   ON devices ("regulatoryStatus");
CREATE INDEX IF NOT EXISTS idx_devices_appr_status  ON devices ("approvalStatus");

-- Alert lookups
CREATE INDEX IF NOT EXISTS idx_alerts_severity     ON alerts (severity);
CREATE INDEX IF NOT EXISTS idx_alerts_published_at ON alerts ("publishedAt" DESC);

-- Annotation lookups (camelCase column names)
CREATE INDEX IF NOT EXISTS idx_annotations_device ON annotations ("deviceId", "isPublished", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_annotations_tenant ON annotations ("tenantId", "createdAt" DESC);
