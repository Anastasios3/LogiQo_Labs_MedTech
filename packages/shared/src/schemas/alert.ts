import { z } from "zod";
import { paginationSchema } from "./common.js";

// ── Enum schemas ─────────────────────────────────────────────────────────────

export const alertSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export const alertTypeSchema = z.enum([
  "recall",
  "safety_notice",
  "field_correction",
  "hazard_alert",
]);

// ── Query schemas ─────────────────────────────────────────────────────────────

export const listAlertsSchema = paginationSchema.extend({
  /** Filter by active (unacknowledged by tenant) vs acknowledged. */
  status:   z.enum(["active", "acknowledged"]).default("active"),
  severity: alertSeveritySchema.optional(),
  type:     alertTypeSchema.optional(),
  /** Partial case-insensitive match against Alert.source. */
  source:   z.string().max(200).trim().optional(),
});

// ── Mutation schemas ──────────────────────────────────────────────────────────

export const acknowledgeAlertSchema = z.object({
  notes: z.string().max(1000).trim().optional(),
});

/**
 * Body schema for POST /alerts (system_admin only).
 *
 * Phase 6 spec:
 *   • title 5–500 chars (required)
 *   • summary 10–4000 chars (required)
 *   • alertType, severity, source (required)
 *   • affectedSkus: array of 1–500 SKU strings (min 1 SKU required)
 *   • publishedAt / expiresAt: ISO datetime strings (optional)
 *   • sourceUrl: valid URL (optional)
 *   • externalId: for deduplication (optional)
 */
export const createAlertSchema = z.object({
  title:       z.string().min(5).max(500).trim(),
  summary:     z.string().min(10).max(4000).trim(),
  alertType:   alertTypeSchema,
  severity:    alertSeveritySchema,
  source:      z.string().min(2).max(200).trim().default("Manual"),
  /** URL to the original advisory / recall notice. */
  sourceUrl:   z.string().url("sourceUrl must be a valid URL.").optional(),
  /** External recall/advisory number — used for deduplication on re-ingestion. */
  externalId:  z.string().max(200).trim().optional(),
  /**
   * ISO 8601 date-time string — when the alert was originally published by
   * the source (e.g. the FDA recall initiation date). Defaults to now().
   */
  publishedAt: z.string().datetime({ message: "publishedAt must be a valid ISO datetime." }).optional(),
  /**
   * ISO 8601 date-time string — when the alert expires / was terminated.
   * If omitted the alert has no expiry.
   */
  expiresAt:   z.string().datetime({ message: "expiresAt must be a valid ISO datetime." }).optional(),
  /**
   * Device SKUs affected by this alert.
   * Each SKU will be matched exactly against Device.sku in the DB;
   * a matching device gets an AlertDeviceLink created.
   * Minimum 1 SKU, maximum 500 SKUs per alert.
   */
  affectedSkus: z.array(z.string().min(1).max(200).trim()).min(1, "At least one affectedSku is required.").max(500),
});

// ── Derived types ─────────────────────────────────────────────────────────────

export type ListAlerts       = z.infer<typeof listAlertsSchema>;
export type AcknowledgeAlert = z.infer<typeof acknowledgeAlertSchema>;
export type CreateAlert      = z.infer<typeof createAlertSchema>;
