import type { PaginatedResponse } from "./common.js";

export interface Manufacturer {
  id: string;
  name: string;
  slug: string;
  countryOfOrigin?: string | null;
  fdaEstablishmentId?: string | null;
}

export interface DeviceCategory {
  id: string;
  name: string;
  code: string;
  parentId?: string | null;
}

export interface DeviceDocument {
  id: string;
  documentType: "ifu" | "image" | "technical_spec" | "safety_notice";
  title: string;
  version?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  // s3Key is NEVER exposed to the frontend
}

export interface Device {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  modelNumber?: string | null;
  version?: string | null;
  fdA510kNumber?: string | null;
  ceMmarkNumber?: string | null;
  regulatoryStatus: "approved" | "recalled" | "pending" | "withdrawn";
  approvalStatus: "pending" | "approved" | "rejected";
  materialComposition?: Record<string, unknown> | null;
  dimensionsMm?: Record<string, unknown> | null;
  compatibilityMatrix?: Record<string, unknown> | null;
  extractionTooling?: Record<string, unknown> | null;
  sterilizationMethod?: string | null;
  manufacturer?: Pick<Manufacturer, "id" | "name" | "slug"> | null;
  category?: Pick<DeviceCategory, "id" | "name"> | null;
  documents?: DeviceDocument[];
  /** Prisma aggregate counts — included in list and detail responses */
  _count?: {
    annotations: number;
  };
  createdAt: string;
  updatedAt: string;
}

export type DeviceListResponse = PaginatedResponse<Device>;
