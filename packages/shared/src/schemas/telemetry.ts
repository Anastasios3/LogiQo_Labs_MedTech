/**
 * Zod schemas for Peer Telemetry interactions:
 * votes, comments, comment votes, flags, tags, verification tier.
 *
 * Used in both apps/api (route validation) and apps/web (form validation).
 */
import { z } from "zod";

// ── Votes ─────────────────────────────────────────────────────────────────────

export const castAnnotationVoteSchema = z.object({
  /** -1 = downvote, +1 = upvote */
  value: z.union([z.literal(-1), z.literal(1)]),
});

export type CastAnnotationVote = z.infer<typeof castAnnotationVoteSchema>;

// ── Comments ──────────────────────────────────────────────────────────────────

export const createCommentSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty").max(5000).trim(),
  /** UUID of parent comment — omit for top-level comments */
  parentId: z.string().uuid().optional(),
});

export type CreateComment = z.infer<typeof createCommentSchema>;

export const castCommentVoteSchema = z.object({
  value: z.union([z.literal(-1), z.literal(1)]),
});

export type CastCommentVote = z.infer<typeof castCommentVoteSchema>;

// ── Flags ─────────────────────────────────────────────────────────────────────

export const flagReasonSchema = z.enum([
  "dangerous",
  "inaccurate",
  "spam",
  "conflict_of_interest",
]);

export const createFlagSchema = z.object({
  reason: flagReasonSchema,
  notes: z.string().max(2000).trim().optional(),
});

export type FlagReasonEnum = z.infer<typeof flagReasonSchema>;
export type CreateFlag     = z.infer<typeof createFlagSchema>;

export const resolveFlagSchema = z.object({
  resolution: z.string().min(1).max(500).trim(),
});

export type ResolveFlag = z.infer<typeof resolveFlagSchema>;

// ── Tags ──────────────────────────────────────────────────────────────────────

export const tagCategorySchema = z.enum([
  "device_type",
  "specialty",
  "material",
  "procedure",
]);

export const createTagSchema = z.object({
  name:     z.string().min(1).max(80).trim(),
  slug:     z.string().min(1).max(80).toLowerCase().regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  category: tagCategorySchema,
});

export type CreateTag        = z.infer<typeof createTagSchema>;
export type TagCategoryEnum  = z.infer<typeof tagCategorySchema>;

/** Attach / detach tags on an annotation */
export const updateAnnotationTagsSchema = z.object({
  /** Tag slugs to attach */
  add:    z.array(z.string().max(80)).max(10).default([]),
  /** Tag slugs to detach */
  remove: z.array(z.string().max(80)).max(10).default([]),
});

export type UpdateAnnotationTags = z.infer<typeof updateAnnotationTagsSchema>;

// ── Verification tier ─────────────────────────────────────────────────────────

/**
 * User submits NPI number to request tier-2 verification.
 * Backend validates against public NPI registry.
 */
export const requestNpiVerificationSchema = z.object({
  npiNumber: z
    .string()
    .regex(/^\d{10}$/, "NPI must be exactly 10 digits"),
});

export type RequestNpiVerification = z.infer<typeof requestNpiVerificationSchema>;

/**
 * Admin promotes / demotes a user's verification tier (0-3).
 */
export const adminSetVerificationTierSchema = z.object({
  tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  reason: z.string().max(500).trim().optional(),
});

export type AdminSetVerificationTier = z.infer<typeof adminSetVerificationTierSchema>;

// ── Annotation feed query ─────────────────────────────────────────────────────

export const annotationFeedQuerySchema = z.object({
  /** Ranking strategy */
  sort:       z.enum(["top", "newest", "discussed"]).default("top"),
  deviceId:   z.string().uuid().optional(),
  /** Filter by tag slug */
  tag:        z.string().optional(),
  /** Filter by annotation type */
  type:       z.string().optional(),
  /** Filter by severity */
  severity:   z.enum(["low", "medium", "high", "critical"]).optional(),
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(50).default(20),
});

export type AnnotationFeedQuery = z.infer<typeof annotationFeedQuerySchema>;
