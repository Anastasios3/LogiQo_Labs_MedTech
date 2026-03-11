/**
 * Auth0 Post-Registration Action — LogiQo MedTech
 * ─────────────────────────────────────────────────────────────────────────
 * Deploy in Auth0 Dashboard:
 *   Actions → Library → Build Custom Action → Post User Registration
 *
 * Same secrets as login-action.js:
 *   DATABASE_URL = postgresql://...
 *
 * What it does:
 *   Creates the user record in our DB immediately after Auth0 creates the
 *   Auth0 user. Users start at verification_tier = 0 (unverified read-only).
 *   The login action handles the detailed role/tenant resolution.
 */

const { Client } = require("pg");

exports.onExecutePostUserRegistration = async (event) => {
  const DATABASE_URL = event.secrets.DATABASE_URL;
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    await db.connect();

    // Get default tenant
    const { rows: tenants } = await db.query(
      `SELECT id FROM tenants WHERE is_active = true ORDER BY created_at ASC LIMIT 1`
    );
    const tenantId = tenants[0]?.id;
    if (!tenantId) return;

    // Determine role from email domain (simple heuristic)
    // Override with app_metadata if set from management API
    const appMeta = event.user.app_metadata ?? {};
    const role    = appMeta.role ?? "surgeon";
    const tid     = appMeta.tenant_id ?? tenantId;

    await db.query(
      `INSERT INTO users
         (auth0_user_id, email, full_name, role, tenant_id, verification_tier, is_active)
       VALUES ($1, $2, $3, $4, $5, 0, true)
       ON CONFLICT (auth0_user_id) DO NOTHING`,
      [
        event.user.user_id,
        event.user.email,
        event.user.name ?? event.user.email?.split("@")[0] ?? "New User",
        role,
        tid,
      ]
    );
  } catch (err) {
    console.error("LogiQo Post-Registration Action error:", err.message);
  } finally {
    await db.end().catch(() => {});
  }
};
