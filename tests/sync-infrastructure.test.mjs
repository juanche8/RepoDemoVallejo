import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_REPROCESS_DAYS,
  getReprocessDays,
  parseReprocessDays,
} from "../lib/sync/config.ts";
import { resolveSyncDateRange } from "../lib/sync/date-range.ts";

test("primera sincronización usa la fecha inicial proporcionada", () => {
  assert.deepEqual(
    resolveSyncDateRange({
      mode: "incremental",
      initialDate: "2026-09-01",
      targetDate: "2026-09-11",
      reprocessDays: 3,
    }),
    { dateFrom: "2026-09-01", dateTo: "2026-09-11" },
  );
});

test("primera sincronización sin fecha inicial devuelve un error controlado", () => {
  assert.throws(
    () =>
      resolveSyncDateRange({
        mode: "incremental",
        targetDate: "2026-09-11",
        reprocessDays: 3,
      }),
    /fecha inicial configurada/,
  );
});

test("sin días nuevos conserva la ventana de reproceso", () => {
  assert.deepEqual(
    resolveSyncDateRange({
      mode: "incremental",
      lastSuccessfulDate: "2026-09-11",
      targetDate: "2026-09-11",
      reprocessDays: 3,
    }),
    { dateFrom: "2026-09-09", dateTo: "2026-09-11" },
  );
});

test("sincronización incremental combina reproceso y días nuevos", () => {
  assert.deepEqual(
    resolveSyncDateRange({
      mode: "incremental",
      lastSuccessfulDate: "2026-09-08",
      targetDate: "2026-09-11",
      reprocessDays: 3,
    }),
    { dateFrom: "2026-09-06", dateTo: "2026-09-11" },
  );
});

test("forceReprocess usa exactamente el rango solicitado", () => {
  assert.deepEqual(
    resolveSyncDateRange({
      mode: "force",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      reprocessDays: 3,
    }),
    { dateFrom: "2026-08-01", dateTo: "2026-08-31" },
  );
});

test("forceReprocess sin rango devuelve error", () => {
  assert.throws(
    () => resolveSyncDateRange({ mode: "force", reprocessDays: 3 }),
    /requiere dateFrom y dateTo/,
  );
});

test("rechaza rangos invertidos", () => {
  assert.throws(
    () =>
      resolveSyncDateRange({
        mode: "force",
        dateFrom: "2026-09-11",
        dateTo: "2026-09-01",
        reprocessDays: 3,
      }),
    /dateFrom no puede ser posterior/,
  );
});

test("una variable no numérica usa el fallback", () => {
  assert.equal(parseReprocessDays("inválido", 3), 3);
});

test("una variable negativa usa el fallback", () => {
  assert.equal(parseReprocessDays("-1", 7), 7);
});

test("la configuración se resuelve por fuente sin repetir valores", () => {
  assert.equal(getReprocessDays("ga4", { GA4_REPROCESS_DAYS: "5" }), 5);
  assert.equal(
    getReprocessDays("meta_ads", {}),
    DEFAULT_REPROCESS_DAYS.meta_ads,
  );
});
