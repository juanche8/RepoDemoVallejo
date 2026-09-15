import { fetchGA4Report } from "../../lib/integrations/ga4/client.ts";
import type {
  GA4NormalizedRow,
  GA4QueryInput,
} from "@/lib/integrations/ga4/types";
import {
  getGA4InitialSyncDate,
  getGA4UpsertBatchSize,
  getReprocessDays,
} from "../../lib/sync/config.ts";
import {
  resolveSyncDateRange,
  type SyncDateRange,
} from "../../lib/sync/date-range.ts";
import type { Store } from "@/types/analytics";
import type { SyncResult, SyncStatus } from "@/types/sync";

type Environment = Record<string, string | undefined>;

export type GA4SyncInput = {
  propertyId: string;
  ecommerce: Store;
  mode: "incremental" | "force";
  dateFrom?: string;
  dateTo?: string;
};

export type GA4SyncKey = {
  source: "ga4";
  accountId: string;
  ecommerce: Store;
};

export type GA4SyncStatusRecord = {
  lastSuccessfulSync?: string | null;
  lastSuccessfulDate?: string | null;
  lastAttempt?: string | null;
  syncStatus?: SyncStatus;
  recordsProcessed?: number;
  dateFrom?: string | null;
  dateTo?: string | null;
  errorMessage?: string | null;
};

export type GA4SyncStatusUpdate = GA4SyncStatusRecord & GA4SyncKey & {
  updatedAt: string;
};

export interface GA4SyncStore {
  readSyncStatus(key: GA4SyncKey): Promise<GA4SyncStatusRecord | null>;
  upsertSyncStatus(update: GA4SyncStatusUpdate): Promise<void>;
  upsertGA4Rows(rows: GA4NormalizedRow[], updatedAt: string): Promise<void>;
}

export type GA4SyncDependencies = {
  store?: GA4SyncStore;
  fetchReport?: (input: GA4QueryInput) => Promise<GA4NormalizedRow[]>;
  environment?: Environment;
  now?: () => Date;
};

function toDatabaseRow(row: GA4NormalizedRow, updatedAt: string) {
  return {
    property_id: row.propertyId,
    ecommerce: row.ecommerce,
    date: row.date,
    channel_group: row.channelGroup,
    source: row.source,
    medium: row.medium,
    campaign: row.campaign,
    device_category: row.deviceCategory,
    active_users: row.activeUsers,
    new_users: row.newUsers,
    sessions: row.sessions,
    engaged_sessions: row.engagedSessions,
    engagement_rate: row.engagementRate,
    ecommerce_purchases: row.ecommercePurchases,
    purchase_revenue: row.purchaseRevenue,
    updated_at: updatedAt,
  };
}

async function createSupabaseStore(): Promise<GA4SyncStore> {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const client = createSupabaseServerClient();

  return {
    async readSyncStatus(key) {
      const { data, error } = await client
        .from("analytics_sync_status")
        .select("last_successful_sync,last_successful_date,last_attempt,sync_status,records_processed,date_from,date_to,error_message")
        .eq("source", key.source)
        .eq("account_id", key.accountId)
        .eq("ecommerce", key.ecommerce)
        .maybeSingle();
      if (error) throw new Error(`GA4 sync status read failed: ${error.message}`);
      if (!data) return null;
      return {
        lastSuccessfulSync: data.last_successful_sync,
        lastSuccessfulDate: data.last_successful_date,
        lastAttempt: data.last_attempt,
        syncStatus: data.sync_status as SyncStatus,
        recordsProcessed: data.records_processed,
        dateFrom: data.date_from,
        dateTo: data.date_to,
        errorMessage: data.error_message,
      };
    },

    async upsertSyncStatus(update) {
      const payload: Record<string, unknown> = {
        source: update.source,
        account_id: update.accountId,
        ecommerce: update.ecommerce,
        updated_at: update.updatedAt,
      };
      if (update.lastSuccessfulSync !== undefined) {
        payload.last_successful_sync = update.lastSuccessfulSync;
      }
      if (update.lastSuccessfulDate !== undefined) {
        payload.last_successful_date = update.lastSuccessfulDate;
      }
      if (update.lastAttempt !== undefined) payload.last_attempt = update.lastAttempt;
      if (update.syncStatus !== undefined) payload.sync_status = update.syncStatus;
      if (update.recordsProcessed !== undefined) {
        payload.records_processed = update.recordsProcessed;
      }
      if (update.dateFrom !== undefined) payload.date_from = update.dateFrom;
      if (update.dateTo !== undefined) payload.date_to = update.dateTo;
      if (update.errorMessage !== undefined) payload.error_message = update.errorMessage;

      const { error } = await client.from("analytics_sync_status").upsert(payload, {
        onConflict: "source,account_id,ecommerce",
      });
      if (error) throw new Error(`GA4 sync status write failed: ${error.message}`);
    },

    async upsertGA4Rows(rows, updatedAt) {
      if (!rows.length) return;
      const { error } = await client.from("ga4_daily").upsert(
        rows.map((row) => toDatabaseRow(row, updatedAt)),
        {
          onConflict: "property_id,ecommerce,date,channel_group,source,medium,campaign,device_category",
        },
      );
      if (error) throw new Error(`GA4 batch upsert failed: ${error.message}`);
    },
  };
}

