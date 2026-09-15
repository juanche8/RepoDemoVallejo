import assert from "node:assert/strict";
import test from "node:test";
import {
  ga4DashboardCacheKey,
  ga4PercentageChange,
  ga4RateDelta,
  previousEquivalentRange,
  withGA4Comparison,
} from "../lib/integrations/ga4/dashboard.ts";

const current = {
  propertyId: "271269023",
  dateFrom: "2026-07-16",
  dateTo: "2026-07-22",
  updatedAt: "2026-09-11T12:00:00.000Z",
  hasData: true,
  totals: {
    sessions: 120,
    activeUsers: 100,
    newUsers: 60,
    purchases: 12,
    revenue: 2400,
  },
  funnelEvents: {
    viewItem: 180,
    addToCart: 30,
    beginCheckout: 18,
    purchaseEventCount: 12,
    viewItemUsers: 80,
    addToCartUsers: 20,
    beginCheckoutUsers: 10,
    purchaseUsers: 8,
  },
  funnelEventsAvailable: true,
  channelGroups: [],
  devices: [],
};

test("calcula el período inmediatamente anterior", () => {
  assert.deepEqual(previousEquivalentRange("2026-07-16", "2026-07-22"), {
    dateFrom: "2026-07-09",
    dateTo: "2026-07-15",
  });
});

test("mantiene la misma cantidad de días", () => {
  const previous = previousEquivalentRange("2026-02-27", "2026-03-03");
  const days = (from, to) =>
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 + 1;
  assert.equal(days("2026-02-27", "2026-03-03"), days(previous.dateFrom, previous.dateTo));
});

test("calcula variación de usuarios", () => {
  assert.equal(ga4PercentageChange(120, 100), 20);
});

test("calcula variación de compras", () => {
  assert.equal(ga4PercentageChange(12, 10), 20);
});

test("calcula variación de revenue", () => {
  assert.equal(ga4PercentageChange(2400, 2000), 20);
});

test("previous cero devuelve estado neutral", () => {
  assert.equal(ga4PercentageChange(10, 0), null);
});

test("calcula diferencia de conversión en puntos porcentuales", () => {
  assert.equal(ga4RateDelta(20, 80, 18, 90), 5);
});

test("un error comparado conserva el período actual", async () => {
  const result = await withGA4Comparison(current, async () => {
    throw new Error("comparison unavailable");
  });
  assert.equal(result.totals.sessions, 120);
  assert.equal(result.comparison, null);
  assert.equal(result.comparisonError, "Comparación no disponible");
});

test("el caché diferencia ambos rangos", () => {
  const previous = previousEquivalentRange(current.dateFrom, current.dateTo);
  assert.notEqual(
    ga4DashboardCacheKey({ ...current, ecommerce: "Sportotal" }),
    ga4DashboardCacheKey({
      propertyId: current.propertyId,
      ecommerce: "Sportotal",
      ...previous,
    }),
  );
});

test("la comparación reutiliza un único cargador genérico", async () => {
  let calls = 0;
  const compared = await withGA4Comparison(current, async () => {
    calls += 1;
    return { ...current, dateFrom: "2026-07-09", dateTo: "2026-07-15" };
  });
  assert.equal(calls, 1);
  assert.equal(compared.comparison?.dateFrom, "2026-07-09");
});
