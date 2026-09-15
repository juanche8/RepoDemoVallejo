import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchGA4DashboardData,
  GA4_GLOBAL_REPORT,
  GA4_SEGMENTED_REPORT,
  normalizeGA4DashboardData,
  publicGA4Error,
} from "../lib/integrations/ga4/dashboard.ts";
import { formatCurrency } from "../lib/formatters.ts";

const input = {
  propertyId: "271269023",
  ecommerce: "Sportotal",
  dateFrom: "2026-09-09",
  dateTo: "2026-09-10",
};

const metricHeaders = [
  "activeUsers",
  "newUsers",
  "sessions",
  "ecommercePurchases",
  "purchaseRevenue",
].map((name) => ({ name }));

const metricValues = (active, fresh, sessions, purchases, revenue) =>
  [active, fresh, sessions, purchases, revenue]
    .map((value) => ({ value: String(value) }));

function globalResponse(values = metricValues(80, 40, 100, 5, 1200.5)) {
  return { metricHeaders, rows: [{ metricValues: values }], rowCount: 1 };
}

function segmentedResponse() {
  return {
    dimensionHeaders: [
      { name: "sessionDefaultChannelGroup" },
      { name: "deviceCategory" },
    ],
    metricHeaders,
    rows: [
      {
        dimensionValues: [{ value: "Organic Search" }, { value: "mobile" }],
        metricValues: metricValues(60, 30, 70, 4, 900),
      },
      {
        dimensionValues: [{ value: "Direct" }, { value: "desktop" }],
        metricValues: metricValues(50, 20, 30, 1, 300.5),
      },
    ],
    rowCount: 2,
  };
}

test("los KPIs globales provienen del reporte sin dimensiones", () => {
  const data = normalizeGA4DashboardData(
    input,
    globalResponse(),
    segmentedResponse(),
    { rows: [], rowCount: 0 },
    "2026-09-11T12:00:00.000Z",
  );
  assert.deepEqual(data.totals, {
    sessions: 100,
    activeUsers: 80,
    newUsers: 40,
    purchases: 5,
    revenue: 1200.5,
  });
  assert.deepEqual(GA4_GLOBAL_REPORT.dimensions, []);
});

test("genera el desglose por channel group", () => {
  const data = normalizeGA4DashboardData(
    input,
    globalResponse(),
    segmentedResponse(),
    { rows: [], rowCount: 0 },
    "2026-09-11T12:00:00.000Z",
  );
  assert.deepEqual(data.channelGroups.map((item) => item.name), [
    "Organic Search",
    "Direct",
  ]);
});

test("genera el desglose por dispositivo", () => {
  const data = normalizeGA4DashboardData(
    input,
    globalResponse(),
    segmentedResponse(),
    { rows: [], rowCount: 0 },
    "2026-09-11T12:00:00.000Z",
  );
  assert.deepEqual(data.devices.map((item) => item.name), ["mobile", "desktop"]);
  assert.deepEqual(GA4_SEGMENTED_REPORT.dimensions, [
    "sessionDefaultChannelGroup",
    "deviceCategory",
  ]);
});

test("no suma activeUsers segmentados para construir el KPI global", () => {
  const data = normalizeGA4DashboardData(
    input,
    globalResponse(metricValues(80, 40, 100, 5, 1200.5)),
    segmentedResponse(),
    { rows: [], rowCount: 0 },
    "2026-09-11T12:00:00.000Z",
  );
  assert.equal(data.totals.activeUsers, 80);
  assert.equal(data.channelGroups.reduce((sum, row) => sum + row.activeUsers, 0), 110);
});

test("maneja respuestas globales vacías sin inventar datos", () => {
  const data = normalizeGA4DashboardData(
    input,
    { rows: [], rowCount: 0 },
    { rows: [], rowCount: 0 },
    { rows: [], rowCount: 0 },
    "2026-09-11T12:00:00.000Z",
  );
  assert.equal(data.hasData, false);
  assert.equal(data.totals.sessions, 0);
});

test("expone un mensaje público seguro ante errores", () => {
  assert.equal(publicGA4Error(), "No se pudieron cargar los datos de GA4");
  assert.equal(publicGA4Error().includes("token"), false);
});

test("revenue utiliza el formateador monetario compartido", () => {
  assert.equal(formatCurrency(1200.5, true), "$ 1,2 mil");
});

test("envía el rango exacto a las tres consultas", async () => {
  const calls = [];
  await fetchGA4DashboardData(input, async (query, definition) => {
    calls.push({ query, dimensions: definition.dimensions });
    if (definition.dimensions.includes("eventName")) {
      return { rows: [], rowCount: 0 };
    }
    return definition.dimensions.length ? segmentedResponse() : globalResponse();
  }, "2026-09-11T12:00:00.000Z");
  assert.equal(calls.length, 3);
  assert.equal(calls.every(({ query }) =>
    query.dateFrom === "2026-09-09" && query.dateTo === "2026-09-10"), true);
});
