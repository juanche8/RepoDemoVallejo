import { z } from "zod";

const macro = z.enum(["Calzado", "Indumentaria", "Accesorios"]);
const device = z.enum(["Desktop", "Mobile", "Tablet"]);
const store = z.enum(["Sportotal", "Vallejo Calzados", "Freekick"]);
const commercialChannel = z.enum(["Ecommerce", "Marketplace", "Tienda física asistida"]);
const acquisitionChannel = z.enum(["Paid Social", "Paid Search", "Organic Search", "Direct", "Email", "Referral"]);

export const productSchema = z.object({
  productId: z.string(),
  name: z.string(),
  model: z.string(),
  brand: z.string(),
  macroCategory: macro,
  category: z.string(),
  subcategory: z.string(),
  store,
});

export const skuSchema = z.object({
  skuId: z.string(),
  productId: z.string(),
  color: z.string(),
  size: z.string(),
  currentPrice: z.number().nonnegative(),
  listPrice: z.number().nonnegative(),
  cost: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative(),
});

export const dailyMetricSchema = z.object({
  date: z.string(),
  ecommerce: store,
  productId: z.string().optional(),
  commercialChannel,
  acquisitionChannel,
  province: z.string(),
  device,
  source: z.string().optional(),
  medium: z.string().optional(),
  campaign: z.string().optional(),
  sessions: z.number().int().nonnegative(),
  productViews: z.number().int().nonnegative(),
  addToCarts: z.number().int().nonnegative(),
  beginCheckouts: z.number().int().nonnegative(),
  purchases: z.number().int().nonnegative(),
  revenue: z.number().nonnegative(),
  units: z.number().int().nonnegative(),
}).superRefine((row, context) => {
  if (row.productId && row.sessions !== 0) {
    context.addIssue({ code: "custom", message: "Las filas de producto no deben contener sesiones" });
  }
  if (!row.productId && (row.productViews || row.addToCarts || row.beginCheckouts || row.purchases)) {
    context.addIssue({ code: "custom", message: "Las filas agregadas solo deben contener sesiones" });
  }
  if (!(row.productViews >= row.addToCarts && row.addToCarts >= row.beginCheckouts && row.beginCheckouts >= row.purchases)) {
    context.addIssue({ code: "custom", message: "La secuencia del embudo de producto no es válida" });
  }
});

export const productArraySchema = z.array(productSchema);
export const skuArraySchema = z.array(skuSchema);
export const dailyMetricArraySchema = z.array(dailyMetricSchema);

export const paidMediaMetricSchema = z.object({
  date: z.string(), ecommerce: store, platform: z.enum(["Meta Ads", "Google Ads"]),
  accountName: z.string(), campaignId: z.string(), campaignName: z.string(), campaignObjective: z.string(), adSetId: z.string(), adSetName: z.string(), adId: z.string(), adName: z.string(),
  acquisitionChannel, source: z.string(), medium: z.string(), campaign: z.string(), content: z.string(), macroCategory: macro, category: z.string(), brand: z.string(), productId: z.string(), skuId: z.string(), province: z.string(), device,
  impressions: z.number().int().nonnegative(), reach: z.number().int().nonnegative(), reachIsAggregated: z.boolean(), frequency: z.number().nonnegative().nullable(), clicks: z.number().int().nonnegative(), linkClicks: z.number().int().nonnegative(), landingPageViews: z.number().int().nonnegative(),
  spend: z.number().nonnegative(), platformPurchases: z.number().int().nonnegative(), platformRevenue: z.number().nonnegative(), ga4Sessions: z.number().int().nonnegative(), ga4ProductViews: z.number().int().nonnegative(), ga4AddToCarts: z.number().int().nonnegative(), ga4BeginCheckouts: z.number().int().nonnegative(), ga4Purchases: z.number().int().nonnegative(), ga4Revenue: z.number().nonnegative(), vtexOrders: z.number().int().nonnegative(), vtexRevenue: z.number().nonnegative(),
}).superRefine((row, context) => {
  const validPaidSequence = row.impressions >= row.clicks
    && row.clicks >= row.linkClicks
    && row.landingPageViews >= row.ga4ProductViews
    && row.ga4ProductViews >= row.ga4AddToCarts
    && row.ga4AddToCarts >= row.ga4BeginCheckouts
    && row.ga4BeginCheckouts >= row.ga4Purchases;
  if (!validPaidSequence) context.addIssue({ code: "custom", message: "La secuencia del funnel pago no es válida" });
});

export const paidMediaArraySchema = z.array(paidMediaMetricSchema);
