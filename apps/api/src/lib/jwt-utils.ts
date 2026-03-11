/**
 * Minimal HS256 JWT helpers for email-verification tokens.
 *
 * We deliberately avoid adding a jsonwebtoken/jose dependency — Node's built-in
 * crypto module gives us everything we need for short-lived, single-use tokens.
 *
 * Algorithm: HS256 (HMAC-SHA256)
 * Token lifetime: configurable, default 24 h
 */
import { createHmac, timingSafeEqual } from "crypto";

// ── Internal helpers ──────────────────────────────────────────────────────────

function b64urlEncode(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function b64urlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface VerificationTokenPayload {
  auth0UserId: string;
  userId:      string;
  /** optional extra claim — e.g. which action is being verified */
  action?:     string;
}

/**
 * Sign a short-lived HS256 JWT for email verification.
 *
 * @param payload   - Claims to embed (auth0UserId + userId required)
 * @param secret    - Signing secret (use AUTH0_SECRET or EMAIL_SECRET env var)
 * @param ttlSecs   - Token lifetime in seconds (default: 86400 = 24 h)
 */
export function signVerificationToken(
  payload: VerificationTokenPayload,
  secret: string,
  ttlSecs = 86_400
): string {
  const header = b64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now    = Math.floor(Date.now() / 1000);

  const claims = {
    ...payload,
    iat: now,
    exp: now + ttlSecs,
  };
  const body = b64urlEncode(JSON.stringify(claims));

  const sig = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${sig}`;
}

/**
 * Verify a HS256 JWT and return its typed payload.
 *
 * Throws on invalid signature, wrong format, or expired token.
 */
export function verifyVerificationToken(
  token: string,
  secret: string
): VerificationTokenPayload & { iat: number; exp: number } {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token: expected 3 segments");
  }

  const [header, body, sig] = parts;

  // ── Algorithm confusion guard ─────────────────────────────────────────────
  // Parse the header and reject anything that isn't HS256 before the
  // signature check runs. Without this check, an attacker who controls
  // the header could try to claim "alg":"none" or switch to an asymmetric
  // algorithm to bypass HMAC verification.
  const headerClaims = JSON.parse(
    b64urlDecode(header).toString("utf8")
  ) as Record<string, unknown>;

  if (headerClaims.alg !== "HS256") {
    throw new Error(
      `Unsupported token algorithm: expected HS256, got ${String(headerClaims.alg ?? "none")}`
    );
  }

  // Constant-time signature comparison (prevents timing attacks)
  const expected = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");

  const sigBuf      = b64urlDecode(sig);
  const expectedBuf = b64urlDecode(expected);

  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    throw new Error("Invalid token signature");
  }

  const claims = JSON.parse(b64urlDecode(body).toString("utf8")) as Record<string, unknown>;

  if (typeof claims.exp !== "number" || claims.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token has expired");
  }

  return claims as unknown as VerificationTokenPayload & { iat: number; exp: number };
}
