import { fetchGA4ApiReport } from "./client.ts";
import {
  parseDecimalMetric,
  parseIntegerMetric,
} from "./normalize.ts";
import type {
  GA4ApiResponse,
  GA4BrandProductData,
  GA4CategoryMetricRow,
  GA4ProductMetricRow,
  GA4ProductOpportunities,
  GA4ProductPage,
  GA4ProductSortKey,
  GA4QueryInput,
  GA4ReportDefinition,
} from "./types";

const ITEM_METRICS = [
  "itemsViewed",
  "itemsAddedToCart",
  "itemsCheckedOut",
  "itemsPurchased",
  "itemRevenue",
] as const;

export const GA4_BRAND_REPORT: GA4ReportDefinition = {
  dimensions: ["itemBrand"],
  metrics: ITEM_METRICS,
};

export const GA4_PRODUCT_REPORT: GA4ReportDefinition = {
  dimensions: [
    "itemId",
    "itemName",
    "itemBrand",
    "itemCategory2",
    "itemCategory3",
  ],
  metrics: ITEM_METRICS,
};

export type BrandProductReportType =
  | "brand-performance"
  | "product-performance";

type ReportRunner = (
  input: GA4QueryInput,
  definition: GA4ReportDefinition,
  reportType: BrandProductReportType,
) => Promise<GA4ApiResponse>;

function indexes(headers: Array<{ name?: string }> | undefined) {
  return new Map((headers ?? []).map((header, index) => [header.name ?? "", index]));
}

function clean(value: string | null | undefined, fallback: string): string {
  const result = value?.trim().replace(/\s+/g, " ");
  return !result || result === "(not set)" ? fallback : result;
}

export function brandConsolidationKey(value: string): string {
  return clean(value, "Sin marca").toLocaleLowerCase("es-AR");
}

function emptyMetricRow(name: string): GA4CategoryMetricRow {
  return {
    name,
    itemsViewed: 0,
    itemsAddedToCart: 0,
    itemsCheckedOut: 0,
    itemsPurchased: 0,
    itemRevenue: 0,
  };
}

function rowMetrics(
  response: GA4ApiResponse,
  rowIndex: number,
): Omit<GA4CategoryMetricRow, "name"> {
  const metricIndexes = indexes(response.metricHeaders);
  const values = response.rows?.[rowIndex]?.metricValues;
  const integer = (metric: string) => parseIntegerMetric(
    values?.[metricIndexes.get(metric) ?? -1]?.value ?? undefined,
    metric,
  );
  return {
    itemsViewed: integer("itemsViewed"),
    itemsAddedToCart: integer("itemsAddedToCart"),
    itemsCheckedOut: integer("itemsCheckedOut"),
    itemsPurchased: integer("itemsPurchased"),
    itemRevenue: parseDecimalMetric(
      values?.[metricIndexes.get("itemRevenue") ?? -1]?.value ?? undefined,
      "itemRevenue",
    ),
  };
}

function addMetrics(
  target: GA4CategoryMetricRow,
  metrics: Omit<GA4CategoryMetricRow, "name">,
) {
  target.itemsViewed += metrics.itemsViewed;
  target.itemsAddedToCart += metrics.itemsAddedToCart;
  target.itemsCheckedOut += metrics.itemsCheckedOut;
  target.itemsPurchased += metrics.itemsPurchased;
  target.itemRevenue += metrics.itemRevenue;
}

export function normalizeBrandRows(
  response: GA4ApiResponse,
): GA4CategoryMetricRow[] {
  const groups = new Map<string, GA4CategoryMetricRow>();
  for (let index = 0; index < (response.rows?.length ?? 0); index += 1) {
    const raw = response.rows?.[index]?.dimensionValues?.[0]?.value;
    const displayName = clean(raw, "Sin marca");
    const key = brandConsolidationKey(displayName);
    const current = groups.get(key) ?? emptyMetricRow(displayName);
    addMetrics(current, rowMetrics(response, index));
    groups.set(key, current);
  }
  return [...groups.values()].sort(
    (left, right) => right.itemRevenue - left.itemRevenue,
  );
}

type ProductAccumulator = GA4ProductMetricRow & {
  selectedNameViews: number;
};

