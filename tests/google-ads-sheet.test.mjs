import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGoogleAdsSheetValues, validateGoogleAdsSheetHeaders } from "../lib/integrations/google-ads/sheet-normalize.ts";
import { readSheetRange, SHEETS_READONLY_SCOPE } from "../lib/integrations/google-sheets/client.ts";
import { headers, validRow } from "./fixtures/google-ads-sheet.mjs";

test("acepta headers correctos", () => {
  assert.equal(validateGoogleAdsSheetHeaders(headers).get("campaign_name"), 2);
});

test("normaliza headers reordenados por nombre", () => {
  const order = ["campaign_name", ...headers.filter((header) => header !== "campaign_name")];
  const row = order.map((header) => validRow[headers.indexOf(header)]);
  assert.equal(normalizeGoogleAdsSheetValues({ values: [order, row] })[0].campaignName, "Search Marca");
});

test("normaliza una fila válida", () => {
  const row = normalizeGoogleAdsSheetValues({ values: [headers, validRow] })[0];
  assert.equal(row.date, "2026-07-16");
  assert.equal(row.campaignId, "123456");
  assert.equal(row.impressions, 1000);
});

test("conserva números decimales", () => {
  const row = normalizeGoogleAdsSheetValues({ values: [headers, validRow] })[0];
  assert.equal(row.cost, 25000.5);
  assert.equal(row.conversions, 5.25);
  assert.equal(row.conversionValue, 100000.75);
});

test("acepta cero conversiones", () => {
  const row = [...validRow];
  row[headers.indexOf("conversions")] = "0";
  row[headers.indexOf("cpa")] = "0";
  assert.equal(normalizeGoogleAdsSheetValues({ values: [headers, row] })[0].conversions, 0);
});

test("acepta costo cero", () => {
  const row = [...validRow];
  row[headers.indexOf("cost")] = "0";
  row[headers.indexOf("roas")] = "0";
  assert.equal(normalizeGoogleAdsSheetValues({ values: [headers, row] })[0].cost, 0);
});

test("rechaza una fila con número inválido sin devolver NaN", () => {
  const row = [...validRow];
  row[headers.indexOf("clicks")] = "no-numérico";
  assert.throws(() => normalizeGoogleAdsSheetValues({ values: [headers, row] }), /número inválido en clicks/);
});

test("informa columnas obligatorias faltantes", () => {
  assert.throws(() => validateGoogleAdsSheetHeaders(headers.filter((header) => header !== "roas")), /roas/);
});

test("una respuesta vacía devuelve un array vacío", () => {
  assert.deepEqual(normalizeGoogleAdsSheetValues({}), []);
  assert.deepEqual(normalizeGoogleAdsSheetValues({ values: [] }), []);
});

test("el lector usa scope readonly y no expone secretos en errores", async () => {
  const secret = "token-secreto-no-exponer";
  assert.equal(SHEETS_READONLY_SCOPE, "https://www.googleapis.com/auth/spreadsheets.readonly");
  await assert.rejects(
    readSheetRange(
      { spreadsheetId: "sheet-id", sheetName: "campaign_daily", range: "A:N" },
      { accessToken: secret, request: async () => new Response(null, { status: 403 }) },
    ),
    (error) => error instanceof Error
      && error.message === "Google Sheets: la cuenta de servicio no tiene acceso de lectura."
      && !error.message.includes(secret)
      && !error.message.includes("Authorization"),
  );
});
