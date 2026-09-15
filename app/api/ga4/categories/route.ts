import { NextResponse } from "next/server";
import {
  categoryCacheKey,
  fetchGA4CategoriesData,
  type CategoryReportType,
} from "@/lib/integrations/ga4/categories";
import { fetchGA4ApiReport } from "@/lib/integrations/ga4/client";
import { previousEquivalentRange } from "@/lib/integrations/ga4/dashboard";
import type {
  GA4ApiResponse,
  GA4CategoriesData,
  GA4QueryInput,
  GA4ReportDefinition,
} from "@/lib/integrations/ga4/types";

export const runtime = "nodejs";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; data: GA4ApiResponse }>();

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value;
}

async function cachedReport(
  input: GA4QueryInput,
  definition: GA4ReportDefinition,
  reportType: CategoryReportType,
): Promise<GA4ApiResponse> {
  const key = categoryCacheKey(input, reportType);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const data = await fetchGA4ApiReport(input, definition);
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

async function categoriesForRange(
  input: GA4QueryInput,
): Promise<GA4CategoriesData> {
  return fetchGA4CategoriesData(
    input,
    (query, definition, reportType) =>
      cachedReport(query, definition, reportType),
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const includeComparison = url.searchParams.get("compare") === "true";
  if (!validDate(dateFrom) || !validDate(dateTo) || dateFrom > dateTo) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) {
    return NextResponse.json(
      { error: "No se pudieron cargar los datos de GA4" },
      { status: 503 },
    );
  }
  const input: GA4QueryInput = {
    propertyId,
    ecommerce: "Sportotal",
    dateFrom,
    dateTo,
  };
  try {
    const current = await categoriesForRange(input);
    if (!includeComparison) return NextResponse.json(current);
    const comparedRange = previousEquivalentRange(dateFrom, dateTo);
    try {
      const comparison = await categoriesForRange({
        ...input,
        ...comparedRange,
      });
      return NextResponse.json({
        ...current,
        comparison,
        comparisonError: null,
      });
    } catch {
      return NextResponse.json({
        ...current,
        comparison: null,
        comparisonError: "Comparación no disponible",
      });
    }
  } catch {
    return NextResponse.json(
      { error: "No se pudieron cargar los datos de GA4" },
      { status: 502 },
    );
  }
}
