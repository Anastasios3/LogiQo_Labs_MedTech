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
import {
  promoteUserToNpiVerified,
  NpiNotFoundError,
  type NpiVerificationResult,
} from "../../services/npi-service.js";

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
      // Include tenantId, role, specialty so the NPI service can run the
      // specialty cross-check and write a complete audit entry.
      select: {
        id:               true,
        tenantId:         true,
        email:            true,
        role:             true,
        verificationTier: true,
        specialty:        true,
      },
    });
    if (!user) return reply.code(404).send({ message: "User not found" });

    if (user.verificationTier >= 2) {
      return reply.code(409).send({
        message: "Already tier 2+ verified. Contact admin for tier-3 promotion.",
      });
    }

    const { npiNumber } = requestNpiVerificationSchema.parse(request.body);

    // NPI lookup, specialty cross-check, DB promotion, reputation upsert,
    // and audit are all delegated to the shared service so this path and
    // POST /auth/submit-npi produce identical audit entries and DB state.
    let result: NpiVerificationResult;
    try {
      result = await promoteUserToNpiVerified({
        db:    fastify.db,
        log:   fastify.log,
        audit: (entry) => fastify.audit(request, entry),
        user:  {
          id:        user.id,
          tenantId:  user.tenantId,
          email:     user.email,
          role:      user.role,
          specialty: user.specialty,
        },
        npiNumber,
      });
    } catch (err) {
      if (err instanceof NpiNotFoundError) {
        return reply.code(422).send({
          message: `${err.message}. Verify the number and try again.`,
        });
      }
      throw err;
    }

    return reply.send({
      message:          "NPI verified. You are now a tier-2 contributor.",
      id:               user.id,
      npiNumber:        result.npiNumber,
      npiName:          result.npiName,
      verificationTier: result.verificationTier,
    });
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
