import type {
  MetaAction,
  MetaCampaignMetric,
  MetaInsightsRow,
  MetaTotals,
} from "./types.ts";

export const META_CANONICAL_PURCHASE = "offsite_conversion.fb_pixel_purchase";
export const META_DIAGNOSTIC_PURCHASE = "omni_purchase";

function numeric(value: string | number | undefined, field: string): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Meta Ads: valor numérico inválido en ${field}.`);
  }
  return parsed;
}

export function actionValue(actions: MetaAction[] | undefined, type: string): number {
  const value = actions?.find((action) => action.action_type === type)?.value;
  return numeric(value, type);
}

export function metaRatios(input: {
  impressions: number;
  clicks: number;
  spend: number;
  purchases: number;
  attributedPurchaseValue: number;
}) {
  return {
    ctr: input.impressions > 0 ? input.clicks / input.impressions : null,
    cpc: input.clicks > 0 ? input.spend / input.clicks : null,
    cpa: input.purchases > 0 ? input.spend / input.purchases : null,
    roas: input.spend > 0 ? input.attributedPurchaseValue / input.spend : null,
  };
}

export function normalizeMetaCampaign(row: MetaInsightsRow): MetaCampaignMetric {
  const impressions = numeric(row.impressions, "impressions");
  const clicks = numeric(row.clicks, "clicks");
  const reach = numeric(row.reach, "reach");
  const spend = numeric(row.spend, "spend");
  const purchases = actionValue(row.actions, META_CANONICAL_PURCHASE);
  const attributedPurchaseValue = actionValue(row.action_values, META_CANONICAL_PURCHASE);
  return {
    campaignId: row.campaign_id?.trim() || "Sin ID",
    campaignName: row.campaign_name?.trim() || "Sin nombre",
    impressions,
    reach,
    clicks,
    spend,
    purchases,
    attributedPurchaseValue,
    omniPurchases: actionValue(row.actions, META_DIAGNOSTIC_PURCHASE),
    omniPurchaseValue: actionValue(row.action_values, META_DIAGNOSTIC_PURCHASE),
    ...metaRatios({ impressions, clicks, spend, purchases, attributedPurchaseValue }),
  };
}

export function metaTotals(campaigns: MetaCampaignMetric[], reach: number | null): MetaTotals {
  const sums = campaigns.reduce((total, row) => ({
    impressions: total.impressions + row.impressions,
    clicks: total.clicks + row.clicks,
    spend: total.spend + row.spend,
    purchases: total.purchases + row.purchases,
    attributedPurchaseValue: total.attributedPurchaseValue + row.attributedPurchaseValue,
    omniPurchases: total.omniPurchases + row.omniPurchases,
    omniPurchaseValue: total.omniPurchaseValue + row.omniPurchaseValue,
  }), {
    impressions: 0,
    clicks: 0,
    spend: 0,
    purchases: 0,
    attributedPurchaseValue: 0,
    omniPurchases: 0,
    omniPurchaseValue: 0,
  });
  return { ...sums, reach, ...metaRatios(sums) };
}

export function metaChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
