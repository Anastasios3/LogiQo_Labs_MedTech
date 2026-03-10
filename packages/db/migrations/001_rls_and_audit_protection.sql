-- ============================================================
-- Migration: Row-Level Security + Audit Log Immutability
-- Run AFTER prisma migrate deploy
-- ============================================================

-- Create application DB user with least-privilege access
-- (Run this once manually, not in automated migrations)
-- CREATE ROLE app_user WITH LOGIN PASSWORD '${APP_DB_PASSWORD}';
-- GRANT CONNECT ON DATABASE logiqo_medtech TO app_user;
-- GRANT USAGE ON SCHEMA public TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- ============================================================
-- AUDIT LOG IMMUTABILITY
-- The app_user cannot UPDATE or DELETE audit_logs.
-- Only INSERT and SELECT are permitted.
-- ============================================================
REVOKE UPDATE, DELETE ON audit_logs FROM app_user;

-- ============================================================
-- ROW-LEVEL SECURITY (Multi-tenant isolation)
-- ============================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_alert_acknowledgements ENABLE ROW LEVEL SECURITY;

-- The app sets the tenant context at the start of each request:
--   SET LOCAL app.current_tenant_id = '<uuid>';

-- RLS policies: users can only see their tenant's data
CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_annotations ON annotations
  USING (
    tenant_id = current_setting('app.current_tenant_id')::uuid
    OR visibility = 'platform'
  );

CREATE POLICY tenant_isolation_sops ON sops
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_alert_ack ON tenant_alert_acknowledgements
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Devices and alerts are global (not tenant-scoped) but require authentication.
-- Approval status is enforced at the application layer.

-- ============================================================
-- INDEXES for clinical search performance
-- ============================================================

-- Full-text search on device name + SKU (pg_tsvector for MVP)
CREATE INDEX idx_devices_fts ON devices
  USING GIN (to_tsvector('english', name || ' ' || sku || ' ' || COALESCE(description, '')));

-- Manufacturer and category lookups
CREATE INDEX idx_devices_manufacturer ON devices (manufacturer_id);
CREATE INDEX idx_devices_category ON devices (category_id);
CREATE INDEX idx_devices_regulatory_status ON devices (regulatory_status);
CREATE INDEX idx_devices_approval_status ON devices (approval_status);

-- Alert lookups
CREATE INDEX idx_alerts_severity ON alerts (severity);
CREATE INDEX idx_alerts_published_at ON alerts (published_at DESC);

-- Annotation lookups
CREATE INDEX idx_annotations_device ON annotations (device_id, is_published, created_at DESC);
CREATE INDEX idx_annotations_tenant ON annotations (tenant_id, created_at DESC);
