import type { DateRange } from "@/types/analytics";
import type { AdPlatform, PaidMediaMetric, PaidMediaTotals, AttributionSource } from "@/types/paid-media";

export type PaidMediaFilterContext = {
  store: string;
  macroCategory: string;
  category: string;
  brand: string;
  productId: string;
  province: string;
  device: string;
  acquisitionChannel: string;
};

export function filterPaidMediaRows(
  rows: PaidMediaMetric[], context: PaidMediaFilterContext, range: DateRange,
  platform: AdPlatform | "Todas" = "Todas", campaign = "Todas",
): PaidMediaMetric[] {
  return rows.filter((row) =>
    row.date >= range.from && row.date <= range.to
    && (context.store === "Todos" || row.ecommerce === context.store)
    && (context.macroCategory === "Todas" || row.macroCategory === context.macroCategory)
    && (context.category === "Todas" || row.category === context.category)
    && (context.brand === "Todas" || row.brand === context.brand)
    && (context.productId === "Todos" || row.productId === context.productId)
    && (context.province === "Todas" || row.province === context.province)
    && (context.device === "Todos" || row.device === context.device)
    && (context.acquisitionChannel === "Todos" || row.acquisitionChannel === context.acquisitionChannel)
    && (platform === "Todas" || row.platform === platform)
    && (campaign === "Todas" || row.campaignName === campaign));
}

export function contextualCampaigns(
  rows: PaidMediaMetric[], context: PaidMediaFilterContext, range: DateRange,
  platform: AdPlatform | "Todas",
): string[] {
  return [...new Set(filterPaidMediaRows(rows, context, range, platform).map((row) => row.campaignName))].sort();
}

export function attributedValues(totals: PaidMediaTotals, source: AttributionSource) {
  if (source === "platform") return { purchases: totals.platformPurchases, revenue: totals.platformRevenue };
  if (source === "vtex") return { purchases: totals.vtexOrders, revenue: totals.vtexRevenue };
  return { purchases: totals.ga4Purchases, revenue: totals.ga4Revenue };
}