export function normalizeProductRows(
  response: GA4ApiResponse,
): GA4ProductMetricRow[] {
  const dimensionIndexes = indexes(response.dimensionHeaders);
  const groups = new Map<string, ProductAccumulator>();
  for (let index = 0; index < (response.rows?.length ?? 0); index += 1) {
    const values = response.rows?.[index]?.dimensionValues;
    const dimension = (name: string, fallback: string) => clean(
      values?.[dimensionIndexes.get(name) ?? -1]?.value,
      fallback,
    );
    const rawId = dimension("itemId", "Sin ID");
    const key = rawId === "Sin ID" ? "Sin ID" : rawId;
    const metrics = rowMetrics(response, index);
    const candidateName = dimension("itemName", "Sin nombre");
    const current = groups.get(key) ?? {
      ...emptyMetricRow(candidateName),
      itemId: key,
      itemName: candidateName,
      itemBrand: dimension("itemBrand", "Sin marca"),
      macroCategory: dimension("itemCategory2", "Sin categoría"),
      category: dimension("itemCategory3", "Sin categoría"),
      selectedNameViews: -1,
    };
    if (metrics.itemsViewed > current.selectedNameViews) {
      current.name = candidateName;
      current.itemName = candidateName;
      current.itemBrand = dimension("itemBrand", "Sin marca");
      current.macroCategory = dimension("itemCategory2", "Sin categoría");
      current.category = dimension("itemCategory3", "Sin categoría");
      current.selectedNameViews = metrics.itemsViewed;
    }
    addMetrics(current, metrics);
    groups.set(key, current);
  }
  return [...groups.values()]
    .map((row) => {
      const normalized = { ...row } as Partial<ProductAccumulator>;
      delete normalized.selectedNameViews;
      return normalized as GA4ProductMetricRow;
    })
    .sort((left, right) => right.itemRevenue - left.itemRevenue);
}

export function itemConversion(
  row: Pick<GA4CategoryMetricRow, "itemsViewed" | "itemsPurchased">,
): number | null {
  return row.itemsViewed === 0
    ? null
    : (row.itemsPurchased / row.itemsViewed) * 100;
}

export function averageRevenuePerUnit(
  row: Pick<GA4CategoryMetricRow, "itemsPurchased" | "itemRevenue">,
): number | null {
  return row.itemsPurchased === 0
    ? null
    : row.itemRevenue / row.itemsPurchased;
}

function rowCoverage(
  response: GA4ApiResponse | null,
  dimension: "itemId" | "itemName" | "itemBrand",
  missingValue: string,
): number {
  const dimensionIndex = indexes(response?.dimensionHeaders).get(dimension);
  const rows = response?.rows ?? [];
  if (!rows.length || dimensionIndex === undefined) return 0;
  const missing = rows.filter((row) =>
    clean(row.dimensionValues?.[dimensionIndex]?.value, missingValue)
      === missingValue).length;
  return ((rows.length - missing) / rows.length) * 100;
}

export function normalizeGA4BrandProductData(
  input: GA4QueryInput,
  brandResponse: GA4ApiResponse,
  productResponse: GA4ApiResponse | null,
  updatedAt: string,
): GA4BrandProductData {
  const brands = normalizeBrandRows(brandResponse);
  const products = productResponse ? normalizeProductRows(productResponse) : [];
  return {
    propertyId: input.propertyId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    updatedAt,
    hasData: brands.length > 0,
    productDetailAvailable: productResponse !== null,
    brands,
    products,
    coverage: {
      itemBrand: rowCoverage(productResponse, "itemBrand", "Sin marca"),
      itemId: rowCoverage(productResponse, "itemId", "Sin ID"),
      itemName: rowCoverage(productResponse, "itemName", "Sin nombre"),
    },
  };
}

export async function fetchGA4BrandProductData(
  input: GA4QueryInput,
  runner: ReportRunner = (query, definition) =>
    fetchGA4ApiReport(query, definition),
  updatedAt = new Date().toISOString(),
): Promise<GA4BrandProductData> {
  const brandResponse = await runner(input, GA4_BRAND_REPORT, "brand-performance");
  const productResult = await Promise.allSettled([
    runner(input, GA4_PRODUCT_REPORT, "product-performance"),
  ]);
  return normalizeGA4BrandProductData(
    input,
    brandResponse,
    productResult[0].status === "fulfilled" ? productResult[0].value : null,
    updatedAt,
  );
}

export function brandProductCacheKey(
  input: GA4QueryInput,
  reportType: BrandProductReportType,
): string {
  return `${input.propertyId}:${input.dateFrom}:${input.dateTo}:${reportType}`;
}

