import assert from "node:assert/strict";
import test from "node:test";
import {
  chunkGA4Rows,
  safeGA4SyncError,
  syncGA4,
} from "../services/analytics/ga4-sync.ts";

const fixedNow = () => new Date("2026-09-11T12:00:00.000Z");

function row(overrides = {}) {
  return {
    date: "2026-09-11",
    propertyId: "property-1",
    ecommerce: "Sportotal",
    channelGroup: "Organic Search",
    source: "google",
    medium: "organic",
    campaign: "(not set)",
    deviceCategory: "mobile",
    activeUsers: 10,
    newUsers: 5,
    sessions: 12,
    engagedSessions: 8,
    engagementRate: 0.66,
    ecommercePurchases: 1,
    purchaseRevenue: 1000,
    ...overrides,
  };
}

function keyFor(item) {
  return [
    item.propertyId,
    item.ecommerce,
    item.date,
    item.channelGroup,
    item.source,
    item.medium,
    item.campaign,
    item.deviceCategory,
  ].join("|");
}

class MemoryStore {
  constructor(status = null) {
    this.status = status;
    this.statusUpdates = [];
    this.rows = new Map();
    this.batchSizes = [];
    this.failAtBatch = null;
  }

  async readSyncStatus() {
    return this.status;
  }

  async upsertSyncStatus(update) {
    this.status = { ...this.status, ...update };
    this.statusUpdates.push(update);
  }

  async upsertGA4Rows(rows) {
    const batchNumber = this.batchSizes.length + 1;
    this.batchSizes.push(rows.length);
    if (batchNumber === this.failAtBatch) throw new Error("batch rejected");
    for (const item of rows) this.rows.set(keyFor(item), item);
  }
}

const baseInput = {
  propertyId: "property-1",
  ecommerce: "Sportotal",
  mode: "incremental",
  dateTo: "2026-09-11",
};

function dependencies(store, fetchReport, environment = {}) {
  return { store, fetchReport, environment, now: fixedNow };
}

test("primera carga utiliza GA4_INITIAL_SYNC_DATE", async () => {
  const store = new MemoryStore();
  let requestedRange;
  const result = await syncGA4(
    baseInput,
    dependencies(store, async (input) => {
      requestedRange = [input.dateFrom, input.dateTo];
      return [];
    }, { GA4_INITIAL_SYNC_DATE: "2026-09-01" }),
  );
  assert.deepEqual(requestedRange, ["2026-09-01", "2026-09-11"]);
  assert.equal(result.status, "success");
});

test("primera carga sin initial date devuelve error controlado", async () => {
  await assert.rejects(
    () => syncGA4(baseInput, dependencies(new MemoryStore(), async () => [])),
    /fecha inicial configurada/,
  );
});

test("incremental usa la última fecha exitosa", async () => {
  const store = new MemoryStore({ lastSuccessfulDate: "2026-09-08" });
  let requestedRange;
  await syncGA4(baseInput, dependencies(store, async (input) => {
    requestedRange = [input.dateFrom, input.dateTo];
    return [];
  }));
  assert.deepEqual(requestedRange, ["2026-09-06", "2026-09-11"]);
});

test("sin días nuevos reprocesa la ventana configurada", async () => {
  const store = new MemoryStore({ lastSuccessfulDate: "2026-09-11" });
  let dateFrom;
  await syncGA4(baseInput, dependencies(store, async (input) => {
    dateFrom = input.dateFrom;
    return [];
  }));
  assert.equal(dateFrom, "2026-09-09");
});

test("force usa exactamente el rango solicitado", async () => {
  const store = new MemoryStore({ lastSuccessfulDate: "2026-09-10" });
  let requestedRange;
  await syncGA4(
    {
      ...baseInput,
      mode: "force",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-05",
    },
    dependencies(store, async (input) => {
      requestedRange = [input.dateFrom, input.dateTo];
      return [];
    }),
  );
  assert.deepEqual(requestedRange, ["2026-08-01", "2026-08-05"]);
});

test("marca running antes de consultar GA4", async () => {
  const store = new MemoryStore();
  await syncGA4(
    baseInput,
    dependencies(store, async () => {
      assert.equal(store.status.syncStatus, "running");
      return [];
    }, { GA4_INITIAL_SYNC_DATE: "2026-09-01" }),
  );
  assert.equal(store.statusUpdates[0].syncStatus, "running");
});

test("success actualiza timestamp y fecha exitosa", async () => {
  const store = new MemoryStore({ lastSuccessfulDate: "2026-09-08" });
  await syncGA4(baseInput, dependencies(store, async () => [row()]));
  assert.equal(store.status.syncStatus, "success");
  assert.equal(store.status.lastSuccessfulSync, "2026-09-11T12:00:00.000Z");
  assert.equal(store.status.lastSuccessfulDate, "2026-09-11");
});

