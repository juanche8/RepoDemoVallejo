import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { tabs } from "../components/dashboard/dashboard-types.ts";
import { getPaymentDataSource, getPaymentMethodsViewModel } from "../types/payments.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("Medios pagos ya no aparece en la navegación", () => {
  assert.equal(tabs.includes("Medios pagos"), false);
});

test("Paid Media aparece correctamente", () => {
  assert.equal(tabs.includes("Paid Media"), true);
});

test("el nuevo menú Medios de pago existe y respeta el orden", () => {
  const plaza = tabs.indexOf("Venta por plaza");
  assert.deepEqual(tabs.slice(plaza, plaza + 3), ["Venta por plaza", "Medios de pago", "Paid Media"]);
});

test("Dashboard conecta la navegación con PaymentMethods", async () => {
  const source = await readFile(resolve(root, "components/dashboard/Dashboard.tsx"), "utf8");
  assert.match(source, /tab === "Medios de pago" && <PaymentMethods ecommerce={filters\.store}/);
});

test("la pantalla carga con estado vacío sin VTEX", () => {
  assert.equal(getPaymentMethodsViewModel("Sportotal").hasData, false);
});

test("el estado pendiente de VTEX es explícito", () => {
  assert.equal(getPaymentMethodsViewModel("Sportotal").sourceLabel, "VTEX · Pendiente de conexión");
});

test("la vista no entrega filas ni métricas simuladas", () => {
  const viewModel = getPaymentMethodsViewModel("Vallejo Calzados");
  assert.deepEqual(Object.keys(viewModel).sort(), ["connection", "hasData", "message", "sourceLabel"]);
});

test("Sportotal y Vallejo mantienen fuentes separadas", () => {
  assert.notDeepEqual(getPaymentDataSource("Sportotal"), getPaymentDataSource("Vallejo Calzados"));
  assert.equal(getPaymentDataSource("Sportotal").ecommerce, "Sportotal");
  assert.equal(getPaymentDataSource("Vallejo Calzados").ecommerce, "Vallejo Calzados");
});

test("un ecommerce desconocido no usa fallback", () => {
  assert.throws(() => getPaymentDataSource("Freekick"), /sin fallback/);
  assert.throws(() => getPaymentDataSource("Desconocido"), /sin fallback/);
});
