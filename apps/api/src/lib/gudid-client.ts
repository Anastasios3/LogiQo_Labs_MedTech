/**
 * GUDID (Global Unique Device Identification Database) API client
 * Public API, no authentication required.
 * Docs: https://accessgudid.nlm.nih.gov/resources/developers
 */

import type { GudidDeviceInfo } from "@logiqo/shared";

const GUDID_BASE = "https://accessgudid.nlm.nih.gov/api/2.0";

interface GudidApiResponse {
  gudid?: {
    device?: {
      brandName?:          string;
      versionModelNumber?: string;
      catalogNumber?:      string;
      companyName?:        string;
      deviceDescription?:  string;
      gmdnTerms?: {
        gmdn?: {
          gmdnPTName?: string;
        }[];
      };
      sterilization?: {
        deviceSterile?:              boolean;
        sterilizationPriorToUse?:   boolean;
      };
      deviceSizes?: {
        deviceSize?: {
          sizeType?:  string;
          sizeValue?: string;
          sizeUnit?:  string;
        }[];
      };
    };
  };
  error?: string;
}

/**
 * Look up a device by its UDI (Unique Device Identifier).
 * Accepts full UDI strings like (01)00643169007222(17)141231(10)A213B1
 * Returns null if the UDI is not found or invalid.
 */
export async function lookupByUdi(udi: string): Promise<GudidDeviceInfo | null> {
  const encoded = encodeURIComponent(udi.trim());
  const url     = `${GUDID_BASE}/devices/lookup/${encoded}.json`;

  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "LogiQo-MedTech/1.0" },
      signal:  AbortSignal.timeout(10_000),
    });

    if (res.status === 404) return null;
    if (!res.ok) return null;

    const data = await res.json() as GudidApiResponse;
    const dev = data?.gudid?.device;
    if (!dev) return null;

    const gmdnName = dev.gmdnTerms?.gmdn?.[0]?.gmdnPTName ?? "";

    const sizes = dev.deviceSizes?.deviceSize?.map(s => ({
      type:  s.sizeType  ?? "",
      value: s.sizeValue ?? "",
      unit:  s.sizeUnit  ?? "",
    })) ?? [];

    return {
      brandName:          dev.brandName          ?? "",
      versionModelNumber: dev.versionModelNumber ?? "",
      catalogNumber:      dev.catalogNumber      ?? "",
      companyName:        dev.companyName        ?? "",
      deviceDescription:  dev.deviceDescription  ?? undefined,
      gmdnPTName:         gmdnName,
      sterilization: dev.sterilization
        ? {
            sterile:                 dev.sterilization.deviceSterile          ?? false,
            sterilizationPriorToUse: dev.sterilization.sterilizationPriorToUse ?? false,
          }
        : null,
      deviceSizes: sizes.length ? sizes : null,
    };
  } catch {
    return null;
  }
}

/**
 * Test GUDID connectivity. Returns true if the API is reachable.
 */
export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${GUDID_BASE}/devices/lookup/test.json`, {
      signal: AbortSignal.timeout(5_000),
    });
    // 404 = API is reachable (just no device with that UDI)
    const ok = res.status === 404 || res.ok;
    return { ok, message: ok ? "GUDID is reachable" : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Unreachable" };
  }
}
