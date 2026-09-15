import { NextResponse } from "next/server";
import {
  fetchMetaAdsData,
  fetchMetaInsights,
  metaCacheKey,
} from "@/lib/integrations/meta-ads/client";
import { previousEquivalentRange } from "@/lib/integrations/ga4/dashboard";
import {
  getMetaAdAccountId,
  normalizeMetaEcommerce,
} from "@/lib/integrations/meta-ads/config";
import type { MetaInsightsRow } from "@/lib/integrations/meta-ads/types";
import { MetaSuccessCache } from "@/lib/integrations/meta-ads/cache";
import {
  asComparisonError,
  metaErrorDiagnostic,
  metaPublicError,
} from "@/lib/integrations/meta-ads/errors";

export const runtime = "nodejs";
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new MetaSuccessCache<MetaInsightsRow[]>(CACHE_TTL_MS);

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function dataForRange(input: {
  ecommerce: string;
  accessToken: string;
  dateFrom: string;
  dateTo: string;
}) {
  return fetchMetaAdsData(input, async (query) => {
    const accountId = getMetaAdAccountId(query.ecommerce);
    const key = metaCacheKey(
      query.ecommerce,
      accountId,
      query.dateFrom,
      query.dateTo,
      query.level,
    );
    return cache.getOrLoad(key, () => fetchMetaInsights(query));
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const store = url.searchParams.get("store");
  const includeComparison = url.searchParams.get("compare") === "true";
  if (!validDate(dateFrom) || !validDate(dateTo) || dateFrom > dateTo) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!store || !accessToken) {
    return NextResponse.json({ error: "Meta Ads no está configurado" }, { status: 503 });
  }
  try {
    const ecommerce = normalizeMetaEcommerce(store);
    getMetaAdAccountId(ecommerce);
    const input = { ecommerce, accessToken, dateFrom, dateTo };
    const current = await dataForRange(input);
    if (!includeComparison) return NextResponse.json(current);
    const comparedRange = previousEquivalentRange(dateFrom, dateTo);
    try {
      const comparison = await dataForRange({ ...input, ...comparedRange });
      return NextResponse.json({ ...current, comparison, comparisonError: null });
    } catch (error) {
      const contextualError = asComparisonError(error);
      console.error("Meta Ads comparison failed", metaErrorDiagnostic(contextualError));
      const comparisonError = metaPublicError(contextualError);
      return NextResponse.json({
        ...current,
        comparison: null,
        comparisonError: "Comparación no disponible",
        comparisonConnectionStatus: comparisonError.meta_connection_status,
      });
    }
  } catch (error) {
    console.error("Meta Ads request failed", metaErrorDiagnostic(error));
    return NextResponse.json(metaPublicError(error), { status: 502 });
  }
}
