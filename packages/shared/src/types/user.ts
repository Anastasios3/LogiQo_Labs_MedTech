export type UserRole =
  | "surgeon"
  | "hospital_safety_officer"
  | "system_admin"
  | "it_procurement";

export interface User {
  id: string;
  tenantId: string;
  auth0UserId: string;
  email: string;
  fullName: string;
  role: UserRole;
  specialty?: string | null;
  npiNumber?: string | null;
  isVerifiedClinician: boolean;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}
