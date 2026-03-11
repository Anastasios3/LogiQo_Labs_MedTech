/**
 * FDA OpenFDA Device API client
 * Docs: https://open.fda.gov/apis/device/
 * No API key required for low-volume queries; set FDA_API_KEY env for higher rate limits.
 */

const FDA_BASE = "https://api.fda.gov/device";
const API_KEY = process.env.FDA_API_KEY ?? "";

// ── Types ────────────────────────────────────────────────────────────────────

// Fields from the FDA /device/enforcement.json endpoint
// (enforcement has classification + recall_number; the /recall endpoint does not)
export interface FdaRecallResult {
  recall_number:            string;
  classification:           string;   // 'Class I' | 'Class II' | 'Class III'
  product_description:      string;
  reason_for_recall:        string;
  recall_initiation_date:   string;   // 'YYYYMMDD'
  status?:                  string;
  distribution_pattern?:    string;
  product_quantity?:        string;
  recalling_firm?:          string;
  country?:                 string;
  openfda?: {
    device_name?:           string[];
    k_number?:              string[];
    manufacturer_name?:     string[];
    registration_number?:   string[];
    fei_number?:            string[];
  };
}

export interface Fda510kResult {
  k_number:             string;
  applicant:            string;
  device_name:          string;
  decision_date:        string;   // 'YYYYMMDD'
  decision_description: string;
  product_code:         string;
  type?:                string;
  openfda?: {
    device_name?: string[];
    manufacturer_name?: string[];
  };
}

interface FdaApiResponse<T> {
  results: T[];
  meta?: {
    results?: {
      total: number;
      skip:  number;
      limit: number;
    };
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildParams(extra: Record<string, string | number>): string {
  const params = new URLSearchParams(extra as Record<string, string>);
  if (API_KEY) params.set("api_key", API_KEY);
  return params.toString();
}

async function fdaGet<T>(endpoint: string, params: Record<string, string | number>): Promise<T[]> {
  const qs  = buildParams(params);
  const url = `${FDA_BASE}/${endpoint}.json?${qs}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "LogiQo-MedTech/1.0 (contact@logiqo.io)" },
    signal:  AbortSignal.timeout(15_000),
  });

  if (res.status === 404) return []; // No results found — not an error
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`FDA API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as FdaApiResponse<T>;
  return data.results ?? [];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Severity mapping:
 *   Class I  → critical  (immediate hazard to health)
 *   Class II → high      (may cause adverse health consequences)
 *   Class III→ medium    (unlikely to cause adverse health consequences)
 */
export function recallClassToSeverity(recallClass: string): string {
  const cls = recallClass.toUpperCase();
  if (cls.includes("CLASS I"))   return "critical";
  if (cls.includes("CLASS II"))  return "high";
  if (cls.includes("CLASS III")) return "medium";
  return "low";
}

/**
 * Parse YYYYMMDD or ISO string into a Date.
 * Returns null if the input is falsy or unparseable.
 */
export function parseFdaDate(raw?: string): Date | null {
  if (!raw) return null;
  // FDA uses YYYYMMDD
  if (/^\d{8}$/.test(raw)) {
    return new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00Z`);
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Fetch recent device enforcement actions (recalls with Class I/II/III classification).
 * Uses /device/enforcement.json which includes the `classification` field.
 */
export async function fetchRecentRecalls(limit = 100, skip = 0): Promise<FdaRecallResult[]> {
  return fdaGet<FdaRecallResult>("enforcement", {
    limit,
    skip,
    sort:   "recall_initiation_date:desc",
    search: "product_type:Devices",
  });
}

/**
 * Fetch recent 510(k) clearances.
 */
export async function fetch510kClearances(limit = 100, skip = 0): Promise<Fda510kResult[]> {
  return fdaGet<Fda510kResult>("510k", {
    limit,
    skip,
    sort: "decision_date:desc",
    search: "decision_description:SUBSTANTIALLY+EQUIVALENT",
  });
}
