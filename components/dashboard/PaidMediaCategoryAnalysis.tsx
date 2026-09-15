import { attributedValues } from "@/lib/paid-media-filtering";
import { participationDelta } from "@/lib/dashboard-rules";
import { paidRate, paidRatio } from "@/lib/paid-media-analytics";
import { formatPercentage } from "@/lib/formatters";
import type { AttributionSource, PaidMediaTotals } from "@/types/paid-media";
import type { PaidGroupRow } from "./paid-media-types";
import { Section } from "./ui";

export function PaidMediaCategoryAnalysis({ rows, totals, previous, attribution, comparisonEnabled }: { rows: PaidGroupRow[]; totals: PaidMediaTotals; previous: PaidMediaTotals; attribution: AttributionSource; comparisonEnabled: boolean }) {
  const selectedTotals = attributedValues(totals, attribution);
  const previousTotals = attributedValues(previous, attribution);
  return <Section title="Inversión por categorías y productos" eyebrow={`Participaciones según ${attribution}`} className="mt-4"><div className="table-scroll"><table><thead><tr>{["Macrocategoría", "Part. inversión", "Part. sesiones", "Part. compras", "Part. ingresos", "ROAS", "Conversión", "Δ part. ingresos"].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row) => { const values = attributedValues(row.current, attribution); const oldValues = attributedValues(row.previous, attribution); const delta = participationDelta(paidRate(values.revenue, selectedTotals.revenue), paidRate(oldValues.revenue, previousTotals.revenue), comparisonEnabled); return <tr key={row.key}><td><strong>{row.label}</strong></td><td>{formatPercentage(paidRate(row.current.spend, totals.spend))}</td><td>{formatPercentage(paidRate(row.current.ga4Sessions, totals.ga4Sessions))}</td><td>{formatPercentage(paidRate(values.purchases, selectedTotals.purchases))}</td><td>{formatPercentage(paidRate(values.revenue, selectedTotals.revenue))}</td><td>{paidRatio(values.revenue, row.current.spend).toFixed(2)}×</td><td>{formatPercentage(paidRate(values.purchases, row.current.ga4Sessions))}</td><td>{delta === null ? "—" : `${formatPercentage(delta)} pp`}</td></tr>; })}</tbody></table></div></Section>;
}
