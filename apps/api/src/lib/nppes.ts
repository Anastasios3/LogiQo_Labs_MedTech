/**
 * NPPES NPI Registry lookup helper.
 *
 * Public REST API — no key required.
 * Rate-limit: ~1 req/s per NPPES usage guidelines.
 * Docs: https://npiregistry.cms.hhs.gov/api-page
 */

export interface NppesTaxonomy {
  code:    string;
  /** Human-readable specialty description (e.g. "Internal Medicine") */
  desc:    string;
  primary: boolean;
}

export interface NppesLookupResult {
  valid:       boolean;
  /** Provider display name (individual or organisation) */
  name?:       string;
  /** Taxonomy / specialty classifications returned by NPPES */
  taxonomies?: NppesTaxonomy[];
}

/**
 * Look up a 10-digit NPI in the NPPES public registry.
 *
 * Returns `{ valid: false }` for any non-200 response, missing result, or
 * network error so callers can treat all failure modes uniformly.
 */
export async function lookupNpi(npi: string): Promise<NppesLookupResult> {
  try {
    const url = `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`;
    const res  = await fetch(url, {
      headers: { "User-Agent": "LogiQo-MedTech/1.0 (contact@logiqo.io)" },
      signal:  AbortSignal.timeout(8_000),
    });

    if (!res.ok) return { valid: false };

    const data = await res.json() as any;
    if (!data.results?.length) return { valid: false };

    const result = data.results[0];

    // NPPES field priority (v2.1 API):
    //   1. basic.last_name / basic.first_name      — individual providers (most common)
    //   2. authorized_official_{last,first}_name   — org's authorised official (fallback)
    //   3. organization_name                       — organisation name
    //   4. "Unknown"                               — last resort
    const name = result.basic?.last_name
      ? `${result.basic.first_name ?? ""} ${result.basic.last_name}`.trim()
      : result.basic?.authorized_official_last_name
        ? `${result.basic.authorized_official_first_name ?? ""} ${result.basic.authorized_official_last_name}`.trim()
        : result.basic?.organization_name
          ?? "Unknown";

    const taxonomies: NppesTaxonomy[] = (result.taxonomies ?? []).map((t: any) => ({
      code:    String(t.code    ?? ""),
      desc:    String(t.desc    ?? ""),
      primary: Boolean(t.primary),
    }));

    return { valid: true, name, taxonomies };
  } catch {
    return { valid: false };
  }
}
