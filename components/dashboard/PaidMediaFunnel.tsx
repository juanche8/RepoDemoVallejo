import { AlertTriangle } from "lucide-react";
import { comparisonChange, nonAdvancingVolume } from "@/lib/dashboard-rules";
import { paidRate } from "@/lib/paid-media-analytics";
import { formatNumber, formatPercentage } from "@/lib/formatters";
import type { PaidMediaTotals } from "@/types/paid-media";
import { Section, Variation } from "./ui";

export function PaidMediaFunnel({ current, previous, comparisonEnabled }: { current: PaidMediaTotals; previous: PaidMediaTotals; comparisonEnabled: boolean }) {
  const stages = [
    ["Impresiones", current.impressions, previous.impressions], ["Clics", current.linkClicks, previous.linkClicks],
    ["Landing page views", current.landingPageViews, previous.landingPageViews], ["Sesiones GA4", current.ga4Sessions, previous.ga4Sessions],
    ["Vistas de producto GA4", current.ga4ProductViews, previous.ga4ProductViews], ["Carritos GA4", current.ga4AddToCarts, previous.ga4AddToCarts],
    ["Checkouts GA4", current.ga4BeginCheckouts, previous.ga4BeginCheckouts], ["Compras GA4", current.ga4Purchases, previous.ga4Purchases],
  ] as const;
  const losses = stages.slice(1).map((stage, index) => ({ index: index + 1, abandonment: 100 - paidRate(stage[1], stages[index][1]) }));
  const worst = losses.reduce((result, item) => item.abandonment > result.abandonment ? item : result);
  const hasQualityIssue = stages.slice(1).some((stage, index) => nonAdvancingVolume(stages[index][1], stage[1]).nextStageIsHigher);

  return <Section title="Funnel de Paid Media" eyebrow="Recorrido operativo medido por plataforma y GA4">
    <div className="paid-funnel">{stages.map((stage, index) => {
      const prior = index ? stages[index - 1][1] : stage[1];
      const conversion = index ? paidRate(stage[1], prior) : 100;
      const progress = nonAdvancingVolume(prior, stage[1]);
      return <article key={stage[0]} className={index === worst.index ? "is-worst" : ""}><div><span>{index + 1}</span><strong>{stage[0]}</strong><b>{formatNumber(stage[1])}</b></div><dl><div><dt>Conversión anterior</dt><dd>{index ? formatPercentage(conversion) : "—"}</dd></div><div><dt>Volumen que no avanzó</dt><dd>{index ? formatNumber(progress.volume) : "—"}</dd></div><div><dt>Tasa de abandono</dt><dd>{index ? formatPercentage(100 - conversion) : "—"}</dd></div><div><dt>Vs. anterior</dt><dd><Variation value={comparisonChange(stage[1], stage[2], comparisonEnabled)} /></dd></div></dl></article>;
    })}</div>
    {hasQualityIssue && <p className="attribution-note">La etapa siguiente registra un volumen superior. Revisar diferencias de medición o atribución.</p>}
    <div className="insight-banner"><AlertTriangle /><div><strong>Mayor pérdida del recorrido pago</strong><p>Entre {stages[worst.index - 1][0]} y {stages[worst.index][0]}, con {formatPercentage(worst.abandonment)} de tasa de abandono.</p></div></div>
  </Section>;
}
