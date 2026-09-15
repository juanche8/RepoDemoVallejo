import type { Device, MacroCategory, Store } from "./analytics";

export type AdPlatform = "Meta Ads" | "Google Ads";
export type AttributionSource = "platform" | "ga4" | "vtex";

export type PaidMediaMetric = {
  date: string;
  ecommerce: Store;
  platform: AdPlatform;
  accountName: string;
  campaignId: string;
  campaignName: string;
  campaignObjective: string;
  adSetId: string;
  adSetName: string;
  adId: string;
  adName: string;
  acquisitionChannel: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  macroCategory: MacroCategory;
  category: string;
  brand: string;
  productId: string;
  skuId: string;
  province: string;
  device: Device;
  impressions: number;
  reach: number;
  reachIsAggregated: boolean;
  frequency: number | null;
  clicks: number;
  linkClicks: number;
  landingPageViews: number;
  spend: number;
  platformPurchases: number;
  platformRevenue: number;
  ga4Sessions: number;
  ga4ProductViews: number;
  ga4AddToCarts: number;
  ga4BeginCheckouts: number;
  ga4Purchases: number;
  ga4Revenue: number;
  vtexOrders: number;
  vtexRevenue: number;
};

export type PaidMediaTotals = Omit<
  PaidMediaMetric,
  | "date" | "ecommerce" | "platform" | "accountName" | "campaignId"
  | "campaignName" | "campaignObjective" | "adSetId" | "adSetName"
  | "adId" | "adName" | "acquisitionChannel" | "source" | "medium" | "campaign"
  | "content" | "macroCategory" | "category" | "brand" | "productId"
  | "skuId" | "province" | "device" | "frequency" | "reachIsAggregated"
> & { frequency: number | null; reachIsAggregated: boolean };
