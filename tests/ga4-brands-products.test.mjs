import assert from "node:assert/strict";
import test from "node:test";
import {
  averageRevenuePerUnit,
  brandConsolidationKey,
  brandProductCacheKey,
  createTimedDatasetCache,
  fetchGA4BrandProductData,
  itemConversion,
  normalizeBrandRows,
  normalizeGA4BrandProductData,
  normalizeProductRows,
  paginateProducts,
  productOpportunities,
} from "../lib/integrations/ga4/brands-products.ts";
import { previousEquivalentRange } from "../lib/integrations/ga4/dashboard.ts";

const input = { propertyId: "271269023", ecommerce: "Sportotal", dateFrom: "2026-07-16", dateTo: "2026-07-22" };
const metrics = ["itemsViewed", "itemsAddedToCart", "itemsCheckedOut", "itemsPurchased", "itemRevenue"];
const response = (dimensions, rows, rowCount = rows.length) => ({ dimensionHeaders: dimensions.map((name) => ({ name })), metricHeaders: metrics.map((name) => ({ name })), rows: rows.map(({ dimensions: values, metrics: metricValues }) => ({ dimensionValues: values.map((value) => ({ value })), metricValues: metricValues.map((value) => ({ value: String(value) })) })), rowCount });
const brands = response(["itemBrand"], [
  { dimensions: ["Nike"], metrics: [100, 20, 10, 5, 5000] },
  { dimensions: [" NIKE  "], metrics: [50, 10, 4, 2, 2000] },
]);
const products = response(["itemId", "itemName", "itemBrand", "itemCategory2", "itemCategory3"], [
  { dimensions: ["1", "Producto A", "Nike", "Calzado", "Zapatillas"], metrics: [100, 20, 10, 5, 5000] },
  { dimensions: ["1", "PRODUCTO A", "Nike", "Calzado", "Zapatillas"], metrics: [10, 1, 1, 0, 0] },
  { dimensions: ["2", "Producto A", "Nike", "Calzado", "Zapatillas"], metrics: [30, 3, 2, 1, 1000] },
  { dimensions: ["(not set)", "Sin código", "Nike", "Accesorios", "Otros"], metrics: [2, 1, 0, 0, 0] },
]);

test("consolida marcas sin distinguir mayúsculas ni espacios", () => { const rows = normalizeBrandRows(brands); assert.equal(rows.length, 1); assert.equal(rows[0].itemsViewed, 150); });
test("itemId es la clave principal", () => { assert.equal(normalizeProductRows(products).length, 3); });
test("mismo nombre con IDs diferentes permanece separado", () => { const rows = normalizeProductRows(products); assert.ok(rows.some((row) => row.itemId === "1")); assert.ok(rows.some((row) => row.itemId === "2")); });
test("mismo ID con nombres distintos se consolida y elige el de más vistas", () => { const row = normalizeProductRows(products).find((item) => item.itemId === "1"); assert.equal(row.itemName, "Producto A"); assert.equal(row.itemsViewed, 110); });
test("normaliza revenue", () => { assert.equal(normalizeProductRows(products).find((row) => row.itemId === "1").itemRevenue, 5000); });
test("normaliza itemsPurchased", () => { assert.equal(normalizeProductRows(products).find((row) => row.itemId === "1").itemsPurchased, 5); });
test("calcula conversión", () => { assert.equal(itemConversion({ itemsViewed: 100, itemsPurchased: 5 }), 5); });
test("división por cero devuelve neutral", () => { assert.equal(itemConversion({ itemsViewed: 0, itemsPurchased: 5 }), null); assert.equal(averageRevenuePerUnit({ itemsPurchased: 0, itemRevenue: 10 }), null); });
test("reutiliza período anterior", () => { assert.deepEqual(previousEquivalentRange(input.dateFrom, input.dateTo), { dateFrom: "2026-07-09", dateTo: "2026-07-15" }); });
test("agrupa productos sin ID por separado", () => { assert.equal(normalizeProductRows(products).filter((row) => row.itemId === "Sin ID").length, 1); });
test("maneja respuesta vacía", () => { const data = normalizeGA4BrandProductData(input, { rows: [] }, { rows: [] }, "2026-09-11T00:00:00Z"); assert.equal(data.hasData, false); });
test("cache diferencia rango y reporte", () => { const key = brandProductCacheKey(input, "brand-performance"); assert.notEqual(key, brandProductCacheKey(input, "product-performance")); assert.notEqual(key, brandProductCacheKey({ ...input, dateFrom: "2026-07-09" }, "brand-performance")); });
test("el cliente conserva rowCount paginado normalizado", () => { const paged = response(["itemBrand"], [{ dimensions: ["Nike"], metrics: [1, 0, 0, 0, 1] }], 5000); assert.equal(paged.rowCount, 5000); assert.equal(normalizeBrandRows(paged).length, 1); });
test("ranking por revenue queda descendente", async () => { const data = await fetchGA4BrandProductData(input, async (_query, _definition, type) => type === "brand-performance" ? response(["itemBrand"], [{ dimensions: ["B"], metrics: [1, 0, 0, 0, 10] }, { dimensions: ["A"], metrics: [1, 0, 0, 0, 20] }]) : products, "2026-09-11T00:00:00Z"); assert.deepEqual(data.brands.map((row) => row.name), ["A", "B"]); });
test("la clave de consolidación es determinista", () => { assert.equal(brandConsolidationKey(" New   Balance "), "new balance"); });

