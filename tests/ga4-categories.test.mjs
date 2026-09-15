import assert from "node:assert/strict";
import test from "node:test";
import {
  categoryCacheKey,
  categoryConversion,
  fetchGA4CategoriesData,
  GA4_CATEGORY_DETAIL_REPORT,
  GA4_CATEGORY_MACRO_REPORT,
  normalizeCategoryName,
  normalizeGA4CategoriesData,
} from "../lib/integrations/ga4/categories.ts";
import { previousEquivalentRange } from "../lib/integrations/ga4/dashboard.ts";

const input = {
  propertyId: "271269023",
  ecommerce: "Sportotal",
  dateFrom: "2026-07-16",
  dateTo: "2026-07-22",
};
const metrics = [
  "itemsViewed",
  "itemsAddedToCart",
  "itemsCheckedOut",
  "itemsPurchased",
  "itemRevenue",
];
const response = (dimensions, rows) => ({
  dimensionHeaders: dimensions.map((name) => ({ name })),
  metricHeaders: metrics.map((name) => ({ name })),
  rows: rows.map(({ values, metrics: valuesMetrics }) => ({
    dimensionValues: values.map((value) => ({ value })),
    metricValues: valuesMetrics.map((value) => ({ value: String(value) })),
  })),
  rowCount: rows.length,
});
const macro = response(["itemCategory2"], [
  { values: ["Calzado"], metrics: [100, 20, 10, 5, 5000] },
  { values: ["(not set)"], metrics: [1, 0, 0, 0, 0] },
]);
const detail = response(["itemCategory3", "itemCategory"], [
  { values: ["Zapatillas", "Hombre"], metrics: [80, 16, 8, 4, 4000] },
  { values: ["Remeras", "Mujer"], metrics: [20, 4, 2, 1, 1000] },
]);

test("itemCategory2 define macrocategoría", () => {
  assert.deepEqual(GA4_CATEGORY_MACRO_REPORT.dimensions, ["itemCategory2"]);
});

test("itemCategory3 define categoría comercial", () => {
  assert.equal(GA4_CATEGORY_DETAIL_REPORT.dimensions[0], "itemCategory3");
});

test("itemCategory queda como género secundario", () => {
  assert.equal(GA4_CATEGORY_DETAIL_REPORT.dimensions[1], "itemCategory");
});

test("normaliza revenue por categoría", () => {
  const data = normalizeGA4CategoriesData(input, macro, detail, "2026-09-11T00:00:00Z");
  assert.equal(data.macros[0].itemRevenue, 5000);
});

test("normaliza itemsPurchased", () => {
  const data = normalizeGA4CategoriesData(input, macro, detail, "2026-09-11T00:00:00Z");
  assert.equal(data.macros[0].itemsPurchased, 5);
});

test("calcula conversión vista a compra", () => {
  assert.equal(categoryConversion({
    name: "Calzado",
    itemsViewed: 100,
    itemsAddedToCart: 20,
    itemsCheckedOut: 10,
    itemsPurchased: 5,
    itemRevenue: 5000,
  }), 5);
});

test("views cero devuelve conversión neutral", () => {
  assert.equal(categoryConversion({
    name: "Vacía",
    itemsViewed: 0,
    itemsAddedToCart: 0,
    itemsCheckedOut: 0,
    itemsPurchased: 0,
    itemRevenue: 0,
  }), null);
});

test("reutiliza el período anterior equivalente", () => {
  assert.deepEqual(previousEquivalentRange(input.dateFrom, input.dateTo), {
    dateFrom: "2026-07-09",
    dateTo: "2026-07-15",
  });
});

test("agrupa valores vacíos como Sin categoría", () => {
  assert.equal(normalizeCategoryName("(not set)"), "Sin categoría");
  assert.equal(normalizeCategoryName(""), "Sin categoría");
});

test("maneja respuesta vacía", () => {
  const data = normalizeGA4CategoriesData(input, { rows: [] }, { rows: [] }, "2026-09-11T00:00:00Z");
  assert.equal(data.hasData, false);
  assert.deepEqual(data.macros, []);
});

test("un error de detalle conserva el resumen", async () => {
  const data = await fetchGA4CategoriesData(input, async (_query, _definition, type) => {
    if (type === "detail") throw new Error("detail unavailable");
    return macro;
  }, "2026-09-11T00:00:00Z");
  assert.equal(data.hasData, true);
  assert.equal(data.detailAvailable, false);
  assert.equal(data.macros[0].name, "Calzado");
});

test("el cache diferencia rango y tipo de reporte", () => {
  const macroKey = categoryCacheKey(input, "macro");
  assert.notEqual(macroKey, categoryCacheKey(input, "detail"));
  assert.notEqual(macroKey, categoryCacheKey({ ...input, dateFrom: "2026-07-09" }, "macro"));
});
