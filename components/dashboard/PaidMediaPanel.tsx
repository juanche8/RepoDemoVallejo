"use client";

import { useState } from "react";
import { MousePointerClick, Target } from "lucide-react";
import { attributedValues, contextualCampaigns, filterPaidMediaRows } from "@/lib/paid-media-filtering";
import { isDrilldownCurrent } from "@/lib/dashboard-rules";
import { attributionDiscrepancy, analyzePaidMediaDiscrepancy } from "@/lib/paid-media-rules";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/formatters";
import { paidMediaMetrics } from "@/lib/paid-media-data";
import { paidRate, paidRatio, sumPaid } from "@/lib/paid-media-analytics";
import { mockProducts, mockSkus } from "@/lib/mock-data";
import type { DateRange, Filters } from "@/types/analytics";
import type { AdPlatform, AttributionSource } from "@/types/paid-media";
import { PaidMediaAlerts, type PaidAlert } from "./PaidMediaAlerts";
import { PaidMediaCampaignTable } from "./PaidMediaCampaignTable";
import { PaidMediaCategoryAnalysis } from "./PaidMediaCategoryAnalysis";
import { PaidMediaFunnel } from "./PaidMediaFunnel";
import { PaidMediaKpis } from "./PaidMediaKpis";
import { MetaPaidMediaPanel } from "./MetaPaidMediaPanel";
import { groupPaidRows, type PaidGroupRow } from "./paid-media-types";
import { Empty, Section } from "./ui";
import { UtmControl } from "./UtmControl";

type Props = {
  filters: Filters;
  range: DateRange;
  compareRange: DateRange | null;
  platform: AdPlatform | "Todas";
  campaign: string;
  attribution: AttributionSource;
  onPlatformChange: (value: AdPlatform | "Todas") => void;
  onCampaignChange: (value: string) => void;
  onAttributionChange: (value: AttributionSource) => void;
};

const attributionLabels: Record<AttributionSource, string> = {
  platform: "Plataforma publicitaria", ga4: "Google Analytics", vtex: "VTEX",
};
const productById = new Map(mockProducts.map((product) => [product.productId, product]));
const stockByProduct = new Map(mockProducts.map((product) => [
  product.productId,
  mockSkus.filter((sku) => sku.productId === product.productId).reduce((total, sku) => total + sku.stock, 0),
]));

