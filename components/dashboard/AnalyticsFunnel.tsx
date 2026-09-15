import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { comparisonChange, funnelKeys, nonAdvancingVolume, segmentedSessionsNote } from "@/lib/dashboard-rules";
import { pp } from "@/lib/analytics";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/formatters";
import {
  ga4FunnelRate as rate,
  ga4PercentageChange,
  ga4RateDelta,
} from "@/lib/integrations/ga4/dashboard";
import type { GA4DashboardData } from "@/lib/integrations/ga4/types";
import type { DateRange, MetricTotals } from "@/types/analytics";
import { Section, Variation } from "./ui";

export const funnelMetricNames = {
  sessions: "Sesiones", productViews: "Vista de producto", addToCarts: "Agregado al carrito",
  beginCheckouts: "Inicio de checkout", purchases: "Compra",
} as const;

const userFunnelMetricNames = {
  sessions: "Usuarios activos",
  productViews: "Usuarios con View Item",
  addToCarts: "Usuarios con Add to Cart",
  beginCheckouts: "Usuarios con Begin Checkout",
  purchases: "Usuarios compradores",
} as const;

const statusFor = (abandonment: number) => abandonment >= 68
  ? { label: "Crítico", className: "status-critical" }
  : abandonment >= 45
    ? { label: "Atención", className: "status-attention" }
    : { label: "Saludable", className: "status-healthy" };

type Props = {
  current: MetricTotals;
  previous: MetricTotals;
  segmented: boolean;
  comparisonEnabled: boolean;
  range: DateRange;
  store: string;
};

type GA4State =
  | { status: "idle" }
  | { status: "error"; key: string; message: string }
  | { status: "success"; key: string; data: GA4DashboardData };

function updatedLabel(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));
}

function formatPercentagePoints(value: number): string {
  return `${value > 0 ? "+" : ""}${formatNumber(value, 1)} p.p.`;
}

function userFunnelValues(
  data: GA4DashboardData,
  fallback: MetricTotals,
): MetricTotals {
  return {
    ...fallback,
    sessions: data.totals.activeUsers,
    productViews: data.funnelEvents.viewItemUsers,
    addToCarts: data.funnelEvents.addToCartUsers,
    beginCheckouts: data.funnelEvents.beginCheckoutUsers,
    purchases: data.funnelEvents.purchaseUsers,
    revenue: data.totals.revenue,
  };
}