test("un error no actualiza la última sincronización exitosa", async () => {
  const original = "2026-09-08T10:00:00.000Z";
  const store = new MemoryStore({
    lastSuccessfulDate: "2026-09-08",
    lastSuccessfulSync: original,
  });
  const result = await syncGA4(
    baseInput,
    dependencies(store, async () => { throw new Error("HTTP 403"); }),
  );
  assert.equal(result.status, "failed");
  assert.equal(store.status.lastSuccessfulSync, original);
  assert.equal(store.status.lastSuccessfulDate, "2026-09-08");
});

test("dos ejecuciones del mismo rango conservan una fila por clave", async () => {
  const store = new MemoryStore();
  const env = { GA4_INITIAL_SYNC_DATE: "2026-09-11" };
  await syncGA4(baseInput, dependencies(store, async () => [row()], env));
  await syncGA4(baseInput, dependencies(store, async () => [row()], env));
  assert.equal(store.rows.size, 1);
});

test("el reproceso actualiza métricas existentes", async () => {
  const store = new MemoryStore();
  const env = { GA4_INITIAL_SYNC_DATE: "2026-09-11" };
  await syncGA4(baseInput, dependencies(store, async () => [row()], env));
  await syncGA4(
    baseInput,
    dependencies(store, async () => [row({ sessions: 20 })], env),
  );
  assert.equal(store.rows.size, 1);
  assert.equal([...store.rows.values()][0].sessions, 20);
});

test("batching divide filas según la configuración", async () => {
  const store = new MemoryStore();
  const rows = Array.from({ length: 5 }, (_, index) =>
    row({ date: `2026-09-0${index + 1}` }));
  await syncGA4(
    baseInput,
    dependencies(store, async () => rows, {
      GA4_INITIAL_SYNC_DATE: "2026-09-01",
      GA4_UPSERT_BATCH_SIZE: "2",
    }),
  );
  assert.deepEqual(store.batchSizes, [2, 2, 1]);
  assert.deepEqual(chunkGA4Rows(rows, 2).map((batch) => batch.length), [2, 2, 1]);
});

test("falla del segundo batch detiene el proceso y marca failed", async () => {
  const store = new MemoryStore();
  store.failAtBatch = 2;
  const rows = [
    row({ date: "2026-09-01" }),
    row({ date: "2026-09-02" }),
    row({ date: "2026-09-03" }),
  ];
  const result = await syncGA4(
    baseInput,
    dependencies(store, async () => rows, {
      GA4_INITIAL_SYNC_DATE: "2026-09-01",
      GA4_UPSERT_BATCH_SIZE: "2",
    }),
  );
  assert.equal(result.status, "failed");
  assert.equal(result.recordsProcessed, 2);
  assert.deepEqual(store.batchSizes, [2, 1]);
  assert.equal(store.status.syncStatus, "failed");
});

test("records_processed refleja filas persistidas", async () => {
  const store = new MemoryStore();
  const result = await syncGA4(
    baseInput,
    dependencies(store, async () => [row(), row({ date: "2026-09-10" })], {
      GA4_INITIAL_SYNC_DATE: "2026-09-01",
    }),
  );
  assert.equal(result.recordsProcessed, 2);
  assert.equal(store.status.recordsProcessed, 2);
});

test("respuesta GA4 vacía finaliza success con cero filas", async () => {
  const store = new MemoryStore();
  const result = await syncGA4(
    baseInput,
    dependencies(store, async () => [], {
      GA4_INITIAL_SYNC_DATE: "2026-09-01",
    }),
  );
  assert.equal(result.status, "success");
  assert.equal(result.recordsProcessed, 0);
  assert.deepEqual(store.batchSizes, []);
});

test("el error persistido elimina secretos y queda acotado", async () => {
  const secret = "private-value-never-store";
  const environment = {
    GA4_INITIAL_SYNC_DATE: "2026-09-01",
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: secret,
  };
  const store = new MemoryStore();
  const result = await syncGA4(
    baseInput,
    dependencies(store, async () => {
      throw new Error(`auth rejected ${secret}`);
    }, environment),
  );
  assert.equal(result.status, "failed");
  assert.equal(result.errorMessage.includes(secret), false);
  assert.match(result.errorMessage, /\[redacted\]/);
  assert.equal(result.errorMessage.length <= 300, true);
  assert.equal(safeGA4SyncError(new Error(secret), environment).includes(secret), false);
});
