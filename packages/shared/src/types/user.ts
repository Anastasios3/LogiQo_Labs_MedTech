export type UserRole =
  | "surgeon"
  | "hospital_safety_officer"
  | "system_admin"
  | "it_procurement";

/**
 * Verification tier scale:
 *  0 = Registered, email unverified (read-only)
 *  1 = Email verified via hospital domain (read + flag only)
 *  2 = NPI validated against public registry (full participation)
 *  3 = Manually reviewed by admin (trusted contributor, 1.5× vote weight)
 */
export type VerificationTier = 0 | 1 | 2 | 3;

/**
 * Subscription status values aligned with Stripe subscription states.
 *
 *  "none"      — no subscription record exists (free / trial / not yet subscribed)
 *  "active"    — paid subscription is current; full platform access granted
 *  "past_due"  — payment failed; Stripe is retrying; read-only grace period
 *  "canceled"  — subscription was explicitly canceled; access revoked at period end
 *  "trialing"  — within a Stripe trial period; treated as active for access checks
 */
export type SubscriptionStatus =
  | "none"
  | "active"
  | "past_due"
  | "canceled"
  | "trialing";

export interface User {
  id: string;
  tenantId: string;
  auth0UserId: string;
  email: string;
  fullName: string;
  role: UserRole;
  specialty?: string | null;
  npiNumber?: string | null;
  /** @deprecated use verificationTier instead */
  isVerifiedClinician?: boolean;
  verificationTier: VerificationTier;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  /**
   * Reflects the current Stripe subscription state for this user's tenant.
   * Absent (undefined) in API responses that do not join the subscription table;
   * always present in GET /users/me and the dashboard session.
   */
  subscriptionStatus?: SubscriptionStatus;
}

export interface UserReputation {
  userId: string;
  totalScore: number;
  weeklyScore: number;
  monthlyScore: number;
  updatedAt: string;
}
