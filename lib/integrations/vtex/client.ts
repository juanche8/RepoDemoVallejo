import { getVtexCredentials } from "./config.ts";
import { classifyVtexError, VtexIntegrationError } from "./errors.ts";
import type { VtexOrderDetail, VtexOrdersResponse } from "./types.ts";

export type VtexRequest = (
  url: string,
  init: { method: "GET"; headers: Record<string, string> },
) => Promise<Response>;

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

export function assertReadOnlyMethod(method: string): asserts method is "GET" {
  if (method.toUpperCase() !== "GET") {
    throw new Error("VTEX_PERMISSION_DENIED: la integración permite únicamente GET.");
  }
}

function endpoint(account: string, path: string): string {
  return `https://${account}.vtexcommercestable.com.br${path}`;
}

async function vtexGet<T>(
  url: string,
  headers: Record<string, string>,
  request: VtexRequest,
): Promise<T> {
  let response: Response;
  try {
    response = await request(url, { method: "GET", headers });
  } catch {
    throw new VtexIntegrationError("VTEX_API_UNAVAILABLE");
  }
  if (!response.ok) throw classifyVtexError(response.status);
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object") throw new VtexIntegrationError("VTEX_BAD_RESPONSE", response.status);
  return payload as T;
}

export function createVtexReadClient(
  ecommerce: string,
  environment: Record<string, string | undefined> = process.env,
  request: VtexRequest = fetch,
) {
  if (typeof window !== "undefined") throw new Error("VTEX_CONFIG_MISSING: cliente solo disponible en servidor.");
  const credentials = getVtexCredentials(ecommerce, environment);
  const headers = {
    Accept: "application/json",
    "X-VTEX-API-AppKey": credentials.appKey,
    "X-VTEX-API-AppToken": credentials.appToken,
  };

  return {
    ecommerce: credentials.ecommerce,
    async listOrders(dateFrom: string, dateTo: string, page = 1, perPage = 100) {
      if (!validDate(dateFrom) || !validDate(dateTo) || dateFrom > dateTo) {
        throw new Error("VTEX_BAD_RESPONSE: rango inválido.");
      }
      const filter = encodeURIComponent(`creationDate:[${dateFrom}T00:00:00.000Z TO ${dateTo}T23:59:59.999Z]`);
      const url = endpoint(credentials.account, `/api/oms/pvt/orders?f_creationDate=${filter}&page=${page}&per_page=${perPage}&orderBy=creationDate,asc`);
      return vtexGet<VtexOrdersResponse>(url, headers, request);
    },
    async getOrder(orderId: string) {
      if (!orderId || !/^[\w-]+$/.test(orderId)) throw new Error("VTEX_BAD_RESPONSE: orderId inválido.");
      return vtexGet<VtexOrderDetail>(endpoint(credentials.account, `/api/oms/pvt/orders/${encodeURIComponent(orderId)}`), headers, request);
    },
  };
}
