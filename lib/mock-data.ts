import type { AcquisitionChannel, CommercialChannel, DailyMetric, Device, MacroCategory, Product, SKU, Store } from "@/types/analytics";
import { dailyMetricArraySchema, productArraySchema, skuArraySchema } from "./schemas";

export const DATA_TODAY = "2026-07-22";

export const TAXONOMY: Record<MacroCategory, Record<string, string[]>> = {
  Calzado: {
    Running: ["Zapatillas de running"],
    Fútbol: ["Botines de fútbol"],
    Urbano: ["Zapatillas urbanas"],
    Botas: ["Botas y borcegos"],
    Sandalias: ["Sandalias deportivas"],
  },
  Indumentaria: {
    Remeras: ["Remeras deportivas"],
    Buzos: ["Buzos deportivos"],
    Camperas: ["Camperas deportivas"],
    Conjuntos: ["Conjuntos deportivos"],
  },
  Accesorios: {
    Pelotas: ["Pelotas de fútbol"],
    Mochilas: ["Mochilas deportivas"],
    Guantes: ["Guantes de arquero"],
    Medias: ["Medias deportivas"],
  },
};

const stores: Array<{ store: Store; count: number; prefix: string }> = [
  { store: "Sportotal", count: 40, prefix: "ST" },
  { store: "Vallejo Calzados", count: 30, prefix: "VC" },
  { store: "Freekick", count: 20, prefix: "FK" },
];
const brands = {
  Sportotal: ["Nike", "Adidas", "Puma", "Asics", "Under Armour", "Fila"],
  "Vallejo Calzados": ["Vizzano", "Briganti", "Piccadilly", "Ramarim", "Hush Puppies"],
  Freekick: ["Umbro", "Reusch", "Kappa", "Penalty", "Joma"],
} as const;
const models = ["Essential", "Pro", "Motion", "Classic", "Advance", "Performance"];
const colors = ["Negro", "Blanco", "Azul marino", "Rojo", "Gris"];
export const COMMERCIAL_CHANNELS: CommercialChannel[] = ["Ecommerce", "Marketplace", "Tienda física asistida"];
export const ACQUISITION_CHANNELS: AcquisitionChannel[] = ["Paid Social", "Paid Search", "Organic Search", "Direct", "Email", "Referral"];
export const PROVINCES = ["Buenos Aires", "CABA", "Córdoba", "Santa Fe", "Mendoza", "Tucumán"];
const devices: Device[] = ["Desktop", "Mobile", "Tablet"];
const flatTaxonomy = Object.entries(TAXONOMY).flatMap(([macro, categories]) =>
  Object.entries(categories).map(([category, subcategories]) => ({
    macroCategory: macro as MacroCategory,
    category,
    subcategory: subcategories[0],
  })),
);
const seeded = (a: number, b: number) => ((a * 9301 + b * 49297 + 233280) % 233280) / 233280;
const iso = (date: Date) => date.toISOString().slice(0, 10);

const products: Product[] = [];
const skus: SKU[] = [];
let globalIndex = 0;
for (const group of stores) {
  for (let index = 0; index < group.count; index += 1) {
    const taxonomy = flatTaxonomy[(index + (group.store === "Sportotal" ? 0 : group.store === "Vallejo Calzados" ? 2 : 5)) % flatTaxonomy.length];
    const brand = brands[group.store][index % brands[group.store].length];
    const model = models[(index * 3) % models.length];
    const productId = `${group.prefix}-P${String(index + 1).padStart(3, "0")}`;
    products.push({
      productId,
      name: `${taxonomy.subcategory} ${brand} ${model}`,
      model,
      brand,
      ...taxonomy,
      store: group.store,
    });

    const sizes = taxonomy.macroCategory === "Indumentaria"
      ? ["XS", "S", "M", "L", "XL", "XXL"]
      : taxonomy.macroCategory === "Accesorios"
        ? ["Único", "S", "M", "L"]
        : ["36", "37", "38", "39", "40", "41", "42", "43"];
    const skuCount = 2 + (index % 3);
    for (let skuIndex = 0; skuIndex < skuCount; skuIndex += 1) {
      const listPrice = Math.round((32000 + index * 2700 + seeded(globalIndex, skuIndex + 4) * 45000) / 100) * 100;
      const discount = [0, 10, 15, 20, 25][(index + skuIndex) % 5];
      const currentPrice = Math.round((listPrice * (1 - discount / 100)) / 100) * 100;
      skus.push({
        skuId: `${group.prefix}-SKU-${String(globalIndex + 1).padStart(4, "0")}-${skuIndex + 1}`,
        productId,
        color: colors[(index + skuIndex) % colors.length],
        size: sizes[(index + skuIndex) % sizes.length],
        currentPrice,
        listPrice,
        cost: index % 4 === 0 ? Math.round(currentPrice * 0.55) : undefined,
        stock: index % 17 === 0 ? 0 : Math.max(0, Math.round(seeded(globalIndex, skuIndex) * 18) - (index % 8 === 0 ? 5 : 0)),
      });
    }
    globalIndex += 1;
  }
}

