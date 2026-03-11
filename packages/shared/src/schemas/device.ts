import { z } from "zod";
import { paginationSchema } from "./common.js";

// ── Enums ──────────────────────────────────────────────────────────────────

export const deviceRegulatoryStatusSchema = z.enum([
  "approved",
  "recalled",
  "pending",
  "withdrawn",
]);

export const deviceApprovalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);

export const documentTypeSchema = z.enum([
  "ifu",
  "image",
  "technical_spec",
  "safety_notice",
]);

// ── Query schemas ──────────────────────────────────────────────────────────

export const deviceSearchSchema = paginationSchema.extend({
  /** Free-text search: name, SKU, description */
  q:            z.string().max(200).trim().optional(),
  category:     z.string().optional(),
  manufacturer: z.string().optional(),
  status:       deviceRegulatoryStatusSchema.optional(),
  approval:     deviceApprovalStatusSchema.optional(),
});

// ── Mutation schemas ───────────────────────────────────────────────────────

export const createDeviceSchema = z.object({
  sku:                 z.string().min(1).max(100).trim(),
  manufacturerId:      z.string().uuid("Invalid manufacturer ID"),
  categoryId:          z.string().uuid("Invalid category ID"),
  name:                z.string().min(2).max(300).trim(),
  description:         z.string().max(2000).trim().optional(),
  modelNumber:         z.string().max(100).trim().optional(),
  version:             z.string().max(50).trim().optional(),
  fda510kNumber:       z.string().max(100).trim().optional(),
  ceMmarkNumber:       z.string().max(100).trim().optional(),
  materialComposition: z.record(z.unknown()).optional(),
  dimensionsMm:        z.record(z.unknown()).optional(),
  compatibilityMatrix: z.record(z.unknown()).optional(),
  extractionTooling:   z.record(z.unknown()).optional(),
  sterilizationMethod: z.string().max(200).trim().optional(),
});

export const rejectDeviceSchema = z.object({
  reason: z.string().min(1).max(500).trim(),
});

// ── Derived types ──────────────────────────────────────────────────────────

export type DeviceSearch  = z.infer<typeof deviceSearchSchema>;
export type CreateDevice  = z.infer<typeof createDeviceSchema>;
export type RejectDevice  = z.infer<typeof rejectDeviceSchema>;
export type DeviceRegulatoryStatus = z.infer<typeof deviceRegulatoryStatusSchema>;
export type DeviceApprovalStatus   = z.infer<typeof deviceApprovalStatusSchema>;
