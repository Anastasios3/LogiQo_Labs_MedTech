import "dotenv/config"; // Load .env before any other code
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { authPlugin } from "./plugins/auth.js";
import { dbPlugin } from "./plugins/db.js";
import { redisPlugin } from "./plugins/redis.js";
import { auditPlugin } from "./plugins/audit.js";
import { devicesRoutes } from "./modules/devices/routes.js";
import { alertsRoutes } from "./modules/alerts/routes.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { annotationsRoutes } from "./modules/annotations/routes.js";
import { ingestionRoutes, settingsRoutes } from "./modules/ingestion/routes.js";
import { usersRoutes, adminUserRoutes } from "./modules/users/routes.js";
import { startScheduler } from "./jobs/scheduler.js";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty" }
        : undefined,
  },
  trustProxy: true,
});

// Security middleware
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
});

await app.register(cors, {
  origin: process.env.ALLOWED_ORIGINS?.split(",") ?? ["http://localhost:3000"],
  credentials: true,
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  keyGenerator: (request) => request.ip,
});

// Infrastructure plugins
await app.register(dbPlugin);
await app.register(redisPlugin);
await app.register(authPlugin);
await app.register(auditPlugin);

// Route modules
await app.register(devicesRoutes, { prefix: "/devices" });
await app.register(alertsRoutes, { prefix: "/alerts" });
await app.register(adminRoutes, { prefix: "/admin" });
await app.register(annotationsRoutes, { prefix: "/annotations" });
await app.register(ingestionRoutes, { prefix: "/ingestion" });
await app.register(settingsRoutes,   { prefix: "/settings" });
await app.register(usersRoutes,      { prefix: "/users" });
await app.register(adminUserRoutes,  { prefix: "/admin" });

// Health check
app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

// Start background scheduler (checks tenant sync preferences every 5 min)
startScheduler(app);

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
  app.log.info(`API server listening on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
