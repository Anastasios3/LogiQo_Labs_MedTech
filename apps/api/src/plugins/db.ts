import fp from "fastify-plugin";
import { PrismaClient, Prisma } from "@logiqo/db";
import type { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    db: PrismaClient;
    /**
     * Run a callback inside a PostgreSQL transaction with the RLS tenant
     * context pre-set via `SET LOCAL app.current_tenant_id = <tenantId>`.
     *
     * All tenant-scoped Prisma queries MUST go through this helper so that
     * the Row-Level Security policies on annotations, comments, users, etc.
     * are enforced at the database level.
     *
     * Usage:
     *   const result = await fastify.withTenant(request.user.tenantId, async (tx) => {
     *     return tx.annotation.findMany({ where: { isPublished: true } });
     *   });
     *
     * The `tx` parameter is a Prisma interactive transaction client — identical
     * to `fastify.db` but scoped to the transaction.
     *
     * @param tenantId  - UUID of the requesting tenant (from request.user.tenantId)
     * @param fn        - Async callback that receives the transaction client
     */
    withTenant: <T>(
      tenantId: string,
      fn: (tx: Prisma.TransactionClient) => Promise<T>
    ) => Promise<T>;
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

  /**
   * withTenant — sets the PostgreSQL RLS session variable inside an interactive
   * transaction so all subsequent queries in the callback are filtered to the
   * specified tenant's data. Implements the Phase 2 RLS wiring described in
   * packages/db/migrations/001_rls_and_audit_protection.sql.
   */
  fastify.decorate(
    "withTenant",
    <T>(tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
      return prisma.$transaction(async (tx) => {
        // SET LOCAL means the value reverts at the end of this transaction,
        // preventing tenant context leakage between requests on pooled connections.
        await tx.$executeRaw`SET LOCAL app.current_tenant_id = ${tenantId}`;
        return fn(tx);
      });
    }
  );

  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
};

export const dbPlugin = fp(dbPluginImpl, { name: "db" });
