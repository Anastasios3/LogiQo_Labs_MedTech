/**
 * Auth routes:
 *
 *   POST /auth/webhook/user-created  — Auth0 post-registration webhook (server→server)
 *   POST /auth/register              — Client-facing signup with email + password
 *   GET  /auth/verify-email          — Email verification callback (Auth0 ticket redirect)
 *
 * All three are unauthenticated endpoints — no JWT required.
 * Tenant context is set explicitly where needed.
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  createAuth0User,
  createEmailVerificationTicket,
  getAuth0User,
} from "../../lib/auth0-management.js";
import {
  signVerificationToken,
  verifyVerificationToken,
} from "../../lib/jwt-utils.js";
import {
  promoteUserToNpiVerified,
  NpiNotFoundError,
  type NpiVerificationResult,
} from "../../services/npi-service.js";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const auth0WebhookSchema = z.object({
  event: z.object({
    type: z.string(),
    data: z.object({
      object: z.object({
        user_id: z.string(),
        email:   z.string(),
        app_metadata: z
          .object({
            tenant_id: z.string().optional(),
            role:      z.string().optional(),
          })
          .optional(),
      }),
    }),
  }),
});

const submitNpiSchema = z.object({
  /** Exactly 10 decimal digits — no dashes, spaces, or letters */
  npiNumber: z
    .string()
    .regex(/^\d{10}$/, "NPI must be exactly 10 digits with no spaces or dashes"),
});

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  firstName: z.string().min(1, "First name is required").max(100).trim(),
  lastName:  z.string().min(1, "Last name is required").max(100).trim(),
  role: z
    .enum(["surgeon", "hospital_safety_officer", "it_procurement", "org_admin"])
    .default("surgeon"),
  /**
   * UUID token from an organisation invitation email.
   * When present, the role and tenantId are taken from the invitation row
   * rather than from the request body and the auto-created personal tenant
   * path is skipped.
   */
  inviteToken:    z.string().uuid("inviteToken must be a UUID").optional(),
  /** Legacy field — kept for backwards compatibility; inviteToken supersedes this */
  inviteTenantId: z.string().uuid().optional(),
});

// ── Route plugin ──────────────────────────────────────────────────────────────

