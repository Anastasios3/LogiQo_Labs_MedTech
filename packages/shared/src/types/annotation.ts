export type AnnotationType =
  | "operational_friction"
  | "failure_mode"
  | "material_tolerance"
  | "tooling_anomaly"
  | "general_observation";

export type AnnotationSeverity = "low" | "medium" | "high" | "critical";

export type AnnotationStatus = "draft" | "published" | "flagged" | "removed";

export interface Annotation {
  id: string;
  deviceId: string;
  tenantId: string;
  annotationType: AnnotationType;
  severity?: AnnotationSeverity | null;
  title: string;
  body: string;
  procedureType?: string | null;
  procedureDate?: string | null;
  patientCount?: number | null;
  visibility: "tenant" | "platform";
  /** Legacy boolean — kept for backwards compat. Prefer `status`. */
  isPublished: boolean;
  /** Lifecycle status (Phase 6). draft | published | flagged | removed */
  status: AnnotationStatus;
  publishedAt?: string | null;
  flaggedReason?: string | null;
  version: number;
  parentId?: string | null;
  author?: {
    id: string;
    fullName: string;
    specialty?: string | null;
    verificationTier: number;
  } | null;
  /** Device info — included when fetching annotation feeds */
  device?: {
    id: string;
    name: string;
    sku: string;
  } | null;
  /** Prisma aggregate count for endorsements */
  _count?: {
    annotationEndorsements: number;
    votes?: number;
    comments?: number;
  };
  /** Denormalized endorsement counter — updated atomically on each endorse action */
  endorsementCount: number;
  /** Denormalized flag counter — triggers auto-escalation at >= 3 */
  flagCount: number;
  /** Whether the requesting user has endorsed this annotation */
  userHasEndorsed?: boolean;
  /** Weighted vote score (used for ranking) */
  voteScore?: number;
  /** User's own vote on this annotation (-1, 0, or +1) */
  userVote?: -1 | 0 | 1 | null;
  /** Tag slugs attached to this annotation */
  tags?: AnnotationTagLink[];
  createdAt: string;
}

// ── Votes ─────────────────────────────────────────────────────────────────────

export interface AnnotationVote {
  id: string;
  annotationId: string;
  userId: string;
  /** -1 (downvote) or +1 (upvote) */
  value: -1 | 1;
  /**
   * Computed at write time:
   *   voter.specialty === device.category.specialtyHint → 1.5
   *   related specialty                                  → 1.0
   *   unrelated                                          → 0.6
   */
  specialtyRelevanceScore: number;
  createdAt: string;
}

// ── Comments ──────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  annotationId: string;
  parentId?: string | null;
  authorId: string;
  tenantId: string;
  body: string;
  /** 0 = top-level, 1 = reply, 2 = nested reply (max) */
  depth: 0 | 1 | 2;
  isAnonymized: boolean;
  isPublished: boolean;
  author?: {
    id: string;
    fullName: string;
    specialty?: string | null;
    verificationTier: number;
  } | null;
  replies?: Comment[];
  /** User's own vote on this comment */
  userVote?: -1 | 0 | 1 | null;
  voteScore?: number;
  createdAt: string;
}

export interface CommentVote {
  id: string;
  commentId: string;
  userId: string;
  value: -1 | 1;
  createdAt: string;
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export type TagCategory = "device_type" | "specialty" | "material" | "procedure";

export interface AnnotationTag {
  id: string;
  name: string;
  slug: string;
  category: TagCategory;
}

export interface AnnotationTagLink {
  annotationId: string;
  tagId: string;
  tag?: AnnotationTag;
}

// ── Flags ─────────────────────────────────────────────────────────────────────

export type FlagReason =
  | "dangerous"
  | "inaccurate"
  | "spam"
  | "conflict_of_interest";

export interface AnnotationFlag {
  id: string;
  annotationId: string;
  flaggedById: string;
  reason: FlagReason;
  notes?: string | null;
  resolvedById?: string | null;
  resolvedAt?: string | null;
  resolution?: string | null;
  createdAt: string;
}
