import cron from "node-cron";
import type { FastifyInstance } from "fastify";
import { ingestFdaRecalls } from "../modules/ingestion/ingest-fda-recalls.js";
import { ingestFda510k } from "../modules/ingestion/ingest-fda-510k.js";
import type { SyncFrequency } from "@logiqo/shared";

const FREQUENCY_MS: Record<SyncFrequency, number> = {
  manual: Infinity,
  "1h":   1  * 60 * 60 * 1000,
  "6h":   6  * 60 * 60 * 1000,
  "24h":  24 * 60 * 60 * 1000,
};

function shouldRunNow(
  lastSyncAt: string | null | undefined,
  frequency:  SyncFrequency,
): boolean {
  if (frequency === "manual") return false;
  if (!lastSyncAt) return true;
  const elapsed = Date.now() - new Date(lastSyncAt).getTime();
  return elapsed >= FREQUENCY_MS[frequency];
}

async function runSync(
  sourceKey:   string,
  db:          FastifyInstance["db"],
  log:         FastifyInstance["log"],
): Promise<void> {
  try {
    if (sourceKey === "fdaRecalls") {
      const res = await ingestFdaRecalls(db, "cron");
      log.info({ sourceKey, ...res }, "Cron sync completed");
    } else if (sourceKey === "fda510k") {
      const res = await ingestFda510k(db, "cron");
      log.info({ sourceKey, ...res }, "Cron sync completed");
    }
    // GUDID and EUDAMED are lookup-only in Phase 1 — no batch sync
  } catch (err) {
    // Ingesters already catch and persist errors; log here just in case
    log.error({ err, sourceKey }, "Unexpected scheduler error");
  }
}

export function startScheduler(fastify: FastifyInstance): void {
  // Check every 5 minutes whether any tenant's configured sync is due
  cron.schedule("*/5 * * * *", async () => {
    try {
      const tenants = await fastify.db.tenant.findMany({
        where:  { isActive: true },
        select: { id: true, settings: true },
      });

      for (const tenant of tenants) {
        const settings    = (tenant.settings as Record<string, unknown>) ?? {};
        const dataSources = (settings.dataSources as Record<string, { enabled: boolean; syncFrequency: SyncFrequency; lastSyncAt?: string | null }>) ?? {};

        for (const [sourceKey, cfg] of Object.entries(dataSources)) {
          if (!cfg.enabled) continue;
          if (!shouldRunNow(cfg.lastSyncAt, cfg.syncFrequency)) continue;

          await runSync(sourceKey, fastify.db, fastify.log);

          // Record lastSyncAt so we don't re-run immediately next tick
          const updatedDS = {
            ...dataSources,
            [sourceKey]: { ...cfg, lastSyncAt: new Date().toISOString() },
          };

          await fastify.db.tenant.update({
            where: { id: tenant.id },
            data:  { settings: { ...settings, dataSources: updatedDS } },
          });
        }
      }
    } catch (err) {
      fastify.log.error({ err }, "Scheduler tick error");
    }
  });

  fastify.log.info("Ingestion scheduler started — checks every 5 minutes");
}