export function AnalyticsFunnel({
  current,
  previous,
  segmented,
  comparisonEnabled,
  range,
  store,
}: Props) {
  const [ga4, setGA4] = useState<GA4State>({ status: "idle" });
  const requestKey = `${store}:${range.from}:${range.to}:${comparisonEnabled}`;

  useEffect(() => {
    if (store !== "Sportotal") return;
    const controller = new AbortController();
    fetch(`/api/ga4/funnel?dateFrom=${range.from}&dateTo=${range.to}&compare=${comparisonEnabled}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as GA4DashboardData | { error?: string };
        if (!response.ok) throw new Error("No se pudieron cargar los datos de GA4");
        setGA4({ status: "success", key: requestKey, data: payload as GA4DashboardData });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setGA4({ status: "error", key: requestKey, message: "No se pudieron cargar los datos de GA4" });
      });
    return () => controller.abort();
  }, [comparisonEnabled, range.from, range.to, requestKey, store]);

  const ga4Status = store !== "Sportotal"
    ? "idle"
    : ga4.status !== "idle" && ga4.key === requestKey
      ? ga4.status
      : "loading";
  const realData = ga4.status === "success"
    && ga4.key === requestKey
    && ga4.data.hasData
    ? ga4.data
    : null;
  const realFunnelValues = realData && !segmented;
  const comparisonData = realData?.comparison?.hasData
    && realData.comparison.funnelEventsAvailable
    ? realData.comparison
    : null;
  const displayedCurrent = realFunnelValues
    ? realData.funnelEventsAvailable
      ? userFunnelValues(realData, current)
      : {
          ...current,
          sessions: realData.totals.activeUsers,
          purchases: realData.totals.purchases,
          revenue: realData.totals.revenue,
        }
    : current;
  const displayedPrevious = realFunnelValues && comparisonData
    ? userFunnelValues(comparisonData, previous)
    : previous;
  const keys = funnelKeys(segmented).filter((key) => key !== "revenue" && key !== "units" && key !== "stock");
  const stages = keys.map((key, index) => {
    const prior = index ? displayedCurrent[keys[index - 1]] : displayedCurrent[key];
    const previousPrior = index
      ? displayedPrevious[keys[index - 1]]
      : displayedPrevious[key];
    const abandonment = index
      ? Math.max(100 - rate(displayedCurrent[key], prior), 0)
      : 0;
    const progress = nonAdvancingVolume(prior, displayedCurrent[key]);
    const isRealStage = Boolean(realFunnelValues)
      && (key === "sessions"
        || key === "purchases"
        || (Boolean(realData?.funnelEventsAvailable)
          && (key === "productViews"
            || key === "addToCarts"
            || key === "beginCheckouts")));
    return {
      key,
      name: realFunnelValues
        ? userFunnelMetricNames[key as keyof typeof userFunnelMetricNames]
        : funnelMetricNames[key as keyof typeof funnelMetricNames],
      value: displayedCurrent[key],
      sessionRate: segmented ? null : rate(displayedCurrent[key], displayedCurrent.sessions),
      stepRate: index ? rate(displayedCurrent[key], prior) : 100,
      drop: index ? progress.volume : 0,
      nextStageIsHigher: index ? progress.nextStageIsHigher : false,
      abandonment,
      previousAbandonment: index
        ? Math.max(100 - rate(displayedPrevious[key], previousPrior), 0)
        : 0,
      variation: isRealStage
        ? comparisonData
          ? ga4PercentageChange(
              displayedCurrent[key],
              displayedPrevious[key],
            ) ?? undefined
          : undefined
        : comparisonChange(displayedCurrent[key], previous[key], comparisonEnabled),
      rateDelta: index && comparisonData
        ? ga4RateDelta(
            displayedCurrent[key],
            prior,
            displayedPrevious[key],
            previousPrior,
          )
        : null,
      source: isRealStage ? "GA4 real" : "Simulado",
      secondary: realFunnelValues && realData.funnelEventsAvailable
        ? key === "productViews"
          ? `${formatNumber(realData.funnelEvents.viewItem)} eventos`
          : key === "addToCarts"
            ? `${formatNumber(realData.funnelEvents.addToCart)} eventos`
            : key === "beginCheckouts"
              ? `${formatNumber(realData.funnelEvents.beginCheckout)} eventos`
              : key === "purchases"
                ? `${formatNumber(realData.totals.purchases)} compras · ${formatNumber(realData.funnelEvents.purchaseEventCount)} eventos`
                : `${formatNumber(realData.totals.sessions)} sesiones`
        : null,
      status: statusFor(abandonment),
    };
  });
  const worst = stages.slice(1).reduce((result, stage) => stage.abandonment > result.abandonment ? stage : result);
  const worstIndex = stages.findIndex((stage) => stage.key === worst.key);
  const from = stages[worstIndex - 1].name;
  const to = worst.name === "Agregado al carrito" ? "Carrito" : worst.name;
  const sessionsNote = segmentedSessionsNote(segmented);

  return (
    <>
      {ga4Status === "loading" && <p className="attribution-note">Cargando datos reales de GA4…</p>}
      {ga4Status === "error" && ga4.status === "error" && <p className="attribution-note">{ga4.message}. Se mantienen visibles los datos simulados.</p>}
      {ga4Status === "success" && ga4.status === "success" && !ga4.data.hasData && <p className="attribution-note">GA4 no devolvió datos para el período. Se mantienen visibles los datos simulados.</p>}
      {store !== "Sportotal" && <p className="attribution-note">La conexión GA4 real está habilitada inicialmente solo para Sportotal. Esta vista utiliza datos simulados.</p>}
      {realData && !realData.funnelEventsAvailable && (
        <p className="attribution-note">
          Eventos del funnel no disponibles. Los indicadores generales permanecen visibles con datos reales.
        </p>
      )}
      {realData?.comparisonError && (
        <p className="attribution-note">Comparación no disponible.</p>
      )}
      {realData && (
        <Section
          title="Indicadores generales"
          eyebrow="GA4 · Datos reales"
          action={<span className="status-badge status-healthy">Actualizado: {updatedLabel(realData.updatedAt)}</span>}
        >
          <div className="paid-kpi-grid">
            <article className="paid-kpi"><span>Sesiones</span><strong>{formatNumber(realData.totals.sessions)}</strong><small>Fuente: GA4 real{comparisonData && <> · Anterior {formatNumber(comparisonData.totals.sessions)} · <Variation value={ga4PercentageChange(realData.totals.sessions, comparisonData.totals.sessions) ?? undefined} /></>}</small></article>
            <article className="paid-kpi"><span>Usuarios activos</span><strong>{formatNumber(realData.totals.activeUsers)}</strong><small>Fuente: GA4 real · no aditivo{comparisonData && <> · Anterior {formatNumber(comparisonData.totals.activeUsers)} · <Variation value={ga4PercentageChange(realData.totals.activeUsers, comparisonData.totals.activeUsers) ?? undefined} /></>}</small></article>
            <article className="paid-kpi"><span>Usuarios nuevos</span><strong>{formatNumber(realData.totals.newUsers)}</strong><small>Fuente: GA4 real · no aditivo</small></article>
            <article className="paid-kpi"><span>Compras</span><strong>{formatNumber(realData.totals.purchases)}</strong><small>Fuente: GA4 real{comparisonData && <> · Anterior {formatNumber(comparisonData.totals.purchases)} · <Variation value={ga4PercentageChange(realData.totals.purchases, comparisonData.totals.purchases) ?? undefined} /></>}</small></article>
            <article className="paid-kpi"><span>Ingresos</span><strong>{formatCurrency(realData.totals.revenue, true)}</strong><small>Fuente: GA4 real{comparisonData && <> · Anterior {formatCurrency(comparisonData.totals.revenue, true)} · <Variation value={ga4PercentageChange(realData.totals.revenue, comparisonData.totals.revenue) ?? undefined} /></>}</small></article>
          </div>
        </Section>
      )}
      {sessionsNote && <p className="attribution-note">{sessionsNote}</p>}
      <Section
        title={segmented ? "Embudo segmentado" : "Embudo de conversión"}
        eyebrow={realFunnelValues
          ? realData.funnelEventsAvailable
            ? "GA4 · Datos reales · Conversión por usuarios"
            : "GA4 real: sesiones y compras · Eventos intermedios no disponibles"
          : "Google Analytics · Datos simulados"}
        action={<span className={`status-badge funnel-loss-badge ${worst.abandonment >= 68 ? "status-critical" : "status-attention"}`}>Mayor pérdida: {from} → {to}</span>}
      >
        <div className="funnel-grid">
          {stages.map((stage, index) => (
            <article key={stage.key} className={`funnel-stage ${stage.key === worst.key ? "funnel-stage-worst" : ""}`} style={{ "--stage-width": `${100 - index * 9}%` } as React.CSSProperties}>
              <div className="funnel-stage-head"><span className="stage-number">{index + 1}</span><div><p>{stage.name}</p><strong>{formatNumber(stage.value)}{realFunnelValues ? " usuarios" : ""}</strong><small>{stage.secondary ? `${stage.secondary} · ` : ""}{stage.source}</small></div><span className={`status-badge ${stage.status.className}`}>{stage.status.label}</span></div>
              <div className="funnel-metrics">
                <span><small>{realFunnelValues ? "Sobre usuarios activos" : segmented ? "Sobre vistas" : "Sobre sesiones"}</small><b>{index === 0 ? formatPercentage(100) : formatPercentage(stage.sessionRate ?? rate(stage.value, current.productViews))}</b></span>
                <span><small>Desde etapa anterior</small><b>{formatPercentage(stage.stepRate)}</b></span>
                <span><small>Volumen que no avanzó</small><b>{index ? formatNumber(stage.drop) : "—"}</b></span>
                <span><small>Tasa de abandono</small><b>{index ? formatPercentage(stage.abandonment) : "—"}</b></span>
                <span><small>Vs. período anterior</small><b><Variation value={stage.variation} /></b>{stage.rateDelta !== null && <small>{formatPercentagePoints(stage.rateDelta)} conversión</small>}</span>
              </div>
            </article>
          ))}
        </div>
      </Section>
      <div className="insight-banner"><AlertTriangle /><div><strong>Principal punto de fuga</strong><p>La principal caída se encuentra entre {from} y {worst.name}, con un abandono del {formatPercentage(worst.abandonment)}{realFunnelValues && comparisonData ? `, ${formatNumber(Math.abs(pp(worst.abandonment, worst.previousAbandonment)), 1)} p.p. ${worst.abandonment > worst.previousAbandonment ? "por encima" : "por debajo"} del período anterior.` : realFunnelValues ? ". Comparación no disponible." : comparisonEnabled ? `, ${formatNumber(Math.abs(pp(worst.abandonment, worst.previousAbandonment)), 1)} p.p. ${worst.abandonment > worst.previousAbandonment ? "por encima" : "por debajo"} del período anterior.` : ". Sin comparación temporal seleccionada."}</p></div></div>
      {realData && (
        <Section title="Desgloses de adquisición" eyebrow="GA4 · Datos reales" className="mt-4">
          <div className="table-scroll">
            <table>
              <thead><tr><th>Channel group</th><th>Sesiones</th><th>Usuarios activos</th><th>Usuarios nuevos</th><th>Compras</th><th>Ingresos</th></tr></thead>
              <tbody>{realData.channelGroups.map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{formatNumber(item.sessions)}</td><td>{formatNumber(item.activeUsers)}</td><td>{formatNumber(item.newUsers)}</td><td>{formatNumber(item.purchases)}</td><td>{formatCurrency(item.revenue, true)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="table-scroll mt-4">
            <table>
              <thead><tr><th>Dispositivo</th><th>Sesiones</th><th>Usuarios activos</th><th>Usuarios nuevos</th><th>Compras</th><th>Ingresos</th></tr></thead>
              <tbody>{realData.devices.map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{formatNumber(item.sessions)}</td><td>{formatNumber(item.activeUsers)}</td><td>{formatNumber(item.newUsers)}</td><td>{formatNumber(item.purchases)}</td><td>{formatCurrency(item.revenue, true)}</td></tr>)}</tbody>
            </table>
          </div>
        </Section>
      )}
    </>
  );
}
