/**
 * Organization management routes (org_admin + system_admin only):
 *
 *   POST   /organizations/invite                — Invite a user to the tenant
 *   GET    /organizations/invitations           — List pending invitations
 *   DELETE /organizations/invitations/:id       — Revoke an invitation
 *   GET    /organizations/users                 — List active users in the tenant
 *   PATCH  /organizations/users/:id/role        — Change a user's role
 *   DELETE /organizations/users/:id             — Soft-delete a user (sets deletedAt)
 *
 * All routes are registered inside the protected scope (authenticate +
 * checkSubscription already run). Role enforcement is done inline.
 *
 * Invite flow:
 *   1. POST /organizations/invite → DB upsert + email with token link
 *   2. User clicks link → frontend /register?invite=<token>
 *   3. GET /auth/accept-invite?token=<token> → validates, redirects to /register
 *   4. POST /auth/register { inviteToken } → provisions user, marks acceptedAt,
 *      increments activeUserCount on tenant
 *
 * Seat-limit enforcement (capacity model):
 *   effectiveSeatCount = activeUserCount + pendingInvitationCount
 *   where pendingInvitationCount excludes the target email when re-inviting
 *   (a refresh does not consume an additional seat).
 *
 *   The capacity check lives inside a $transaction under SELECT … FOR UPDATE
 *   so that concurrent invite requests cannot both read activeUserCount < maxUsers
 *   and both pass the check simultaneously.
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sendEmail, inviteEmailHtml } from "../../lib/mailer.js";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  /**
   * .toLowerCase() normalises the email before the UNIQUE(tenant_id, email)
   * constraint is evaluated, preventing case-variant duplicates
   * (e.g. User@Example.com vs user@example.com hitting the same logical slot).
   */
  email: z.string().email("Invalid email format").toLowerCase(),
  role:  z.enum(
    ["surgeon", "hospital_safety_officer", "it_procurement", "org_admin"],
    { errorMap: () => ({ message: "Role must be one of: surgeon, hospital_safety_officer, it_procurement, org_admin" }) }
  ),
});

const patchRoleSchema = z.object({
  role: z.enum(
    ["surgeon", "hospital_safety_officer", "it_procurement", "org_admin"],
    { errorMap: () => ({ message: "Role must be one of: surgeon, hospital_safety_officer, it_procurement, org_admin" }) }
  ),
});

// ── Sentinel errors thrown inside transactions and caught outside ─────────────
// Using plain Error + extra properties so Prisma transparently re-throws them
// from the transaction boundary (Prisma wraps unknown errors on rollback).

interface TxError extends Error {
  txCode:             "TENANT_NOT_FOUND" | "SEAT_LIMIT_REACHED" | "INVITATION_ACCEPTED";
  maxUsers?:          number;
  activeUserCount?:   number;
  pendingInvitations?: number;
}

function txError(
  txCode:  TxError["txCode"],
  message: string,
  extra?:  Omit<TxError, keyof Error | "txCode">,
): TxError {
  return Object.assign(new Error(message), { txCode, ...extra }) as TxError;
}

function isTxError(err: unknown): err is TxError {
  return err instanceof Error && "txCode" in err;
}

// ── Route plugin ──────────────────────────────────────────────────────────────

