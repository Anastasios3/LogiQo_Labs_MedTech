/**
 * Auth0 Management API client.
 *
 * Provides typed wrappers around the Auth0 Management API v2 for:
 *   • Creating users (POST /api/v2/users)
 *   • Generating email-verification tickets (POST /api/v2/tickets/email-verification)
 *   • Reading user state (GET /api/v2/users/{id})
 *
 * Access tokens are obtained via client_credentials grant and cached with a
 * 60-second safety margin to prevent thundering-herd on token expiry.
 *
 * Requires env vars:
 *   AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET
 */

// ── Management API token cache ────────────────────────────────────────────────

interface CachedToken {
  accessToken: string;
  expiresAt:   number; // epoch ms
}

let tokenCache: CachedToken | null = null;

async function getManagementToken(): Promise<string> {
  const SAFETY_MARGIN_MS = 60_000; // refresh 60 s before actual expiry

  if (tokenCache && Date.now() < tokenCache.expiresAt - SAFETY_MARGIN_MS) {
    return tokenCache.accessToken;
  }

  const domain = process.env.AUTH0_DOMAIN;
  if (!domain) throw new Error("AUTH0_DOMAIN env var not set");

  const res = await fetch(`https://${domain}/oauth/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      grant_type:    "client_credentials",
      client_id:     process.env.AUTH0_CLIENT_ID!,
      client_secret: process.env.AUTH0_CLIENT_SECRET!,
      // The Management API audience follows this exact pattern for every Auth0 tenant
      audience:      `https://${domain}/api/v2/`,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Auth0 Management token request failed (${res.status}): ${body}`
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };

  tokenCache = {
    accessToken: data.access_token,
    expiresAt:   Date.now() + data.expires_in * 1_000,
  };

  return tokenCache.accessToken;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateUserParams {
  email:     string;
  password:  string;
  firstName: string;
  lastName:  string;
  role:      string;
}

export interface Auth0UserRecord {
  user_id:        string;
  email:          string;
  email_verified: boolean;
  name:           string;
  user_metadata?: Record<string, unknown>;
  app_metadata?:  Record<string, unknown>;
}

// ── User creation ─────────────────────────────────────────────────────────────

/**
 * Create a new user in Auth0's Username-Password-Authentication connection.
 *
 * Throws `EMAIL_EXISTS` error code if the email is already registered.
 */
export async function createAuth0User(
  params: CreateUserParams
): Promise<Auth0UserRecord> {
  const domain = process.env.AUTH0_DOMAIN!;
  const token  = await getManagementToken();

  const res = await fetch(`https://${domain}/api/v2/users`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      email:      params.email,
      password:   params.password,
      connection: "Username-Password-Authentication",
      name:       `${params.firstName} ${params.lastName}`,
      // user_metadata is user-editable; app_metadata is admin-only
      user_metadata: {
        firstName: params.firstName,
        lastName:  params.lastName,
      },
      app_metadata: {
        role:              params.role,
        verification_tier: 0,
      },
      email_verified: false,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const err = (await res.json()) as { message?: string; code?: string; statusCode?: number };

    // Auth0 returns 409 for duplicate email
    if (res.status === 409 || err.message?.toLowerCase().includes("already exist")) {
      throw Object.assign(
        new Error("An account with that email address already exists."),
        { code: "EMAIL_EXISTS", statusCode: 409 }
      );
    }

    // Auth0 password policy violation
    if (res.status === 400 && err.message?.toLowerCase().includes("password")) {
      throw Object.assign(
        new Error(err.message ?? "Password does not meet Auth0 policy requirements."),
        { code: "PASSWORD_POLICY", statusCode: 422 }
      );
    }

    throw new Error(
      `Auth0 user creation failed (${res.status}): ${err.message ?? "Unknown error"}`
    );
  }

  return res.json() as Promise<Auth0UserRecord>;
}

// ── Email verification ticket ─────────────────────────────────────────────────

/**
 * Create an Auth0 email-verification ticket.
 *
 * When the user clicks the link in the verification email, Auth0 verifies the
 * address and then redirects the browser to `resultUrl`.
 *
 * @param auth0UserId  - The user_id returned by createAuth0User (e.g. "auth0|...")
 * @param resultUrl    - Where Auth0 should redirect after verification
 * @param ttlSecs      - Ticket lifetime (default: 86400 = 24 h)
 * @returns            - The full Auth0 ticket URL to send to the user
 */
export async function createEmailVerificationTicket(
  auth0UserId: string,
  resultUrl:   string,
  ttlSecs      = 86_400
): Promise<string> {
  const domain = process.env.AUTH0_DOMAIN!;
  const token  = await getManagementToken();

  const res = await fetch(`https://${domain}/api/v2/tickets/email-verification`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      user_id:    auth0UserId,
      result_url: resultUrl,
      ttl_sec:    ttlSecs,
      // Include email in redirect (optional; helps frontend auto-fill)
      includeEmailInRedirect: false,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    throw new Error(
      `Auth0 verification ticket creation failed (${res.status}): ${err.message ?? "Unknown"}`
    );
  }

  const data = (await res.json()) as { ticket: string };
  return data.ticket;
}

// ── Read user ─────────────────────────────────────────────────────────────────

/**
 * Fetch a user record from Auth0 Management API.
 * Used to confirm `email_verified: true` before promoting tier in our DB.
 */
export async function getAuth0User(auth0UserId: string): Promise<Auth0UserRecord> {
  const domain = process.env.AUTH0_DOMAIN!;
  const token  = await getManagementToken();

  const res = await fetch(
    `https://${domain}/api/v2/users/${encodeURIComponent(auth0UserId)}`,
    {
      headers: { "Authorization": `Bearer ${token}` },
      signal:  AbortSignal.timeout(10_000),
    }
  );

  if (!res.ok) {
    throw new Error(
      `Auth0 getUser failed (${res.status}) for user ${auth0UserId}`
    );
  }

  return res.json() as Promise<Auth0UserRecord>;
}
