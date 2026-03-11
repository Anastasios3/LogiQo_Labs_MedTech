import type { PrismaClient } from "@logiqo/db";
import {
  fetchRecentRecalls,
  recallClassToSeverity,
  parseFdaDate,
} from "../../lib/fda-client.js";

export interface IngestionResult {
  runId:           string;
  recordsIngested: number;
  recordsSkipped:  number;
  errorMessage?:   string;
}

/**
 * Fetch FDA device recalls and upsert them into the alerts table.
 * Deduplicates by `externalId` (recall_number). Attempts SKU-level device matching.
 */
export async function ingestFdaRecalls(
  db:           PrismaClient,
  triggeredBy:  "manual" | "cron",
  userId?:      string,
  limit = 200,
): Promise<IngestionResult> {
  // Create a tracking run record
  const run = await db.ingestionRun.create({
    data: {
      source:              "fda_recalls",
      status:              "running",
      triggeredBy,
      triggeredByUserId:   userId ?? null,
    },
  });

  let ingested = 0;
  let skipped  = 0;

  try {
    const recalls = await fetchRecentRecalls(limit, 0);

    for (const recall of recalls) {
      const externalId = recall.recall_number;
      if (!externalId) { skipped++; continue; }

      // Skip if already in DB
      const existing = await db.alert.findFirst({ where: { externalId } });
      if (existing) { skipped++; continue; }

      const publishedAt = parseFdaDate(recall.recall_initiation_date) ?? new Date();
      const severity    = recallClassToSeverity(recall.classification ?? "");
      const title       = (recall.product_description ?? "FDA Device Recall").slice(0, 300);

      // Build affected SKU list from openfda.device_name words (best effort)
      const affectedSkus: string[] = [];

      // Try to find matching devices in our DB by device name
      const deviceNames = recall.openfda?.device_name ?? [];
      const matchedDeviceIds: string[] = [];

      for (const dName of deviceNames.slice(0, 3)) {
        const words = dName.split(/\s+/).filter(w => w.length > 3).slice(0, 4);
        if (!words.length) continue;
        const devices = await db.device.findMany({
          where: {
            name: { contains: words[0], mode: "insensitive" },
          },
          select: { id: true, sku: true },
          take: 3,
        });
        for (const d of devices) {
          if (!matchedDeviceIds.includes(d.id)) matchedDeviceIds.push(d.id);
          if (!affectedSkus.includes(d.sku)) affectedSkus.push(d.sku);
        }
      }

      // Insert alert + device links in a transaction
      await db.$transaction(async tx => {
        const alert = await tx.alert.create({
          data: {
            alertType:   "recall",
            source:      "FDA MedWatch",
            externalId,
            title,
            summary:     recall.reason_for_recall?.slice(0, 1000) ?? "",
            fullText:    recall.product_description,
            severity,
            affectedSkus,
            publishedAt,
            sourceUrl:   `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfRES/res.cfm?id=${externalId}`,
            rawPayload:  recall as object,
          },
        });

        for (const deviceId of matchedDeviceIds) {
          await tx.alertDeviceLink.createMany({
            data: [{ alertId: alert.id, deviceId, matchMethod: "sku_fuzzy" }],
            skipDuplicates: true,
          });
        }
      });

      ingested++;
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