export const organizationsRoutes: FastifyPluginAsync = async (fastify) => {

  // Shared role guard: only org_admin or system_admin may manage users
  function requireOrgAdmin(role: string): boolean {
    return role === "org_admin" || role === "system_admin";
  }

  // ── POST /organizations/invite ────────────────────────────────────────────────
  // Creates or refreshes an invitation for an email address within the tenant.
  // Re-inviting an existing email resets the token and expiry (so the old link
  // is invalidated). A 409 is returned if the email is already an active member.
  //
  // Capacity check rationale:
  //   We lock the tenant row (FOR UPDATE) and count pending invitations inside
  //   the same transaction so that:
  //   (a) Two concurrent requests cannot both read stale capacity and both pass.
  //   (b) Pending invitations consume virtual seat slots so that accepting all
  //       outstanding invitations cannot exceed maxUsers.
  //   Re-invites exclude the target email from the pending count because a
  //   refresh replaces the existing row rather than adding a new seat.
  fastify.post("/invite", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (request, reply) => {

    if (!requireOrgAdmin(request.user.role)) {
      return reply.code(403).send({ message: "Only org_admin or system_admin can send invitations." });
    }

    // ── Validate body ────────────────────────────────────────────────────────────
    let body: z.infer<typeof inviteSchema>;
    try {
      body = inviteSchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({
          message: "Validation failed",
          errors:  err.errors.map(e => ({ field: e.path.join("."), message: e.message })),
        });
      }
      throw err;
    }

    const tenantId = request.user.tenantId;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000); // 7 days

    // ── 1. Load the inviting user ────────────────────────────────────────────────
    // Tenant capacity and name are read inside the transaction under a lock.
    const dbUser = await fastify.db.user.findUnique({
      where:  { auth0UserId: request.user.sub },
      select: { id: true, fullName: true },
    });
    if (!dbUser) return reply.code(404).send({ message: "Requesting user not found." });

    // ── 2. Check if the email is already an active member ────────────────────────
    // Done outside the transaction: this is a read-only guard that cannot create
    // capacity drift (membership only changes via user-removal or register).
    const existingUser = await fastify.db.user.findFirst({
      where: { tenantId, email: body.email, deletedAt: null },
      select: { id: true },
    });
    if (existingUser) {
      return reply.code(409).send({
        message: `${body.email} is already an active member of this organisation.`,
        code:    "ALREADY_MEMBER",
      });
    }

    // ── 3. Transaction: lock tenant → capacity check → upsert ────────────────────
    type TxResult = {
      invitation: { id: string; token: string };
      tenantName: string;
    };

    let txResult: TxResult;
    try {
      txResult = await fastify.db.$transaction(async (tx) => {
        // Lock the tenant row for the duration of this transaction.
        // Concurrent invite requests will queue here; each will observe the
        // pending-invitation count as it stands after all previous transactions
        // have committed, preventing silent over-provisioning.
        const tenantRows = await tx.$queryRaw<{
          max_users: number;
          active_user_count: number;
          name: string;
        }[]>`
          SELECT max_users, active_user_count, name
          FROM tenants
          WHERE id = ${tenantId}::uuid
          FOR UPDATE
        `;

        const tenantRow = tenantRows[0];
        if (!tenantRow) {
          throw txError("TENANT_NOT_FOUND", "Tenant not found.");
        }

        // Count pending invitations for this tenant, excluding the target email.
        // Excluding the target email ensures that a re-invite (which refreshes
        // the existing row rather than adding a row) does not double-count the
        // seat that the original invitation was already reserving.
        const pendingRows = await tx.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) AS count
          FROM invitations
          WHERE tenant_id  = ${tenantId}::uuid
            AND accepted_at IS NULL
            AND revoked_at  IS NULL
            AND expires_at  > now()
            AND email       != ${body.email}
        `;
        const pending = Number(pendingRows[0]?.count ?? 0);

        // Effective seat usage = confirmed active users + pending virtual reservations
        const effectiveCount = tenantRow.active_user_count + pending;
        if (effectiveCount >= tenantRow.max_users) {
          throw txError("SEAT_LIMIT_REACHED", "SEAT_LIMIT_REACHED", {
            maxUsers:          tenantRow.max_users,
            activeUserCount:   tenantRow.active_user_count,
            pendingInvitations: pending,
          });
        }

        // Upsert invitation — find + (update | create) to rotate the token.
        // Prisma does not support calling gen_random_uuid() in update data, so
        // we use a raw UPDATE … RETURNING for the refresh case.
        const existing = await tx.invitation.findUnique({
          where:  { tenantId_email: { tenantId, email: body.email } },
          select: { id: true, acceptedAt: true },
        });

        if (existing?.acceptedAt) {
          // acceptedAt is set but the user row was not found above — rare race
          // between acceptance and this invite request. Surface as a 409.
          throw txError("INVITATION_ACCEPTED", "This invitation has already been accepted.");
        }

        if (existing) {
          // Refresh: rotate token + reset expiry + clear any prior revocation.
          const updated = await tx.$queryRaw<{ id: string; token: string }[]>`
            UPDATE invitations
            SET
              token         = gen_random_uuid(),
              role          = ${body.role},
              expires_at    = ${expiresAt},
              revoked_at    = NULL,
              invited_by_id = ${dbUser.id}::uuid
            WHERE id = ${existing.id}::uuid
            RETURNING id, token::text
          `;
          return { invitation: updated[0], tenantName: tenantRow.name };
        }

        // Create new invitation row.
        const created = await tx.invitation.create({
          data: {
            tenantId,
            invitedById: dbUser.id,
            email:       body.email,
            role:        body.role,
            expiresAt,
          },
          select: { id: true, token: true },
        });
        return { invitation: created, tenantName: tenantRow.name };
      });

    } catch (err: unknown) {
      if (isTxError(err)) {
        if (err.txCode === "SEAT_LIMIT_REACHED") {
          const msg =
            `Seat limit reached. Your plan allows ${err.maxUsers} seats. ` +
            `${err.activeUserCount} are currently active and ${err.pendingInvitations} ` +
            `seat${err.pendingInvitations === 1 ? " is" : "s are"} reserved for pending invitations. ` +
            `Upgrade your plan or remove a member to free a seat.`;
          return reply.code(422).send({
            message:           msg,
            code:              "SEAT_LIMIT_REACHED",
            maxUsers:          err.maxUsers,
            activeUserCount:   err.activeUserCount,
            pendingInvitations: err.pendingInvitations,
          });
        }
        if (err.txCode === "INVITATION_ACCEPTED") {
          return reply.code(409).send({ message: err.message, code: "INVITATION_ACCEPTED" });
        }
        if (err.txCode === "TENANT_NOT_FOUND") {
          return reply.code(404).send({ message: err.message });
        }
      }
      throw err; // unexpected — let Fastify's error handler surface it
    }

    const { invitation, tenantName } = txResult;

    // ── 4. Send invitation email ─────────────────────────────────────────────────
    const appUrl    = process.env.APP_URL ?? "http://localhost:3000";
    const acceptUrl = `${appUrl}/register?invite=${invitation.token}`;

    const emailResult = await sendEmail(
      {
        to:      body.email,
        subject: `You've been invited to join ${tenantName} on LogiQo`,
        html:    inviteEmailHtml({
          inviterName: dbUser.fullName,
          tenantName,
          role:        body.role,
          acceptUrl,
          expiresAt,
        }),
      },
      fastify.log
    );

    if (!emailResult.ok) {
      // Email failure is non-fatal — the admin can re-send. Log the error but
      // return the invitationId so the admin knows the DB record was created.
      fastify.log.error(
        { email: body.email, error: emailResult.error },
        "[invite] Failed to send invitation email — invitation created but not delivered"
      );
    }

    // ── 5. Audit ─────────────────────────────────────────────────────────────────
    await fastify.audit(request, {
      action:       "org.invitation.sent",
      resourceType: "invitation",
      resourceId:   invitation.id,
      newValues:    { email: body.email, role: body.role, expiresAt: expiresAt.toISOString() },
    });

    return reply.code(201).send({
      invitationId: invitation.id,
      email:        body.email,
      role:         body.role,
      expiresAt:    expiresAt.toISOString(),
      emailSent:    emailResult.ok,
    });
  });

  // ── GET /organizations/invitations ────────────────────────────────────────────
  // Returns pending (not accepted, not revoked, not expired) invitations.
  fastify.get("/invitations", async (request, reply) => {
    if (!requireOrgAdmin(request.user.role)) {
      return reply.code(403).send({ message: "Only org_admin or system_admin can view invitations." });
    }

    const tenantId = request.user.tenantId;
    const now      = new Date();

    const invitations = await fastify.db.invitation.findMany({
      where: {
        tenantId,
        acceptedAt: null,
        revokedAt:  null,
        expiresAt:  { gt: now },
      },
      select: {
        id:        true,
        email:     true,
        role:      true,
        expiresAt: true,
        createdAt: true,
        invitedBy: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.code(200).send({ data: invitations, total: invitations.length });
  });

  // ── DELETE /organizations/invitations/:id ─────────────────────────────────────
  // Revokes a pending invitation — the link in the email becomes invalid.
  fastify.delete("/invitations/:id", async (request, reply) => {
    if (!requireOrgAdmin(request.user.role)) {
      return reply.code(403).send({ message: "Only org_admin or system_admin can revoke invitations." });
    }

    const { id } = request.params as { id: string };
    const tenantId = request.user.tenantId;

    const invitation = await fastify.db.invitation.findFirst({
      where:  { id, tenantId },
      select: { id: true, email: true, acceptedAt: true, revokedAt: true },
    });

    if (!invitation) {
      return reply.code(404).send({ message: "Invitation not found." });
    }
    if (invitation.acceptedAt) {
      return reply.code(409).send({ message: "This invitation has already been accepted and cannot be revoked." });
    }
    if (invitation.revokedAt) {
      return reply.code(409).send({ message: "This invitation is already revoked." });
    }

    await fastify.db.invitation.update({
      where: { id },
      data:  { revokedAt: new Date() },
    });

    await fastify.audit(request, {
      action:       "org.invitation.revoked",
      resourceType: "invitation",
      resourceId:   id,
      newValues:    { email: invitation.email, revokedAt: new Date().toISOString() },
    });

    return reply.code(200).send({ message: "Invitation revoked." });
  });

  // ── GET /organizations/users ──────────────────────────────────────────────────
  // Lists active (non-deleted) users in the tenant.
  fastify.get("/users", async (request, reply) => {
    if (!requireOrgAdmin(request.user.role)) {
      return reply.code(403).send({ message: "Only org_admin or system_admin can list organisation users." });
    }

    const querySchema = z.object({
      page:  z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    });

    let query: z.infer<typeof querySchema>;
    try {
      query = querySchema.parse(request.query);
    } catch {
      return reply.code(400).send({ message: "Invalid query parameters." });
    }

    const tenantId = request.user.tenantId;
    const skip     = (query.page - 1) * query.limit;

    const [users, total] = await Promise.all([
      fastify.db.user.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id:               true,
          email:            true,
          fullName:         true,
          role:             true,
          verificationTier: true,
          subscriptionStatus: true,
          isActive:         true,
          lastLoginAt:      true,
          createdAt:        true,
          userReputation:   { select: { totalScore: true } },
        },
        skip,
        take:    query.limit,
        orderBy: { createdAt: "desc" },
      }),
      fastify.db.user.count({ where: { tenantId, deletedAt: null } }),
    ]);

    return reply.code(200).send({ data: users, total, page: query.page, limit: query.limit });
  });

  // ── PATCH /organizations/users/:id/role ───────────────────────────────────────
  // Changes a user's role within the tenant.
  fastify.patch("/users/:id/role", async (request, reply) => {
    if (!requireOrgAdmin(request.user.role)) {
      return reply.code(403).send({ message: "Only org_admin or system_admin can change user roles." });
    }

    const { id } = request.params as { id: string };

    let body: z.infer<typeof patchRoleSchema>;
    try {
      body = patchRoleSchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({
          message: "Validation failed",
          errors:  err.errors.map(e => ({ field: e.path.join("."), message: e.message })),
        });
      }
      throw err;
    }

    const tenantId = request.user.tenantId;

    // Guard: cannot change own role (prevents accidental self-demotion)
    const requestingUser = await fastify.db.user.findUnique({
      where:  { auth0UserId: request.user.sub },
      select: { id: true },
    });
    if (requestingUser?.id === id && request.user.role !== "system_admin") {
      return reply.code(422).send({ message: "You cannot change your own role. Contact another org admin." });
    }

    const target = await fastify.db.user.findFirst({
      where:  { id, tenantId, deletedAt: null },
      select: { id: true, email: true, role: true },
    });

    if (!target) {
      return reply.code(404).send({ message: "User not found in this organisation." });
    }

    const updated = await fastify.db.user.update({
      where:  { id },
      data:   { role: body.role },
      select: { id: true, email: true, fullName: true, role: true },
    });

    await fastify.audit(request, {
      action:       "org.user.role_changed",
      resourceType: "user",
      resourceId:   id,
      oldValues:    { role: target.role },
      newValues:    { role: body.role },
    });

    return reply.code(200).send(updated);
  });

  // ── DELETE /organizations/users/:id ───────────────────────────────────────────
  // Soft-deletes a user: sets deletedAt + isActive=false, decrements
  // activeUserCount on the tenant. The user record is preserved for audit
  // trail integrity (hard deletes are never performed).
  //
  // Counter drift guard:
  //   GREATEST(0, active_user_count - 1) prevents the counter going negative
  //   if activeUserCount has drifted (e.g. a DB correction or a previous
  //   missed decrement from the concurrent-invite race window). A negative
  //   counter would permanently corrupt the capacity check for this tenant.
  fastify.delete("/users/:id", async (request, reply) => {
    if (!requireOrgAdmin(request.user.role)) {
      return reply.code(403).send({ message: "Only org_admin or system_admin can remove users." });
    }

    const { id } = request.params as { id: string };
    const tenantId = request.user.tenantId;

    // Guard: cannot remove yourself
    const requestingUser = await fastify.db.user.findUnique({
      where:  { auth0UserId: request.user.sub },
      select: { id: true },
    });
    if (requestingUser?.id === id) {
      return reply.code(422).send({ message: "You cannot remove yourself from the organisation." });
    }

    const target = await fastify.db.user.findFirst({
      where:  { id, tenantId, deletedAt: null },
      select: { id: true, email: true, role: true },
    });

    if (!target) {
      return reply.code(404).send({ message: "User not found in this organisation." });
    }

    // Soft-delete + floored decrement of the seat counter in one transaction.
    // Interactive form (callback) is required because $executeRaw cannot be
    // mixed with model operations inside the batch (array) transaction form.
    await fastify.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data:  { deletedAt: new Date(), isActive: false },
      });
      // GREATEST(0, …) floors the counter at zero so that any prior drift
      // cannot push activeUserCount negative and permanently block new invites.
      await tx.$executeRaw`
        UPDATE tenants
        SET active_user_count = GREATEST(0, active_user_count - 1)
        WHERE id = ${tenantId}::uuid
      `;
    });

    await fastify.audit(request, {
      action:       "org.user.removed",
      resourceType: "user",
      resourceId:   id,
      newValues:    { deletedAt: new Date().toISOString(), email: target.email },
    });

    return reply.code(200).send({ message: `${target.email} has been removed from the organisation.` });
  });
};
