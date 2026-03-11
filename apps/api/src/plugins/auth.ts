import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import jwksClient from "jwks-rsa";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
    requireRole: (
      ...roles: string[]
    ) => (request: FastifyRequest) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      email: string;
      "https://logiqo.io/role": string;
      "https://logiqo.io/tenant_id": string;
    };
    user: {
      sub: string;
      email: string;
      role: string;
      tenantId: string;
    };
  }
}

const authPluginImpl: FastifyPluginAsync = async (fastify) => {
  const domain = process.env.AUTH0_DOMAIN;

  // ── Dev-mode bypass ──────────────────────────────────────────────────────────
  // When AUTH0_DOMAIN is not set, all requests are auto-authenticated as a
  // system_admin dev user. The tenant ID is resolved lazily from the DB so
  // the server works immediately after `db:seed` with zero extra config.
  // NEVER deploy without AUTH0_DOMAIN set — this bypasses all auth checks.
  if (!domain) {
    fastify.log.warn(
      "⚠️  AUTH0_DOMAIN not configured — DEV MODE active. " +
      "All API requests are auto-authenticated as system_admin. " +
      "Set AUTH0_DOMAIN in .env to enable real Auth0 authentication."
    );

    // Cache the tenant ID so we only hit the DB once per process lifetime
    let cachedTenantId = process.env.DEFAULT_TENANT_ID ?? "";

    fastify.decorate("authenticate", async (request: FastifyRequest) => {
      if (!cachedTenantId) {
        try {
          const first = await fastify.db.tenant.findFirst({
            select: { id: true },
            orderBy: { createdAt: "asc" },
          });
          cachedTenantId = first?.id ?? "";
        } catch {
          // DB not yet migrated/seeded — leave tenantId empty
        }
      }

      (request as any).user = {
        sub:      "00000000-0000-0000-0000-000000000001",
        email:    "dev@logiqo.local",
        role:     "system_admin",
        tenantId: cachedTenantId,
      };
    });

    fastify.decorate(
      "requireRole",
      (..._roles: string[]) =>
        async (request: FastifyRequest) => {
          // Dev mode: all role checks pass — system_admin can do everything
          await fastify.authenticate(request);
        }
    );

    return;
  }

  // ── Production: Auth0 JWKS ───────────────────────────────────────────────────
  const client = jwksClient({
    jwksUri: `https://${domain}/.well-known/jwks.json`,
    cache: true,
    rateLimit: true,
  });

  // @fastify/jwt v8 changed the secret callback to receive a decoded JWT object
  // (not raw request + token string). The header.kid is available directly.
  // @fastify/jwt v8 changed secret callback to receive a decoded JWT object.
  // We cast to `any` because the installed type definitions are stricter than
  // the runtime behaviour (jwks-rsa still works with the header.kid pattern).
  await fastify.register(jwt, {
    secret: (async (decodedJwt: any) => {
      const kid = decodedJwt?.header?.kid as string | undefined;
      if (!kid) throw new Error("Missing kid in JWT header");
      const key = await client.getSigningKey(kid);
      return key.getPublicKey();
    }) as any,
    verify: {
      allowedAud: process.env.AUTH0_AUDIENCE,
      allowedIss: [`https://${domain}/`],
    } as any,
    decode: { complete: true },
  });

  fastify.decorate("authenticate", async (request: FastifyRequest) => {
    await request.jwtVerify();
    // Map custom Auth0 claims → normalized user object
    const payload = request.user as any;
    request.user = {
      sub:      payload.sub,
      email:    payload.email ?? payload["https://logiqo.io/email"],
      role:     payload["https://logiqo.io/role"],
      tenantId: payload["https://logiqo.io/tenant_id"],
    };
  });

  fastify.decorate(
    "requireRole",
    (...roles: string[]) =>
      async (request: FastifyRequest) => {
        await fastify.authenticate(request);
        if (!roles.includes(request.user.role)) {
          throw { statusCode: 403, message: "Insufficient permissions" };
        }
      }
  );
};

export const authPlugin = fp(authPluginImpl, { name: "auth" });
