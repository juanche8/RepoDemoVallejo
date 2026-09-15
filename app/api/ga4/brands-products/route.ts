import { NextResponse } from "next/server";
import {
  brandProductCacheKey,
  createTimedDatasetCache,
  fetchGA4BrandProductData,
  paginateProducts,
  productOpportunities,
  type BrandProductReportType,
} from "@/lib/integrations/ga4/brands-products";
import { fetchGA4ApiReport } from "@/lib/integrations/ga4/client";
import { previousEquivalentRange } from "@/lib/integrations/ga4/dashboard";
import type {
  GA4ApiResponse,
  GA4BrandProductData,
  GA4ProductSortKey,
  GA4QueryInput,
  GA4ReportDefinition,
} from "@/lib/integrations/ga4/types";

export const runtime = "nodejs";
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; data: GA4ApiResponse }>();
const datasetCache = createTimedDatasetCache<GA4BrandProductData>(CACHE_TTL_MS);

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value;
}

async function cachedReport(
  input: GA4QueryInput,
  definition: GA4ReportDefinition,
  reportType: BrandProductReportType,
): Promise<GA4ApiResponse> {
  const key = brandProductCacheKey(input, reportType);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const data = await fetchGA4ApiReport(input, definition);
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

async function dataForRange(input: GA4QueryInput): Promise<GA4BrandProductData> {
  const key = `${input.propertyId}:${input.dateFrom}:${input.dateTo}:normalized`;
  return datasetCache.getOrLoad(key, () => fetchGA4BrandProductData(
    input,
    (query, definition, reportType) => cachedReport(query, definition, reportType),
  ));
}

const SORT_KEYS = new Set<GA4ProductSortKey>([
  "revenue", "purchased", "conversion", "views", "addedToCart",
  "checkedOut", "itemName", "itemBrand",
]);

function withoutProducts(
  data: GA4BrandProductData,
): Omit<GA4BrandProductData, "products" | "comparison"> {
  const summary: Partial<GA4BrandProductData> = { ...data };
  delete summary.products;
  delete summary.comparison;
  return summary as Omit<GA4BrandProductData, "products" | "comparison">;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const includeComparison = url.searchParams.get("compare") === "true";
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "50");
  const search = url.searchParams.get("search") ?? "";
  const requestedSort = url.searchParams.get("sortBy") as GA4ProductSortKey | null;
  const sortBy = requestedSort && SORT_KEYS.has(requestedSort) ? requestedSort : "revenue";
  const sortDirection = url.searchParams.get("sortDirection") === "asc" ? "asc" : "desc";
  if (!validDate(dateFrom) || !validDate(dateTo) || dateFrom > dateTo) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) {
    return NextResponse.json({ error: "No se pudieron cargar los datos de GA4" }, { status: 503 });
  }
  const input: GA4QueryInput = {
    propertyId,
    ecommerce: "Sportotal",
    dateFrom,
    dateTo,
  };
  try {
    const current = await dataForRange(input);
    let comparison: GA4BrandProductData | null = null;
    let comparisonError: string | null = null;
    const comparedRange = previousEquivalentRange(dateFrom, dateTo);
    if (includeComparison) {
      try {
        comparison = await dataForRange({ ...input, ...comparedRange });
      } catch {
        comparisonError = "Comparación no disponible";
      }
    }
    const products = current.products;
    const currentSummary = withoutProducts(current);
    const comparisonSummary = comparison ? withoutProducts(comparison) : null;
    return NextResponse.json({
      ...currentSummary,
      comparison: comparisonSummary,
      comparisonError,
      productCount: products.length,
      productPage: paginateProducts(products, comparison?.products ?? [], {
        page,
        pageSize,
        search,
        sortBy,
        sortDirection,
      }),
      opportunities: productOpportunities(products),
    });
  } catch {
    return NextResponse.json({ error: "No se pudieron cargar los datos de GA4" }, { status: 502 });
  }
}
