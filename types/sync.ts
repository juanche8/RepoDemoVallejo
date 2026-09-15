import type { Store } from "./analytics";

export type SyncSource = "ga4" | "google_ads" | "meta_ads";
export type SyncStatus = "idle" | "running" | "success" | "failed";
export type SyncMode = "incremental" | "force";

export type SyncRequest = {
  source: SyncSource;
  accountId?: string;
  propertyId?: string;
  ecommerce: Store;
  mode: SyncMode;
  dateFrom?: string;
  dateTo?: string;
};

export type SyncResult = {
  source: SyncSource;
  status: SyncStatus;
  dateFrom: string;
  dateTo: string;
  recordsProcessed: number;
  startedAt: string;
  finishedAt: string;
  errorMessage?: string;
};
