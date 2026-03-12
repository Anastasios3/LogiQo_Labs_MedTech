/**
 * Peer Telemetry sub-routes:
 *   POST   /annotations/:id/votes        — cast or change vote
 *   DELETE /annotations/:id/votes        — remove own vote
 *   GET    /annotations/:id/comments     — list threaded comments
 *   POST   /annotations/:id/comments     — add comment
 *   POST   /annotations/:id/comments/:commentId/votes — vote on comment
 *   DELETE /annotations/:id/comments/:commentId/votes — remove comment vote
 *   POST   /annotations/:id/flags        — flag annotation
 *   PATCH  /annotations/:id/flags/:flagId — resolve flag (admin / safety officer)
 *   PUT    /annotations/:id/tags         — update tags (moderator+)
 */
import type { FastifyPluginAsync } from "fastify";
import {
  castAnnotationVoteSchema,
  createCommentSchema,
  castCommentVoteSchema,
  createFlagSchema,
  resolveFlagSchema,
  updateAnnotationTagsSchema,
} from "@logiqo/shared";

/** Static specialty → related-specialty map for relevance scoring */
const SPECIALTY_RELATIONS: Record<string, string[]> = {
  orthopedic_surgery:  ["sports_medicine", "physical_therapy", "trauma_surgery"],
  cardiology:          ["cardiac_surgery", "vascular_surgery", "critical_care"],
  neurology:           ["neurosurgery", "neuroradiology", "critical_care"],
  general_surgery:     ["colorectal_surgery", "bariatric_surgery", "trauma_surgery"],
  radiology:           ["interventional_radiology", "neuroradiology"],
  anesthesiology:      ["critical_care", "pain_management"],
};

/**
 * Compute specialtyRelevanceScore:
 *   1.5 — exact match with device category's specialty hint
 *   1.0 — in a related specialty group
 *   0.6 — unrelated
 */
function computeSpecialtyRelevance(
  voterSpecialty: string | null | undefined,
  deviceSpecialtyHint: string | null | undefined,
): number {
  if (!voterSpecialty || !deviceSpecialtyHint) return 0.6;
  const v = voterSpecialty.toLowerCase();
  const h = deviceSpecialtyHint.toLowerCase();
  if (v === h) return 1.5;
  const related = SPECIALTY_RELATIONS[h] ?? [];
  if (related.includes(v)) return 1.0;
  return 0.6;
}

/**
 * Compute tier multiplier for vote weight:
 *   0 → 0 (unverified — votes don't count)
 *   1 → 0 (domain verified — can flag but votes don't count)
 *   2 → 1.0
 *   3 → 1.5
 */
function tierMultiplier(tier: number): number {
  if (tier <= 1) return 0;
  if (tier === 2) return 1.0;
  return 1.5; // tier 3
}

/** Recompute annotation's voteScore and persist to UserReputation */
async function recalcAnnotationScore(
  db: any,
  annotationId: string,
): Promise<number> {
  const votes = await db.annotationVote.findMany({
    where: { annotationId },
    include: {
      user: { select: { verificationTier: true } },
    },
  });
  let score = 0;
  for (const v of votes) {
    score +=
      v.value *
      v.specialtyRelevanceScore *
      tierMultiplier(v.user.verificationTier);
  }
  return score;
}

