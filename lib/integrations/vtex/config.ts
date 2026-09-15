import type { VtexCredentials, VtexEcommerce, VtexEnvironment } from "./types.ts";

export function normalizeVtexEcommerce(value: string): VtexEcommerce {
  if (value === "sportotal" || value === "Sportotal") return "sportotal";
  throw new Error("VTEX_CONFIG_MISSING: ecommerce no soportado y sin fallback.");
}

export function getVtexCredentials(
  ecommerce: string,
  environment: VtexEnvironment = process.env,
): VtexCredentials {
  const normalized = normalizeVtexEcommerce(ecommerce);
  const account = environment.VTEX_SPORTOTAL_ACCOUNT?.trim();
  const appKey = environment.VTEX_SPORTOTAL_APP_KEY?.trim();
  const appToken = environment.VTEX_SPORTOTAL_APP_TOKEN?.trim();
  if (!account || !appKey || !appToken) {
    throw new Error("VTEX_CONFIG_MISSING: faltan credenciales server-side para Sportotal.");
  }
  if (!/^[a-z0-9-]+$/i.test(account)) {
    throw new Error("VTEX_ACCOUNT_ERROR: nombre de cuenta inválido.");
  }
  return { ecommerce: normalized, account, appKey, appToken };
}
