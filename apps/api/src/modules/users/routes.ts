/**
 * User / profile routes:
 *   GET    /users/me              — own profile + reputation
 *   PATCH  /users/me/verification — submit NPI for tier-2 verification
 *   PATCH  /admin/users/:id/tier  — admin: set any user's verification tier
 */
import type { FastifyPluginAsync } from "fastify";
import {
  requestNpiVerificationSchema,
  adminSetVerificationTierSchema,
} from "@logiqo/shared";

/**
 * Validate NPI number against the US NPPES public registry.
 * Returns the name from the registry if valid, null if not found.
 *
 * NPPES NPI Registry API — no key required, rate-limit 1 req/s.
 */
async function lookupNpi(npi: string): Promise<{ valid: boolean; name?: string }> {
  try {
    const url = `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`;
    const res  = await fetch(url, {
      headers: { "User-Agent": "LogiQo-MedTech/1.0 (contact@logiqo.io)" },
      signal:  AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { valid: false };
    const data = await res.json() as any;
    if (!data.results?.length) return { valid: false };
    const result = data.results[0];
    // NPPES field priority (v2.1 API):
    //   1. basic.last_name / basic.first_name      — individual providers (most common)
    //   2. authorized_official_{last,first}_name   — org's authorised official (fallback)
    //   3. organization_name                       — organisation name
    //   4. "Unknown"                               — last resort
    const name = result.basic?.last_name
      ? `${result.basic.first_name ?? ""} ${result.basic.last_name}`.trim()
      : result.basic?.authorized_official_last_name
        ? `${result.basic.authorized_official_first_name ?? ""} ${result.basic.authorized_official_last_name}`.trim()
        : result.basic?.organization_name
          ?? "Unknown";
    return { valid: true, name };
  } catch {
    return { valid: false };
  }
}

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // ── GET /users/me ────────────────────────────────────────────────────────────
  fastify.get("/me", async (request, reply) => {
    const user = await fastify.db.user.findUnique({
      where:   { auth0UserId: request.user.sub },
      select: {
        id:               true,
        tenantId:         true,
        email:            true,
        fullName:         true,
        role:             true,
        specialty:        true,
        npiNumber:        true,
        verificationTier: true,
        isActive:         true,
        lastLoginAt:      true,
        createdAt:        true,
        userReputation:   true,
      },
    });
    if (!user) return reply.code(404).send({ message: "User not found" });
    return user;
  });

  // ── PATCH /users/me/verification — submit NPI ─────────────────────────────────
  fastify.patch("/me/verification", async (request, reply) => {
    const user = await fastify.db.user.findUnique({
      where:  { auth0UserId: request.user.sub },
      select: { id: true, verificationTier: true, email: true },
    });
    if (!user) return reply.code(404).send({ message: "User not found" });

    if (user.verificationTier >= 2) {
      return reply.code(409).send({
        message: "Already tier 2+ verified. Contact admin for tier-3 promotion.",
      });
    }

    const { npiNumber } = requestNpiVerificationSchema.parse(request.body);

    // Validate against NPPES registry
    const lookup = await lookupNpi(npiNumber);
    if (!lookup.valid) {
      return reply.code(422).send({
        message: `NPI ${npiNumber} not found in NPPES registry. Verify the number and try again.`,
      });
    }

    const updated = await fastify.db.user.update({
      where:  { id: user.id },
      data:   {
        npiNumber,
        verificationTier:         2,
        verificationSubmittedAt:  new Date(),
        verificationApprovedAt:   new Date(),
      },
      select: { id: true, verificationTier: true, npiNumber: true },
    });

    // Initialise reputation record if missing
    await fastify.db.userReputation.upsert({
      where:  { userId: user.id },
      create: { userId: user.id, totalScore: 0, weeklyScore: 0, monthlyScore: 0 },
      update: {},
    });

    await fastify.audit(request, {
      action:       "user.verification.tier2",
      resourceType: "user",
      resourceId:   user.id,
      newValues:    { verificationTier: 2, npiNumber },
    });

    return { message: "NPI verified. You are now a tier-2 contributor.", ...updated };
  });
};

// ── Admin tier management ─────────────────────────────────────────────────────

export const adminUserRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook(
    "preHandler",
    fastify.requireRole("system_admin"),
  );

  // PATCH /admin/users/:id/tier
  fastify.patch<{ Params: { id: string } }>(
    "/users/:id/tier",
    async (request, reply) => {
      const { tier, reason } = adminSetVerificationTierSchema.parse(request.body);
      const targetId         = request.params.id;

      const target = await fastify.db.user.findUnique({
        where:  { id: targetId },
        select: { id: true, verificationTier: true, fullName: true },
      });
      if (!target) return reply.code(404).send({ message: "User not found" });

      const updated = await fastify.db.user.update({
        where:  { id: targetId },
        data:   {
          verificationTier:       tier,
          // Stamp approval timestamp whenever an admin promotes to tier 2+
          ...(tier >= 2 ? { verificationApprovedAt: new Date() } : {}),
        },
        select: { id: true, verificationTier: true, fullName: true, email: true },
      });

      await fastify.audit(request, {
        action:       "admin.user.tier.updated",
        resourceType: "user",
        resourceId:   targetId,
        oldValues:    { verificationTier: target.verificationTier },
        newValues:    { verificationTier: tier, reason },
      });

      return updated;
    },
  );

  // GET /admin/users — list users with tier + reputation for verification queue
  fastify.get("/users", async (request) => {
    const query = request.query as { tier?: string; page?: string; limit?: string };
    const page  = Math.max(1, parseInt(query.page  ?? "1", 10));
    const limit = Math.min(50, parseInt(query.limit ?? "20", 10));

    const where: any = {};
    if (query.tier !== undefined) where.verificationTier = parseInt(query.tier, 10);

    const [users, total] = await Promise.all([
      fastify.db.user.findMany({
        where,
        select: {
          id:               true,
          tenantId:         true,
          email:            true,
          fullName:         true,
          role:             true,
          specialty:        true,
          npiNumber:        true,
          verificationTier: true,
          isActive:         true,
          createdAt:        true,
          userReputation:   { select: { totalScore: true, weeklyScore: true } },
        },
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      fastify.db.user.count({ where }),
    ]);

    return { data: users, total, page, limit };
  });
};
