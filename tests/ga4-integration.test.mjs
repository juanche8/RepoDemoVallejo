import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchGA4Report,
  normalizePrivateKey,
} from "../lib/integrations/ga4/client.ts";
import {
  normalizeGA4Date,
  normalizeGA4Response,
  parseDecimalMetric,
  parseIntegerMetric,
} from "../lib/integrations/ga4/normalize.ts";

const dimensions = [
  "date",
  "sessionDefaultChannelGroup",
  "sessionSource",
  "sessionMedium",
  "sessionCampaignName",
  "deviceCategory",
];
const metrics = [
  "activeUsers",
  "newUsers",
  "sessions",
  "engagedSessions",
  "engagementRate",
  "ecommercePurchases",
  "purchaseRevenue",
];
const input = {
  propertyId: "123456",
  dateFrom: "2026-09-01",
  dateTo: "2026-09-11",
  ecommerce: "Sportotal",
};

function apiRow({
  date = "20260911",
  channel = "Organic Search",
  source = "google",
  medium = "organic",
  campaign = "always-on",
  device = "mobile",
  values = ["100", "40", "120", "80", "0.6667", "5", "125000.50"],
} = {}) {
  return {
    dimensionValues: [date, channel, source, medium, campaign, device]
      .map((value) => ({ value })),
    metricValues: values.map((value) => ({ value })),
  };
}

function response(rows, rowCount = rows.length) {
  return {
    dimensionHeaders: dimensions.map((name) => ({ name })),
    metricHeaders: metrics.map((name) => ({ name })),
    rows,
    rowCount,
  };
}

test("convierte fechas YYYYMMDD a YYYY-MM-DD", () => {
  assert.equal(normalizeGA4Date("20260911"), "2026-09-11");
});

test("rechaza fechas inválidas", () => {
  assert.throws(() => normalizeGA4Date("20260231"), /fecha inválida/);
});

test("convierte métricas enteras válidas", () => {
  assert.equal(parseIntegerMetric("123", "sessions"), 123);
});

test("convierte métricas decimales válidas", () => {
  assert.equal(parseDecimalMetric("1250.75", "purchaseRevenue"), 1250.75);
});

test("una métrica inválida genera error y no NaN", () => {
  assert.throws(() => parseDecimalMetric("error", "engagementRate"), /decimal/);
});

test("campaign vacío se normaliza como (not set)", () => {
  const [row] = normalizeGA4Response(response([apiRow({ campaign: "" })]), input);
  assert.equal(row.campaign, "(not set)");
});

test("device vacío se normaliza como unknown", () => {
  const [row] = normalizeGA4Response(response([apiRow({ device: "" })]), input);
  assert.equal(row.deviceCategory, "unknown");
});

test("tráfico directo conserva source y medium consistentes", () => {
  const [row] = normalizeGA4Response(
    response([apiRow({ source: "(direct)", medium: "(none)" })]),
    input,
  );
  assert.equal(row.source, "(direct)");
  assert.equal(row.medium, "(none)");
});

test("mapea valores por nombre de header aunque cambie su orden", () => {
  const reordered = response([apiRow()]);
  reordered.dimensionHeaders = [...reordered.dimensionHeaders].reverse();
  reordered.rows[0].dimensionValues = [...reordered.rows[0].dimensionValues].reverse();
  reordered.metricHeaders = [...reordered.metricHeaders].reverse();
  reordered.rows[0].metricValues = [...reordered.rows[0].metricValues].reverse();
  const [row] = normalizeGA4Response(reordered, input);
  assert.equal(row.date, "2026-09-11");
  assert.equal(row.sessions, 120);
  assert.equal(row.purchaseRevenue, 125000.5);
});

test("normaliza respuestas con múltiples filas", () => {
  const rows = normalizeGA4Response(
    response([apiRow(), apiRow({ date: "20260910" })]),
    input,
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[1].date, "2026-09-10");
});

test("una respuesta sin filas devuelve un array vacío", () => {
  assert.deepEqual(normalizeGA4Response({ rowCount: 0 }, input), []);
});

test("pagina solo cuando rowCount excede las filas recibidas", async () => {
  const offsets = [];
  const rows = await fetchGA4Report(input, {
    accessToken: "token-de-prueba",
    pageSize: 1,
    requestPage: async ({ offset }) => {
      offsets.push(offset);
      return response([apiRow({ date: offset ? "20260910" : "20260911" })], 2);
    },
  });
  assert.deepEqual(offsets, [0, 1]);
  assert.equal(rows.length, 2);
});

test("no solicita una página adicional cuando no corresponde", async () => {
  let requests = 0;
  await fetchGA4Report(input, {
    accessToken: "token-de-prueba",
    pageSize: 100,
    requestPage: async () => {
      requests += 1;
      return response([apiRow()]);
    },
  });
  assert.equal(requests, 1);
});

test("normaliza saltos escapados de una private key sin exponerla", () => {
  const normalized = normalizePrivateKey("línea-1\\nlínea-2");
  assert.equal(normalized, "línea-1\nlínea-2");
  assert.equal(normalized.includes("\\n"), false);
});
