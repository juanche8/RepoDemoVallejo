import { fetchGA4ApiReport } from "./client.ts";
import {
  parseDecimalMetric,
  parseIntegerMetric,
} from "./normalize.ts";
import type {
  GA4ApiResponse,
  GA4DashboardBreakdown,
  GA4DashboardData,
  GA4DashboardTotals,
  GA4FunnelEvents,
  GA4QueryInput,
  GA4ReportDefinition,
} from "./types";

const DASHBOARD_METRICS = [
  "activeUsers",
  "newUsers",
  "sessions",
  "ecommercePurchases",
  "purchaseRevenue",
] as const;

export const GA4_GLOBAL_REPORT: GA4ReportDefinition = {
  dimensions: [],
  metrics: DASHBOARD_METRICS,
};

export const GA4_SEGMENTED_REPORT: GA4ReportDefinition = {
  dimensions: ["sessionDefaultChannelGroup", "deviceCategory"],
  metrics: DASHBOARD_METRICS,
};

export const GA4_FUNNEL_EVENT_NAMES = [
  "view_item",
  "add_to_cart",
  "begin_checkout",
  "purchase",
] as const;

export const GA4_FUNNEL_EVENTS_REPORT: GA4ReportDefinition = {
  dimensions: ["eventName"],
  metrics: ["eventCount", "totalUsers"],
  dimensionFilter: {
    filter: {
      fieldName: "eventName",
      inListFilter: { values: GA4_FUNNEL_EVENT_NAMES },
    },
  },
};

export function ga4DashboardCacheKey(input: GA4QueryInput): string {
  return `${input.propertyId}:${input.dateFrom}:${input.dateTo}`;
}