function SimulatedPaidMediaPanel(props: Props) {
  const [drill, setDrill] = useState<{ row: PaidGroupRow; contextKey: string } | null>(null);
  const selectedProductId = props.filters.product;
  const context = {
    store: props.filters.store, macroCategory: props.filters.macroCategory,
    category: props.filters.category, brand: props.filters.brand,
    productId: selectedProductId, province: props.filters.province,
    device: props.filters.device, acquisitionChannel: props.filters.acquisitionChannel,
  };
  const campaignOptions = contextualCampaigns(paidMediaMetrics, context, props.range, props.platform);
  const effectiveCampaign = campaignOptions.includes(props.campaign) ? props.campaign : "Todas";
  const contextKey = JSON.stringify({ context, range: props.range, compareRange: props.compareRange, platform: props.platform, campaign: effectiveCampaign });
  const rows = filterPaidMediaRows(paidMediaMetrics, context, props.range, props.platform, effectiveCampaign);
  const previousRows = props.compareRange
    ? filterPaidMediaRows(paidMediaMetrics, context, props.compareRange, props.platform, effectiveCampaign)
    : [];
  const totals = sumPaid(rows);
  const previous = sumPaid(previousRows);
  const comparisonEnabled = props.compareRange !== null;
  const selectedTotals = attributedValues(totals, props.attribution);
  const campaigns = groupPaidRows(rows, previousRows, "campaignName")
    .sort((a, b) => paidRatio(attributedValues(b.current, props.attribution).revenue, b.current.spend) - paidRatio(attributedValues(a.current, props.attribution).revenue, a.current.spend));
  const platforms = groupPaidRows(rows, previousRows, "platform");
  const macros = groupPaidRows(rows, previousRows, "macroCategory");
  const utms = groupPaidRows(rows, previousRows, "campaign").map((row) => {
    const sample = row.rows[0];
    const errors = [
      !sample.campaign && "Campaña ausente",
      !["facebook", "instagram", "google"].includes(sample.source) && "Source no normalizado",
      !["paid_social", "cpc"].includes(sample.medium) && "Medium incorrecto",
    ].filter(Boolean) as string[];
    return { ...row, sample, errors };
  });

  const attributionAlerts = campaigns.filter((row) => attributionDiscrepancy(row.current.platformPurchases, row.current.ga4Purchases).alert);
  const paidAlerts: PaidAlert[] = [
    { label: "ROAS bajo según atribución seleccionada", count: campaigns.filter((row) => paidRatio(attributedValues(row.current, props.attribution).revenue, row.current.spend) < 1.8).length, status: "critical" },
    { label: "CPA alto según atribución seleccionada", count: campaigns.filter((row) => paidRatio(row.current.spend, attributedValues(row.current, props.attribution).purchases) > 18_000).length, status: "critical" },
    { label: "GA4: diferencia elevada entre clics y sesiones", count: campaigns.filter((row) => paidRate(row.current.ga4Sessions, row.current.linkClicks) < 70).length, status: "attention" },
    { label: "GA4: inversión con cero compras", count: campaigns.filter((row) => row.current.spend > 0 && row.current.ga4Purchases === 0).length, status: "critical" },
    { label: "Producto anunciado sin stock", count: new Set(rows.filter((row) => (stockByProduct.get(row.productId) ?? 1) === 0).map((row) => row.productId)).size, status: "critical" },
    { label: "Discrepancia Plataforma vs. GA4", count: attributionAlerts.length, status: attributionAlerts.some((row) => attributionDiscrepancy(row.current.platformPurchases, row.current.ga4Purchases).severity === "critical") ? "critical" : "attention" },
    { label: "Baja tasa link click a landing", count: campaigns.filter((row) => analyzePaidMediaDiscrepancy(row.current).lowLandingRate).length, status: "attention" },
    { label: "Diferencia landing vs. sesión GA4", count: campaigns.filter((row) => analyzePaidMediaDiscrepancy(row.current).landingSessionGap).length, status: "attention" },
    { label: "GA4: inversión y clics sin sesiones", count: campaigns.filter((row) => analyzePaidMediaDiscrepancy(row.current).activeTrafficWithoutSessions).length, status: "critical" },
  ];
  const localFilters = <div className="paid-local-filters"><label>Plataforma<select value={props.platform} onChange={(event) => { props.onPlatformChange(event.target.value as AdPlatform | "Todas"); props.onCampaignChange("Todas"); }}><option>Todas</option><option>Meta Ads</option><option>Google Ads</option></select></label><label>Campaña<select value={effectiveCampaign} onChange={(event) => props.onCampaignChange(event.target.value)}><option>Todas</option>{campaignOptions.map((value) => <option key={value}>{value}</option>)}</select></label></div>;

  if (rows.length === 0 || totals.spend <= 0) {
    return <Section title="Paid Media" eyebrow="Meta Ads y Google Ads · Datos simulados deterministas" action={localFilters}><Empty text="No se registraron datos de Paid Media para los filtros y período seleccionados." /></Section>;
  }

  return (
    <div className="paid-media-view">
      <Section title="Paid Media" eyebrow="Meta Ads y Google Ads · Datos simulados deterministas" action={localFilters}>
        <div className="attribution-switch"><span>Fuente de conversión</span>{(Object.keys(attributionLabels) as AttributionSource[]).map((source) => <button key={source} className={props.attribution === source ? "active" : ""} onClick={() => props.onAttributionChange(source)}>{attributionLabels[source]}</button>)}</div>
        <p className="attribution-note">Ranking, ROAS, CPA, compras, ingresos y conversión responden a la fuente seleccionada. Sesiones y etapas de navegación permanecen identificadas como GA4.</p>
        <PaidMediaKpis totals={totals} previous={previous} attribution={props.attribution} comparisonEnabled={comparisonEnabled} />
      </Section>

      <Section title="Comparación por plataforma" eyebrow={`Conversión seleccionada: ${attributionLabels[props.attribution]}`} className="mt-4"><div className="table-scroll"><table><thead><tr>{["Plataforma", "Inversión", "Clics", "Sesiones GA4", "Compras", "Ingresos", "ROAS", "CPA", "Conversión"].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{platforms.map((row) => { const values = attributedValues(row.current, props.attribution); return <tr key={row.key}><td><strong>{row.label}</strong></td><td>{formatCurrency(row.current.spend, true)}</td><td>{formatNumber(row.current.linkClicks)}</td><td>{formatNumber(row.current.ga4Sessions)}</td><td>{formatNumber(values.purchases)}</td><td>{formatCurrency(values.revenue, true)}</td><td>{paidRatio(values.revenue, row.current.spend).toFixed(2)}×</td><td>{formatCurrency(paidRatio(row.current.spend, values.purchases))}</td><td>{formatPercentage(paidRate(values.purchases, row.current.ga4Sessions))}</td></tr>; })}</tbody></table></div></Section>

      <PaidMediaFunnel current={totals} previous={previous} comparisonEnabled={comparisonEnabled} />
      <PaidMediaCampaignTable campaigns={campaigns} attribution={props.attribution} comparisonEnabled={comparisonEnabled} onOpen={(row) => setDrill({ row, contextKey })} />
      {drill && isDrilldownCurrent(drill.contextKey, contextKey) && <Section title={drill.row.label} eyebrow="Plataforma → campaña → conjunto/grupo → anuncio → producto" className="mt-4" action={<button className="secondary" onClick={() => setDrill(null)}>Cerrar</button>}><div className="paid-drill">{groupPaidRows(drill.row.rows, [], "adSetName").map((set) => <article key={set.key}><Target /><div><strong>{set.label}</strong>{groupPaidRows(set.rows, [], "adName").map((ad) => <p key={ad.key}>{ad.label}<small>{[...new Set(ad.rows.map((row) => productById.get(row.productId)?.name))].join(", ")}</small></p>)}</div><span>{formatCurrency(attributedValues(set.current, props.attribution).revenue, true)}</span></article>)}</div></Section>}
      <PaidMediaCategoryAnalysis rows={macros} totals={totals} previous={previous} attribution={props.attribution} comparisonEnabled={comparisonEnabled} />
      <div className="paid-diagnostics">{[["Alta inversión y baja conversión", campaigns.filter((row) => paidRate(row.current.spend, totals.spend) > 20 && paidRate(attributedValues(row.current, props.attribution).purchases, row.current.ga4Sessions) < 1.2).length], ["Baja inversión y alta conversión", campaigns.filter((row) => paidRate(row.current.spend, totals.spend) < 15 && paidRate(attributedValues(row.current, props.attribution).purchases, row.current.ga4Sessions) > 2).length], ["Productos anunciados sin venta", new Set(rows.filter((row) => attributedValues(sumPaid([row]), props.attribution).purchases === 0).map((row) => row.productId)).size]].map(([label, count]) => <article key={label}><MousePointerClick /><span>{label}</span><strong>{count}</strong></article>)}</div>
      <UtmControl rows={utms} />
      <PaidMediaAlerts alerts={paidAlerts} />
      <p className="attribution-note">Resultados actuales: {formatNumber(selectedTotals.purchases)} compras y {formatCurrency(selectedTotals.revenue, true)} según {attributionLabels[props.attribution]}.</p>
    </div>
  );
}

export function PaidMediaPanel(props: Props) {
  if (props.filters.store === "Sportotal" || props.filters.store === "Vallejo Calzados") {
    return (
      <MetaPaidMediaPanel
        store={props.filters.store}
        range={props.range}
        compareRange={props.compareRange}
        platform={props.platform}
        campaign={props.campaign}
        onPlatformChange={props.onPlatformChange}
        onCampaignChange={props.onCampaignChange}
      />
    );
  }
  return <SimulatedPaidMediaPanel {...props} />;
}
