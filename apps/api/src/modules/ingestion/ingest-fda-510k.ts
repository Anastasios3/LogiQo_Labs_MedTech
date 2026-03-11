import type { PrismaClient } from "@logiqo/db";
import { fetch510kClearances, parseFdaDate } from "../../lib/fda-client.js";
import type { IngestionResult } from "./ingest-fda-recalls.js";

/**
 * Fetch FDA 510(k) clearances and enrich our Device records with the k_number.
 * Matches by device name similarity (case-insensitive ILIKE contains).
 */
export async function ingestFda510k(
  db:          PrismaClient,
  triggeredBy: "manual" | "cron",
  userId?:     string,
  limit = 200,
): Promise<IngestionResult> {
  const run = await db.ingestionRun.create({
    data: {
      source:            "fda_510k",
      status:            "running",
      triggeredBy,
      triggeredByUserId: userId ?? null,
    },
  });

  let ingested = 0;
  let skipped  = 0;

  try {
    const clearances = await fetch510kClearances(limit, 0);

    for (const item of clearances) {
      if (!item.k_number || !item.device_name) { skipped++; continue; }

      // Find devices in our DB whose name contains the first meaningful word
      const words = item.device_name.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
      if (!words.length) { skipped++; continue; }

      const candidates = await db.device.findMany({
        where: {
          name:           { contains: words[0], mode: "insensitive" },
          fdA510kNumber:  null, // Only enrich devices that don't already have a 510k number
        },
        select: { id: true, name: true },
        take:   5,
      });

      if (!candidates.length) { skipped++; continue; }

      // Further filter: at least 2 words must match
      const matched = candidates.filter(d => {
        const lower = d.name.toLowerCase();
        return words.filter(w => lower.includes(w.toLowerCase())).length >= Math.min(2, words.length);
      });

      if (!matched.length) { skipped++; continue; }

      // Enrich matched devices with the 510(k) number
      const decisionDate = parseFdaDate(item.decision_date);
      for (const dev of matched) {
        await db.device.update({
          where: { id: dev.id },
          data: {
            fdA510kNumber: item.k_number,
            updatedAt:     new Date(),
          },
        });
        ingested++;
      }

      // Mark extras as skipped
      skipped += candidates.length - matched.length;
    }

    await db.ingestionRun.update({
      where: { id: run.id },
      data: {
        status:          "completed",
        recordsIngested: ingested,
        recordsSkipped:  skipped,
        completedAt:     new Date(),
      },
    });

    return { runId: run.id, recordsIngested: ingested, recordsSkipped: skipped };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.ingestionRun.update({
      where: { id: run.id },
      data: {
        status:          "failed",
        recordsIngested: ingested,
        recordsSkipped:  skipped,
        errorMessage:    msg,
        completedAt:     new Date(),
      },
    });
    return { runId: run.id, recordsIngested: ingested, recordsSkipped: skipped, errorMessage: msg };
  }
}
