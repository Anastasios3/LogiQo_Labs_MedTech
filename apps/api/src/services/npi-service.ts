/**
 * NPI verification service.
 *
 * Shared promotion logic used by both:
 *   - PATCH /users/me/verification   (usersRoutes)
 *   - POST  /auth/submit-npi         (authRoutes)
 *
 * Centralises NPI lookup, specialty cross-check, DB promotion to tier 2,
 * reputation upsert, and audit write so that both paths produce identical
 * audit log entries (action: "user.npi.verified") and identical DB state.
 *
 * Callers supply a curried audit function to keep this module free of
 * Fastify request dependencies:
 *
 *   audit: (entry) => fastify.audit(request, entry)
 *
 * Phase 2 — manual specialty review:
 *   When taxonomy mismatch detection is hardened (CMS code mapping, not just
 *   substring matching), callers should gate on result.specialtyMismatch:
 *
 *     const result = await promoteUserToNpiVerified(params);
 *     if (result.specialtyMismatch) {
 *       // Hold at tier 2-pending, queue for manual clinician review.
 *       // promoteUserToNpiVerified() has already written to DB and audit;
 *       // callers only need to add the hold/review-queue step here.
 *     }
 *
 *   The return interface is already stable — adding the branch in Phase 2
 *   requires no changes to this service's signature or to the other caller.
 */
import { lookupNpi } from "../lib/nppes.js";
import type { AuditEntry } from "../plugins/audit.js";
import type { PrismaClient } from "@logiqo/db";

// ── Typed errors ───────────────────────────────────────────────────────────────

/**
 * Thrown when an NPI is not found in the NPPES registry.
 * Callers should map this to HTTP 422.
 */
export class NpiNotFoundError extends Error {
  constructor(public readonly npiNumber: string) {
    super(`NPI ${npiNumber} not found in the NPPES registry`);
    this.name = "NpiNotFoundError";
  }
}

/**
 * Defined now for Phase 2 — NOT thrown in Phase 1.
 *
 * In Phase 2, when the specialty cross-check is upgraded from a loose
 * substring match to a precise CMS taxonomy code → specialty enum mapping,
 * callers that want to block promotion entirely on a mismatch can throw this
 * from a wrapper or catch it from this service (if the service is updated to
 * throw rather than warn). Callers that prefer manual-review-hold should
 * instead rely on `NpiVerificationResult.specialtyMismatch` and never throw.
 *
 * The class is exported now so Phase 2 code can `instanceof`-check it without
 * a source change to this module's public surface.
 */
export class SpecialtyMismatchError extends Error {
  constructor(
    public readonly npiNumber:  string,
    public readonly specialty:  string,
    public readonly taxonomies: string[],
  ) {
    super(
      `NPI ${npiNumber} taxonomy [${taxonomies.join(", ")}] does not match ` +
      `declared specialty "${specialty}"`
    );
    this.name = "SpecialtyMismatchError";
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

/** User fields required by the promotion service (pre-loaded by the caller). */
export interface NpiVerificationUser {
  id:        string;
  tenantId:  string;
  email:     string;
  role:      string;
  specialty: string | null;
}

export interface PromoteToNpiVerifiedParams {
  db:    PrismaClient;
  /** Only `warn` is used — pass `fastify.log` directly. */
  log:   { warn: (...args: any[]) => void };
  /** Curried audit fn: `(entry) => fastify.audit(request, entry)` */
  audit: (entry: AuditEntry) => Promise<void>;
  user:  NpiVerificationUser;
  npiNumber: string;
}

export interface NpiVerificationResult {
  npiNumber:        string;
  npiName:          string | undefined;
  verificationTier: 2;
  /**
   * True when the NPPES taxonomy descriptions do not match the user's declared
   * specialty. Phase 1: user is still promoted (auto-approve) and callers may
   * log or ignore this flag. Phase 2: callers should check this flag and
   * conditionally hold the user at tier-2-pending for manual review.
   *
   * False when either party is absent — a mismatch is only detectable when
   * both the user's specialty and the NPI's taxonomy entries are present.
   */
  specialtyMismatch: boolean;
}

// ── Service function ───────────────────────────────────────────────────────────

/**
 * Look up an NPI, run the specialty cross-check, promote the user to
 * verification tier 2, upsert their reputation record, and write an
 * audit log entry.
 *
 * Throws `NpiNotFoundError` when the NPPES registry returns no match.
 * All other failures propagate as-is to the caller.
 */
export async function promoteUserToNpiVerified(
  params: PromoteToNpiVerifiedParams,
): Promise<NpiVerificationResult> {
  const { db, log, audit, user, npiNumber } = params;

  // ── 1. NPPES registry lookup ───────────────────────────────────────────────
  const lookup = await lookupNpi(npiNumber);
  if (!lookup.valid) {
    throw new NpiNotFoundError(npiNumber);
  }

  // ── 2. Specialty cross-check ───────────────────────────────────────────────
  // Phase 1 (MVP): loose substring match on NPPES taxonomy descriptions.
  // Auto-approves regardless of result; mismatch is surfaced via the
  // specialtyMismatch flag in the return value so callers can observe it
  // without this service blocking promotion.
  //
  // Phase 2: replace with a precise CMS taxonomy code → internal specialty
  // enum mapping. At that point, callers should gate on specialtyMismatch to
  // hold the user at tier-2-pending for manual review (see module JSDoc).
  //
  // specialtyMismatch is false when either side is absent — only detectable
  // when both user.specialty and lookup.taxonomies are populated.
  let specialtyMismatch = false;

  if (user.specialty && lookup.taxonomies?.length) {
    const specialtyLower = user.specialty.toLowerCase();
    const taxonomyMatch  = lookup.taxonomies.some(
      t =>
        t.desc.toLowerCase().includes(specialtyLower) ||
        specialtyLower.includes(t.desc.toLowerCase())
    );
    if (!taxonomyMatch) {
      specialtyMismatch = true;
      log.warn(
        {
          npi:        npiNumber,
          specialty:  user.specialty,
          taxonomies: lookup.taxonomies.map(t => t.desc),
        },
        "NPI taxonomy does not match user specialty — auto-approving for MVP " +
        "(specialtyMismatch=true returned to caller; gate on this flag in phase 2)"
      );
    }
  }

  // ── 3. Promote to tier 2 in DB ────────────────────────────────────────────
  await db.user.update({
    where: { id: user.id },
    data:  {
      npiNumber,
      verificationTier:        2,
      verificationSubmittedAt: new Date(),
      verificationApprovedAt:  new Date(),
    },
  });

  // ── 4. Ensure reputation record exists ────────────────────────────────────
  // community actions (votes, comments) require a reputation row.
  await db.userReputation.upsert({
    where:  { userId: user.id },
    create: { userId: user.id, totalScore: 0, weeklyScore: 0, monthlyScore: 0 },
    update: {},
  });

  // ── 5. Audit — identical entry regardless of which endpoint triggered this ─
  await audit({
    action:       "user.npi.verified",
    resourceType: "user",
    resourceId:   user.id,
    newValues:    {
      npiNumber,
      npiName:          lookup.name,
      verificationTier: 2,
      specialtyMismatch,
    },
  });

  return {
    npiNumber,
    npiName:          lookup.name,
    verificationTier: 2,
    specialtyMismatch,
  };
}
