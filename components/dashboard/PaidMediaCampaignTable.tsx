import { attributedValues } from "@/lib/paid-media-filtering";
import { comparisonChange } from "@/lib/dashboard-rules";
import { paidRate, paidRatio } from "@/lib/paid-media-analytics";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/formatters";
import type { AttributionSource } from "@/types/paid-media";
import type { PaidGroupRow } from "./paid-media-types";
import { Section, Variation } from "./ui";

export function PaidMediaCampaignTable({ campaigns, attribution, comparisonEnabled, onOpen }: { campaigns: PaidGroupRow[]; attribution: AttributionSource; comparisonEnabled: boolean; onOpen: (row: PaidGroupRow) => void }) {
  const source = attribution === "platform" ? "Plataforma" : attribution.toUpperCase();
  return <Section title="Performance por campaña" eyebrow={`Ranking según atribución ${source}`} className="mt-4"><div className="table-scroll"><table><thead><tr>{["Plataforma", "Campaña", "Objetivo", "Inversión", "Impresiones", "Clics", "Sesiones GA4", `Compras ${source}`, `Ingresos ${source}`, `ROAS ${source}`, `CPA ${source}`, `Conversión ${source}`, "Variación"].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{campaigns.map((row) => { const selected = attributedValues(row.current, attribution); const previous = attributedValues(row.previous, attribution); return <tr key={row.key} tabIndex={0} onClick={() => onOpen(row)}><td>{row.platform}</td><td><strong>{row.label}</strong><small>Ver anuncios y productos</small></td><td>{row.objective}</td><td>{formatCurrency(row.current.spend, true)}</td><td>{formatNumber(row.current.impressions)}</td><td>{formatNumber(row.current.linkClicks)}</td><td>{formatNumber(row.current.ga4Sessions)}</td><td>{formatNumber(selected.purchases)}</td><td>{formatCurrency(selected.revenue, true)}</td><td>{paidRatio(selected.revenue, row.current.spend).toFixed(2)}×</td><td>{formatCurrency(paidRatio(row.current.spend, selected.purchases))}</td><td>{formatPercentage(paidRate(selected.purchases, row.current.ga4Sessions))}</td><td><Variation value={comparisonChange(selected.revenue, previous.revenue, comparisonEnabled)} /></td></tr>; })}</tbody></table></div></Section>;
}
