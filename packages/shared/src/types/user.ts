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
}

export interface UserReputation {
  userId: string;
  totalScore: number;
  weeklyScore: number;
  monthlyScore: number;
  updatedAt: string;
}
