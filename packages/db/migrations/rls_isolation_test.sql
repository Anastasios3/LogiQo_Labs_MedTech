-- ══════════════════════════════════════════════════════════════════════════════
-- LogiQo MedTech — RLS Tenant Isolation Verification Script
-- ══════════════════════════════════════════════════════════════════════════════
-- Run after applying migrations 001 + 002 + 003 to verify tenant isolation.
--
-- Prerequisites:
--   1. app_user role must exist (created by migration 001 or by this script)
--   2. The three seed tenants must be present (from db:seed)
--
-- Usage (run as the logiqo/postgres superuser):
--   docker exec -i logiqo_postgres psql -U logiqo -d logiqo_medtech \
--     < packages/db/migrations/rls_isolation_test.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 0. Ensure app_user role exists ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'test_rls_only';
    GRANT CONNECT ON DATABASE logiqo_medtech TO app_user;
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
    -- Audit log immutability: no UPDATE or DELETE for app_user
    REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
    RAISE NOTICE 'app_user role created';
  ELSE
    RAISE NOTICE 'app_user role already exists';
  END IF;
END;
$$;

-- ── 1. Load tenant IDs from seed data ────────────────────────────────────────
\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo 'Tenant IDs (from seed data):'
SELECT id, name FROM tenants ORDER BY name;

-- ── 2. Run isolation tests as app_user (non-superuser, RLS enforced) ─────────
\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo 'Running isolation tests as app_user (RLS enforced)...'
\echo ''

