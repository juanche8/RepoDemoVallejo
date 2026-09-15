import type { Filters, MetricTotals } from "@/types/analytics";

const PRODUCT_SEGMENT_KEYS: Array<keyof Filters> = ["macroCategory", "category", "brand", "product"];

export function resetDependentFilters(filters: Filters, key: keyof Filters, value: string): Filters {
  const next = { ...filters, [key]: value };
  if (key === "store") {
    return { ...next, macroCategory: "Todas", category: "Todas", brand: "Todas", product: "Todos" };
  }
  if (key === "macroCategory") return { ...next, category: "Todas", product: "Todos" };
  if (key === "category" || key === "brand") return { ...next, product: "Todos" };
  return next;
}

type FilterableProduct = { productId: string; store: string; macroCategory: string; category: string; brand: string; name: string };

export function sanitizeDependentFilters(filters: Filters, products: FilterableProduct[]): Filters {
  const inStore = products.filter((product) => filters.store === "Todos" || product.store === filters.store);
  const macroValid = filters.macroCategory === "Todas" || inStore.some((product) => product.macroCategory === filters.macroCategory);
  const normalized = macroValid ? filters : { ...filters, macroCategory: "Todas", category: "Todas", product: "Todos" };
  const inTaxonomy = inStore.filter((product) =>
    (normalized.macroCategory === "Todas" || product.macroCategory === normalized.macroCategory)
    && (normalized.category === "Todas" || product.category === normalized.category));
  const brandValid = normalized.brand === "Todas" || inTaxonomy.some((product) => product.brand === normalized.brand);
  const withBrand = brandValid ? normalized : { ...normalized, brand: "Todas", product: "Todos" };
  const productValid = withBrand.product === "Todos" || inTaxonomy.some((product) => product.productId === withBrand.product && (withBrand.brand === "Todas" || product.brand === withBrand.brand));
  return productValid ? withBrand : { ...withBrand, product: "Todos" };
}

export function dependentProductOptions(filters: Filters, products: FilterableProduct[]) {
  const storeProducts = products.filter((product) => filters.store === "Todos" || product.store === filters.store);
  const macroCategories = [...new Set(storeProducts.map((product) => product.macroCategory))];
  const macroProducts = storeProducts.filter((product) => filters.macroCategory === "Todas" || product.macroCategory === filters.macroCategory);
  const categories = [...new Set(macroProducts.map((product) => product.category))];
  const categoryProducts = macroProducts.filter((product) => filters.category === "Todas" || product.category === filters.category);
  const brands = [...new Set(categoryProducts.map((product) => product.brand))];
  const visibleProducts = categoryProducts.filter((product) => filters.brand === "Todas" || product.brand === filters.brand);
  return { macroCategories, categories, brands, products: visibleProducts.map((product) => ({ value: product.productId, label: product.name })) };
}

export function hasProductSegmentation(filters: Filters): boolean {
  return PRODUCT_SEGMENT_KEYS.some((key) => !["Todas", "Todos"].includes(filters[key]));
}

export function funnelKeys(segmented: boolean): Array<keyof MetricTotals> {
  return segmented
    ? ["productViews", "addToCarts", "beginCheckouts", "purchases"]
    : ["sessions", "productViews", "addToCarts", "beginCheckouts", "purchases"];
}

export function comparisonChange(current: number, previous: number, enabled: boolean): number | null | undefined {
  if (!enabled) return undefined;
  if (!previous) return current ? null : 0;
  return ((current - previous) / previous) * 100;
}

export function participationDelta(current: number, previous: number, enabled: boolean): number | null {
  return enabled ? current - previous : null;
}

export function coverageDays(stock: number, units: number, days: number): number | null {
  if (stock === 0) return 0;
  if (units === 0) return null;
  return Math.round(stock / (units / Math.max(days, 1)));
}

export function isDrilldownCurrent(openContextKey: string | null, currentContextKey: string): boolean {
  return openContextKey !== null && openContextKey === currentContextKey;
}

export function participationShares(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  return values.map((value) => total ? (value / total) * 100 : 0);
}

export function moduleAvailability(input: {
  sessions: number; productViews: number; categories: number;
  products: number; paidRows: number; alerts: number;
}) {
  return {
    analytics: input.sessions > 0 || input.productViews > 0,
    categories: input.categories > 0,
    products: input.products > 0,
    paidMedia: input.paidRows > 0,
    alerts: input.alerts > 0,
    executiveSummary: true,
  };
}

export function nonAdvancingVolume(previousStage: number, nextStage: number) {
  return {
    volume: Math.max(previousStage - nextStage, 0),
    nextStageIsHigher: nextStage > previousStage,
  };
}

export function segmentedSessionsNote(segmented: boolean): string | null {
  return segmented
    ? "Las sesiones se muestran a nivel ecommerce. El análisis segmentado comienza en vistas de producto."
    : null;
}
