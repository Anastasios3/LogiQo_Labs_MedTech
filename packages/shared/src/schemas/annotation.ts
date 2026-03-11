import { z } from "zod";

// ── Enum schemas ────────────────────────────────────────────────────────────

export const annotationTypeSchema = z.enum([
  "operational_friction",
  "failure_mode",
  "material_tolerance",
  "tooling_anomaly",
  "general_observation",
]);

export const annotationSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export const annotationVisibilitySchema = z.enum(["tenant", "platform"]);

// ── Mutation schemas ────────────────────────────────────────────────────────

export const createAnnotationSchema = z.object({
  deviceId:       z.string().uuid("Invalid device ID"),
  annotationType: annotationTypeSchema,
  severity:       annotationSeveritySchema.optional(),
  title:          z.string().min(5).max(200).trim(),
  body:           z.string().min(20).max(10000).trim(),
  procedureType:  z.string().max(200).trim().optional(),
  /** ISO date string YYYY-MM-DD — stored as date, not timestamp (minimise PHI) */
  procedureDate:  z.string().date().optional(),
  /** Aggregate count only — never individual patient identifiers */
  patientCount:   z.number().int().min(1).optional(),
  visibility:     annotationVisibilitySchema.default("tenant"),
  structuredData: z.record(z.unknown()).optional(),
});

export const endorseAnnotationSchema = z.object({
  annotationId: z.string().uuid(),
});

export const moderateAnnotationSchema = z.object({
  action:      z.enum(["approve", "reject"]),
  reviewNotes: z.string().max(1000).trim().optional(),
});

// ── Derived types (unique to this schema — AnnotationType/AnnotationSeverity are in types/annotation.ts) ──

export type AnnotationVisibility = z.infer<typeof annotationVisibilitySchema>;
export type CreateAnnotation     = z.infer<typeof createAnnotationSchema>;
export type ModerateAnnotation   = z.infer<typeof moderateAnnotationSchema>;