export const mockProducts = productArraySchema.parse(products);
export const mockSkus = skuArraySchema.parse(skus);

const productRows: DailyMetric[] = [];
const sessionBuckets = new Map<string, DailyMetric>();
const start = new Date(Date.UTC(2026, 4, 24));

for (let dayIndex = 0; dayIndex < 60; dayIndex += 1) {
  const date = new Date(start);
  date.setUTCDate(start.getUTCDate() + dayIndex);
  const day = iso(date);
  for (let productIndex = 0; productIndex < mockProducts.length; productIndex += 1) {
    const product = mockProducts[productIndex];
    const productSkus = mockSkus.filter((sku) => sku.productId === product.productId);
    const stock = productSkus.reduce((total, sku) => total + sku.stock, 0);
    const averagePrice = productSkus.reduce((total, sku) => total + sku.currentPrice, 0) / productSkus.length;
    const commercialChannel = COMMERCIAL_CHANNELS[productIndex % COMMERCIAL_CHANNELS.length];
    const acquisitionChannel = ACQUISITION_CHANNELS[productIndex % ACQUISITION_CHANNELS.length];
    const province = PROVINCES[(productIndex * 2) % PROVINCES.length];
    const source = acquisitionChannel === "Paid Social" ? "facebook" : acquisitionChannel === "Paid Search" ? "google" : "site";
    const medium = acquisitionChannel.toLowerCase().replaceAll(" ", "_");
    const campaign = acquisitionChannel.startsWith("Paid") ? "always_on" : "non_paid";

    for (let deviceIndex = 0; deviceIndex < devices.length; deviceIndex += 1) {
      const device = devices[deviceIndex];
      const deviceShare = [0.28, 0.63, 0.09][deviceIndex];
      const base = (30 + seeded(productIndex, dayIndex) * 210) * deviceShare;
      const macroTrend = product.macroCategory === "Calzado" ? 1 - dayIndex * 0.004 : product.macroCategory === "Indumentaria" ? 1 + dayIndex * 0.004 : 1;
      const estimatedSessions = Math.max(1, Math.round(base * macroTrend));
      let viewRate = 0.62 + seeded(productIndex, dayIndex + 2) * 0.18;
      let cartRate = 0.14 + seeded(productIndex + 2, dayIndex) * 0.12;
      let checkoutRate = 0.52 + seeded(productIndex, dayIndex + 4) * 0.22;
      let purchaseRate = 0.58 + seeded(productIndex + 7, dayIndex) * 0.24;
      if (productIndex % 11 === 0) viewRate = 0.28;
      if (productIndex % 13 === 0) cartRate = 0.045;
      if (productIndex % 17 === 0) checkoutRate = 0.22;
      if (productIndex % 19 === 0) purchaseRate = 0.19;
      const productViews = Math.round(estimatedSessions * viewRate);
      const addToCarts = Math.min(productViews, Math.round(productViews * cartRate));
      const beginCheckouts = Math.min(addToCarts, Math.round(addToCarts * checkoutRate));
      const purchases = stock === 0 ? 0 : Math.min(beginCheckouts, Math.round(beginCheckouts * purchaseRate));
      const units = Math.round(purchases * (1 + seeded(dayIndex, productIndex) * 0.28));

      productRows.push({
        date: day,
        ecommerce: product.store,
        productId: product.productId,
        commercialChannel,
        acquisitionChannel,
        province,
        device,
        source,
        medium,
        campaign,
        sessions: 0,
        productViews,
        addToCarts,
        beginCheckouts,
        purchases,
        revenue: Math.round(units * averagePrice),
        units,
      });

      const bucketKey = [day, product.store, commercialChannel, acquisitionChannel, province, device, source, medium, campaign].join("|");
      const existing = sessionBuckets.get(bucketKey);
      const sessions = Math.max(productViews, estimatedSessions);
      if (existing) existing.sessions += sessions;
      else sessionBuckets.set(bucketKey, {
        date: day,
        ecommerce: product.store,
        commercialChannel,
        acquisitionChannel,
        province,
        device,
        source,
        medium,
        campaign,
        sessions,
        productViews: 0,
        addToCarts: 0,
        beginCheckouts: 0,
        purchases: 0,
        revenue: 0,
        units: 0,
      });
    }
  }
}

export const mockDailyMetrics = dailyMetricArraySchema.parse([
  ...sessionBuckets.values(),
  ...productRows,
]);