export const telemetryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // ── Helper: resolve internal user from auth0 sub ────────────────────────────
  async function getUser(sub: string) {
    return fastify.db.user.findUnique({
      where:  { auth0UserId: sub },
      select: { id: true, verificationTier: true, specialty: true, tenantId: true },
    });
  }

  // ── Helper: resolve annotation + device category for relevance scoring ───────
  async function getAnnotationWithCategory(annotationId: string) {
    return fastify.db.annotation.findUnique({
      where: { id: annotationId },
      include: {
        device: {
          include: { category: { select: { specialtyHint: true } } },
        },
      },
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ANNOTATION VOTES
  // ════════════════════════════════════════════════════════════════════════════

  // POST /annotations/:id/votes — cast or update vote
  fastify.post<{ Params: { id: string } }>(
    "/:id/votes",
    async (request, reply) => {
      const user = await getUser(request.user.sub);
      if (!user) return reply.code(401).send({ message: "User not found" });

      if (user.verificationTier < 2) {
        return reply.code(403).send({
          message: "NPI-verified clinicians (tier 2+) may vote. Submit NPI verification first.",
        });
      }

      const annotation = await getAnnotationWithCategory(request.params.id);
      if (!annotation?.isPublished) {
        return reply.code(404).send({ message: "Annotation not found" });
      }

      // Can't vote own annotation
      if (annotation.authorId === user.id) {
        return reply.code(422).send({ message: "Cannot vote on your own annotation" });
      }

      const body  = castAnnotationVoteSchema.parse(request.body);
      const score = computeSpecialtyRelevance(
        user.specialty,
        annotation.device.category.specialtyHint,
      );

      await fastify.db.annotationVote.upsert({
        where:  { annotationId_userId: { annotationId: annotation.id, userId: user.id } },
        create: {
          annotationId:           annotation.id,
          userId:                 user.id,
          value:                  body.value,
          specialtyRelevanceScore: score,
        },
        update: {
          value:                  body.value,
          specialtyRelevanceScore: score,
        },
      });

      // Update author's reputation
      const voteScore = await recalcAnnotationScore(fastify.db, annotation.id);
      await fastify.db.userReputation.upsert({
        where:  { userId: annotation.authorId },
        create: { userId: annotation.authorId, totalScore: voteScore, weeklyScore: voteScore, monthlyScore: voteScore },
        update: { totalScore: voteScore },
      });

      await fastify.audit(request, {
        action:       "annotation.vote.cast",
        resourceType: "annotation",
        resourceId:   annotation.id,
        newValues:    { value: body.value, specialtyRelevanceScore: score },
      });

      return reply.code(201).send({ voteScore });
    },
  );

  // DELETE /annotations/:id/votes — remove own vote
  fastify.delete<{ Params: { id: string } }>(
    "/:id/votes",
    async (request, reply) => {
      const user = await getUser(request.user.sub);
      if (!user) return reply.code(401).send({ message: "User not found" });

      const vote = await fastify.db.annotationVote.findUnique({
        where: { annotationId_userId: { annotationId: request.params.id, userId: user.id } },
      });
      if (!vote) return reply.code(404).send({ message: "No vote found" });

      await fastify.db.annotationVote.delete({
        where: { annotationId_userId: { annotationId: request.params.id, userId: user.id } },
      });

      const voteScore = await recalcAnnotationScore(fastify.db, request.params.id);
      const annotation = await fastify.db.annotation.findUnique({
        where: { id: request.params.id }, select: { authorId: true },
      });
      if (annotation) {
        await fastify.db.userReputation.upsert({
          where:  { userId: annotation.authorId },
          create: { userId: annotation.authorId, totalScore: 0, weeklyScore: 0, monthlyScore: 0 },
          update: { totalScore: voteScore },
        });
      }

      await fastify.audit(request, {
        action:       "annotation.vote.removed",
        resourceType: "annotation",
        resourceId:   request.params.id,
      });

      return reply.code(204).send();
    },
  );

  // ════════════════════════════════════════════════════════════════════════════
  // COMMENTS
  // ════════════════════════════════════════════════════════════════════════════

  // GET /annotations/:id/comments — list threaded comments
  fastify.get<{ Params: { id: string } }>(
    "/:id/comments",
    async (request, reply) => {
      const user = await getUser(request.user.sub);
      if (!user) return reply.code(401).send({ message: "User not found" });

      const tenantId     = request.user.tenantId;
      const annotationId = request.params.id;

      // Fetch only top-level comments; replies are nested
      const topLevel = await fastify.db.comment.findMany({
        where:   { annotationId, depth: 0, isPublished: true },
        include: {
          author: { select: { id: true, fullName: true, specialty: true, verificationTier: true } },
          votes:  { select: { value: true, userId: true } },
          replies: {
            where:   { isPublished: true },
            include: {
              author: { select: { id: true, fullName: true, specialty: true, verificationTier: true } },
              votes:  { select: { value: true, userId: true } },
              replies: {
                where:   { isPublished: true },
                include: {
                  author: { select: { id: true, fullName: true, specialty: true, verificationTier: true } },
                  votes:  { select: { value: true, userId: true } },
                },
                orderBy: { createdAt: "asc" },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      // Annotate with userVote and voteScore
      const withScores = (comments: typeof topLevel): any[] =>
        comments.map(c => ({
          ...c,
          voteScore: (c.votes as any[]).reduce((s: number, v: any) => s + v.value, 0),
          userVote:  (c.votes as any[]).find((v: any) => v.userId === user.id)?.value ?? 0,
          votes:     undefined, // strip raw votes for response
          author:    c.isAnonymized ? { id: c.authorId, fullName: "Anonymous", specialty: null, verificationTier: 0 } : c.author,
          replies:   withScores((c as any).replies ?? []),
        }));

      return withScores(topLevel);
    },
  );

  // POST /annotations/:id/comments — add comment
  fastify.post<{ Params: { id: string } }>(
    "/:id/comments",
    async (request, reply) => {
      const user = await getUser(request.user.sub);
      if (!user) return reply.code(401).send({ message: "User not found" });

      if (user.verificationTier < 1) {
        return reply.code(403).send({
          message: "Email-verified users (tier 1+) may comment.",
        });
      }

      const annotation = await fastify.db.annotation.findUnique({
        where: { id: request.params.id }, select: { id: true, isPublished: true },
      });
      if (!annotation?.isPublished) {
        return reply.code(404).send({ message: "Annotation not found" });
      }

      const body = createCommentSchema.parse(request.body);

      // Resolve depth from parent
      let depth = 0;
      if (body.parentId) {
        const parent = await fastify.db.comment.findUnique({
          where:  { id: body.parentId },
          select: { depth: true },
        });
        if (!parent) return reply.code(404).send({ message: "Parent comment not found" });
        depth = parent.depth + 1;
        if (depth > 2) {
          return reply.code(422).send({ message: "Maximum comment nesting depth (2) exceeded" });
        }
      }

      const comment = await fastify.db.comment.create({
        data: {
          annotationId: request.params.id,
          parentId:     body.parentId ?? null,
          authorId:     user.id,
          tenantId:     user.tenantId,
          body:         body.body,
          depth,
          isPublished:  true,
        },
        include: {
          author: { select: { id: true, fullName: true, specialty: true, verificationTier: true } },
        },
      });

      await fastify.audit(request, {
        action:       "annotation.comment.created",
        resourceType: "comment",
        resourceId:   comment.id,
        newValues:    { annotationId: request.params.id, depth, parentId: body.parentId },
      });

      return reply.code(201).send({ ...comment, voteScore: 0, userVote: 0 });
    },
  );

  // POST /annotations/:id/comments/:commentId/votes — vote on comment
  fastify.post<{ Params: { id: string; commentId: string } }>(
    "/:id/comments/:commentId/votes",
    async (request, reply) => {
      const user = await getUser(request.user.sub);
      if (!user) return reply.code(401).send({ message: "User not found" });
      if (user.verificationTier < 2) {
        return reply.code(403).send({ message: "NPI-verified clinicians (tier 2+) may vote." });
      }

      const { value } = castCommentVoteSchema.parse(request.body);

      // Can't vote own comment
      const comment = await fastify.db.comment.findUnique({
        where: { id: request.params.commentId }, select: { authorId: true },
      });
      if (!comment) return reply.code(404).send({ message: "Comment not found" });
      if (comment.authorId === user.id) {
        return reply.code(422).send({ message: "Cannot vote on your own comment" });
      }

      await fastify.db.commentVote.upsert({
        where:  { commentId_userId: { commentId: request.params.commentId, userId: user.id } },
        create: { commentId: request.params.commentId, userId: user.id, value },
        update: { value },
      });

      return reply.code(201).send({ ok: true });
    },
  );

  // DELETE /annotations/:id/comments/:commentId/votes — remove comment vote
  fastify.delete<{ Params: { id: string; commentId: string } }>(
    "/:id/comments/:commentId/votes",
    async (request, reply) => {
      const user = await getUser(request.user.sub);
      if (!user) return reply.code(401).send({ message: "User not found" });

      await fastify.db.commentVote.deleteMany({
        where: { commentId: request.params.commentId, userId: user.id },
      });

      return reply.code(204).send();
    },
  );

  // ════════════════════════════════════════════════════════════════════════════
  // ENDORSEMENTS
  // ════════════════════════════════════════════════════════════════════════════

  // POST /annotations/:id/endorse — endorse an annotation (tier 2+ only)
  //
  // Idempotency: returns 409 if the user already endorsed this annotation.
  // Increments annotation.endorsementCount atomically in the same transaction.
  // Authors cannot endorse their own annotations (422).
  //
  fastify.post<{ Params: { id: string } }>(
    "/:id/endorse",
    async (request, reply) => {
      const user = await getUser(request.user.sub);
      if (!user) return reply.code(401).send({ message: "User not found" });

      if (user.verificationTier < 2) {
        return reply.code(403).send({
          message: "NPI-verified clinicians (tier 2+) may endorse annotations.",
        });
      }

      const annotationId = request.params.id;

      const annotation = await fastify.db.annotation.findUnique({
        where:  { id: annotationId },
        select: { id: true, status: true, authorId: true, endorsementCount: true },
      });
      if (!annotation || annotation.status !== "published") {
        return reply.code(404).send({ message: "Annotation not found" });
      }

      // Authors cannot endorse their own annotation
      if (annotation.authorId === user.id) {
        return reply.code(422).send({ message: "Cannot endorse your own annotation." });
      }

      // Idempotency check
      const existing = await fastify.db.annotationEndorsement.findUnique({
        where: { annotationId_userId: { annotationId, userId: user.id } },
      });
      if (existing) {
        return reply.code(409).send({
          message:          "You have already endorsed this annotation.",
          endorsementCount: annotation.endorsementCount,
        });
      }

      // Create endorsement record + increment counter atomically
      const [, updated] = await fastify.db.$transaction([
        fastify.db.annotationEndorsement.create({
          data: { annotationId, userId: user.id },
        }),
        fastify.db.annotation.update({
          where:  { id: annotationId },
          data:   { endorsementCount: { increment: 1 } },
          select: { endorsementCount: true },
        }),
      ]);

      await fastify.audit(request, {
        action:       "annotation.endorsed",
        resourceType: "annotation",
        resourceId:   annotationId,
        newValues:    { endorsementCount: updated.endorsementCount },
      });

      return reply.code(201).send({ endorsementCount: updated.endorsementCount });
    },
  );

  // ════════════════════════════════════════════════════════════════════════════
  // FLAGS
  // ════════════════════════════════════════════════════════════════════════════

  // Auto-escalation threshold: when flagCount reaches this value the annotation
  // is moved to status="flagged" for moderator review without manual action.
  const FLAG_ESCALATION_THRESHOLD = 3;

  // POST /annotations/:id/flags — flag annotation
  //
  // Phase 6 additions:
  //   • Increments annotation.flagCount atomically
  //   • When flagCount >= FLAG_ESCALATION_THRESHOLD and status === "published",
  //     sets status="flagged" and snapshots flaggedReason for quick triage
  //
  fastify.post<{ Params: { id: string } }>(
    "/:id/flags",
    async (request, reply) => {
      const user = await getUser(request.user.sub);
      if (!user) return reply.code(401).send({ message: "User not found" });

      if (user.verificationTier < 1) {
        return reply.code(403).send({ message: "Email-verified users (tier 1+) may flag content." });
      }

      const body = createFlagSchema.parse(request.body);

      // Prevent duplicate open flags from same user
      const existing = await fastify.db.annotationFlag.findFirst({
        where: { annotationId: request.params.id, flaggedById: user.id, resolvedAt: null },
      });
      if (existing) {
        return reply.code(409).send({ message: "You already have an open flag on this annotation." });
      }

      // Create flag + increment counter + conditionally escalate — all atomic.
      //
      // SELECT … FOR UPDATE serialises concurrent flag submissions at the DB level.
      // Without the lock, two simultaneous requests can both read flagCount = 2,
      // both increment to 3, and both execute the escalation UPDATE — producing
      // duplicate status transitions. The row lock ensures only one transaction
      // can hold the lock at a time, so exactly one transaction triggers escalation.
      const [flag, updatedAnnotation] = await fastify.db.$transaction(async tx => {
        // Acquire row-level lock before reading flagCount
        await tx.$queryRaw`
          SELECT id FROM annotations
          WHERE  id = ${request.params.id}::uuid
          FOR    UPDATE
        `;

        const flag = await tx.annotationFlag.create({
          data: {
            annotationId: request.params.id,
            flaggedById:  user.id,
            reason:       body.reason,
            notes:        body.notes,
          },
        });

        const updated = await tx.annotation.update({
          where:  { id: request.params.id },
          data:   { flagCount: { increment: 1 } },
          select: { id: true, flagCount: true, status: true },
        });

        // Auto-escalation: only escalate published annotations
        if (
          updated.flagCount >= FLAG_ESCALATION_THRESHOLD &&
          updated.status === "published"
        ) {
          await tx.annotation.update({
            where: { id: request.params.id },
            data: {
              status:       "flagged",
              flaggedReason: body.reason,
            },
          });
        }

        return [flag, updated];
      });

      await fastify.audit(request, {
        action:       "annotation.flagged",
        resourceType: "annotation_flag",
        resourceId:   flag.id,
        newValues: {
          reason:        body.reason,
          annotationId:  request.params.id,
          flagCount:     updatedAnnotation.flagCount,
          autoEscalated: updatedAnnotation.flagCount >= FLAG_ESCALATION_THRESHOLD,
        },
      });

      return reply.code(201).send({
        flagId:    flag.id,
        flagCount: updatedAnnotation.flagCount,
        escalated: updatedAnnotation.flagCount >= FLAG_ESCALATION_THRESHOLD,
      });
    },
  );

  // PATCH /annotations/:id/flags/:flagId — resolve flag (admin / safety officer)
  fastify.patch<{ Params: { id: string; flagId: string } }>(
    "/:id/flags/:flagId",
    { preHandler: fastify.requireRole("system_admin", "hospital_safety_officer") },
    async (request, reply) => {
      const user = await getUser(request.user.sub);
      if (!user) return reply.code(401).send({ message: "User not found" });

      const body = resolveFlagSchema.parse(request.body);

      const flag = await fastify.db.annotationFlag.update({
        where: { id: request.params.flagId },
        data: {
          resolvedById: user.id,
          resolvedAt:   new Date(),
          resolution:   body.resolution,
        },
      });

      await fastify.audit(request, {
        action:       "annotation.flag.resolved",
        resourceType: "annotation_flag",
        resourceId:   flag.id,
        newValues:    { resolution: body.resolution },
      });

      return flag;
    },
  );

  // ════════════════════════════════════════════════════════════════════════════
  // TAGS
  // ════════════════════════════════════════════════════════════════════════════

  // PUT /annotations/:id/tags — update tags (safety officer / admin)
  fastify.put<{ Params: { id: string } }>(
    "/:id/tags",
    { preHandler: fastify.requireRole("system_admin", "hospital_safety_officer") },
    async (request, reply) => {
      const { add, remove } = updateAnnotationTagsSchema.parse(request.body);
      const annotationId    = request.params.id;

      // Ensure annotation exists
      const annotation = await fastify.db.annotation.findUnique({
        where: { id: annotationId }, select: { id: true },
      });
      if (!annotation) return reply.code(404).send({ message: "Annotation not found" });

      await fastify.db.$transaction(async tx => {
        // Detach removed tags
        if (remove.length) {
          const tagsToRemove = await tx.annotationTag.findMany({
            where: { slug: { in: remove } },
            select: { id: true },
          });
          const tagIds = tagsToRemove.map(t => t.id);
          await tx.annotationTagLink.deleteMany({
            where: { annotationId, tagId: { in: tagIds } },
          });
        }

        // Attach new tags (upsert tag by slug, then link)
        for (const slug of add) {
          const tag = await tx.annotationTag.upsert({
            where:  { slug },
            create: { name: slug.replace(/-/g, " "), slug, category: "device_type" },
            update: {},
          });
          await tx.annotationTagLink.upsert({
            where:  { annotationId_tagId: { annotationId, tagId: tag.id } },
            create: { annotationId, tagId: tag.id },
            update: {},
          });
        }
      });

      const tags = await fastify.db.annotationTagLink.findMany({
        where:   { annotationId },
        include: { tag: true },
      });

      return { annotationId, tags };
    },
  );
};
