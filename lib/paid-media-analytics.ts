import type { PaidMediaMetric, PaidMediaTotals } from "@/types/paid-media";

export const emptyPaidTotals = (): PaidMediaTotals => ({
  impressions: 0,
  reach: 0,
  reachIsAggregated: false,
  frequency: null,
  clicks: 0,
  linkClicks: 0,
  landingPageViews: 0,
  spend: 0,
  platformPurchases: 0,
  platformRevenue: 0,
  ga4Sessions: 0,
  ga4ProductViews: 0,
  ga4AddToCarts: 0,
  ga4BeginCheckouts: 0,
  ga4Purchases: 0,
  ga4Revenue: 0,
  vtexOrders: 0,
  vtexRevenue: 0,
});

const additiveKeys = [
  "impressions", "clicks", "linkClicks", "landingPageViews", "spend",
  "platformPurchases", "platformRevenue", "ga4Sessions", "ga4ProductViews",
  "ga4AddToCarts", "ga4BeginCheckouts", "ga4Purchases", "ga4Revenue",
  "vtexOrders", "vtexRevenue",
] as const;

export function sumPaid(rows: PaidMediaMetric[]): PaidMediaTotals {
  const totals = rows.reduce((result, row) => {
    for (const key of additiveKeys) result[key] += row[key];
    return result;
  }, emptyPaidTotals());

  // Reach is non-additive. It is exposed only when the source supplied one
  // already-aggregated row for the exact scope being displayed.
  if (rows.length === 1 && rows[0].reachIsAggregated) {
    totals.reach = rows[0].reach;
    totals.reachIsAggregated = true;
    totals.frequency = totals.reach ? totals.impressions / totals.reach : null;
  }
  return totals;
}

export const paidRate = (value: number, total: number) => total ? (value / total) * 100 : 0;
export const paidRatio = (value: number, total: number) => total ? value / total : 0;
export const paidChange = (current: number, previous: number) => previous ? ((current - previous) / previous) * 100 : current ? null : 0;
