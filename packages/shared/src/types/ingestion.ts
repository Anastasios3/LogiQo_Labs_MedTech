// External API ingestion types

export type IngestionSource = "fda_recalls" | "fda_510k" | "gudid" | "eudamed";
export type IngestionStatus = "running" | "completed" | "failed";
export type SyncFrequency  = "manual" | "1h" | "6h" | "24h";

export interface IngestionRun {
  id:               string;
  source:           IngestionSource;
  status:           IngestionStatus;
  recordsIngested:  number;
  recordsSkipped:   number;
  errorMessage?:    string | null;
  startedAt:        string;
  completedAt?:     string | null;
  triggeredBy:      "manual" | "cron";
  triggeredByUserId?: string | null;
}

export interface DataSourceSettings {
  enabled:       boolean;
  syncFrequency: SyncFrequency;
  lastSyncAt?:   string | null;
}

export interface TenantDataSources {
  fdaRecalls: DataSourceSettings;
  fda510k:    DataSourceSettings;
  gudid:      DataSourceSettings;
  eudamed:    DataSourceSettings;
}

export const DEFAULT_DATA_SOURCES: TenantDataSources = {
  fdaRecalls: { enabled: false, syncFrequency: "manual", lastSyncAt: null },
  fda510k:    { enabled: false, syncFrequency: "manual", lastSyncAt: null },
  gudid:      { enabled: true,  syncFrequency: "manual", lastSyncAt: null },
  eudamed:    { enabled: false, syncFrequency: "manual", lastSyncAt: null },
};

export interface GudidDeviceInfo {
  brandName:          string;
  versionModelNumber: string;
  catalogNumber:      string;
  companyName:        string;
  gmdnPTName:         string;
  deviceDescription?: string;
  sterilization?:     { sterile: boolean; sterilizationPriorToUse: boolean } | null;
  deviceSizes?:       { type: string; value: string; unit: string }[] | null;
}
