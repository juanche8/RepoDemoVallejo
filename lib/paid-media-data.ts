import { DATA_TODAY, mockProducts, mockSkus, PROVINCES } from "./mock-data";
import { paidMediaArraySchema } from "./schemas";
import type { AdPlatform, PaidMediaMetric } from "@/types/paid-media";

const DAY = 86_400_000;
const iso = (value: Date) => value.toISOString().slice(0, 10);
const seeded = (...values: number[]) => {
  let value = 2166136261;
  for (const item of values) value = Math.imul(value ^ item, 16777619);
  return ((value >>> 0) % 10_000) / 10_000;
};

const definitions: Array<{
  platform: AdPlatform;
  objective: string;
  name: string;
  source: string;
  medium: string;
  spendFactor: number;
  clickFactor: number;
  sessionFactor: number;
  conversionFactor: number;
}> = [
  { platform: "Meta Ads", objective: "Ventas", name: "META | Ventas | Catálogo", source: "facebook", medium: "paid_social", spendFactor: 1.22, clickFactor: 1.15, sessionFactor: .78, conversionFactor: .92 },
  { platform: "Meta Ads", objective: "Remarketing", name: "META | Remarketing | Carrito", source: "instagram", medium: "paid_social", spendFactor: .72, clickFactor: .92, sessionFactor: .9, conversionFactor: 1.45 },
  { platform: "Meta Ads", objective: "Prospecting", name: "META | Prospecting | Video", source: "facebook", medium: "social_paid", spendFactor: .86, clickFactor: 1.3, sessionFactor: .58, conversionFactor: .55 },
  { platform: "Google Ads", objective: "Search", name: "GOOGLE | Search | Marca", source: "google", medium: "cpc", spendFactor: .74, clickFactor: .8, sessionFactor: .94, conversionFactor: 1.55 },
  { platform: "Google Ads", objective: "Shopping", name: "GOOGLE | Shopping | Productos", source: "google", medium: "cpc", spendFactor: 1.08, clickFactor: 1.08, sessionFactor: .88, conversionFactor: 1.28 },
  { platform: "Google Ads", objective: "Performance Max", name: "GOOGLE | PMax | Always On", source: "google", medium: "cpc", spendFactor: 1.3, clickFactor: 1.02, sessionFactor: .82, conversionFactor: 1.12 },
];

const start = new Date(`${DATA_TODAY}T00:00:00Z`).getTime() - 59 * DAY;

const generatedPaidMediaMetrics: PaidMediaMetric[] = Array.from({ length: 60 }, (_, day) =>
  definitions.flatMap((definition, campaignIndex) =>
    mockProducts
      .filter((_, productIndex) => productIndex % definitions.length === campaignIndex)
      .slice(0, 4)
      .map((product, productIndex) => {
        const sku = mockSkus.find((item) => item.productId === product.productId)!;
        const productStock = mockSkus
          .filter((item) => item.productId === product.productId)
          .reduce((total, item) => total + item.stock, 0);
        const noise = .86 + seeded(day, campaignIndex, productIndex) * .3;
        const trend = product.macroCategory === "Calzado" ? 1.14 - day * .004 : product.macroCategory === "Indumentaria" ? .82 + day * .006 : .96;
        const spend = Math.round((2100 + sku.currentPrice * .045) * definition.spendFactor * noise * trend);
        const impressions = Math.round(spend * (20 + campaignIndex * 2.6));
        const clicks = Math.max(1, Math.round(impressions * (.009 + definition.clickFactor * .0045)));
        const linkClicks = Math.round(clicks * .9);
        const landingPageViews = Math.min(linkClicks, Math.round(linkClicks * definition.sessionFactor));
        const ga4Sessions = Math.min(linkClicks, Math.round(landingPageViews * (0.98 + seeded(day, productIndex, 21) * 0.04)));
        const ga4ProductViews = Math.min(ga4Sessions, Math.round(ga4Sessions * (.69 + seeded(day, productIndex, 5) * .12)));
        const ga4AddToCarts = Math.min(ga4ProductViews, Math.round(ga4ProductViews * (.08 + definition.conversionFactor * .045)));
        const ga4BeginCheckouts = Math.min(ga4AddToCarts, Math.round(ga4AddToCarts * (.48 + campaignIndex * .018)));
        let ga4Purchases = Math.min(ga4BeginCheckouts, Math.round(ga4BeginCheckouts * (.42 + definition.conversionFactor * .16)));
        if (productStock === 0 || (campaignIndex === 2 && productIndex === 0)) ga4Purchases = 0;
        const ga4Revenue = Math.round(ga4Purchases * sku.currentPrice * (1.03 + seeded(day, 8) * .18));
        const platformPurchases = Math.round(ga4Purchases * (definition.platform === "Meta Ads" ? 1.22 : 1.1));
        const vtexOrders = Math.max(0, Math.round(ga4Purchases * (.94 + seeded(day, 12) * .12)));
        const source = campaignIndex === 2 && day % 13 === 0 ? "facebook_ads" : definition.source;
        const campaign = campaignIndex === 1 && day % 17 === 0 ? "" : definition.name.toLowerCase().replaceAll(" | ", "_").replaceAll(" ", "_");
        const reach = Math.round(impressions / (1.35 + seeded(day, campaignIndex, 19) * .8));
        return {
          date: iso(new Date(start + day * DAY)), ecommerce: product.store, platform: definition.platform,
          accountName: `${product.store} · ${definition.platform}`, campaignId: `CMP-${campaignIndex + 1}`,
          campaignName: definition.name, campaignObjective: definition.objective,
          adSetId: `SET-${campaignIndex + 1}-${product.macroCategory.slice(0, 3).toUpperCase()}`,
          adSetName: `${definition.objective} · ${product.macroCategory}`, adId: `AD-${campaignIndex + 1}-${product.productId}`,
          adName: `${product.name} · ${sku.color}`, acquisitionChannel: definition.platform === "Meta Ads" ? "Paid Social" : "Paid Search", source, medium: definition.medium,
          campaign, content: `${product.macroCategory.toLowerCase()}_${product.productId.toLowerCase()}`,
          macroCategory: product.macroCategory, category: product.category, brand: product.brand,
          productId: product.productId, skuId: sku.skuId, province: PROVINCES[(productIndex * 2) % PROVINCES.length],
          device: productIndex % 3 === 0 ? "Desktop" : productIndex % 3 === 1 ? "Mobile" : "Tablet",
          impressions, reach, reachIsAggregated: true, frequency: impressions / Math.max(reach, 1), clicks, linkClicks,
          landingPageViews, spend,
          platformPurchases, platformRevenue: Math.round(ga4Revenue * (definition.platform === "Meta Ads" ? 1.19 : 1.08)),
          ga4Sessions, ga4ProductViews, ga4AddToCarts, ga4BeginCheckouts, ga4Purchases, ga4Revenue,
          vtexOrders, vtexRevenue: Math.round(vtexOrders * sku.currentPrice * 1.06),
        } satisfies PaidMediaMetric;
      })
  )
).flat();

export const paidMediaMetrics = paidMediaArraySchema.parse(generatedPaidMediaMetrics);
