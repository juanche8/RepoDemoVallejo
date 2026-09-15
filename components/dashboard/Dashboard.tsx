"use client";

import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { InstitutionalHeader } from "@/components/layout/InstitutionalHeader";
import { comparisonRange, inRange, performance, pp, presetRange, rate, resolveComparisonMode, sumMetrics } from "@/lib/analytics";
import { formatDate, formatPercentage, formatShortDate } from "@/lib/formatters";
import { ACQUISITION_CHANNELS, COMMERCIAL_CHANNELS, DATA_TODAY, mockDailyMetrics, mockProducts, mockSkus, PROVINCES } from "@/lib/mock-data";
import { paidChange, paidRate, paidRatio, sumPaid } from "@/lib/paid-media-analytics";
import { paidMediaMetrics } from "@/lib/paid-media-data";
import { isAggregateSessionMetric } from "@/lib/metric-rules";
import { hasProductSegmentation, resetDependentFilters, sanitizeDependentFilters } from "@/lib/dashboard-rules";
import { attributedValues, filterPaidMediaRows } from "@/lib/paid-media-filtering";
import { paidMediaEmptyMessage } from "@/lib/paid-media-rules";
import type { ComparisonMode, DatePreset, DateRange, Filters } from "@/types/analytics";
import type { AdPlatform, AttributionSource } from "@/types/paid-media";
import { AlertsPanel, type AlertCounts } from "./AlertsPanel";
import { AnalyticsFunnel, funnelMetricNames } from "./AnalyticsFunnel";
import { CategoryPerformance } from "./CategoryPerformance";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { FiltersPanel } from "./FiltersPanel";
import { PaidMediaPanel } from "./PaidMediaPanel";
import { PaymentMethods } from "./PaymentMethods";
import { SalesByPlaza } from "./SalesByPlaza";
import { ProductPerformance } from "./ProductPerformance";
import { SidebarNavigation } from "./SidebarNavigation";
import { groupPerformance, type Tab } from "./dashboard-types";
import { Empty } from "./ui";

const initialFilters: Filters = {
  store: "Sportotal", macroCategory: "Todas", category: "Todas", brand: "Todas",
  product: "Todos", commercialChannel: "Todos", acquisitionChannel: "Todos", province: "Todas", device: "Todos",
};

