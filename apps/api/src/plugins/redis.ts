import fp from "fastify-plugin";
import { Redis } from "ioredis";
import type { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPluginImpl: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    lazyConnect:          true,
    maxRetriesPerRequest: 3,
  });

  await redis.connect();
  fastify.log.info("Redis connected");

  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    await redis.quit();
  });
};

export const redisPlugin = fp(redisPluginImpl, { name: "redis" });
