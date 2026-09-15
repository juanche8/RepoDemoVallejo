import assert from "node:assert/strict";
import test from "node:test";
import { comparisonRange, rangeDays, rangesOverlap, resolveComparisonMode } from "../lib/date-ranges.ts";
import { skusForProduct } from "../lib/catalog.ts";
import { isAggregateSessionMetric, isProductEventMetric } from "../lib/metric-rules.ts";
import { sumPaid } from "../lib/paid-media-analytics.ts";
import { analyzePaidMediaDiscrepancy } from "../lib/paid-media-rules.ts";
import { attributionDiscrepancy } from "../lib/paid-media-rules.ts";
import { comparisonChange, coverageDays, dependentProductOptions, funnelKeys, isDrilldownCurrent, moduleAvailability, nonAdvancingVolume, participationDelta, participationShares, resetDependentFilters, sanitizeDependentFilters, segmentedSessionsNote } from "../lib/dashboard-rules.ts";
import { attributedValues, contextualCampaigns, filterPaidMediaRows } from "../lib/paid-media-filtering.ts";
import { paidMediaEmptyMessage } from "../lib/paid-media-rules.ts";

test("desplaza exactamente siete días conservando longitud y sin superposición", () => {
  const current = { from: "2026-07-16", to: "2026-07-22" };
  const compared = comparisonRange(current, "previous_week");
  assert.deepEqual(compared, { from: "2026-07-09", to: "2026-07-15" });
  assert.equal(rangeDays(compared), rangeDays(current));
  assert.equal(rangesOverlap(current, compared), false);
});

test("un producto puede resolver múltiples SKU", () => {
  const skus = [
    { skuId: "SKU-1", productId: "P-1" },
    { skuId: "SKU-2", productId: "P-1" },
    { skuId: "SKU-3", productId: "P-2" },
  ];
  assert.deepEqual(skusForProduct(skus, "P-1").map((sku) => sku.skuId), ["SKU-1", "SKU-2"]);
});

test("separa sesiones agregadas de eventos de producto", () => {
  const sessionRow = { sessions: 120 };
  const productRow = { productId: "P-1", sessions: 0 };
  assert.equal(isAggregateSessionMetric(sessionRow), true);
  assert.equal(isProductEventMetric(sessionRow), false);
  assert.equal(isAggregateSessionMetric(productRow), false);
  assert.equal(isProductEventMetric(productRow), true);
});

const paidRow = (overrides = {}) => ({
  impressions: 1000, reach: 600, reachIsAggregated: true, frequency: 1.67,
  clicks: 100, linkClicks: 90, landingPageViews: 70, spend: 1000,
  platformPurchases: 2, platformRevenue: 3000, ga4Sessions: 68,
  ga4ProductViews: 50, ga4AddToCarts: 10, ga4BeginCheckouts: 5,
  ga4Purchases: 2, ga4Revenue: 2800, vtexOrders: 2, vtexRevenue: 2900,
  ...overrides,
});

test("no suma alcance y solo calcula frecuencia para alcance agregado único", () => {
  const single = sumPaid([paidRow()]);
  assert.equal(single.reach, 600);
  assert.equal(single.frequency, 1000 / 600);
  const combined = sumPaid([paidRow(), paidRow({ reach: 500 })]);
  assert.equal(combined.reach, 0);
  assert.equal(combined.frequency, null);
  assert.equal(combined.reachIsAggregated, false);
});

test("genera alertas funcionales de link click, landing y sesión", () => {
  const lowLanding = analyzePaidMediaDiscrepancy({ linkClicks: 100, landingPageViews: 60, ga4Sessions: 58, spend: 1000 });
  assert.equal(lowLanding.lowLandingRate, true);
  const gap = analyzePaidMediaDiscrepancy({ linkClicks: 100, landingPageViews: 80, ga4Sessions: 50, spend: 1000 });
  assert.equal(gap.landingSessionDifference, 30);
  assert.equal(gap.landingSessionDifferenceRate, 37.5);
  assert.equal(gap.landingSessionGap, true);
  const noSessions = analyzePaidMediaDiscrepancy({ linkClicks: 20, landingPageViews: 12, ga4Sessions: 0, spend: 500 });
  assert.equal(noSessions.activeTrafficWithoutSessions, true);
});