export const authRoutes: FastifyPluginAsync = async (fastify) => {

  // ── POST /auth/webhook/user-created ─────────────────────────────────────────
  // Called by Auth0 post-registration Action. Provisions the user in our DB
  // as a backup to the client-facing /register endpoint.
  fastify.post(
    "/webhook/user-created",
    async (request, reply) => {
      const webhookSecret = request.headers["x-webhook-secret"];
      if (webhookSecret !== process.env.AUTH0_WEBHOOK_SECRET) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      const payload = auth0WebhookSchema.parse(request.body);
      const { user_id, email, app_metadata } = payload.event.data.object;

      await fastify.db.user.upsert({
        where:  { auth0UserId: user_id },
        update: { lastLoginAt: new Date() },
        create: {
          auth0UserId:     user_id,
          email,
          fullName:        email.split("@")[0],
          role:            app_metadata?.role ?? "surgeon",
          tenantId:        app_metadata?.tenant_id ?? process.env.DEFAULT_TENANT_ID!,
          verificationTier: 0,
        },
      });

      return reply.code(204).send();
    }
  );

  // ── POST /auth/register ──────────────────────────────────────────────────────
  // Client-facing registration endpoint.
  // 1. Validates input
  // 2. Creates user in Auth0 (username/password connection)
  // 3. Auto-provisions a personal tenant (or links to invite tenant)
  // 4. Creates user record in our DB at tier 0
  // 5. Generates signed verification token
  // 6. Creates Auth0 email-verification ticket with our callback as result_url
  // 7. Returns { userId, message, verificationUrl }
  fastify.post("/register", {
    // Tighter per-route limit: 5 registration attempts per IP per minute.
    // Overrides the global 100 req/min default for this sensitive endpoint.
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    let body: z.infer<typeof registerSchema>;
    try {
      body = registerSchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({
          message: "Validation failed",
          errors:  err.errors.map(e => ({ field: e.path.join("."), message: e.message })),
        });
      }
      throw err;
    }

    // ── 1. Create user in Auth0 ────────────────────────────────────────────────
    let auth0User: Awaited<ReturnType<typeof createAuth0User>>;
    try {
      auth0User = await createAuth0User({
        email:     body.email,
        password:  body.password,
        firstName: body.firstName,
        lastName:  body.lastName,
        role:      body.role,
      });
    } catch (err: unknown) {
      const e = err as { code?: string; statusCode?: number; message?: string };
      if (e.code === "EMAIL_EXISTS") {
        return reply.code(409).send({ message: e.message });
      }
      if (e.code === "PASSWORD_POLICY") {
        return reply.code(422).send({ message: e.message });
      }
      // Auth0 unreachable in dev (no real credentials) — fall through to DB-only registration
      fastify.log.warn(
        { err },
        "Auth0 registration unavailable; continuing with DB-only user creation"
      );
      // Synthesise a placeholder auth0UserId for dev mode
      auth0User = {
        user_id:        `dev|${Date.now()}`,
        email:          body.email,
        email_verified: false,
        name:           `${body.firstName} ${body.lastName}`,
      };
    }

    // ── 2. Resolve or create tenant ────────────────────────────────────────────
    let tenantId: string;
    let resolvedRole = body.role;

    // ── 2a. Org invite path — inviteToken supersedes inviteTenantId ────────────
    if (body.inviteToken) {
      const now = new Date();
      const invitation = await fastify.db.invitation.findUnique({
        where:  { token: body.inviteToken },
        select: {
          id:         true,
          tenantId:   true,
          email:      true,
          role:       true,
          expiresAt:  true,
          acceptedAt: true,
          revokedAt:  true,
          tenant:     { select: { id: true, isActive: true } },
        },
      });

      if (!invitation) {
        return reply.code(400).send({ message: "Invitation not found. The link may have expired or been revoked.", code: "INVALID_INVITE_TOKEN" });
      }
      if (invitation.acceptedAt) {
        return reply.code(409).send({ message: "This invitation has already been accepted.", code: "INVITATION_ACCEPTED" });
      }
      if (invitation.revokedAt) {
        return reply.code(400).send({ message: "This invitation has been revoked.", code: "INVITATION_REVOKED" });
      }
      if (invitation.expiresAt < now) {
        return reply.code(400).send({ message: "This invitation has expired. Please ask an admin to re-invite you.", code: "INVITATION_EXPIRED" });
      }
      if (!invitation.tenant.isActive) {
        return reply.code(400).send({ message: "The organisation associated with this invitation is no longer active.", code: "TENANT_INACTIVE" });
      }
      // Email in the registration body must match the invitation email
      if (invitation.email !== body.email.toLowerCase()) {
        return reply.code(400).send({
          message: `This invitation was sent to ${invitation.email}. Please register with that email address.`,
          code:    "EMAIL_MISMATCH",
        });
      }

      tenantId     = invitation.tenantId;
      // invitation.role is stored as a plain string in Prisma; we trust the
      // DB value (written by the invite endpoint which validates the enum) and
      // cast to the schema union type here.
      resolvedRole = invitation.role as z.infer<typeof registerSchema>["role"];

    } else if (body.inviteTenantId) {
      // Legacy invite-tenant path (kept for backwards compat) — verify the tenant exists
      const tenant = await fastify.db.tenant.findUnique({
        where:  { id: body.inviteTenantId },
        select: { id: true, isActive: true },
      });
      if (!tenant?.isActive) {
        return reply.code(404).send({ message: "Invitation tenant not found or inactive." });
      }
      tenantId = tenant.id;
    } else {
      // Individual path — auto-create a personal tenant
      // Slug is derived from auth0UserId suffix to guarantee uniqueness
      const suffix = auth0User.user_id.replace(/^[^|]+\|/, "").slice(0, 10);
      const tenant = await fastify.db.tenant.create({
        data: {
          name:     `${body.firstName} ${body.lastName}`,
          slug:     `personal-${suffix}`,
          planTier: "individual",
          isActive: true,
          settings: {},
        },
        select: { id: true },
      });
      tenantId = tenant.id;
    }

    // ── 3. Provision user in DB at tier 0 ─────────────────────────────────────
    const user = await fastify.db.user.upsert({
      where: { auth0UserId: auth0User.user_id },
      create: {
        auth0UserId:     auth0User.user_id,
        tenantId,
        email:           body.email,
        fullName:        `${body.firstName} ${body.lastName}`,
        role:            resolvedRole,
        verificationTier: 0,
      },
      update: {}, // idempotent — no-op if already exists (e.g. webhook beat us)
      select: { id: true, email: true, tenantId: true, role: true },
    });

    // ── 3a. Mark invitation accepted + increment tenant seat counter ───────────
    if (body.inviteToken) {
      const now = new Date();
      await fastify.db.$transaction([
        fastify.db.invitation.update({
          where: { token: body.inviteToken },
          data:  { acceptedAt: now },
        }),
        fastify.db.tenant.update({
          where: { id: tenantId },
          data:  { activeUserCount: { increment: 1 } },
        }),
      ]);
    }

    // ── 4. Build signed verification token ────────────────────────────────────
    const secret = process.env.AUTH0_SECRET ?? "dev-secret-change-in-production";
    const verificationToken = signVerificationToken(
      { auth0UserId: auth0User.user_id, userId: user.id },
      secret,
      86_400 // 24 h
    );

    // ── 5. Create Auth0 email-verification ticket ──────────────────────────────
    const apiBase  = process.env.API_BASE_URL ?? "http://localhost:8080";
    const resultUrl = `${apiBase}/auth/verify-email?token=${verificationToken}`;

    let verificationUrl: string = resultUrl; // dev fallback

    try {
      verificationUrl = await createEmailVerificationTicket(
        auth0User.user_id,
        resultUrl,
        86_400
      );
    } catch (ticketErr) {
      // In dev, Auth0 credentials may not be configured — fall back to our direct token URL.
      // The GET /auth/verify-email endpoint handles both paths.
      fastify.log.warn(
        { err: ticketErr },
        "Could not create Auth0 verification ticket — using direct token URL (dev fallback)"
      );
    }

    // ── 6. Audit log (unauthenticated context — actorOverride supplies actor data) ──
    await fastify.audit(request, {
      action:       "user.registered",
      resourceType: "user",
      resourceId:   user.id,
      newValues:    { email: body.email, role: body.role, verificationTier: 0 },
      actorOverride: {
        userId:    user.id,
        tenantId:  user.tenantId,
        userEmail: user.email,
        userRole:  user.role,
      },
    });

    return reply.code(201).send({
      userId:  user.id,
      message: "Account created. A verification email has been sent — please click the link to activate your account.",
      // dev/test ONLY — NEVER set EXPOSE_VERIFICATION_URL=true on staging or production
      ...(process.env.EXPOSE_VERIFICATION_URL === "true" && { verificationUrl }),
    });
  });

  // ── GET /auth/verify-email?token=<jwt> ───────────────────────────────────────
  // Email verification callback — called when the user clicks the link in the
  // verification email (Auth0 ticket → our result_url, or dev direct URL).
  //
  // Flow:
  //   1. Verify our HS256 JWT to extract auth0UserId + userId
  //   2. In production, confirm Auth0 has email_verified = true via Management API
  //   3. Update user: verificationTier = 1, emailVerifiedAt = now()
  //   4. Redirect to frontend onboarding step 2
  fastify.get("/verify-email", {
    // Allow up to 10 verification attempts per IP per minute.
    // Slightly looser than /register since the token itself is the credential.
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const querySchema = z.object({
      token: z.string().min(1, "Missing verification token"),
    });

    let token: string;
    try {
      ({ token } = querySchema.parse(request.query));
    } catch {
      return reply.code(400).send({ message: "Missing or invalid token parameter" });
    }

    // ── Step 1: Verify our signed token ────────────────────────────────────────
    const secret = process.env.AUTH0_SECRET ?? "dev-secret-change-in-production";
    let payload: ReturnType<typeof verifyVerificationToken>;
    try {
      payload = verifyVerificationToken(token, secret);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Token verification failed";
      return reply.code(400).send({ message: msg });
    }

    // ── Step 2: Confirm email is verified in Auth0 (production only) ───────────
    const isDev = !process.env.AUTH0_DOMAIN;
    if (!isDev) {
      let auth0User: Awaited<ReturnType<typeof getAuth0User>>;
      try {
        auth0User = await getAuth0User(payload.auth0UserId);
      } catch {
        return reply.code(502).send({
          message: "Could not confirm verification status with Auth0. Please try again.",
        });
      }

      if (!auth0User.email_verified) {
        return reply.code(400).send({
          message:
            "Your email address has not yet been verified in Auth0. " +
            "Please click the link in the verification email first.",
        });
      }
    }

    // ── Step 3: Update user in our DB ──────────────────────────────────────────
    // Guard: if user is already tier 1+, this is a harmless re-verification
    const existingUser = await fastify.db.user.findUnique({
      where:  { id: payload.userId },
      select: { id: true, verificationTier: true, email: true, tenantId: true, role: true },
    });

    if (!existingUser) {
      return reply.code(404).send({ message: "User not found." });
    }

    if (existingUser.verificationTier < 1) {
      await fastify.db.user.update({
        where: { id: payload.userId },
        data:  { verificationTier: 1, emailVerifiedAt: new Date() },
      });
    }

    // ── Step 4: Audit ──────────────────────────────────────────────────────────
    await fastify.audit(request, {
      action:       "user.email_verified",
      resourceType: "user",
      resourceId:   existingUser.id,
      newValues:    { verificationTier: 1, emailVerifiedAt: new Date().toISOString() },
      actorOverride: {
        userId:    existingUser.id,
        tenantId:  existingUser.tenantId,
        userEmail: existingUser.email,
        userRole:  existingUser.role,
      },
    });

    // ── Step 5: Redirect to onboarding ─────────────────────────────────────────
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    return reply.redirect(`${appUrl}/onboarding?step=2&verified=true`);
  });

  // ── POST /auth/submit-npi ────────────────────────────────────────────────────
  // Authenticated — requires tier 1 (email verified).
  //
  // Flow:
  //   1. Authenticate via JWT (explicit — this route lives in the public authRoutes plugin)
  //   2. Guard: user must be tier 1+ and not already tier 2+
  //   3. Validate NPI format (10 digits)
  //   4. NPPES registry lookup — confirm NPI exists
  //   5. Optional specialty cross-check: warn if taxonomy doesn't match, don't block (MVP)
  //   6. Promote user to tier 2 in DB, stamp timestamps
  //   7. Upsert reputation record, write audit log
  //   8. Return { message, npiNumber, npiName, verificationTier }
  //
  // NOTE: No subscription gate applies here — NPI submission is part of the
  //       pre-subscription onboarding path. Only authenticated, email-verified
  //       users can reach this step.
  fastify.post("/submit-npi", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    // ── Step 1: Authenticate ────────────────────────────────────────────────────
    // authRoutes has no global authenticate hook — call explicitly here.
    await fastify.authenticate(request);

    // ── Step 2: Validate request body ──────────────────────────────────────────
    let body: z.infer<typeof submitNpiSchema>;
    try {
      body = submitNpiSchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({
          message: "Validation failed",
          errors:  err.errors.map(e => ({ field: e.path.join("."), message: e.message })),
        });
      }
      throw err;
    }

    // ── Step 3: Tier guard ─────────────────────────────────────────────────────
    // Use the JWT claim for a fast check (avoids a DB round-trip on obvious failures).
    if (request.user.verificationTier < 1) {
      return reply.code(403).send({
        message:
          "Email verification required before NPI submission. " +
          "Please verify your email first.",
      });
    }

    // ── Step 4: Load user from DB (authoritative tier + specialty) ──────────────
    const dbUser = await fastify.db.user.findUnique({
      where:  { auth0UserId: request.user.sub },
      select: {
        id:               true,
        tenantId:         true,
        email:            true,
        role:             true,
        verificationTier: true,
        specialty:        true,
      },
    });

    if (!dbUser) return reply.code(404).send({ message: "User not found." });

    // Re-check against DB tier (more authoritative than the JWT claim which
    // is only refreshed on next login)
    if (dbUser.verificationTier >= 2) {
      return reply.code(409).send({
        message: "NPI already verified. Contact admin for tier-3 promotion.",
      });
    }

    // ── Steps 5-8: NPI lookup, specialty cross-check, DB promotion, audit ──────
    // Delegated to the shared NPI verification service for consistency with
    // PATCH /users/me/verification — both paths now produce identical audit
    // entries (action: "user.npi.verified") and identical DB state.
    let result: NpiVerificationResult;
    try {
      result = await promoteUserToNpiVerified({
        db:    fastify.db,
        log:   fastify.log,
        audit: (entry) => fastify.audit(request, entry),
        user:  {
          id:        dbUser.id,
          tenantId:  dbUser.tenantId,
          email:     dbUser.email,
          role:      dbUser.role,
          specialty: dbUser.specialty,
        },
        npiNumber: body.npiNumber,
      });
    } catch (err) {
      if (err instanceof NpiNotFoundError) {
        return reply.code(422).send({
          message: `${err.message}. Verify the number and try again.`,
        });
      }
      throw err;
    }

    return reply.code(200).send({
      message:          "NPI verified. You can now subscribe.",
      npiNumber:        result.npiNumber,
      npiName:          result.npiName,
      verificationTier: result.verificationTier,
    });
  });

  // ── GET /auth/accept-invite?token=<uuid> ──────────────────────────────────────
  // Public endpoint — no authentication required.
  //
  // Validates the invite token before the user reaches the registration form:
  //   1. Token exists, not expired, not revoked, not already accepted
  //   2. Redirect to frontend register page with the token embedded in the URL
  //
  // This prevents users from landing on a broken registration form (e.g. after
  // an invitation has been revoked or expired). It also lets the frontend
  // pre-fill the invited email address via a follow-up lookup if desired.
  //
  // The token itself is validated again inside POST /auth/register — this
  // endpoint is an early-exit guard only, not the authoritative check.
  fastify.get("/accept-invite", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const querySchema = z.object({
      token: z.string().uuid("Token must be a UUID"),
    });

    let token: string;
    try {
      ({ token } = querySchema.parse(request.query));
    } catch {
      return reply.code(400).send({ message: "Missing or invalid invite token." });
    }

    const now        = new Date();
    const invitation = await fastify.db.invitation.findUnique({
      where:  { token },
      select: {
        id:         true,
        email:      true,
        expiresAt:  true,
        acceptedAt: true,
        revokedAt:  true,
        tenant:     { select: { isActive: true } },
      },
    });

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    if (!invitation) {
      return reply.redirect(`${appUrl}/register?invite_error=not_found`);
    }
    if (invitation.acceptedAt) {
      return reply.redirect(`${appUrl}/register?invite_error=already_accepted`);
    }
    if (invitation.revokedAt) {
      return reply.redirect(`${appUrl}/register?invite_error=revoked`);
    }
    if (invitation.expiresAt < now) {
      return reply.redirect(`${appUrl}/register?invite_error=expired`);
    }
    if (!invitation.tenant.isActive) {
      return reply.redirect(`${appUrl}/register?invite_error=tenant_inactive`);
    }

    // Token is valid — redirect to the registration page with the token.
    // The frontend should read `?invite=<token>` and pass it to POST /auth/register.
    return reply.redirect(`${appUrl}/register?invite=${token}`);
  });
};
