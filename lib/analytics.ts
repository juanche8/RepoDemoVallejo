import type {
  DailyMetric,
  DatePreset,
  DateRange,
  MetricTotals,
  Product,
  ProductPerformance,
  SKU,
} from "@/types/analytics";
import { DATA_TODAY } from "./mock-data";
import { rangeDays, shiftDate } from "./date-ranges";
import { skusForProduct } from "./catalog";
import { coverageDays } from "./dashboard-rules";

export { comparisonRange, rangeDays, resolveComparisonMode } from "./date-ranges";

export function presetRange(preset: DatePreset, custom?: DateRange): DateRange {
  if (preset === "today") return { from: DATA_TODAY, to: DATA_TODAY };
  if (preset === "yesterday") return { from: shiftDate(DATA_TODAY, -1), to: shiftDate(DATA_TODAY, -1) };
  if (preset === "last30") return { from: shiftDate(DATA_TODAY, -29), to: DATA_TODAY };
  if (preset === "month") return { from: "2026-07-01", to: DATA_TODAY };
  if (preset === "custom") return custom ?? { from: shiftDate(DATA_TODAY, -6), to: DATA_TODAY };
  return { from: shiftDate(DATA_TODAY, -6), to: DATA_TODAY };
}

export const inRange = (date: string, range: DateRange) => date >= range.from && date <= range.to;

export const emptyTotals = (): MetricTotals => ({
  sessions: 0,
  productViews: 0,
  addToCarts: 0,
  beginCheckouts: 0,
  purchases: 0,
  revenue: 0,
  units: 0,
  stock: 0,
});

export function sumMetrics(rows: DailyMetric[], stock = 0): MetricTotals {
  return rows.reduce((totals, metric) => ({
    sessions: totals.sessions + metric.sessions,
    productViews: totals.productViews + metric.productViews,
    addToCarts: totals.addToCarts + metric.addToCarts,
    beginCheckouts: totals.beginCheckouts + metric.beginCheckouts,
    purchases: totals.purchases + metric.purchases,
    revenue: totals.revenue + metric.revenue,
    units: totals.units + metric.units,
    stock,
  }), emptyTotals());
}

export function performance(
  products: Product[],
  skus: SKU[],
  metrics: DailyMetric[],
  range: DateRange,
  previousRange: DateRange | null,
): ProductPerformance[] {
  return products.map((product) => {
    const productSkus = skusForProduct(skus, product.productId);
    const productMetrics = metrics.filter((metric) => metric.productId === product.productId);
    const currentMetrics = productMetrics.filter((metric) => inRange(metric.date, range));
    const previousMetrics = previousRange
      ? productMetrics.filter((metric) => inRange(metric.date, previousRange))
      : [];
    const totalStock = productSkus.reduce((total, sku) => total + sku.stock, 0);
    const currentPrice = productSkus.length
      ? productSkus.reduce((total, sku) => total + sku.currentPrice, 0) / productSkus.length
      : 0;
    const listPrice = productSkus.length
      ? productSkus.reduce((total, sku) => total + sku.listPrice, 0) / productSkus.length
      : 0;
    const units = sumMetrics(currentMetrics).units;
    const lastSaleDate = [...productMetrics]
      .filter((metric) => metric.purchases > 0)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? "—";
    const stockBySize = Object.values(productSkus.reduce<Record<string, { size: string; stock: number }>>((result, sku) => {
      result[sku.size] ??= { size: sku.size, stock: 0 };
      result[sku.size].stock += sku.stock;
      return result;
    }, {}));

    return {
      ...product,
      ...sumMetrics(currentMetrics, totalStock),
      previous: sumMetrics(previousMetrics, totalStock),
      skus: productSkus,
      currentPrice,
      listPrice,
      discount: listPrice ? (1 - currentPrice / listPrice) * 100 : 0,
      totalStock,
      stockBySize,
      coverDays: coverageDays(totalStock, units, rangeDays(range)),
      lastSaleDate,
    };
  });
}

export function change(current: number, previous: number) {
  if (!previous) return current ? null : 0;
  return ((current - previous) / previous) * 100;
}

export const rate = (value: number, total: number) => total ? (value / total) * 100 : 0;
export const pp = (current: number, previous: number) => current - previous;
