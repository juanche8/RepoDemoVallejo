import { NextResponse } from "next/server";
import {
  fetchGA4DashboardData,
  ga4DashboardCacheKey,
  previousEquivalentRange,
  withGA4Comparison,
  publicGA4Error,
} from "@/lib/integrations/ga4/dashboard";
import type { GA4DashboardData } from "@/lib/integrations/ga4/types";

export const runtime = "nodejs";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; data: GA4DashboardData }>();

async function getGA4Data(
  propertyId: string,
  dateFrom: string,
  dateTo: string,
): Promise<GA4DashboardData> {
  const input = {
    propertyId,
    ecommerce: "Sportotal" as const,
    dateFrom,
    dateTo,
  };
  const cacheKey = ga4DashboardCacheKey(input);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const data = await fetchGA4DashboardData(input);
  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value;
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
    return NextResponse.json({ error: publicGA4Error() }, { status: 503 });
  }

  try {
    const data = await getGA4Data(propertyId, dateFrom, dateTo);
    if (!includeComparison) return NextResponse.json(data);
    const comparedRange = previousEquivalentRange(dateFrom, dateTo);
    const result = await withGA4Comparison(data, () => getGA4Data(
        propertyId,
        comparedRange.dateFrom,
        comparedRange.dateTo,
      ));
    if (result.comparisonError) {
      console.error(`source=ga4-comparison propertyId=${propertyId} dateFrom=${comparedRange.dateFrom} dateTo=${comparedRange.dateTo} status=unavailable`);
    }
    return NextResponse.json(result);
  } catch (error) {
    const technicalMessage = error instanceof Error ? error.message : "unknown";
    console.error(`source=ga4 propertyId=${propertyId} dateFrom=${dateFrom} dateTo=${dateTo}: ${technicalMessage}`);
    return NextResponse.json({ error: publicGA4Error() }, { status: 502 });
  }
}
