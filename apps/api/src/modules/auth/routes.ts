import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const auth0WebhookSchema = z.object({
  event: z.object({
    type: z.string(),
    data: z.object({
      object: z.object({
        user_id: z.string(),
        email: z.string(),
        app_metadata: z
          .object({
            tenant_id: z.string().optional(),
            role: z.string().optional(),
          })
          .optional(),
      }),
    }),
  }),
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Auth0 post-registration hook: provision user in our DB
  fastify.post(
    "/webhook/user-created",
    {
      config: {
        // This endpoint is called by Auth0, not by clients.
        // Validate using a shared secret, not a JWT.
      },
    },
    async (request, reply) => {
      const webhookSecret = request.headers["x-webhook-secret"];
      if (webhookSecret !== process.env.AUTH0_WEBHOOK_SECRET) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      const payload = auth0WebhookSchema.parse(request.body);
      const { user_id, email, app_metadata } = payload.event.data.object;

      await fastify.db.user.upsert({
        where: { auth0UserId: user_id },
        update: { lastLoginAt: new Date() },
        create: {
          auth0UserId: user_id,
          email,
          fullName: email.split("@")[0],
          role: app_metadata?.role ?? "surgeon",
          tenantId: app_metadata?.tenant_id ?? process.env.DEFAULT_TENANT_ID!,
          verificationTier: 0, // New users start unverified
        },
      });

      return reply.code(204).send();
    }
  );
};
