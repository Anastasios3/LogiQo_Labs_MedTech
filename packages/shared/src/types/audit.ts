export interface AuditLog {
  id: string;
  userId?: string | null;
  tenantId?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  responseStatus?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
  createdAt: string;
}
