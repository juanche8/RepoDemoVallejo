import assert from "node:assert/strict";
import test from "node:test";
import { tabs } from "../components/dashboard/dashboard-types.ts";
import {
  createPlaza,
  getGeographySource,
  getSalesByPlazaViewModel,
  normalizeCity,
  normalizeDeliveryLocation,
  normalizeProvince,
} from "../types/geography.ts";

test("la navegación incluye Venta por plaza en la posición solicitada", () => {
  const index = tabs.indexOf("Venta por plaza");
  assert.equal(tabs[index - 1], "Marcas y productos");
  assert.equal(tabs[index + 1], "Medios de pago");
});

test("la pantalla carga sin VTEX", () => {
  assert.equal(getSalesByPlazaViewModel("Sportotal").hasData, false);
});

test("muestra estado pendiente de conexión", () => {
  assert.equal(getSalesByPlazaViewModel("Sportotal").sourceLabel, "VTEX · Pendiente de conexión");
});

test("no presenta mocks como datos reales", () => {
  const viewModel = getSalesByPlazaViewModel("Vallejo Calzados");
  assert.equal(viewModel.hasData, false);
  assert.equal("rows" in viewModel, false);
});

test("normaliza provincias", () => {
  assert.equal(normalizeProvince("  MENDOZA  "), "Mendoza");
  assert.equal(normalizeProvince("SAN   JUAN"), "San Juan");
});

test("normaliza ciudades sin fuzzy matching", () => {
  assert.equal(normalizeCity(" san miguel   DE tucumán "), "San Miguel De Tucumán");
});

test("plaza combina ciudad y provincia", () => {
  assert.equal(createPlaza("maipú", "MENDOZA"), "Maipú, Mendoza");
  const location = normalizeDeliveryLocation({ city: " Maipú ", state: "MENDOZA", postalCode: " 5515 " });
  assert.equal(location.plaza, "Maipú, Mendoza");
  assert.equal(location.original.province, "MENDOZA");
});

test("ecommerce desconocido no usa fallback", () => {
  assert.throws(() => getGeographySource("Freekick"), /sin fallback/);
});

test("el estado vacío permanece estable al cambiar filtros externos", () => {
  for (const ecommerce of ["Sportotal", "Vallejo Calzados"]) {
    const viewModel = getSalesByPlazaViewModel(ecommerce);
    assert.equal(viewModel.hasData, false);
    assert.equal(viewModel.connection.ecommerce, ecommerce);
  }
});
