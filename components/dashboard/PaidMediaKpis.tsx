import { attributedValues } from "@/lib/paid-media-filtering";
import { analyzePaidMediaDiscrepancy, PAID_MEDIA_THRESHOLDS } from "@/lib/paid-media-rules";
import { paidChange, paidRate, paidRatio } from "@/lib/paid-media-analytics";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/formatters";
import type { AttributionSource, PaidMediaTotals } from "@/types/paid-media";
import { Variation } from "./ui";

function Kpi({ label, value, source, change }: { label: string; value: string; source?: string; change?: number | null }) {
  return <article className="paid-kpi"><span>{label}</span><strong>{value}</strong>{source && <small>Fuente: {source}</small>}{change !== undefined && <Variation value={change} />}</article>;
}

export function PaidMediaKpis({ totals, previous, attribution, comparisonEnabled }: { totals: PaidMediaTotals; previous: PaidMediaTotals; attribution: AttributionSource; comparisonEnabled: boolean }) {
  const selected = attributedValues(totals, attribution);
  const oldSelected = attributedValues(previous, attribution);
  const discrepancy = analyzePaidMediaDiscrepancy(totals);
  const source = attribution === "platform" ? "Plataforma" : attribution.toUpperCase();
  return <div className="paid-kpi-grid">
    <Kpi label="Inversión" value={formatCurrency(totals.spend, true)} change={comparisonEnabled ? paidChange(totals.spend, previous.spend) : undefined} />
    <Kpi label="Impresiones" value={formatNumber(totals.impressions)} />
    <Kpi label="Alcance" value={totals.reachIsAggregated ? formatNumber(totals.reach) : "No aditivo"} source={totals.reachIsAggregated ? "Fuente agregada" : "No se suma entre campañas"} />
    <Kpi label="Clics" value={formatNumber(totals.linkClicks)} />
    <Kpi label="CTR" value={formatPercentage(paidRate(totals.linkClicks, totals.impressions))} />
    <Kpi label="CPC" value={formatCurrency(paidRatio(totals.spend, totals.linkClicks))} />
    <Kpi label="Link click → landing" value={formatPercentage(discrepancy.linkToLandingRate)} source={`Alerta bajo ${PAID_MEDIA_THRESHOLDS.minimumLandingPageViewRate}%`} />
    <Kpi label="Diferencia landing/sesión" value={formatNumber(discrepancy.landingSessionDifference)} source={`${formatPercentage(discrepancy.landingSessionDifferenceRate)} de landing views`} />
    <Kpi label={`Compras ${source}`} value={formatNumber(selected.purchases)} source={source} change={comparisonEnabled ? paidChange(selected.purchases, oldSelected.purchases) : undefined} />
    <Kpi label={`Ingresos ${source}`} value={formatCurrency(selected.revenue, true)} source={source} change={comparisonEnabled ? paidChange(selected.revenue, oldSelected.revenue) : undefined} />
    <Kpi label={`ROAS ${source}`} value={`${paidRatio(selected.revenue, totals.spend).toFixed(2)}×`} source={source} />
    <Kpi label={`CPA ${source}`} value={formatCurrency(paidRatio(totals.spend, selected.purchases))} source={source} />
    <Kpi label={`Conversión ${source}`} value={formatPercentage(paidRate(selected.purchases, totals.ga4Sessions))} source={source} />
  </div>;
}