export function Dashboard() {
  const [filters, setFilters] = useState(initialFilters);
  const [tab, setTab] = useState<Tab>("Embudo Analytics");
  const [preset, setPreset] = useState<DatePreset>("last7");
  const [custom, setCustom] = useState<DateRange>({ from: "2026-07-16", to: DATA_TODAY });
  const [compare, setCompare] = useState<ComparisonMode>("previous_period");
  const [mobileFilters, setMobileFilters] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paidPlatform, setPaidPlatform] = useState<AdPlatform | "Todas">("Todas");
  const [paidCampaign, setPaidCampaign] = useState("Todas");
  const [paidAttribution, setPaidAttribution] = useState<AttributionSource>("ga4");

  const range = presetRange(preset, custom);
  const effectiveCompare = resolveComparisonMode(range, compare);
  const compareRange = comparisonRange(range, effectiveCompare);
  const comparisonEnabled = compareRange !== null;
  const segmented = hasProductSegmentation(filters);

  const products = useMemo(() => mockProducts.filter(product =>
    (filters.store === "Todos" || product.store === filters.store)
    && (filters.macroCategory === "Todas" || product.macroCategory === filters.macroCategory)
    && (filters.category === "Todas" || product.category === filters.category)
    && (filters.brand === "Todas" || product.brand === filters.brand)
    && (filters.product === "Todos" || product.productId === filters.product)), [filters]);
  const productIds = useMemo(() => new Set(products.map(product => product.productId)), [products]);

  const dimensionMetrics = mockDailyMetrics.filter(metric =>
    (filters.store === "Todos" || metric.ecommerce === filters.store)
    && (filters.commercialChannel === "Todos" || metric.commercialChannel === filters.commercialChannel)
    && (filters.acquisitionChannel === "Todos" || metric.acquisitionChannel === filters.acquisitionChannel)
    && (filters.province === "Todas" || metric.province === filters.province)
    && (filters.device === "Todos" || metric.device === filters.device));
  const sessionMetrics = dimensionMetrics.filter(isAggregateSessionMetric);
  const productMetrics = dimensionMetrics.filter(metric => metric.productId && productIds.has(metric.productId));
  const metrics = [...sessionMetrics, ...productMetrics];
  const selectedSkus = mockSkus.filter(sku => productIds.has(sku.productId));
  const stock = selectedSkus.reduce((total, sku) => total + sku.stock, 0);

  const rows = performance(products, selectedSkus, productMetrics, range, compareRange);
  const current = sumMetrics(metrics.filter(metric => inRange(metric.date, range)), stock);
  const previous = compareRange
    ? sumMetrics(metrics.filter(metric => inRange(metric.date, compareRange)), stock)
    : sumMetrics([], stock);
  const macros = groupPerformance(rows, "macroCategory");
  const categories = groupPerformance(rows, "category");
  const brands = groupPerformance(rows, "brand");

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((currentFilters) => sanitizeDependentFilters(resetDependentFilters(currentFilters, key, value), mockProducts));
    if (["store", "macroCategory", "category", "brand", "product", "province", "device", "acquisitionChannel"].includes(key)) setPaidCampaign("Todas");
  };

  const dailyShares = Object.values(productMetrics.filter(metric => inRange(metric.date, range)).reduce<Record<string, { date: string; Calzado: number; Indumentaria: number; Accesorios: number; total: number }>>((result, metric) => {
    const product = products.find(item => item.productId === metric.productId);
    if (!product) return result;
    result[metric.date] ??= { date: metric.date, Calzado: 0, Indumentaria: 0, Accesorios: 0, total: 0 };
    result[metric.date][product.macroCategory] += metric.revenue;
    result[metric.date].total += metric.revenue;
    return result;
  }, {})).map(day => ({ date: formatShortDate(day.date), Calzado: rate(day.Calzado, day.total), Indumentaria: rate(day.Indumentaria, day.total), Accesorios: rate(day.Accesorios, day.total) }));

  const macroDiagnostics = macros.map(macro => {
    const currentShare = rate(macro.revenue, current.revenue);
    const previousShare = rate(macro.previous.revenue, previous.revenue);
    return { ...macro, message: !comparisonEnabled ? `${macro.name}: sin comparación temporal.` : pp(currentShare, previousShare) < 0 ? `${macro.name} perdió ${formatPercentage(Math.abs(pp(currentShare, previousShare)))} puntos porcentuales de participación.` : `${macro.name} mejora su aporte al embudo y gana participación.` };
  });
  const productLosses = comparisonEnabled ? rows.filter(product => pp(rate(product.revenue, current.revenue), rate(product.previous.revenue, previous.revenue)) < -0.25) : [];
  const alertRows: AlertCounts = {
    lowView: current.sessions > 120 && rate(current.productViews, current.sessions) < 45 ? 1 : 0,
    viewCart: rows.filter(product => product.productViews > 80 && rate(product.addToCarts, product.productViews) < 9).length,
    cartCheckout: rows.filter(product => product.addToCarts > 15 && rate(product.beginCheckouts, product.addToCarts) < 38).length,
    checkoutPurchase: rows.filter(product => product.beginCheckouts > 8 && rate(product.purchases, product.beginCheckouts) < 42).length,
    macroLoss: comparisonEnabled ? macroDiagnostics.filter(macro => macro.message.includes("perdió")).length : 0,
    categoryLoss: comparisonEnabled ? categories.filter(category => pp(rate(category.revenue, current.revenue), rate(category.previous.revenue, previous.revenue)) < -1).length : 0,
    brandLoss: comparisonEnabled ? brands.filter(brand => pp(rate(brand.revenue, current.revenue), rate(brand.previous.revenue, previous.revenue)) < -0.5).length : 0,
    productLoss: productLosses.length,
    trafficNoAdvance: rows.filter(product => product.productViews > 180 && rate(product.purchases, product.productViews) < 0.3).length,
    demandNoStock: rows.filter(product => product.totalStock === 0 && product.productViews > 50).length,
    lowRotation: rows.filter(product => product.totalStock > 0 && product.coverDays === null).length,
  };

  const funnelKeys = segmented
    ? (["productViews", "addToCarts", "beginCheckouts", "purchases"] as const)
    : (["sessions", "productViews", "addToCarts", "beginCheckouts", "purchases"] as const);
  const funnel = funnelKeys.map((key) => current[key]);
  const worstIndex = funnel.slice(1).map((value, index) => 100 - rate(value, funnel[index])).reduce((best, value, index, values) => value > values[best] ? index : best, 0) + 1;
  const winners = comparisonEnabled ? categories.filter(category => pp(rate(category.revenue, current.revenue), rate(category.previous.revenue, previous.revenue)) > 0) : [];
  const losers = comparisonEnabled ? categories.filter(category => pp(rate(category.revenue, current.revenue), rate(category.previous.revenue, previous.revenue)) < 0) : [];
  const selectedProductId = filters.product;
  const paidContext = { store: filters.store, macroCategory: filters.macroCategory, category: filters.category, brand: filters.brand, productId: selectedProductId, province: filters.province, device: filters.device, acquisitionChannel: filters.acquisitionChannel };
  const paidRows = filterPaidMediaRows(paidMediaMetrics, paidContext, range, paidPlatform, paidCampaign);
  const paidPreviousRows = compareRange ? filterPaidMediaRows(paidMediaMetrics, paidContext, compareRange, paidPlatform, paidCampaign) : [];
  const paidTotals = sumPaid(paidRows);
  const paidEmptyMessage = paidMediaEmptyMessage(paidRows.length > 0, paidTotals.spend);
  const paidPreviousTotals = sumPaid(paidPreviousRows);
  const paidSelected = attributedValues(paidTotals, paidAttribution);
  const paidPreviousSelected = attributedValues(paidPreviousTotals, paidAttribution);
  const paidPlatforms = (["Meta Ads", "Google Ads"] as const).map(platform => ({ platform, totals: sumPaid(paidRows.filter(row => row.platform === platform)) }));
  const bestPaidPlatform = [...paidPlatforms].sort((a, b) => paidRatio(attributedValues(b.totals, paidAttribution).revenue, b.totals.spend) - paidRatio(attributedValues(a.totals, paidAttribution).revenue, a.totals.spend))[0];
  const topInvestmentPlatform = [...paidPlatforms].sort((a, b) => b.totals.spend - a.totals.spend)[0];
  const currentStageName = funnelMetricNames[funnelKeys[worstIndex]];
  const previousStageName = funnelMetricNames[funnelKeys[worstIndex - 1]];
  const comparisonText = comparisonEnabled ? "Comparación activa." : "Sin comparación temporal; no se clasifican ganadores ni perdedores.";
  const paidVariation = comparisonEnabled ? paidChange(paidSelected.revenue, paidPreviousSelected.revenue) : undefined;
  const paidVariationText = paidVariation === undefined ? "Sin comparación" : paidVariation === null ? "Nuevo" : formatPercentage(paidVariation);
  const paidSummary = paidEmptyMessage ?? `${topInvestmentPlatform.platform} concentró el ${formatPercentage(paidRate(topInvestmentPlatform.totals.spend, paidTotals.spend))} de la inversión. ${bestPaidPlatform.platform} obtuvo el mejor ROAS ${paidAttribution.toUpperCase()}, con ${paidRatio(attributedValues(bestPaidPlatform.totals, paidAttribution).revenue, bestPaidPlatform.totals.spend).toFixed(2)}×. Variación de ingresos: ${paidVariationText}.`;
  const summary = `RADAR ECOMMERCE — RESUMEN EJECUTIVO\nPeríodo: ${formatDate(range.from)} a ${formatDate(range.to)}\n\n1. Estado general del embudo\nConversión final: ${formatPercentage(rate(current.purchases, segmented ? current.productViews : current.sessions))}. ${comparisonText}\n\n2. Etapa con mayor pérdida\n${previousStageName} → ${currentStageName}: ${formatPercentage(100 - rate(funnel[worstIndex], funnel[worstIndex - 1]))} de abandono.\n\n3. Performance de macrocategorías\n${comparisonEnabled ? macroDiagnostics.map(item => item.message).join(" ") : "Sin comparación."}\n\n4. Categorías que ganaron participación\n${comparisonEnabled ? winners.slice(0, 3).map(item => item.name).join(", ") || "Sin ganadores relevantes" : "Sin comparación"}.\n\n5. Categorías que perdieron participación\n${comparisonEnabled ? losers.slice(0, 3).map(item => item.name).join(", ") || "Sin pérdidas relevantes" : "Sin comparación"}.\n\n6. Marcas y productos responsables\n${comparisonEnabled ? `${brands[0]?.name ?? "Sin datos"} lidera en vistas. ${productLosses[0]?.name ?? "No hay un producto dominante en la pérdida"}.` : "Sin comparación."}\n\n7. Alertas de stock\n${alertRows.demandNoStock} productos sin stock continúan recibiendo vistas; ${alertRows.lowRotation} tienen stock sin rotación.\n\n8. Acciones recomendadas\nOptimizar la transición ${previousStageName} → ${currentStageName}${comparisonEnabled ? `; recuperar participación en ${losers[0]?.name ?? "categorías con menor participación"}` : ""}.\n\nPAID MEDIA\n${paidSummary}`;

  const copy = async () => {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([summary], { type: "text/plain" }));
    anchor.download = "radar-ecommerce-resumen-ejecutivo.txt";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  return (
    <>
      <InstitutionalHeader store={filters.store} onStoreChange={(value) => updateFilter("store", value)} />
      <div className="radar-shell">
        <SidebarNavigation active={tab} onChange={setTab} />
        <main className="radar-main">
          <div className="page-heading">
            <div>
              <p>{tab === "Venta por plaza" ? "VENTA POR PLAZA" : tab === "Medios de pago" ? "MEDIOS DE PAGO" : tab === "Paid Media" ? "PAID MEDIA" : "ANÁLISIS DE CONVERSIÓN"}</p>
              <h2>{tab}</h2>
              <span>{tab === "Venta por plaza" ? "Distribución geográfica de pedidos ecommerce" : tab === "Medios de pago" ? "Cómo pagan los clientes y qué opciones financieras utilizan" : "Identificá dónde se pierde el usuario y qué segmentos explican la variación."}</span>
            </div>
            <button className="mobile-filter-button" onClick={() => setMobileFilters(true)}><Filter />Filtros</button>
          </div>
          <FiltersPanel
            filters={filters} products={mockProducts} commercialChannels={COMMERCIAL_CHANNELS} acquisitionChannels={ACQUISITION_CHANNELS} provinces={PROVINCES}
            preset={preset} custom={custom} compare={effectiveCompare}
            moreFilters={moreFilters} mobileOpen={mobileFilters}
            onFilter={updateFilter} onPreset={setPreset} onCustom={setCustom} onCompare={setCompare}
            onMoreFilters={() => setMoreFilters((value) => !value)}
            onCloseMobile={() => setMobileFilters(false)}
          />
          {tab === "Embudo Analytics" && (current.sessions || current.productViews ? <AnalyticsFunnel current={current} previous={previous} segmented={segmented} comparisonEnabled={comparisonEnabled} range={range} store={filters.store} /> : <Empty text="No hay métricas del embudo para los filtros seleccionados." />)}
          {tab === "Categorías" && (macros.length ? <CategoryPerformance rows={macros} current={current} previous={previous} dailyShares={dailyShares} diagnostics={macroDiagnostics} comparisonEnabled={comparisonEnabled} range={range} store={filters.store} /> : <Empty text="No hay categorías para los filtros seleccionados." />)}
          {tab === "Marcas y productos" && (rows.length ? <ProductPerformance rows={rows} brands={brands} current={current} previous={previous} losses={productLosses} comparisonEnabled={comparisonEnabled} range={range} store={filters.store} /> : <Empty text="No hay productos para los filtros seleccionados." />)}
          {tab === "Venta por plaza" && <SalesByPlaza ecommerce={filters.store} />}
          {tab === "Medios de pago" && <PaymentMethods ecommerce={filters.store} />}
          {tab === "Paid Media" && <PaidMediaPanel filters={filters} range={range} compareRange={compareRange} platform={paidPlatform} campaign={paidCampaign} attribution={paidAttribution} onPlatformChange={setPaidPlatform} onCampaignChange={setPaidCampaign} onAttributionChange={setPaidAttribution} />}
          {tab === "Alertas y oportunidades" && <AlertsPanel alerts={alertRows} comparisonEnabled={comparisonEnabled} />}
          {tab === "Resumen ejecutivo" && <ExecutiveSummary summary={summary} copied={copied} onCopy={copy} onDownload={download} />}
        </main>
      </div>
    </>
  );
}
