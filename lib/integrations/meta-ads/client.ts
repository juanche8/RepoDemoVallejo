import { metaTotals, normalizeMetaCampaign } from "./normalize.ts";
import type { MetaAdsData, MetaInsightsResponse, MetaInsightsRow } from "./types.ts";
import {
  getMetaAdAccountId,
  normalizeMetaEcommerce,
} from "./config.ts";
import {
  createMetaApiError,
  MetaIntegrationError,
  type MetaErrorContext,
} from "./errors.ts";

const META_GRAPH_VERSION = "v26.0";
const CAMPAIGN_FIELDS = [
  "campaign_id",
  "campaign_name",
  "impressions",
  "reach",
  "clicks",
  "spend",
  "actions",
  "action_values",
] as const;

export type MetaInsightsLevel = "campaign" | "account";
export type MetaRequest = (
  url: string,
  init: { method: "GET"; headers: { Authorization: string } },
) => Promise<Response>;

export function normalizeMetaAccountId(value: string): string {
  const normalized = value.trim().replace(/^act_/, "");
  if (!/^\d+$/.test(normalized)) throw new Error("Meta Ads: account ID inválido.");
  return normalized;
}

export function metaCacheKey(
  ecommerce: string,
  accountId: string,
  dateFrom: string,
  dateTo: string,
  level: MetaInsightsLevel,
): string {
  return `${normalizeMetaEcommerce(ecommerce)}:${normalizeMetaAccountId(accountId)}:${dateFrom}:${dateTo}:${level}`;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function buildInsightsUrl(input: {
  accountId: string;
  dateFrom: string;
  dateTo: string;
  level: MetaInsightsLevel;
  after?: string;
}): string {
  if (!validDate(input.dateFrom) || !validDate(input.dateTo) || input.dateFrom > input.dateTo) {
    throw new Error("Meta Ads: rango de fechas inválido.");
  }
  const accountId = normalizeMetaAccountId(input.accountId);
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/act_${accountId}/insights`);
  url.searchParams.set("level", input.level);
  url.searchParams.set("fields", input.level === "campaign" ? CAMPAIGN_FIELDS.join(",") : "reach");
  url.searchParams.set("time_range", JSON.stringify({ since: input.dateFrom, until: input.dateTo }));
  url.searchParams.set("limit", "500");
  if (input.after) url.searchParams.set("after", input.after);
  return url.toString();
}

export async function fetchMetaInsights(input: {
  ecommerce: string;
  accessToken: string;
  dateFrom: string;
  dateTo: string;
  level: MetaInsightsLevel;
}, request: MetaRequest = fetch): Promise<MetaInsightsRow[]> {
  if (typeof window !== "undefined") {
    throw new Error("Meta Ads: el cliente solo puede ejecutarse en servidor.");
  }
  if (!input.accessToken) throw new Error("Meta Ads: falta access token.");
  const accountId = getMetaAdAccountId(input.ecommerce);
  const context: MetaErrorContext = {
    ecommerce: normalizeMetaEcommerce(input.ecommerce),
    accountId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    endpoint: input.level === "campaign" ? "campaigns" : "reach",
  };
  const rows: MetaInsightsRow[] = [];
  let after: string | undefined;
  do {
    let response: Response;
    try {
      response = await request(buildInsightsUrl({ ...input, accountId, after }), {
        method: "GET",
        headers: { Authorization: `Bearer ${input.accessToken}` },
      });
    } catch (error) {
      if (error instanceof MetaIntegrationError) throw error;
      throw new MetaIntegrationError(
        "META_API_UNAVAILABLE",
        "unavailable",
        context,
      );
    }
    const payload = await response.json().catch(() => null) as MetaInsightsResponse | null;
    if (!response.ok) throw createMetaApiError(response.status, payload?.error, context);
    if (!payload || !Array.isArray(payload.data)) {
      throw new MetaIntegrationError(
        "META_BAD_RESPONSE",
        "unavailable",
        context,
        response.status,
      );
    }
    rows.push(...(payload.data ?? []));
    after = payload.paging?.next ? payload.paging.cursors?.after : undefined;
  } while (after);
  return rows;
}

export async function fetchMetaAdsData(input: {
  ecommerce: string;
  accessToken: string;
  dateFrom: string;
  dateTo: string;
}, runner: typeof fetchMetaInsights = fetchMetaInsights): Promise<MetaAdsData> {
  const [campaignRows, accountRows] = await Promise.all([
    runner({ ...input, level: "campaign" }),
    runner({ ...input, level: "account" }),
  ]);
  const campaigns = campaignRows.map(normalizeMetaCampaign).sort((a, b) => b.spend - a.spend);
  const rawReach = Number(accountRows[0]?.reach ?? 0);
  const reach = accountRows.length && Number.isFinite(rawReach) ? rawReach : null;
  return {
    connectionStatus: "connected",
    ecommerce: normalizeMetaEcommerce(input.ecommerce),
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    updatedAt: new Date().toISOString(),
    campaigns,
    totals: metaTotals(campaigns, reach),
  };
}
