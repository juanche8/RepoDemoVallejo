import { fetchGA4ApiReport } from "./client.ts";
import {
  parseDecimalMetric,
  parseIntegerMetric,
} from "./normalize.ts";
import type {
  GA4ApiResponse,
  GA4CategoriesData,
  GA4CategoryMetricRow,
  GA4QueryInput,
  GA4ReportDefinition,
} from "./types";

const CATEGORY_METRICS = [
  "itemsViewed",
  "itemsAddedToCart",
  "itemsCheckedOut",
  "itemsPurchased",
  "itemRevenue",
] as const;

export const GA4_CATEGORY_MACRO_REPORT: GA4ReportDefinition = {
  dimensions: ["itemCategory2"],
  metrics: CATEGORY_METRICS,
};

export const GA4_CATEGORY_DETAIL_REPORT: GA4ReportDefinition = {
  dimensions: ["itemCategory3", "itemCategory"],
  metrics: CATEGORY_METRICS,
};

export type CategoryReportType = "macro" | "detail";

type ReportRunner = (
  input: GA4QueryInput,
  definition: GA4ReportDefinition,
  reportType: CategoryReportType,
) => Promise<GA4ApiResponse>;

function indexes(headers: Array<{ name?: string }> | undefined) {
  return new Map((headers ?? []).map((header, index) => [header.name ?? "", index]));
}

export function normalizeCategoryName(value: string | null | undefined): string {
  const normalized = value?.trim();
  return !normalized || normalized === "(not set)"
    ? "Sin categoría"
    : normalized;
}

function emptyRow(name: string): GA4CategoryMetricRow {
  return {
    name,
    itemsViewed: 0,
    itemsAddedToCart: 0,
    itemsCheckedOut: 0,
    itemsPurchased: 0,
    itemRevenue: 0,
  };
}

function groupedRows(
  response: GA4ApiResponse,
  dimension: string,
): GA4CategoryMetricRow[] {
  const dimensionIndexes = indexes(response.dimensionHeaders);
  const metricIndexes = indexes(response.metricHeaders);
  const dimensionIndex = dimensionIndexes.get(dimension);
  if (response.rows?.length && dimensionIndex === undefined) {
    throw new Error(`source=ga4-categories: falta ${dimension}.`);
  }
  const groups = new Map<string, GA4CategoryMetricRow>();
  for (const row of response.rows ?? []) {
    const name = normalizeCategoryName(
      row.dimensionValues?.[dimensionIndex ?? 0]?.value,
    );
    const current = groups.get(name) ?? emptyRow(name);
    const integer = (metric: string) => parseIntegerMetric(
      row.metricValues?.[metricIndexes.get(metric) ?? -1]?.value ?? undefined,
      metric,
    );
    const decimal = (metric: string) => parseDecimalMetric(
      row.metricValues?.[metricIndexes.get(metric) ?? -1]?.value ?? undefined,
      metric,
    );
    current.itemsViewed += integer("itemsViewed");
    current.itemsAddedToCart += integer("itemsAddedToCart");
    current.itemsCheckedOut += integer("itemsCheckedOut");
    current.itemsPurchased += integer("itemsPurchased");
    current.itemRevenue += decimal("itemRevenue");
    groups.set(name, current);
  }
  return [...groups.values()].sort(
    (left, right) => right.itemRevenue - left.itemRevenue,
  );
}

export function categoryConversion(row: GA4CategoryMetricRow): number | null {
  return row.itemsViewed === 0
    ? null
    : (row.itemsPurchased / row.itemsViewed) * 100;
}

export function normalizeGA4CategoriesData(
  input: GA4QueryInput,
  macroResponse: GA4ApiResponse,
  detailResponse: GA4ApiResponse | null,
  updatedAt: string,
): GA4CategoriesData {
  const macros = groupedRows(macroResponse, "itemCategory2");
  const details = detailResponse
    ? groupedRows(detailResponse, "itemCategory3")
    : [];
  const audiences = detailResponse
    ? groupedRows(detailResponse, "itemCategory")
    : [];
  const totalViews = macros.reduce((sum, row) => sum + row.itemsViewed, 0);
  const uncategorizedViews = macros.find(
    (row) => row.name === "Sin categoría",
  )?.itemsViewed ?? 0;
  return {
    propertyId: input.propertyId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    updatedAt,
    hasData: macros.length > 0,
    detailAvailable: detailResponse !== null,
    macros,
    details,
    audiences,
    uncategorizedPercentage: totalViews > 0
      ? (uncategorizedViews / totalViews) * 100
      : 0,
  };
}

export async function fetchGA4CategoriesData(
  input: GA4QueryInput,
  runner: ReportRunner = (query, definition) =>
    fetchGA4ApiReport(query, definition),
  updatedAt = new Date().toISOString(),
): Promise<GA4CategoriesData> {
  const macroResponse = await runner(
    input,
    GA4_CATEGORY_MACRO_REPORT,
    "macro",
  );
  const detailResult = await Promise.allSettled([
    runner(input, GA4_CATEGORY_DETAIL_REPORT, "detail"),
  ]);
  const detailResponse = detailResult[0].status === "fulfilled"
    ? detailResult[0].value
    : null;
  return normalizeGA4CategoriesData(
    input,
    macroResponse,
    detailResponse,
    updatedAt,
  );
}

export function categoryCacheKey(
  input: GA4QueryInput,
  reportType: CategoryReportType,
): string {
  return `${input.propertyId}:${input.dateFrom}:${input.dateTo}:${reportType}`;
}
