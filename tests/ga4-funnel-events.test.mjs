import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchGA4DashboardData,
  GA4_FUNNEL_EVENT_NAMES,
  GA4_FUNNEL_EVENTS_REPORT,
  ga4DashboardCacheKey,
  ga4FunnelRate,
  normalizeGA4FunnelEvents,
} from "../lib/integrations/ga4/dashboard.ts";

const input = {
  propertyId: "271269023",
  ecommerce: "Sportotal",
  dateFrom: "2026-07-16",
  dateTo: "2026-07-22",
};

const eventResponse = (entries) => ({
  dimensionHeaders: [{ name: "eventName" }],
  metricHeaders: [{ name: "eventCount" }, { name: "totalUsers" }],
  rows: entries.map(([name, count, users = count]) => ({
    dimensionValues: [{ value: name }],
    metricValues: [{ value: String(count) }, { value: String(users) }],
  })),
  rowCount: entries.length,
});

const globalResponse = {
  metricHeaders: [
    "activeUsers",
    "newUsers",
    "sessions",
    "ecommercePurchases",
    "purchaseRevenue",
  ].map((name) => ({ name })),
  rows: [{
    metricValues: [80, 40, 100, 5, 1200].map((value) => ({
      value: String(value),
    })),
  }],
  rowCount: 1,
};

test("normaliza view_item", () => {
  assert.equal(normalizeGA4FunnelEvents(eventResponse([["view_item", 91]])).viewItem, 91);
});

test("normaliza add_to_cart", () => {
  assert.equal(normalizeGA4FunnelEvents(eventResponse([["add_to_cart", 32]])).addToCart, 32);
});

test("normaliza begin_checkout", () => {
  assert.equal(normalizeGA4FunnelEvents(eventResponse([["begin_checkout", 17]])).beginCheckout, 17);
});

test("parsea eventCount entero", () => {
  assert.equal(normalizeGA4FunnelEvents(eventResponse([["purchase", "12"]])).purchaseEventCount, 12);
});

test("un evento ausente queda en cero", () => {
  assert.equal(normalizeGA4FunnelEvents(eventResponse([["view_item", 10]])).addToCart, 0);
});

test("ignora eventos extra", () => {
  const result = normalizeGA4FunnelEvents(eventResponse([
    ["view_item", 10],
    ["page_view", 999],
  ]));
  assert.equal(result.viewItem, 10);
  assert.equal(result.viewItemUsers, 10);
  assert.equal(result.addToCart, 0);
  assert.equal(result.purchaseEventCount, 0);
});

test("el filtro contiene solamente los eventos requeridos", () => {
  assert.deepEqual(
    GA4_FUNNEL_EVENTS_REPORT.dimensionFilter.filter.inListFilter.values,
    GA4_FUNNEL_EVENT_NAMES,
  );
});

test("ecommercePurchases sigue siendo la compra oficial", async () => {
  const data = await fetchGA4DashboardData(input, async (_query, definition) => {
    if (definition.dimensions.length === 0) return globalResponse;
    if (definition.dimensions.includes("eventName")) {
      return eventResponse([["purchase", 7]]);
    }
    return { rows: [], rowCount: 0 };
  }, "2026-09-11T12:00:00.000Z");
  assert.equal(data.totals.purchases, 5);
  assert.equal(data.funnelEvents.purchaseEventCount, 7);
});

test("las tasas principales se calculan con usuarios", () => {
  const events = normalizeGA4FunnelEvents(eventResponse([
    ["view_item", 60447, 21840],
    ["add_to_cart", 3120, 1490],
  ]));
  assert.equal(ga4FunnelRate(events.addToCartUsers, events.viewItemUsers).toFixed(1), "6.8");
});

test("eventCount no determina la conversión principal", () => {
  const events = normalizeGA4FunnelEvents(eventResponse([
    ["view_item", 60447, 21840],
    ["add_to_cart", 3120, 1490],
  ]));
  assert.notEqual(
    ga4FunnelRate(events.addToCartUsers, events.viewItemUsers),
    ga4FunnelRate(events.addToCart, events.viewItem),
  );
});

test("purchaseUsers queda separado de ecommercePurchases", async () => {
  const data = await fetchGA4DashboardData(input, async (_query, definition) => {
    if (definition.dimensions.length === 0) return globalResponse;
    if (definition.dimensions.includes("eventName")) {
      return eventResponse([["purchase", 212, 208]]);
    }
    return { rows: [], rowCount: 0 };
  }, "2026-09-11T12:00:00.000Z");
  assert.equal(data.funnelEvents.purchaseUsers, 208);
  assert.equal(data.totals.purchases, 5);
});

test("la división por cero es segura", () => {
  assert.equal(ga4FunnelRate(10, 0), 0);
  assert.equal(Number.isFinite(ga4FunnelRate(10, 0)), true);
});

test("el fallo de eventos no rompe los KPI globales", async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    const data = await fetchGA4DashboardData(input, async (_query, definition) => {
      if (definition.dimensions.length === 0) return globalResponse;
      if (definition.dimensions.includes("eventName")) throw new Error("event failure");
      return { rows: [], rowCount: 0 };
    }, "2026-09-11T12:00:00.000Z");
    assert.equal(data.totals.sessions, 100);
    assert.equal(data.funnelEventsAvailable, false);
  } finally {
    console.warn = originalWarn;
  }
});

test("el cache se separa por propertyId y rango", () => {
  const key = ga4DashboardCacheKey(input);
  assert.notEqual(key, ga4DashboardCacheKey({ ...input, propertyId: "2" }));
  assert.notEqual(key, ga4DashboardCacheKey({ ...input, dateFrom: "2026-07-15" }));
  assert.equal(key, ga4DashboardCacheKey({ ...input }));
});

test("las tres consultas reciben el rango exacto", async () => {
  const ranges = [];
  await fetchGA4DashboardData(input, async (query, definition) => {
    ranges.push([query.dateFrom, query.dateTo]);
    if (definition.dimensions.length === 0) return globalResponse;
    return definition.dimensions.includes("eventName")
      ? eventResponse([])
      : { rows: [], rowCount: 0 };
  }, "2026-09-11T12:00:00.000Z");
  assert.deepEqual(ranges, Array.from({ length: 3 }, () => [
    "2026-07-16",
    "2026-07-22",
  ]));
});

test("el dashboard no duplica consultas", async () => {
  let calls = 0;
  await fetchGA4DashboardData(input, async (_query, definition) => {
    calls += 1;
    if (definition.dimensions.length === 0) return globalResponse;
    return definition.dimensions.includes("eventName")
      ? eventResponse([])
      : { rows: [], rowCount: 0 };
  }, "2026-09-11T12:00:00.000Z");
  assert.equal(calls, 3);
});
