import "dotenv/config"; // Load .env before any other code
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { authPlugin } from "./plugins/auth.js";
import { dbPlugin } from "./plugins/db.js";
import { redisPlugin } from "./plugins/redis.js";
import { auditPlugin } from "./plugins/audit.js";
import { devicesRoutes } from "./modules/devices/routes.js";
import { documentsRoutes } from "./modules/documents/routes.js";
import { alertsRoutes } from "./modules/alerts/routes.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { annotationsRoutes } from "./modules/annotations/routes.js";
import { ingestionRoutes, settingsRoutes } from "./modules/ingestion/routes.js";
import { usersRoutes, adminUserRoutes } from "./modules/users/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { organizationsRoutes } from "./modules/organizations/routes.js";
import { subscribeRoutes } from "./modules/subscribe/routes.js";
import { stripeWebhookRoutes } from "./modules/webhooks/stripe.js";
import { subscriptionGatePlugin } from "./plugins/subscription-gate.js";
import { startScheduler } from "./jobs/scheduler.js";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty" }
        : undefined,
    // Redact sensitive fields from all structured log lines.
    // Prevents credentials and auth tokens from appearing in CloudWatch / Datadog.
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "req.body.currentPassword",
        "req.body.newPassword",
        "req.body.token",
        "req.body.secret",
        "req.body.npiNumber",
        "req.body.stripeCustomerId",
      ],
      censor: "[REDACTED]",
    },
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
await app.register(subscriptionGatePlugin);

// ── Multipart support (document uploads) ──────────────────────────────────────
// Registered globally so @fastify/multipart attaches its content-type parser
// once and all routes can call request.parts(). The limits here are safety
// defaults — the upload route re-validates size and MIME after buffering.
await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB absolute maximum
    files:    1,                 // one file per request
    fields:   10,                // documentType, title, version + headroom
  },
});

// Public auth routes (registration, email verification, NPI submission — no subscription required)
await app.register(authRoutes, { prefix: "/auth" });

// ── Protected routes ─────────────────────────────────────────────────────────
// All routes registered inside this anonymous scope require:
//   1. A valid Auth0 JWT (authenticate)
//   2. An active subscription (checkSubscription)
//
// Hooks run in declaration order — authenticate always fires before
// checkSubscription, so request.user is guaranteed to be populated when
// the subscription check reads it.
//
// system_admin users bypass the subscription gate (see subscription-gate.ts).
await app.register(async function protectedRoutes(scope) {
  scope.addHook("preHandler", async (request, reply) => {
    await scope.authenticate(request);
    await scope.checkSubscription(request, reply);
  });

  await scope.register(devicesRoutes,       { prefix: "/devices" });
  await scope.register(documentsRoutes,     { prefix: "/documents" });
  await scope.register(alertsRoutes,        { prefix: "/alerts" });
  await scope.register(adminRoutes,         { prefix: "/admin" });
  await scope.register(annotationsRoutes,   { prefix: "/annotations" });
  await scope.register(ingestionRoutes,     { prefix: "/ingestion" });
  await scope.register(settingsRoutes,      { prefix: "/settings" });
  await scope.register(usersRoutes,         { prefix: "/users" });
  await scope.register(adminUserRoutes,     { prefix: "/admin" });
  await scope.register(organizationsRoutes, { prefix: "/organizations" });
});

// ── Subscribe routes ─────────────────────────────────────────────────────────
// Registered OUTSIDE the subscription gate intentionally:
//   /subscribe/checkout — user may not yet have an active subscription
//   /subscribe/portal   — subscription check is done inline (stripeCustomerId guard)
// Each handler calls fastify.authenticate() explicitly.
await app.register(subscribeRoutes, { prefix: "/subscribe" });

// ── Stripe webhook ────────────────────────────────────────────────────────────
// No Auth0 auth — Stripe HMAC signature is verified inside the handler.
// The plugin is NOT wrapped with fastify-plugin, so its scoped
// application/json content-type parser (returns raw Buffer for signature
// verification) does not bleed into the rest of the application.
await app.register(stripeWebhookRoutes, { prefix: "/webhooks" });

// Health check
app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
  app.log.info(`API server listening on ${host}:${port}`);
  // Start the background scheduler only after the server is successfully
  // listening. If app.listen throws, the scheduler is never started —
  // preventing orphaned cron jobs from running against an unhealthy process.
  startScheduler(app);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
