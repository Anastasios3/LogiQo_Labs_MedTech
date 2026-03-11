/**
 * EUDAMED (European Database on Medical Devices) client — Phase 1 stub.
 *
 * Full integration requires EU EUDAMED registration credentials.
 * This module provides a connectivity test and documents the planned integration.
 *
 * Phase 2: Register at https://ec.europa.eu/tools/eudamed
 * Use OAuth2 client credentials flow for API access.
 */

const EUDAMED_BASE = "https://ec.europa.eu/tools/eudamed/api";

/**
 * Test EUDAMED API reachability.
 * Returns ok:true if we can reach the EUDAMED endpoint (even a 401 means reachable).
 * Returns ok:false if network timeout or DNS failure.
 */
export async function testConnection(): Promise<{ ok: boolean; message: string; requiresRegistration: boolean }> {
  try {
    const res = await fetch(`${EUDAMED_BASE}/devices/udiDis`, {
      headers: { "Accept": "application/json" },
      signal:  AbortSignal.timeout(8_000),
    });

    // 401 = API is reachable, just needs credentials
    // 403 = Reachable, needs registration
    // 200 = Publicly accessible endpoint
    const reachable = [200, 400, 401, 403, 404, 422].includes(res.status);
    const requiresRegistration = res.status === 401 || res.status === 403;

    return {
      ok:                  reachable,
      requiresRegistration,
      message: reachable
        ? requiresRegistration
          ? "EUDAMED is reachable but requires EU registration credentials."
          : "EUDAMED is reachable."
        : `EUDAMED returned HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      ok:                  false,
      requiresRegistration: false,
      message: e instanceof Error ? e.message : "EUDAMED is unreachable",
    };
  }
}
