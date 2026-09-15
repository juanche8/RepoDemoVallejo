export type ProductScopedMetric = { productId?: string; sessions: number };

export function isAggregateSessionMetric(metric: ProductScopedMetric): boolean {
  return metric.productId === undefined;
}

export function isProductEventMetric(metric: ProductScopedMetric): boolean {
  return metric.productId !== undefined && metric.sessions === 0;
}
