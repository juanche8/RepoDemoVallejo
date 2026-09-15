import type {
  GA4ApiResponse,
  GA4ApiRow,
  GA4NormalizedRow,
  GA4QueryInput,
} from "./types";

const DIMENSION_NAMES = [
  "date",
  "sessionDefaultChannelGroup",
  "sessionSource",
  "sessionMedium",
  "sessionCampaignName",
  "deviceCategory",
] as const;

const METRIC_NAMES = [
  "activeUsers",
  "newUsers",
  "sessions",
  "engagedSessions",
  "engagementRate",
  "ecommercePurchases",
  "purchaseRevenue",
] as const;

function headerIndexes(
  headers: Array<{ name?: string }> | undefined,
  expected: readonly string[],
  kind: string,
): Map<string, number> {
  if (!headers) throw new Error(`source=ga4: faltan headers de ${kind}.`);

  const indexes = new Map(
    headers.map((header, index) => [header.name ?? "", index]),
  );
  const missing = expected.filter((name) => !indexes.has(name));
  if (missing.length) {
    throw new Error(
      `source=ga4: faltan ${kind} requeridos: ${missing.join(", ")}.`,
    );
  }
  return indexes;
}

function rowValue(
  row: GA4ApiRow,
  indexes: Map<string, number>,
  name: string,
  kind: "dimensionValues" | "metricValues",
): string | undefined {
  const index = indexes.get(name);
  if (index === undefined) return undefined;
  return row[kind]?.[index]?.value ?? undefined;
}

export function normalizeGA4Date(value: string | undefined): string {
  if (!value || !/^\d{8}$/.test(value)) {
    throw new Error("source=ga4: fecha inválida; se esperaba YYYYMMDD.");
  }

  const normalized = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw new Error("source=ga4: fecha inválida; se esperaba YYYYMMDD.");
  }
  return normalized;
}

export function normalizeGA4Dimension(
  value: string | null | undefined,
  fallback: string,
): string {
  const normalized = value?.trim();
  if (!normalized || normalized.toLowerCase() === "(not set)") return fallback;
  return normalized;
}

export function parseIntegerMetric(
  value: string | null | undefined,
  name = "métrica",
): number {
  if (value === undefined || value === null || value.trim() === "") return 0;
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`source=ga4: ${name} debe ser un entero no negativo.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`source=ga4: ${name} excede el rango entero seguro.`);
  }
  return parsed;
}

export function parseDecimalMetric(
  value: string | null | undefined,
  name = "métrica",
): number {
  if (value === undefined || value === null || value.trim() === "") return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`source=ga4: ${name} debe ser un decimal no negativo.`);
  }
  return parsed;
}

export function normalizeGA4Response(
  response: GA4ApiResponse,
  input: GA4QueryInput,
): GA4NormalizedRow[] {
  if (!response.rows?.length) return [];

  const dimensions = headerIndexes(
    response.dimensionHeaders,
    DIMENSION_NAMES,
    "dimensiones",
  );
  const metrics = headerIndexes(
    response.metricHeaders,
    METRIC_NAMES,
    "métricas",
  );

  return response.rows.map((row) => ({
    date: normalizeGA4Date(rowValue(row, dimensions, "date", "dimensionValues")),
    propertyId: input.propertyId,
    ecommerce: input.ecommerce,
    channelGroup: normalizeGA4Dimension(
      rowValue(row, dimensions, "sessionDefaultChannelGroup", "dimensionValues"),
      "(not set)",
    ),
    source: normalizeGA4Dimension(
      rowValue(row, dimensions, "sessionSource", "dimensionValues"),
      "(not set)",
    ),
    medium: normalizeGA4Dimension(
      rowValue(row, dimensions, "sessionMedium", "dimensionValues"),
      "(not set)",
    ),
    campaign: normalizeGA4Dimension(
      rowValue(row, dimensions, "sessionCampaignName", "dimensionValues"),
      "(not set)",
    ),
    deviceCategory: normalizeGA4Dimension(
      rowValue(row, dimensions, "deviceCategory", "dimensionValues"),
      "unknown",
    ),
    activeUsers: parseIntegerMetric(
      rowValue(row, metrics, "activeUsers", "metricValues"),
      "activeUsers",
    ),
    newUsers: parseIntegerMetric(
      rowValue(row, metrics, "newUsers", "metricValues"),
      "newUsers",
    ),
    sessions: parseIntegerMetric(
      rowValue(row, metrics, "sessions", "metricValues"),
      "sessions",
    ),
    engagedSessions: parseIntegerMetric(
      rowValue(row, metrics, "engagedSessions", "metricValues"),
      "engagedSessions",
    ),
    engagementRate: parseDecimalMetric(
      rowValue(row, metrics, "engagementRate", "metricValues"),
      "engagementRate",
    ),
    ecommercePurchases: parseIntegerMetric(
      rowValue(row, metrics, "ecommercePurchases", "metricValues"),
      "ecommercePurchases",
    ),
    purchaseRevenue: parseDecimalMetric(
      rowValue(row, metrics, "purchaseRevenue", "metricValues"),
      "purchaseRevenue",
    ),
  }));
}
