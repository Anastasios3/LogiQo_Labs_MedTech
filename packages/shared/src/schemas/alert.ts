import { z } from "zod";
import { paginationSchema } from "./common.js";

// ── Enum schemas ────────────────────────────────────────────────────────────

export const alertSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export const alertTypeSchema = z.enum([
  "recall",
  "safety_notice",
  "field_correction",
  "hazard_alert",
]);

// ── Query schemas ───────────────────────────────────────────────────────────

export const listAlertsSchema = paginationSchema.extend({
  status:   z.enum(["active", "acknowledged"]).default("active"),
  severity: alertSeveritySchema.optional(),
  type:     alertTypeSchema.optional(),
});

// ── Mutation schemas ────────────────────────────────────────────────────────

export const acknowledgeAlertSchema = z.object({
  notes: z.string().max(1000).trim().optional(),
});

// ── Derived types (unique to this schema — AlertType/AlertSeverity are in types/alert.ts) ──

export type ListAlerts       = z.infer<typeof listAlertsSchema>;
export type AcknowledgeAlert = z.infer<typeof acknowledgeAlertSchema>;
