export type CatalogSku = { skuId: string; productId: string };

export function skusForProduct<T extends CatalogSku>(skus: T[], productId: string): T[] {
  return skus.filter((sku) => sku.productId === productId);
}
