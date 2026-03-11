-- Phase 3: Tenant & Organisation System
-- Adds:
--   1. Subscription + seat-management columns to tenants
--   2. Soft-delete (deleted_at) + invitations relation to users
--   3. New invitations table with RLS

-- ── 1. Extend tenants ─────────────────────────────────────────────────────────

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS subscription_status   TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS subscription_tier      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS max_users              INT  NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS active_user_count      INT  NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS tenants_subscription_status_idx
  ON tenants(subscription_status);

-- ── 2. Extend users ───────────────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ── 3. Create invitations table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invitations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invited_by_id UUID        NOT NULL REFERENCES users(id),
  email         TEXT        NOT NULL,
  role          TEXT        NOT NULL,
  -- Cryptographically random UUID for the invite link; DB-generated so it is
  -- always populated even on direct DB inserts.
  token         UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at    TIMESTAMPTZ NOT NULL,
  accepted_at   TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One active invite slot per email per tenant (application layer upserts)
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS invitations_token_idx      ON invitations(token);
CREATE INDEX IF NOT EXISTS invitations_tenant_idx     ON invitations(tenant_id, email);
CREATE INDEX IF NOT EXISTS invitations_expires_at_idx ON invitations(expires_at);

-- ── 4. RLS for invitations ────────────────────────────────────────────────────
-- Matches the pattern established for all other tenant-scoped tables.

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- org_admin of the same tenant may read and manage invitations
CREATE POLICY invitations_tenant_isolation ON invitations
  USING (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- system_admin bypass (matches existing RLS pattern)
CREATE POLICY invitations_system_admin ON invitations
  USING (
    current_setting('app.current_role', true) = 'system_admin'
  );