BEGIN;
  SET ROLE app_user;

  -- Pick one tenant — Rigshospitalet; change to test another
  -- (Or substitute the UUID from the tenant IDs printed above)
  DO $$
  DECLARE
    tenant_a UUID;
    tenant_b UUID;
  BEGIN
    SELECT id INTO tenant_a FROM tenants WHERE slug = 'rigshospitalet';
    SELECT id INTO tenant_b FROM tenants WHERE slug = 'dtu-skylab';

    IF tenant_a IS NULL OR tenant_b IS NULL THEN
      RAISE EXCEPTION 'Seed tenants not found — run pnpm --filter @logiqo/db db:seed first';
    END IF;

    EXECUTE format('SET LOCAL app.current_tenant_id = %L', tenant_a::text);

    RAISE NOTICE 'Tenant context: Rigshospitalet (%)', tenant_a;
    RAISE NOTICE 'Cross-tenant target: DTU Skylab (%)', tenant_b;
  END;
  $$;

  -- Re-apply the context for test queries.
  -- set_config(param, value, is_local) where is_local=true = SET LOCAL equivalent
  SELECT set_config('app.current_tenant_id',
    (SELECT id::text FROM tenants WHERE slug = 'rigshospitalet'),
    true  -- is_local: reverts at end of transaction
  );

  -- TEST 1: annotations
  SELECT
    'TEST 1: annotations' AS test,
    COUNT(*) FILTER (WHERE "tenantId" != (SELECT id FROM tenants WHERE slug = 'rigshospitalet') AND visibility = 'tenant') AS leaked_rows,
    CASE WHEN COUNT(*) FILTER (WHERE "tenantId" != (SELECT id FROM tenants WHERE slug = 'rigshospitalet') AND visibility = 'tenant') = 0
         THEN 'PASS ✓' ELSE 'FAIL ✗ — CROSS-TENANT LEAK DETECTED' END AS result
  FROM annotations;

  -- TEST 2: comments (has direct tenantId)
  SELECT
    'TEST 2: comments' AS test,
    COUNT(*) FILTER (WHERE "tenantId" != (SELECT id FROM tenants WHERE slug = 'rigshospitalet')) AS leaked_rows,
    CASE WHEN COUNT(*) FILTER (WHERE "tenantId" != (SELECT id FROM tenants WHERE slug = 'rigshospitalet')) = 0
         THEN 'PASS ✓' ELSE 'FAIL ✗ — CROSS-TENANT LEAK DETECTED' END AS result
  FROM comments;

  -- TEST 3: annotation_votes
  SELECT
    'TEST 3: annotation_votes' AS test,
    COUNT(*) FILTER (WHERE a."tenantId" != (SELECT id FROM tenants WHERE slug = 'rigshospitalet') AND a.visibility = 'tenant') AS leaked_rows,
    CASE WHEN COUNT(*) FILTER (WHERE a."tenantId" != (SELECT id FROM tenants WHERE slug = 'rigshospitalet') AND a.visibility = 'tenant') = 0
         THEN 'PASS ✓' ELSE 'FAIL ✗ — CROSS-TENANT LEAK DETECTED' END AS result
  FROM annotation_votes av
  JOIN annotations a ON a.id = av."annotationId";

  -- TEST 4: comment_votes
  SELECT
    'TEST 4: comment_votes' AS test,
    COUNT(*) FILTER (WHERE c."tenantId" != (SELECT id FROM tenants WHERE slug = 'rigshospitalet')) AS leaked_rows,
    CASE WHEN COUNT(*) FILTER (WHERE c."tenantId" != (SELECT id FROM tenants WHERE slug = 'rigshospitalet')) = 0
         THEN 'PASS ✓' ELSE 'FAIL ✗ — CROSS-TENANT LEAK DETECTED' END AS result
  FROM comment_votes cv
  JOIN comments c ON c.id = cv."commentId";

  -- TEST 5: annotation_flags
  SELECT
    'TEST 5: annotation_flags' AS test,
    COUNT(*) FILTER (WHERE a."tenantId" != (SELECT id FROM tenants WHERE slug = 'rigshospitalet') AND a.visibility = 'tenant') AS leaked_rows,
    CASE WHEN COUNT(*) FILTER (WHERE a."tenantId" != (SELECT id FROM tenants WHERE slug = 'rigshospitalet') AND a.visibility = 'tenant') = 0
         THEN 'PASS ✓' ELSE 'FAIL ✗ — CROSS-TENANT LEAK DETECTED' END AS result
  FROM annotation_flags af
  JOIN annotations a ON a.id = af."annotationId";

  -- TEST 6: annotation_tag_links
  SELECT
    'TEST 6: annotation_tag_links' AS test,
    COUNT(*) FILTER (WHERE a."tenantId" != (SELECT id FROM tenants WHERE slug = 'rigshospitalet') AND a.visibility = 'tenant') AS leaked_rows,
    CASE WHEN COUNT(*) FILTER (WHERE a."tenantId" != (SELECT id FROM tenants WHERE slug = 'rigshospitalet') AND a.visibility = 'tenant') = 0
         THEN 'PASS ✓' ELSE 'FAIL ✗ — CROSS-TENANT LEAK DETECTED' END AS result
  FROM annotation_tag_links atl
  JOIN annotations a ON a.id = atl."annotationId";

  -- TEST 7: users
  SELECT
    'TEST 7: users' AS test,
    COUNT(*) FILTER (WHERE "tenantId" != (SELECT id FROM tenants WHERE slug = 'rigshospitalet')) AS leaked_rows,
    CASE WHEN COUNT(*) FILTER (WHERE "tenantId" != (SELECT id FROM tenants WHERE slug = 'rigshospitalet')) = 0
         THEN 'PASS ✓' ELSE 'FAIL ✗ — CROSS-TENANT LEAK DETECTED' END AS result
  FROM users;

  -- TEST 8: user_reputations
  SELECT
    'TEST 8: user_reputations' AS test,
    COUNT(*) FILTER (WHERE u."tenantId" != (SELECT id FROM tenants WHERE slug = 'rigshospitalet')) AS leaked_rows,
    CASE WHEN COUNT(*) FILTER (WHERE u."tenantId" != (SELECT id FROM tenants WHERE slug = 'rigshospitalet')) = 0
         THEN 'PASS ✓' ELSE 'FAIL ✗ — CROSS-TENANT LEAK DETECTED' END AS result
  FROM user_reputations ur
  JOIN users u ON u.id = ur."userId";

ROLLBACK;

-- ── 3. Audit log immutability ────────────────────────────────────────────────
\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo 'Testing audit_logs immutability (app_user cannot UPDATE/DELETE)...'

BEGIN;
  SET ROLE app_user;
  SELECT set_config('app.current_tenant_id',
    (SELECT id::text FROM tenants WHERE slug = 'rigshospitalet'),
    true
  );

  DO $$
  BEGIN
    UPDATE audit_logs SET action = 'tampered' WHERE 1=0;
    RAISE NOTICE 'UPDATE on audit_logs: SUCCEEDED (FAIL ✗ — audit log is mutable!)';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 9: audit_log UPDATE BLOCKED ✓';
  END;
  $$;

  DO $$
  BEGIN
    DELETE FROM audit_logs WHERE 1=0;
    RAISE NOTICE 'DELETE on audit_logs: SUCCEEDED (FAIL ✗ — audit log is mutable!)';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 10: audit_log DELETE BLOCKED ✓';
  END;
  $$;

ROLLBACK;

\echo ''
\echo 'All isolation tests complete. Check results above.'
\echo 'All tests should show PASS ✓ or BLOCKED ✓.'
\echo '═══════════════════════════════════════════════════════'
