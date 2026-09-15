import assert from "node:assert/strict";
import test from "node:test";
import { MetaSuccessCache } from "../lib/integrations/meta-ads/cache.ts";
import { fetchMetaAdsData, fetchMetaInsights } from "../lib/integrations/meta-ads/client.ts";
import { MetaIntegrationError, metaPublicError } from "../lib/integrations/meta-ads/errors.ts";

process.env.META_SPORTOTAL_AD_ACCOUNT_ID = "1743789526536634";
process.env.META_VALLEJO_AD_ACCOUNT_ID = "2430398353976655";

const query = (ecommerce = "sportotal") => ({
  ecommerce,
  accessToken: "token-de-prueba",
  dateFrom: "2026-07-16",
  dateTo: "2026-07-22",
  level: "campaign",
});
const response = (status, error) => new Response(
  JSON.stringify(error ? { error } : { data: [] }),
  { status, headers: { "content-type": "application/json" } },
);
const capture = async (input, request) => {
  try {
    await fetchMetaInsights(input, request);
    return null;
  } catch (error) {
    return error;
  }
};

test("token válido devuelve datos", async () => {
  assert.deepEqual(await fetchMetaInsights(query(), async () => response(200)), []);
});

test("token expirado requiere reconexión", async () => {
  const error = await capture(query(), async () => response(401, { code: 190, error_subcode: 463, message: "Session expired" }));
  assert.equal(error.code, "META_TOKEN_EXPIRED");
  assert.equal(error.connectionStatus, "reauthorization_required");
});

test("token inválido requiere reconexión", async () => {
  const error = await capture(query(), async () => response(401, { code: 190, message: "Invalid token" }));
  assert.equal(error.code, "META_TOKEN_INVALID");
});

test("permiso ads_read faltante se distingue", async () => {
  const error = await capture(query(), async () => response(403, { code: 10, message: "Permission denied" }));
  assert.equal(error.code, "META_PERMISSION_DENIED");
  assert.equal(error.connectionStatus, "permission_error");
});

test("cuenta no accesible se distingue", async () => {
  const error = await capture(query("vallejo"), async () => response(403, { code: 200, message: "No access to this ad account" }));
  assert.equal(error.code, "META_ACCOUNT_ACCESS_DENIED");
  assert.equal(error.connectionStatus, "account_error");
});

test("rate limit se clasifica sin retry", async () => {
  let calls = 0;
  const error = await capture(query(), async () => {
    calls += 1;
    return response(429, { code: 4, message: "Rate limit" });
  });
  assert.equal(error.code, "META_RATE_LIMITED");
  assert.equal(calls, 1);
});

test("API unavailable se clasifica", async () => {
  const error = await capture(query(), async () => response(503, { code: 2, message: "Service unavailable" }));
  assert.equal(error.code, "META_API_UNAVAILABLE");
});

test("Sportotal puede fallar sin afectar Vallejo", async () => {
  const sportotal = await capture(query("sportotal"), async () => response(401, { code: 190 }));
  const vallejo = await fetchMetaInsights(query("vallejo"), async () => response(200));
  assert.equal(sportotal.context.ecommerce, "sportotal");
  assert.deepEqual(vallejo, []);
});

test("Vallejo puede fallar sin afectar Sportotal", async () => {
  const vallejo = await capture(query("vallejo"), async () => response(403, { code: 10 }));
  const sportotal = await fetchMetaInsights(query("sportotal"), async () => response(200));
  assert.equal(vallejo.context.ecommerce, "vallejo");
  assert.deepEqual(sportotal, []);
});

test("el token nunca aparece en el error público", async () => {
  const secret = "token-de-prueba";
  const error = await capture({ ...query(), accessToken: secret }, async () => response(401, { code: 190, message: secret }));
  assert.equal(JSON.stringify(metaPublicError(error)).includes(secret), false);
  assert.equal(error.message.includes(secret), false);
});

test("Account ID no se envía al frontend", async () => {
  const runner = async (input) => input.level === "account" ? [{ reach: "10" }] : [];
  const data = await fetchMetaAdsData({ ecommerce: "sportotal", accessToken: "test", dateFrom: "2026-07-16", dateTo: "2026-07-22" }, runner);
  assert.equal(JSON.stringify(data).includes("1743789526536634"), false);
});

test("un error de autenticación no queda cacheado", async () => {
  const cache = new MetaSuccessCache(300000);
  let calls = 0;
  const loader = async () => {
    calls += 1;
    throw new MetaIntegrationError("META_TOKEN_INVALID", "reauthorization_required", { ecommerce: "sportotal", accountId: "internal", dateFrom: "2026-07-16", dateTo: "2026-07-22", endpoint: "campaigns" });
  };
  await assert.rejects(cache.getOrLoad("sportotal", loader));
  await assert.rejects(cache.getOrLoad("sportotal", loader));
  assert.equal(calls, 2);
});

test("una respuesta exitosa sí utiliza caché", async () => {
  const cache = new MetaSuccessCache(300000);
  let calls = 0;
  const loader = async () => ({ calls: ++calls });
  assert.deepEqual(await cache.getOrLoad("vallejo", loader), { calls: 1 });
  assert.deepEqual(await cache.getOrLoad("vallejo", loader), { calls: 1 });
  assert.equal(calls, 1);
});

test("los métodos continúan siendo solo GET", async () => {
  let method = "";
  await fetchMetaInsights(query(), async (_url, init) => {
    method = init.method;
    return response(200);
  });
  assert.equal(method, "GET");
});
