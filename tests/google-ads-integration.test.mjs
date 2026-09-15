import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchGoogleAdsCampaignReport,
  googleAdsDerivedMetrics,
  googleAdsTotals,
  normalizeGoogleAdsCustomerId,
  normalizeGoogleAdsResult,
  safeGoogleAdsError,
} from "../lib/integrations/google-ads/client.ts";

const apiRow = (overrides = {}) => ({
  campaign: {
    id: "123",
    name: "Search Marca",
    status: "ENABLED",
    advertisingChannelType: "SEARCH",
  },
  segments: { date: "2026-07-16" },
  metrics: {
    impressions: "1000",
    clicks: "100",
    costMicros: "25000000",
    conversions: "5",
    conversionsValue: "100000",
  },
  ...overrides,
});

test("normaliza customer ID sin guiones ni espacios", () => {
  assert.equal(normalizeGoogleAdsCustomerId("123-456-7890"), "1234567890");
});

test("convierte cost_micros a unidad monetaria", () => {
  assert.equal(normalizeGoogleAdsResult(apiRow()).cost, 25);
});

test("calcula CTR", () => {
  assert.equal(googleAdsDerivedMetrics({ impressions: 1000, clicks: 100, cost: 25, conversions: 5, attributedConversionValue: 100 }).ctr, 0.1);
});

test("calcula CPC", () => {
  assert.equal(googleAdsDerivedMetrics({ impressions: 1000, clicks: 100, cost: 25, conversions: 5, attributedConversionValue: 100 }).cpc, 0.25);
});

test("calcula CPA", () => {
  assert.equal(googleAdsDerivedMetrics({ impressions: 1000, clicks: 100, cost: 25, conversions: 5, attributedConversionValue: 100 }).cpa, 5);
});

test("calcula ROAS con valor atribuido de Google Ads", () => {
  assert.equal(googleAdsDerivedMetrics({ impressions: 1000, clicks: 100, cost: 25, conversions: 5, attributedConversionValue: 100 }).roas, 4);
});

test("maneja divisiones por cero", () => {
  assert.deepEqual(googleAdsDerivedMetrics({ impressions: 0, clicks: 0, cost: 0, conversions: 0, attributedConversionValue: 0 }), { ctr: null, cpc: null, cpa: null, roas: null });
});

test("conserva campaign type", () => {
  assert.equal(normalizeGoogleAdsResult(apiRow()).campaignType, "SEARCH");
});

test("maneja respuesta vacía", async () => {
  const rows = await fetchGoogleAdsCampaignReport(
    { customerId: "1234567890", dateFrom: "2026-07-16", dateTo: "2026-07-22" },
    { accessToken: "token-de-prueba", requester: async () => [] },
  );
  assert.deepEqual(rows, []);
  assert.deepEqual(googleAdsTotals(rows), { spend: 0, impressions: 0, clicks: 0, conversions: 0, attributedConversionValue: 0, ctr: null, cpc: null, cpa: null, roas: null });
});

test("devuelve un error de permisos seguro", () => {
  assert.equal(safeGoogleAdsError(403).message, "Google Ads: la cuenta de servicio no tiene acceso o el proyecto no posee nivel de API suficiente.");
});

test("los errores no exponen credenciales", () => {
  const secret = "private-key-no-exponer";
  const messages = [safeGoogleAdsError(401), safeGoogleAdsError(403), safeGoogleAdsError(500)]
    .map((error) => error.message).join(" ");
  assert.equal(messages.includes(secret), false);
  assert.equal(messages.includes("Authorization"), false);
  assert.equal(messages.includes("Bearer"), false);
});
