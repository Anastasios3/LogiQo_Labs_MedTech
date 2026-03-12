export type AlertType =
  | "recall"
  | "safety_notice"
  | "field_correction"
  | "hazard_alert";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface Alert {
  id: string;
  alertType: AlertType;
  source: string;
  externalId?: string | null;
  title: string;
  summary: string;
  severity: AlertSeverity;
  affectedSkus?: string[];
  publishedAt: string;
  expiresAt?: string | null;
  sourceUrl?: string | null;
  ingestedAt: string;
  createdAt: string;
}

/**
 * Alert enriched with per-tenant acknowledgement state.
 * Returned by GET /alerts.
 */
export interface AlertWithStatus extends Alert {
  /** Number of AlertDeviceLinks created for this alert. */
  affectedDeviceCount: number;
  /** Devices affected by this alert (id, name, sku only). */
  affectedDevices: Array<{
    id:   string;
    name: string;
    sku:  string;
  }>;
  /** True when the requesting tenant has NOT yet acknowledged the alert. */
  isUnread: boolean;
  /** True when the requesting tenant has acknowledged the alert. */
  acknowledged: boolean;
  /** ISO timestamp of acknowledgement, null if not yet acknowledged. */
  acknowledgedAt: string | null;
  /** Name + specialty of the user who acknowledged, null if not yet acknowledged. */
  acknowledgedBy: {
    fullName:  string;
    specialty: string | null;
  } | null;
}

/**
 * Response body returned by POST /alerts/:id/acknowledge.
 */
export interface AlertAcknowledgement {
  alertId:        string;
  alertTitle:     string;
  acknowledgedAt: string;
  notes?:         string | null;
}
