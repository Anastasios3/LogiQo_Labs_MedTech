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
