import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createVtexReadClient, assertReadOnlyMethod } from "../lib/integrations/vtex/client.ts";
import { getVtexCredentials } from "../lib/integrations/vtex/config.ts";
import { classifyVtexError, safeVtexError } from "../lib/integrations/vtex/errors.ts";
import { aggregateVtexInspection, containsPii } from "../lib/integrations/vtex/inspect.ts";

const environment = {
  VTEX_SPORTOTAL_ACCOUNT: "sportotal-test",
  VTEX_SPORTOTAL_APP_KEY: "secret-key",
  VTEX_SPORTOTAL_APP_TOKEN: "secret-token",
};

test("configura Sportotal sin exponer credenciales", () => {
  const config = getVtexCredentials("Sportotal", environment);
  assert.equal(config.ecommerce, "sportotal");
});

test("ecommerce desconocido no utiliza fallback", () => {
  assert.throws(() => getVtexCredentials("Vallejo Calzados", environment), /sin fallback/);
});

test("GET está permitido", () => {
  assert.doesNotThrow(() => assertReadOnlyMethod("GET"));
});

test("métodos de escritura están bloqueados", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) assert.throws(() => assertReadOnlyMethod(method), /únicamente GET/);
});

test("el cliente envía credenciales solo en headers server-side", async () => {
  let captured;
  const request = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ list: [], paging: { pages: 1 } }), { status: 200 });
  };
  const client = createVtexReadClient("Sportotal", environment, request);
  await client.listOrders("2026-07-16", "2026-07-22");
  assert.equal(captured.init.method, "GET");
  assert.equal(captured.url.includes("secret-key"), false);
  assert.equal(captured.url.includes("secret-token"), false);
});

test("el parsing agregado conserva métricas permitidas", () => {
  const result = aggregateVtexInspection([{ status: "invoiced", value: 12500, items: [{ quantity: 2 }], shippingData: { selectedAddresses: [{ state: "Córdoba", city: "Córdoba", postalCode: "5000" }] }, paymentData: { transactions: [{ gatewayName: "Gateway A", payments: [{ paymentSystemName: "Crédito", installments: 3 }] }] } }], { ecommerce: "sportotal", dateFrom: "2026-07-16", dateTo: "2026-07-22", requests: 2 });
  assert.equal(result.orders.found, 1);
  assert.equal(result.value.gross, 125);
  assert.equal(result.units.preliminaryTotal, 2);
});

test("clasifica errores VTEX de forma segura", () => {
  assert.equal(classifyVtexError(401).code, "VTEX_AUTH_ERROR");
  assert.equal(classifyVtexError(403).code, "VTEX_PERMISSION_DENIED");
  assert.equal(classifyVtexError(404).code, "VTEX_ACCOUNT_ERROR");
  assert.equal(classifyVtexError(429).code, "VTEX_RATE_LIMITED");
  assert.equal(classifyVtexError(503).code, "VTEX_API_UNAVAILABLE");
  assert.deepEqual(safeVtexError(new Error("token secret")), { code: "VTEX_UNKNOWN_ERROR" });
});

test("el resultado agregado no contiene PII", () => {
  const result = aggregateVtexInspection([], { ecommerce: "sportotal", dateFrom: "2026-07-16", dateTo: "2026-07-22", requests: 1 });
  assert.equal(containsPii(result), false);
});

test("las credenciales no usan prefijo público ni se referencian en UI", async () => {
  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.match(example, /VTEX_SPORTOTAL_APP_TOKEN=/);
  assert.doesNotMatch(example, /NEXT_PUBLIC_VTEX/);
});