export const PRODUCT_PAGE_SIZES = [25, 50, 100] as const;

export function createTimedDatasetCache<T>(ttlMs: number) {
  const entries = new Map<string, { expiresAt: number; data: T }>();
  return {
    async getOrLoad(key: string, loader: () => Promise<T>, now = Date.now()) {
      const cached = entries.get(key);
      if (cached && cached.expiresAt > now) return cached.data;
      const data = await loader();
      entries.set(key, { data, expiresAt: now + ttlMs });
      return data;
    },
  };
}

export function normalizeProductPageSize(value: number): 25 | 50 | 100 {
  return PRODUCT_PAGE_SIZES.includes(value as 25 | 50 | 100)
    ? value as 25 | 50 | 100
    : 50;
}

const productSortValue = (row: GA4ProductMetricRow, sortBy: GA4ProductSortKey) => {
  switch (sortBy) {
    case "revenue": return row.itemRevenue;
    case "purchased": return row.itemsPurchased;
    case "conversion": return itemConversion(row) ?? 0;
    case "views": return row.itemsViewed;
    case "addedToCart": return row.itemsAddedToCart;
    case "checkedOut": return row.itemsCheckedOut;
    case "itemName": return row.itemName.toLocaleLowerCase("es-AR");
    case "itemBrand": return row.itemBrand.toLocaleLowerCase("es-AR");
  }
};

export function paginateProducts(
  products: GA4ProductMetricRow[],
  previousProducts: GA4ProductMetricRow[],
  options: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: GA4ProductSortKey;
    sortDirection?: "asc" | "desc";
  } = {},
): GA4ProductPage {
  const pageSize = normalizeProductPageSize(options.pageSize ?? 50);
  const search = options.search?.trim().toLocaleLowerCase("es-AR") ?? "";
  const sortBy = options.sortBy ?? "revenue";
  const direction = options.sortDirection === "asc" ? 1 : -1;
  const filtered = search
    ? products.filter((row) => [row.itemId, row.itemName, row.itemBrand]
      .some((value) => value.toLocaleLowerCase("es-AR").includes(search)))
    : [...products];
  const indexed = filtered.map((row, index) => ({ row, index }));
  indexed.sort((left, right) => {
    const a = productSortValue(left.row, sortBy);
    const b = productSortValue(right.row, sortBy);
    const comparison = typeof a === "string" && typeof b === "string"
      ? a.localeCompare(b, "es-AR")
      : Number(a) - Number(b);
    return comparison === 0 ? left.index - right.index : comparison * direction;
  });
  const totalItems = indexed.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const requestedPage = Math.max(1, Math.trunc(options.page ?? 1));
  const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
  const previousById = new Map(previousProducts.map((row) => [row.itemId, row]));
  const items = indexed
    .slice((page - 1) * pageSize, page * pageSize)
    .map(({ row }) => ({ ...row, previous: previousById.get(row.itemId) ?? null }));
  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

const percentile = (values: number[], fraction: number) => values.length
  ? [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)]
  : 0;

export function productOpportunities(
  products: GA4ProductMetricRow[],
): GA4ProductOpportunities {
  const views = products.map((row) => row.itemsViewed);
  const conversions = products
    .map((row) => itemConversion(row))
    .filter((value): value is number => value !== null);
  const carts = products.map((row) => row.itemsAddedToCart);
  const checkoutRates = products
    .filter((row) => row.itemsAddedToCart > 0)
    .map((row) => row.itemsCheckedOut / row.itemsAddedToCart);
  return {
    highInterest: products.filter((row) =>
      row.itemsViewed >= percentile(views, 0.75)
      && (itemConversion(row) ?? 0) <= percentile(conversions, 0.5)).slice(0, 3),
    highConversion: products.filter((row) =>
      row.itemsViewed > 0
      && row.itemsPurchased > 0
      && row.itemsViewed <= percentile(views, 0.25)
      && (itemConversion(row) ?? 0) >= percentile(conversions, 0.75)).slice(0, 3),
    cartFriction: products.filter((row) =>
      row.itemsAddedToCart >= percentile(carts, 0.75)
      && row.itemsAddedToCart > 0
      && row.itemsCheckedOut / row.itemsAddedToCart <= percentile(checkoutRates, 0.5)).slice(0, 3),
  };
}
