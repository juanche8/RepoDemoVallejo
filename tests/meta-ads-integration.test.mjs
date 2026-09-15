import assert from "node:assert/strict";
import test from "node:test";
import { getMetaAdAccountId, normalizeMetaEcommerce } from "../lib/integrations/meta-ads/config.ts";
import { fetchMetaAdsData, fetchMetaInsights, metaCacheKey } from "../lib/integrations/meta-ads/client.ts";
import { META_CANONICAL_PURCHASE, normalizeMetaCampaign } from "../lib/integrations/meta-ads/normalize.ts";
import { previousEquivalentRange } from "../lib/integrations/ga4/dashboard.ts";

const accountEnvironment = {
  META_SPORTOTAL_AD_ACCOUNT_ID: "1743789526536634",
  META_VALLEJO_AD_ACCOUNT_ID: "2430398353976655",
};
process.env.META_SPORTOTAL_AD_ACCOUNT_ID = accountEnvironment.META_SPORTOTAL_AD_ACCOUNT_ID;
process.env.META_VALLEJO_AD_ACCOUNT_ID = accountEnvironment.META_VALLEJO_AD_ACCOUNT_ID;

function row({ id, name, spend, impressions, clicks, purchases, value }) {
  return {
    campaign_id: id,
    campaign_name: name,
    spend: String(spend),
    impressions: String(impressions),
    clicks: String(clicks),
    reach: "0",
    actions: [
      { action_type: META_CANONICAL_PURCHASE, value: String(purchases) },
      { action_type: "omni_purchase", value: String(purchases + 1) },
    ],
    action_values: [
      { action_type: META_CANONICAL_PURCHASE, value: String(value) },
      { action_type: "omni_purchase", value: String(value + 100) },
    ],
  };
}

const sportotalRow = row({ id: "st-1", name: "ST campaña", spend: 761150.98, impressions: 261243, clicks: 13400, purchases: 87, value: 11618862.96 });
const vallejoRow = row({ id: "vc-1", name: "VC campaña", spend: 520974.16, impressions: 295517, clicks: 11854, purchases: 60, value: 4530236.4 });
const mockRunner = async (query) => {
  if (query.level === "account") return [{ reach: query.ecommerce === "sportotal" ? "64143" : "132860" }];
  return [query.ecommerce === "sportotal" ? sportotalRow : vallejoRow];
};

test("Sportotal resuelve su cuenta explícita", () => {
  assert.equal(getMetaAdAccountId("Sportotal", accountEnvironment), "1743789526536634");
});

test("Vallejo resuelve su cuenta explícita", () => {
  assert.equal(getMetaAdAccountId("Vallejo Calzados", accountEnvironment), "2430398353976655");
});

test("rechaza un ecommerce desconocido", () => {
  assert.throws(() => normalizeMetaEcommerce("Freekick"), /no soportado/);
});

test("no usa fallback cuando falta la cuenta de la marca", () => {
  assert.throws(
    () => getMetaAdAccountId("Vallejo Calzados", { META_SPORTOTAL_AD_ACCOUNT_ID: "1743789526536634" }),
    /falta la cuenta configurada para vallejo/,
  );
});

test("la caché está separada por ecommerce", () => {
  assert.notEqual(
    metaCacheKey("sportotal", "1", "2026-07-16", "2026-07-22", "campaign"),
    metaCacheKey("vallejo", "1", "2026-07-16", "2026-07-22", "campaign"),
  );
});

test("la caché está separada por Account ID", () => {
  assert.notEqual(
    metaCacheKey("sportotal", "1743789526536634", "2026-07-16", "2026-07-22", "campaign"),
    metaCacheKey("sportotal", "2430398353976655", "2026-07-16", "2026-07-22", "campaign"),
  );
});

test("Sportotal no recibe campañas Vallejo", async () => {
  const data = await fetchMetaAdsData({ ecommerce: "sportotal", accessToken: "test", dateFrom: "2026-07-16", dateTo: "2026-07-22" }, mockRunner);
  assert.deepEqual(data.campaigns.map((campaign) => campaign.campaignId), ["st-1"]);
});

test("Vallejo no recibe campañas Sportotal", async () => {
  const data = await fetchMetaAdsData({ ecommerce: "vallejo", accessToken: "test", dateFrom: "2026-07-16", dateTo: "2026-07-22" }, mockRunner);
  assert.deepEqual(data.campaigns.map((campaign) => campaign.campaignId), ["vc-1"]);
});

test("ambas marcas usan la misma compra canónica sin sumar omni", () => {
  assert.equal(META_CANONICAL_PURCHASE, "offsite_conversion.fb_pixel_purchase");
  assert.equal(normalizeMetaCampaign(sportotalRow).purchases, 87);
  assert.equal(normalizeMetaCampaign(vallejoRow).purchases, 60);
});

test("la comparación usa el período anterior equivalente por marca", () => {
  const previous = previousEquivalentRange("2026-07-16", "2026-07-22");
  assert.deepEqual(previous, { dateFrom: "2026-07-09", dateTo: "2026-07-15" });
  assert.notEqual(
    metaCacheKey("vallejo", "2430398353976655", "2026-07-16", "2026-07-22", "campaign"),
    metaCacheKey("vallejo", "2430398353976655", previous.dateFrom, previous.dateTo, "campaign"),
  );
});

test("regresión de KPIs Sportotal", async () => {
  const { totals } = await fetchMetaAdsData({ ecommerce: "sportotal", accessToken: "test", dateFrom: "2026-07-16", dateTo: "2026-07-22" }, mockRunner);
  assert.equal(totals.spend, 761150.98);
  assert.equal(totals.purchases, 87);
  assert.equal(totals.attributedPurchaseValue, 11618862.96);
});

test("KPIs Vallejo", async () => {
  const { totals } = await fetchMetaAdsData({ ecommerce: "vallejo", accessToken: "test", dateFrom: "2026-07-16", dateTo: "2026-07-22" }, mockRunner);
  assert.equal(totals.spend, 520974.16);
  assert.equal(totals.impressions, 295517);
  assert.equal(totals.clicks, 11854);
  assert.equal(totals.purchases, 60);
  assert.equal(totals.attributedPurchaseValue, 4530236.4);
});

test("el cliente realiza exclusivamente GET", async () => {
  let method = "";
  await fetchMetaInsights(
    { ecommerce: "sportotal", accessToken: "test", dateFrom: "2026-07-16", dateTo: "2026-07-22", level: "campaign" },
    async (_url, init) => {
      method = init.method;
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    },
  );
  assert.equal(method, "GET");
});

test("el token y el Account ID no se exponen en el payload", async () => {
  const data = await fetchMetaAdsData({ ecommerce: "sportotal", accessToken: "token-super-secreto", dateFrom: "2026-07-16", dateTo: "2026-07-22" }, mockRunner);
  const serialized = JSON.stringify(data);
  assert.equal(serialized.includes("token-super-secreto"), false);
  assert.equal(serialized.includes("1743789526536634"), false);
});
