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
 */
import { lookupNpi } from "../lib/nppes.js";
import type { AuditEntry } from "../plugins/audit.js";
import type { PrismaClient } from "@logiqo/db";

// ── Typed error ────────────────────────────────────────────────────────────────

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

  // ── 2. Specialty cross-check (warn, don't block — MVP) ────────────────────
  // NPPES taxonomy descriptions use CMS terminology (e.g. "Internal Medicine").
  // A loose substring match covers most cases; phase 2 will replace this with
  // a precise CMS taxonomy code → internal specialty enum mapping.
  if (user.specialty && lookup.taxonomies?.length) {
    const specialtyLower = user.specialty.toLowerCase();
    const taxonomyMatch  = lookup.taxonomies.some(
      t =>
        t.desc.toLowerCase().includes(specialtyLower) ||
        specialtyLower.includes(t.desc.toLowerCase())
    );
    if (!taxonomyMatch) {
      log.warn(
        {
          npi:        npiNumber,
          specialty:  user.specialty,
          taxonomies: lookup.taxonomies.map(t => t.desc),
        },
        "NPI taxonomy does not match user specialty — auto-approving for MVP " +
        "(flag for manual review in phase 2)"
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
    },
  });

  return {
    npiNumber,
    npiName:          lookup.name,
    verificationTier: 2,
  };
}
