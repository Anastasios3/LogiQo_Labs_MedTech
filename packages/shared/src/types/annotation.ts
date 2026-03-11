export type AnnotationType =
  | "operational_friction"
  | "failure_mode"
  | "material_tolerance"
  | "tooling_anomaly"
  | "general_observation";

export type AnnotationSeverity = "low" | "medium" | "high" | "critical";

export interface Annotation {
  id: string;
  deviceId: string;
  tenantId: string;
  annotationType: AnnotationType;
  severity?: AnnotationSeverity | null;
  title: string;
  body: string;
  procedureType?: string | null;
  procedureDate?: string | null;
  patientCount?: number | null;
  visibility: "tenant" | "platform";
  isPublished: boolean;
  version: number;
  parentId?: string | null;
  author?: {
    id: string;
    fullName: string;
    specialty?: string | null;
  } | null;
  /** Device info — included when fetching annotation feeds */
  device?: {
    id: string;
    name: string;
    sku: string;
  } | null;
  /** Prisma aggregate count for endorsements */
  _count?: {
    annotationEndorsements: number;
  };
  endorsementCount?: number;
  createdAt: string;
}
