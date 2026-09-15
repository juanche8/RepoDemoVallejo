import type { SyncSource } from "@/types/sync";

export const DEFAULT_REPROCESS_DAYS: Record<SyncSource, number> = {
  ga4: 3,
  google_ads: 7,
  meta_ads: 7,
};

export const DEFAULT_GA4_UPSERT_BATCH_SIZE = 500;

const ENVIRONMENT_KEYS: Record<SyncSource, string> = {
  ga4: "GA4_REPROCESS_DAYS",
  google_ads: "GOOGLE_ADS_REPROCESS_DAYS",
  meta_ads: "META_ADS_REPROCESS_DAYS",
};

export function parseReprocessDays(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined || value.trim() === "") return fallback;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getReprocessDays(
  source: SyncSource,
  environment: NodeJS.ProcessEnv = process.env,
): number {
  return parseReprocessDays(
    environment[ENVIRONMENT_KEYS[source]],
    DEFAULT_REPROCESS_DAYS[source],
  );
}

export function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (!value || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getGA4UpsertBatchSize(
  environment: NodeJS.ProcessEnv = process.env,
): number {
  return parsePositiveInteger(
    environment.GA4_UPSERT_BATCH_SIZE,
    DEFAULT_GA4_UPSERT_BATCH_SIZE,
  );
}

export function getGA4InitialSyncDate(
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const value = environment.GA4_INITIAL_SYNC_DATE?.trim();
  return value || undefined;
}