test("sin comparación neutraliza variaciones y puntos porcentuales", () => {
  assert.equal(comparisonChange(120, 100, false), undefined);
  assert.equal(participationDelta(25, 20, false), null);
  assert.equal(participationDelta(25, 20, true), 5);
});

const baseFilters = {
  store: "Sportotal", macroCategory: "Calzado", category: "Running", brand: "Nike",
  product: "Producto 1", commercialChannel: "Ecommerce", acquisitionChannel: "Paid Search",
  province: "CABA", device: "Mobile",
};

test("resetea filtros dependientes según la jerarquía", () => {
  assert.deepEqual(resetDependentFilters(baseFilters, "store", "Freekick"), { ...baseFilters, store: "Freekick", macroCategory: "Todas", category: "Todas", brand: "Todas", product: "Todos" });
  assert.deepEqual(resetDependentFilters(baseFilters, "macroCategory", "Accesorios"), { ...baseFilters, macroCategory: "Accesorios", category: "Todas", product: "Todos" });
  assert.equal(resetDependentFilters(baseFilters, "category", "Urbano").product, "Todos");
  assert.equal(resetDependentFilters(baseFilters, "brand", "Adidas").product, "Todos");
  const sanitized = sanitizeDependentFilters({ ...baseFilters, macroCategory: "Accesorios", category: "Todas" }, [{ productId: "P-9", store: "Sportotal", macroCategory: "Accesorios", category: "Pelotas", brand: "Puma", name: "Pelota" }]);
  assert.equal(sanitized.brand, "Todas");
  assert.equal(sanitized.product, "Todos");
});

test("el embudo segmentado comienza en vistas", () => {
  assert.deepEqual(funnelKeys(true), ["productViews", "addToCarts", "beginCheckouts", "purchases"]);
  assert.deepEqual(funnelKeys(false), ["sessions", "productViews", "addToCarts", "beginCheckouts", "purchases"]);
});

const mediaRow = (overrides = {}) => ({
  date: "2026-07-20", ecommerce: "Sportotal", platform: "Meta Ads", campaignName: "Campaña A",
  macroCategory: "Calzado", category: "Running", brand: "Nike", productId: "P-1",
  province: "CABA", device: "Mobile", acquisitionChannel: "Paid Social", ...overrides,
});
const mediaContext = {
  store: "Sportotal", macroCategory: "Calzado", category: "Running", brand: "Nike",
  productId: "P-1", province: "CABA", device: "Mobile", acquisitionChannel: "Paid Social",
};

test("filtra medios pagos y campañas con el contexto completo", () => {
  const rows = [mediaRow(), mediaRow({ campaignName: "Campaña B", platform: "Google Ads" }), mediaRow({ ecommerce: "Freekick", campaignName: "Fuera" })];
  const range = { from: "2026-07-16", to: "2026-07-22" };
  assert.equal(filterPaidMediaRows(rows, mediaContext, range, "Meta Ads").length, 1);
  assert.deepEqual(contextualCampaigns(rows, mediaContext, range, "Meta Ads"), ["Campaña A"]);
});

test("selecciona productos y medios pagos por productId, no por nombre", () => {
  const rows = [mediaRow({ productId: "P-1", campaignName: "Producto correcto" }), mediaRow({ productId: "P-2", campaignName: "Mismo nombre externo" })];
  const range = { from: "2026-07-16", to: "2026-07-22" };
  const filtered = filterPaidMediaRows(rows, mediaContext, range);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].productId, "P-1");
});

test("genera marcas y productos solo desde combinaciones existentes", () => {
  const catalog = [
    { productId: "P-1", store: "Sportotal", macroCategory: "Calzado", category: "Running", brand: "Nike", name: "Runner" },
    { productId: "P-2", store: "Sportotal", macroCategory: "Calzado", category: "Urbano", brand: "Adidas", name: "Street" },
    { productId: "P-3", store: "Freekick", macroCategory: "Calzado", category: "Running", brand: "Puma", name: "Fast" },
  ];
  const options = dependentProductOptions({ ...baseFilters, category: "Running", brand: "Nike", product: "Todos" }, catalog);
  assert.deepEqual(options.brands, ["Nike"]);
  assert.deepEqual(options.products, [{ value: "P-1", label: "Runner" }]);
});