const manyProducts = Array.from({ length: 120 }, (_, index) => ({
  name: `Producto ${String(index).padStart(3, "0")}`,
  itemId: `sku-${index}`,
  itemName: index === 75 ? "Remera Adidas Especial" : `Producto ${String(index).padStart(3, "0")}`,
  itemBrand: index % 2 ? "Nike" : "Adidas",
  macroCategory: "Indumentaria",
  category: "Remeras",
  itemsViewed: index,
  itemsAddedToCart: Math.floor(index / 2),
  itemsCheckedOut: Math.floor(index / 3),
  itemsPurchased: index % 10,
  itemRevenue: index * 100,
}));

test("pagina 50 elementos por defecto", () => assert.equal(paginateProducts(manyProducts, []).items.length, 50));
test("pagina 2 devuelve el tramo correcto", () => {
  const page = paginateProducts(manyProducts, [], { page: 2, sortBy: "itemName", sortDirection: "asc" });
  assert.equal(page.items[0].itemId, "sku-50");
});
test("informa totalItems y totalPages", () => {
  const page = paginateProducts(manyProducts, []);
  assert.equal(page.totalItems, 120);
  assert.equal(page.totalPages, 3);
});
test("busca por itemId", () => assert.deepEqual(paginateProducts(manyProducts, [], { search: "sku-75" }).items.map((row) => row.itemId), ["sku-75"]));
test("busca por itemName sin distinguir mayusculas", () => assert.equal(paginateProducts(manyProducts, [], { search: "  REMERA adidas  " }).totalItems, 1));
test("busca por itemBrand", () => assert.equal(paginateProducts(manyProducts, [], { search: "nike", pageSize: 100 }).totalItems, 60));
test("ordena revenue descendente", () => assert.equal(paginateProducts(manyProducts, [], { sortBy: "revenue" }).items[0].itemId, "sku-119"));
test("ordena revenue ascendente", () => assert.equal(paginateProducts(manyProducts, [], { sortBy: "revenue", sortDirection: "asc" }).items[0].itemId, "sku-0"));
test("ordena conversion y trata cero vistas como cero", () => assert.equal(paginateProducts(manyProducts, [], { sortBy: "conversion" }).items[0].itemId, "sku-1"));
test("un cambio de consulta se representa solicitando pagina 1", () => assert.equal(paginateProducts(manyProducts, [], { page: 1, search: "Nike" }).page, 1));
test("rechaza pageSize no permitido", () => assert.equal(paginateProducts(manyProducts, [], { pageSize: 500 }).pageSize, 50));
test("maneja resultados vacios", () => assert.deepEqual(paginateProducts(manyProducts, [], { search: "inexistente" }).items, []));
test("oportunidades usan el dataset completo", () => {
  const opportunities = productOpportunities(manyProducts);
  assert.ok(opportunities.highInterest.every((row) => manyProducts.includes(row)));
  assert.equal(paginateProducts(manyProducts, [], { pageSize: 25 }).items.length, 25);
});
test("cache vigente evita nuevas cargas al paginar buscar u ordenar", async () => {
  const cache = createTimedDatasetCache(300_000);
  let calls = 0;
  const load = async () => { calls += 1; return manyProducts; };
  const dataset = await cache.getOrLoad("property:range", load, 1_000);
  paginateProducts(dataset, [], { page: 1 });
  paginateProducts(await cache.getOrLoad("property:range", load, 2_000), [], { page: 2 });
  paginateProducts(await cache.getOrLoad("property:range", load, 3_000), [], { search: "Adidas" });
  paginateProducts(await cache.getOrLoad("property:range", load, 4_000), [], { sortBy: "views" });
  assert.equal(calls, 1);
});
test("comparacion previous se asocia por itemId", () => {
  const previous = [{ ...manyProducts[0], itemRevenue: 77 }];
  const page = paginateProducts(manyProducts, previous, { sortBy: "itemName", sortDirection: "asc" });
  assert.equal(page.items[0].previous?.itemRevenue, 77);
});
