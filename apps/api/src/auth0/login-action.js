/**
 * Auth0 Login Action — LogiQo MedTech
 * ─────────────────────────────────────────────────────────────────────────
 * Deploy this in the Auth0 Dashboard:
 *   Actions → Library → Build Custom Action → Login / Post Login
 *
 * Required secret in Auth0 Action Secrets:
 *   DATABASE_URL = postgresql://logiqo:...@host/logiqo_medtech
 *
 * npm packages to add in the Action editor:
 *   pg: "^8"
 *
 * What it does:
 *  1. Looks up the user in our `users` table by auth0_user_id (= event.user.user_id)
 *  2. Reads verificationTier, role, tenantId from DB
 *  3. Adds custom namespace claims to the ID token and access token:
 *       https://logiqo.io/role
 *       https://logiqo.io/tenant_id
 *       https://logiqo.io/verification_tier
 *  4. Updates lastLoginAt in the DB
 *  5. If user not found: provisions a new user record at tier 0 (unverified)
 *
 * Namespace: https://logiqo.io/  (must match what apps/api/src/plugins/auth.ts reads)
 */

const { Client } = require("pg");

exports.onExecutePostLogin = async (event, api) => {
  const NAMESPACE    = "https://logiqo.io/";
  const DATABASE_URL = event.secrets.DATABASE_URL;

  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    await db.connect();

    // 1. Look up user
    const { rows } = await db.query(
      `SELECT id, tenant_id, role, verification_tier, is_active
         FROM users
        WHERE auth0_user_id = $1
        LIMIT 1`,
      [event.user.user_id]
    );

    let dbUser = rows[0];

    if (!dbUser) {
      // 2. Provision new user at tier 0
      // Default tenant: first tenant in DB (pilot deployment assumption).
      // For multi-tenant, extend Auth0 org metadata to carry tenant_id.
      const { rows: tenants } = await db.query(
        `SELECT id FROM tenants WHERE is_active = true ORDER BY created_at ASC LIMIT 1`
      );
      const tenantId = tenants[0]?.id ?? null;

      if (tenantId) {
        const { rows: newUser } = await db.query(
          `INSERT INTO users
             (auth0_user_id, email, full_name, role, tenant_id, verification_tier, is_active)
           VALUES ($1, $2, $3, 'surgeon', $4, 0, true)
           ON CONFLICT (auth0_user_id) DO UPDATE SET last_login_at = NOW()
           RETURNING id, tenant_id, role, verification_tier`,
          [
            event.user.user_id,
            event.user.email,
            event.user.name ?? event.user.email?.split("@")[0] ?? "New User",
            tenantId,
          ]
        );
        dbUser = newUser[0];
      }
    } else {
      // 3. Update last login
      await db.query(
        `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
        [dbUser.id]
      );
    }

    if (dbUser) {
      // 4. Set custom claims on both ID token and access token
      const claims = {
        [`${NAMESPACE}role`]:               dbUser.role,
        [`${NAMESPACE}tenant_id`]:          dbUser.tenant_id,
        [`${NAMESPACE}verification_tier`]:  dbUser.verification_tier,
      };

      for (const [key, value] of Object.entries(claims)) {
        api.idToken.setCustomClaim(key, value);
        api.accessToken.setCustomClaim(key, value);
      }

      // Block inactive users
      if (!dbUser.is_active) {
        api.access.deny("Your account has been deactivated. Contact your administrator.");
        return;
      }
    }

  } catch (err) {
    console.error("LogiQo Auth0 Action error:", err.message);
    // Don't block login on DB errors — log and continue
  } finally {
    await db.end().catch(() => {});
  }
};
