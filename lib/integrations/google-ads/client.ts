import { createGoogleServiceAccountAccessToken } from "../google-auth.ts";
import type {
  GoogleAdsApiResult,
  GoogleAdsCampaignMetric,
  GoogleAdsDerivedMetrics,
  GoogleAdsQueryInput,
  GoogleAdsSearchStreamResponse,
  GoogleAdsTotals,
} from "./types.ts";

const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
const GOOGLE_ADS_API_VERSION = "v25";
type Environment = Record<string, string | undefined>;

export type GoogleAdsRequester = (input: {
  customerId: string;
  loginCustomerId?: string;
  accessToken: string;
  query: string;
}) => Promise<GoogleAdsSearchStreamResponse>;

export function normalizeGoogleAdsCustomerId(value: string): string {
  const normalized = value.replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(normalized)) {
    throw new Error("El Customer ID de Google Ads debe contener 10 dígitos.");
  }
  return normalized;
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

export function buildGoogleAdsCampaignQuery(input: GoogleAdsQueryInput): string {
  if (!validDate(input.dateFrom) || !validDate(input.dateTo) || input.dateFrom > input.dateTo) {
    throw new Error("Rango de fechas de Google Ads inválido.");
  }
  return `SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    campaign.advertising_channel_type,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value,
    segments.date
  FROM campaign
  WHERE segments.date BETWEEN '${input.dateFrom}' AND '${input.dateTo}'
  ORDER BY metrics.cost_micros DESC`;
}

function finiteNumber(value: string | number | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeGoogleAdsResult(result: GoogleAdsApiResult): GoogleAdsCampaignMetric {
  return {
    date: result.segments?.date ?? "",
    campaignId: String(result.campaign?.id ?? ""),
    campaignName: result.campaign?.name?.trim() || "Sin nombre",
    campaignStatus: result.campaign?.status ?? "UNSPECIFIED",
    campaignType: result.campaign?.advertisingChannelType ?? "UNSPECIFIED",
    impressions: finiteNumber(result.metrics?.impressions),
    clicks: finiteNumber(result.metrics?.clicks),
    cost: finiteNumber(result.metrics?.costMicros) / 1_000_000,
    conversions: finiteNumber(result.metrics?.conversions),
    attributedConversionValue: finiteNumber(result.metrics?.conversionsValue),
  };
}

export function googleAdsDerivedMetrics(input: {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  attributedConversionValue: number;
}): GoogleAdsDerivedMetrics {
  return {
    ctr: input.impressions > 0 ? input.clicks / input.impressions : null,
    cpc: input.clicks > 0 ? input.cost / input.clicks : null,
    cpa: input.conversions > 0 ? input.cost / input.conversions : null,
    roas: input.cost > 0 ? input.attributedConversionValue / input.cost : null,
  };
}

export function googleAdsTotals(rows: GoogleAdsCampaignMetric[]): GoogleAdsTotals {
  const totals = rows.reduce((sum, row) => ({
    spend: sum.spend + row.cost,
    impressions: sum.impressions + row.impressions,
    clicks: sum.clicks + row.clicks,
    conversions: sum.conversions + row.conversions,
    attributedConversionValue: sum.attributedConversionValue + row.attributedConversionValue,
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, attributedConversionValue: 0 });
  return {
    ...totals,
    ...googleAdsDerivedMetrics({
      impressions: totals.impressions,
      clicks: totals.clicks,
      cost: totals.spend,
      conversions: totals.conversions,
      attributedConversionValue: totals.attributedConversionValue,
    }),
  };
}

export function safeGoogleAdsError(status: number): Error {
  if (status === 401) return new Error("Google Ads: error de autenticación.");
  if (status === 403) {
    return new Error("Google Ads: la cuenta de servicio no tiene acceso o el proyecto no posee nivel de API suficiente.");
  }
  if (status === 404) return new Error("Google Ads: Customer ID incorrecto o no disponible.");
  return new Error(`Google Ads API respondió HTTP ${status}.`);
}

export const requestGoogleAdsCampaigns: GoogleAdsRequester = async ({
  customerId,
  loginCustomerId,
  accessToken,
  query,
}) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;
  const response = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
    { method: "POST", headers, body: JSON.stringify({ query }) },
  );
  if (!response.ok) throw safeGoogleAdsError(response.status);
  return response.json() as Promise<GoogleAdsSearchStreamResponse>;
};

export async function fetchGoogleAdsCampaignReport(
  input: GoogleAdsQueryInput,
  options: {
    environment?: Environment;
    accessToken?: string;
    requester?: GoogleAdsRequester;
  } = {},
): Promise<GoogleAdsCampaignMetric[]> {
  const environment = options.environment ?? process.env;
  const customerId = normalizeGoogleAdsCustomerId(input.customerId);
  const loginCustomerId = input.loginCustomerId
    ? normalizeGoogleAdsCustomerId(input.loginCustomerId)
    : undefined;
  const accessToken = options.accessToken
    ?? await createGoogleServiceAccountAccessToken(environment, GOOGLE_ADS_SCOPE);
  const response = await (options.requester ?? requestGoogleAdsCampaigns)({
    customerId,
    loginCustomerId,
    accessToken,
    query: buildGoogleAdsCampaignQuery(input),
  });
  return response.flatMap((batch) => batch.results ?? []).map(normalizeGoogleAdsResult);
}