test("selecciona compras e ingresos de Plataforma, GA4 y VTEX", () => {
  const totals = paidRow({ platformPurchases: 10, platformRevenue: 1000, ga4Purchases: 8, ga4Revenue: 800, vtexOrders: 7, vtexRevenue: 700 });
  assert.deepEqual(attributedValues(totals, "platform"), { purchases: 10, revenue: 1000 });
  assert.deepEqual(attributedValues(totals, "ga4"), { purchases: 8, revenue: 800 });
  assert.deepEqual(attributedValues(totals, "vtex"), { purchases: 7, revenue: 700 });
});

test("clasifica correctamente discrepancias de atribución con cero", () => {
  assert.equal(attributionDiscrepancy(10, 0).severity, "critical");
  assert.equal(attributionDiscrepancy(0, 10).severity, "critical");
  assert.equal(attributionDiscrepancy(0, 0).alert, false);
  assert.equal(attributionDiscrepancy(120, 100).differenceRate, 20);
});

test("cobertura sin ventas se representa como sin rotación", () => {
  assert.equal(coverageDays(25, 0, 7), null);
  assert.equal(coverageDays(0, 0, 7), 0);
  assert.equal(coverageDays(20, 10, 5), 10);
});

test("medios pagos permanece disponible sin filas de producto", () => {
  const availability = moduleAvailability({ sessions: 0, productViews: 0, categories: 0, products: 0, paidRows: 2, alerts: 0 });
  assert.equal(availability.products, false);
  assert.equal(availability.paidMedia, true);
  assert.equal(availability.executiveSummary, true);
});

test("el drill-down deja de ser vigente al cambiar el contexto", () => {
  assert.equal(isDrilldownCurrent("contexto-a", "contexto-a"), true);
  assert.equal(isDrilldownCurrent("contexto-a", "contexto-b"), false);
});

test("el resumen pago vacío evita conclusiones, NaN e Infinity", () => {
  const text = paidMediaEmptyMessage(false, 0);
  assert.equal(text, "No se registraron datos de Paid Media para los filtros y período seleccionados.");
  assert.doesNotMatch(text, /NaN|Infinity|ROAS|participación/i);
});

test("resuelve comparación efectiva según la duración", () => {
  assert.equal(resolveComparisonMode({ from: "2026-07-22", to: "2026-07-22" }, "previous_day"), "previous_day");
  assert.equal(resolveComparisonMode({ from: "2026-07-16", to: "2026-07-22" }, "previous_week"), "previous_week");
  assert.equal(resolveComparisonMode({ from: "2026-07-01", to: "2026-07-22" }, "previous_week"), "previous_period");
  assert.equal(resolveComparisonMode({ from: "2026-07-16", to: "2026-07-22" }, "previous_day"), "previous_period");
  assert.equal(resolveComparisonMode({ from: "2026-07-16", to: "2026-07-22" }, "none"), "none");
});

test("las participaciones de macrocategoría suman aproximadamente 100%", () => {
  const shares = participationShares([550, 300, 150]);
  assert.ok(Math.abs(shares.reduce((sum, value) => sum + value, 0) - 100) < 0.000001);
  assert.ok(shares.every(Number.isFinite));
});

test("volumen que no avanzó solo informa disminuciones reales", () => {
  assert.deepEqual(nonAdvancingVolume(100, 70), { volume: 30, nextStageIsHigher: false });
  assert.deepEqual(nonAdvancingVolume(100, 100), { volume: 0, nextStageIsHigher: false });
  assert.deepEqual(nonAdvancingVolume(100, 120), { volume: 0, nextStageIsHigher: true });
});

test("la nota de sesiones aparece únicamente en el embudo segmentado", () => {
  assert.equal(segmentedSessionsNote(false), null);
  assert.equal(segmentedSessionsNote(true), "Las sesiones se muestran a nivel ecommerce. El análisis segmentado comienza en vistas de producto.");
});
