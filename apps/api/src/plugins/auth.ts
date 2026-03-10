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
  const domain = process.env.AUTH0_DOMAIN!;

  const client = jwksClient({
    jwksUri: `https://${domain}/.well-known/jwks.json`,
    cache: true,
    rateLimit: true,
  });

  await fastify.register(jwt, {
    secret: async (request, token) => {
      const decoded = fastify.jwt.decode<{ header: { kid: string } }>(
        token as string
      );
      const kid = decoded?.header?.kid;
      if (!kid) throw new Error("Missing kid in token header");

      const key = await client.getSigningKey(kid);
      return key.getPublicKey();
    },
    verify: {
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${domain}/`,
    },
    // Map JWT claims to user object
    decode: { complete: true },
  });

  fastify.decorate("authenticate", async (request: FastifyRequest) => {
    await request.jwtVerify();
    // Map custom claims to user
    const payload = request.user as any;
    request.user = {
      sub: payload.sub,
      email: payload.email ?? payload["https://logiqo.io/email"],
      role: payload["https://logiqo.io/role"],
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
