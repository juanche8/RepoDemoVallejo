import type { MetricTotals, ProductPerformance } from "@/types/analytics";

export type Tab = "Embudo Analytics" | "Categorías" | "Marcas y productos" | "Venta por plaza" | "Medios de pago" | "Paid Media" | "Alertas y oportunidades" | "Resumen ejecutivo";
export const tabs: Tab[] = ["Embudo Analytics", "Categorías", "Marcas y productos", "Venta por plaza", "Medios de pago", "Paid Media", "Alertas y oportunidades", "Resumen ejecutivo"];

export type GroupRow = { name: string; macro?: string } & MetricTotals & {
  previous: MetricTotals;
  products: ProductPerformance[];
};

export function groupPerformance(rows: ProductPerformance[], key: "macroCategory" | "category" | "brand"): GroupRow[] {
  const grouped = rows.reduce<Record<string, GroupRow>>((result, product) => {
    const name = product[key];
    result[name] ??= {
      name,
      macro: product.macroCategory,
      sessions: 0, productViews: 0, addToCarts: 0, beginCheckouts: 0,
      purchases: 0, revenue: 0, units: 0, stock: 0,
      previous: { sessions: 0, productViews: 0, addToCarts: 0, beginCheckouts: 0, purchases: 0, revenue: 0, units: 0, stock: 0 },
      products: [],
    };
    const group = result[name];
    for (const metric of ["productViews", "addToCarts", "beginCheckouts", "purchases", "revenue", "units", "stock"] as const) {
      group[metric] += product[metric];
      group.previous[metric] += product.previous[metric];
    }
    group.products.push(product);
    return result;
  }, {});
  return Object.values(grouped).sort((a, b) => b.productViews - a.productViews);
}