export function ga4FunnelRate(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

export function ga4PercentageChange(
  current: number,
  previous: number,
): number | null {
  return previous === 0 ? null : ((current - previous) / previous) * 100;
}

export function ga4RateDelta(
  currentValue: number,
  currentBase: number,
  previousValue: number,
  previousBase: number,
): number | null {
  if (currentBase === 0 || previousBase === 0) return null;
  return ga4FunnelRate(currentValue, currentBase)
    - ga4FunnelRate(previousValue, previousBase);
}

function isoDateFromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function previousEquivalentRange(dateFrom: string, dateTo: string) {
  const from = new Date(`${dateFrom}T00:00:00.000Z`);
  const to = new Date(`${dateTo}T00:00:00.000Z`);
  const durationMs = to.getTime() - from.getTime();
  const previousTo = new Date(from.getTime() - 86_400_000);
  const previousFrom = new Date(previousTo.getTime() - durationMs);
  return {
    dateFrom: isoDateFromUtc(previousFrom),
    dateTo: isoDateFromUtc(previousTo),
  };
}

export async function withGA4Comparison(
  current: GA4DashboardData,
  loadComparison: () => Promise<GA4DashboardData>,
): Promise<GA4DashboardData> {
  try {
    return {
      ...current,
      comparison: await loadComparison(),
      comparisonError: null,
    };
  } catch {
    return {
      ...current,
      comparison: null,
      comparisonError: "Comparación no disponible",
    };
  }
}

type ReportRunner = (
  input: GA4QueryInput,
  definition: GA4ReportDefinition,
) => Promise<GA4ApiResponse>;

function indexes(headers: Array<{ name?: string }> | undefined) {
  return new Map((headers ?? []).map((header, index) => [header.name ?? "", index]));
}

function valueAt(
  values: Array<{ value?: string | null }> | undefined,
  map: Map<string, number>,
  name: string,
): string | undefined {
  const index = map.get(name);
  return index === undefined ? undefined : values?.[index]?.value ?? undefined;
}

function totalsFromRow(
  response: GA4ApiResponse,
  rowIndex: number,
): GA4DashboardTotals {
  const metricIndexes = indexes(response.metricHeaders);
  for (const metric of DASHBOARD_METRICS) {
    if (!metricIndexes.has(metric)) {
      throw new Error(`source=ga4: falta la métrica ${metric}.`);
    }
  }
  const values = response.rows?.[rowIndex]?.metricValues;
  return {
    sessions: parseIntegerMetric(valueAt(values, metricIndexes, "sessions"), "sessions"),
    activeUsers: parseIntegerMetric(valueAt(values, metricIndexes, "activeUsers"), "activeUsers"),
    newUsers: parseIntegerMetric(valueAt(values, metricIndexes, "newUsers"), "newUsers"),
    purchases: parseIntegerMetric(valueAt(values, metricIndexes, "ecommercePurchases"), "ecommercePurchases"),
    revenue: parseDecimalMetric(valueAt(values, metricIndexes, "purchaseRevenue"), "purchaseRevenue"),
  };
}

function emptyTotals(): GA4DashboardTotals {
  return { sessions: 0, activeUsers: 0, newUsers: 0, purchases: 0, revenue: 0 };
}

function emptyFunnelEvents(): GA4FunnelEvents {
  return {
    viewItem: 0,
    addToCart: 0,
    beginCheckout: 0,
    purchaseEventCount: 0,
    viewItemUsers: 0,
    addToCartUsers: 0,
    beginCheckoutUsers: 0,
    purchaseUsers: 0,
  };
}

export function normalizeGA4FunnelEvents(
  response: GA4ApiResponse,
): GA4FunnelEvents {
  const dimensionIndexes = indexes(response.dimensionHeaders);
  const metricIndexes = indexes(response.metricHeaders);
  const eventNameIndex = dimensionIndexes.get("eventName");
  const eventCountIndex = metricIndexes.get("eventCount");
  const totalUsersIndex = metricIndexes.get("totalUsers");
  if ((response.rows?.length ?? 0) > 0
    && (eventNameIndex === undefined
      || eventCountIndex === undefined
      || totalUsersIndex === undefined)) {
    throw new Error("source=ga4: faltan eventName, eventCount o totalUsers.");
  }

  const result = emptyFunnelEvents();
  const fields: Record<string, keyof GA4FunnelEvents> = {
    view_item: "viewItem",
    add_to_cart: "addToCart",
    begin_checkout: "beginCheckout",
    purchase: "purchaseEventCount",
  };
  const userFields: Record<string, keyof GA4FunnelEvents> = {
    view_item: "viewItemUsers",
    add_to_cart: "addToCartUsers",
    begin_checkout: "beginCheckoutUsers",
    purchase: "purchaseUsers",
  };
  for (const row of response.rows ?? []) {
    const eventName = row.dimensionValues?.[eventNameIndex ?? 0]?.value ?? "";
    const field = fields[eventName];
    const userField = userFields[eventName];
    if (!field || !userField) continue;
    result[field] += parseIntegerMetric(
      row.metricValues?.[eventCountIndex ?? 0]?.value ?? undefined,
      "eventCount",
    );
    result[userField] += parseIntegerMetric(
      row.metricValues?.[totalUsersIndex ?? 0]?.value ?? undefined,
      "totalUsers",
    );
  }
  return result;
}

function groupedBreakdown(
  response: GA4ApiResponse,
  dimension: string,
  fallback: string,
): GA4DashboardBreakdown[] {
  const dimensionIndexes = indexes(response.dimensionHeaders);
  const dimensionIndex = dimensionIndexes.get(dimension);
  if (dimensionIndex === undefined && response.rows?.length) {
    throw new Error(`source=ga4: falta la dimensión ${dimension}.`);
  }
  const groups = new Map<string, GA4DashboardTotals>();
  for (let rowIndex = 0; rowIndex < (response.rows?.length ?? 0); rowIndex += 1) {
    const name = response.rows?.[rowIndex]?.dimensionValues?.[dimensionIndex ?? 0]?.value?.trim()
      || fallback;
    const current = groups.get(name) ?? emptyTotals();
    const row = totalsFromRow(response, rowIndex);
    groups.set(name, {
      sessions: current.sessions + row.sessions,
      activeUsers: current.activeUsers + row.activeUsers,
      newUsers: current.newUsers + row.newUsers,
      purchases: current.purchases + row.purchases,
      revenue: current.revenue + row.revenue,
    });
  }
  return [...groups.entries()]
    .map(([name, totals]) => ({ name, ...totals }))
    .sort((left, right) => right.sessions - left.sessions);
}

export function normalizeGA4DashboardData(
  input: GA4QueryInput,
  globalResponse: GA4ApiResponse,
  segmentedResponse: GA4ApiResponse,
  eventResponse: GA4ApiResponse | null,
  updatedAt: string,
): GA4DashboardData {
  const hasData = Boolean(globalResponse.rows?.length);
  return {
    propertyId: input.propertyId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    updatedAt,
    hasData,
    totals: hasData ? totalsFromRow(globalResponse, 0) : emptyTotals(),
    funnelEvents: eventResponse
      ? normalizeGA4FunnelEvents(eventResponse)
      : emptyFunnelEvents(),
    funnelEventsAvailable: eventResponse !== null,
    channelGroups: groupedBreakdown(
      segmentedResponse,
      "sessionDefaultChannelGroup",
      "(not set)",
    ),
    devices: groupedBreakdown(segmentedResponse, "deviceCategory", "unknown"),
  };
}

export async function fetchGA4DashboardData(
  input: GA4QueryInput,
  runner: ReportRunner = fetchGA4ApiReport,
  updatedAt = new Date().toISOString(),
): Promise<GA4DashboardData> {
  const globalResponse = await runner(input, GA4_GLOBAL_REPORT);
  const [segmentedResult, eventResult] = await Promise.allSettled([
    runner(input, GA4_SEGMENTED_REPORT),
    runner(input, GA4_FUNNEL_EVENTS_REPORT),
  ]);
  const segmentedResponse = segmentedResult.status === "fulfilled"
    ? segmentedResult.value
    : { rows: [], rowCount: 0 };
  const eventResponse = eventResult.status === "fulfilled"
    ? eventResult.value
    : null;
  if (eventResult.status === "rejected") {
    console.warn(
      `source=ga4 propertyId=${input.propertyId} dateFrom=${input.dateFrom} dateTo=${input.dateTo}: eventos del funnel no disponibles`,
    );
  }
  if (eventResponse) {
    const events = normalizeGA4FunnelEvents(eventResponse);
    if (events.viewItem < events.addToCart
      || events.addToCart < events.beginCheckout) {
      console.warn(
        `source=ga4 propertyId=${input.propertyId} dateFrom=${input.dateFrom} dateTo=${input.dateTo}: secuencia de eventos no monótona`,
      );
    }
  }
  return normalizeGA4DashboardData(
    input,
    globalResponse,
    segmentedResponse,
    eventResponse,
    updatedAt,
  );
}

export function publicGA4Error(): string {
  return "No se pudieron cargar los datos de GA4";
}
