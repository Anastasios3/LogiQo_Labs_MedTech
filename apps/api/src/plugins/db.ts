import fp from "fastify-plugin";
import { PrismaClient } from "@logiqo/db";
import type { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    db: PrismaClient;
  }
}

const dbPluginImpl: FastifyPluginAsync = async (fastify) => {
  const prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

  await prisma.$connect();
  fastify.log.info("Database connected");

  fastify.decorate("db", prisma);

  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
};

export const dbPlugin = fp(dbPluginImpl, { name: "db" });