export function chunkGA4Rows(
  rows: GA4NormalizedRow[],
  batchSize: number,
): GA4NormalizedRow[][] {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("GA4 batch size debe ser un entero positivo.");
  }
  const batches: GA4NormalizedRow[][] = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    batches.push(rows.slice(index, index + batchSize));
  }
  return batches;
}

export async function markSyncRunning(
  store: GA4SyncStore,
  key: GA4SyncKey,
  range: SyncDateRange,
  attemptedAt: string,
): Promise<void> {
  await store.upsertSyncStatus({
    ...key,
    syncStatus: "running",
    lastAttempt: attemptedAt,
    recordsProcessed: 0,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    errorMessage: null,
    updatedAt: attemptedAt,
  });
}

export async function markSyncSuccess(
  store: GA4SyncStore,
  key: GA4SyncKey,
  range: SyncDateRange,
  recordsProcessed: number,
  finishedAt: string,
): Promise<void> {
  await store.upsertSyncStatus({
    ...key,
    syncStatus: "success",
    lastSuccessfulSync: finishedAt,
    lastSuccessfulDate: range.dateTo,
    recordsProcessed,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    errorMessage: null,
    updatedAt: finishedAt,
  });
}

export async function markSyncFailed(
  store: GA4SyncStore,
  key: GA4SyncKey,
  range: SyncDateRange,
  recordsProcessed: number,
  errorMessage: string,
  finishedAt: string,
): Promise<void> {
  await store.upsertSyncStatus({
    ...key,
    syncStatus: "failed",
    recordsProcessed,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    errorMessage,
    updatedAt: finishedAt,
  });
}

export function safeGA4SyncError(
  error: unknown,
  environment: Environment,
): string {
  let message = error instanceof Error ? error.message : "Error desconocido";
  for (const [name, value] of Object.entries(environment)) {
    if (
      value
      && /(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(name)
    ) {
      message = message.replaceAll(value, "[redacted]");
    }
  }
  return `GA4 sync failed: ${message}`.slice(0, 300);
}

export async function syncGA4(
  input: GA4SyncInput,
  dependencies: GA4SyncDependencies = {},
): Promise<SyncResult> {
  if (!input.propertyId.trim()) throw new Error("GA4 sync requiere propertyId.");

  const environment = dependencies.environment ?? process.env;
  const now = dependencies.now ?? (() => new Date());
  const store = dependencies.store ?? await createSupabaseStore();
  const fetchReport = dependencies.fetchReport ?? fetchGA4Report;
  const key: GA4SyncKey = {
    source: "ga4",
    accountId: input.propertyId,
    ecommerce: input.ecommerce,
  };
  const previous = await store.readSyncStatus(key);
  const startedAt = now().toISOString();
  const targetDate = input.mode === "force"
    ? input.dateTo
    : input.dateTo ?? startedAt.slice(0, 10);
  const range = resolveSyncDateRange({
    mode: input.mode,
    targetDate,
    lastSuccessfulDate: previous?.lastSuccessfulDate ?? undefined,
    initialDate: getGA4InitialSyncDate(environment),
    reprocessDays: getReprocessDays("ga4", environment),
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });

  await markSyncRunning(store, key, range, startedAt);
  let recordsProcessed = 0;

  try {
    const rows = await fetchReport({
      propertyId: input.propertyId,
      ecommerce: input.ecommerce,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    });
    const batchSize = getGA4UpsertBatchSize(environment);
    for (const batch of chunkGA4Rows(rows, batchSize)) {
      await store.upsertGA4Rows(batch, now().toISOString());
      recordsProcessed += batch.length;
    }

    const finishedAt = now().toISOString();
    await markSyncSuccess(
      store,
      key,
      range,
      recordsProcessed,
      finishedAt,
    );
    return {
      source: "ga4",
      status: "success",
      ...range,
      recordsProcessed,
      startedAt,
      finishedAt,
    };
  } catch (error) {
    const finishedAt = now().toISOString();
    const errorMessage = safeGA4SyncError(error, environment);
    await markSyncFailed(
      store,
      key,
      range,
      recordsProcessed,
      errorMessage,
      finishedAt,
    );
    return {
      source: "ga4",
      status: "failed",
      ...range,
      recordsProcessed,
      startedAt,
      finishedAt,
      errorMessage,
    };
  }
}
