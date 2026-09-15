import type { ReactNode } from "react";
import { AlertTriangle, Boxes, Funnel, Lightbulb } from "lucide-react";
import { Empty } from "./ui";

export type AlertCounts = {
  lowView: number;
  viewCart: number;
  cartCheckout: number;
  checkoutPurchase: number;
  macroLoss: number;
  categoryLoss: number;
  brandLoss: number;
  productLoss: number;
  trafficNoAdvance: number;
  demandNoStock: number;
  lowRotation: number;
};

type Severity = "critical" | "attention" | "opportunity";
type Insight = {
  title: string;
  count: number;
  severity: Severity;
  meaning: string;
  scope: string;
  action: string;
};

const severityLabel: Record<Severity, string> = {
  critical: "Crítico",
  attention: "Atención",
  opportunity: "Oportunidad",
};

function AlertCard({ insight }: { insight: Insight }) {
  return (
    <details className="alert-card actionable-alert">
      <summary>
        <div>
          <span className={`status-badge status-${insight.severity}`}>
            {severityLabel[insight.severity]}
          </span>
          <h3>{insight.title}</h3>
        </div>
        <strong>{insight.count}</strong>
      </summary>
      <div className="alert-explanation">
        <p><b>Qué significa</b>{insight.meaning}</p>
        <p><b>Criterio</b>{insight.count} {insight.count === 1 ? "caso detectado" : "casos detectados"} con los filtros actuales.</p>
        <p><b>Dónde ocurre</b>{insight.scope}</p>
        <p className="alert-action"><b>Acción sugerida</b>{insight.action}</p>
      </div>
    </details>
  );
}

function InsightGroup({
  icon,
  title,
  description,
  insights,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  insights: Insight[];
}) {
  const activeInsights = insights.filter((insight) => insight.count > 0);
  if (activeInsights.length === 0) return null;
  return (
    <section className="alert-group">
      <header>
        <span className="alert-group-icon">{icon}</span>
        <div><h2>{title}</h2><p>{description}</p></div>
        <span>{activeInsights.reduce((total, insight) => total + insight.count, 0)} casos</span>
      </header>
      <div className="alerts-grid">
        {activeInsights.map((insight) => <AlertCard key={insight.title} insight={insight} />)}
      </div>
    </section>
  );
}

export function AlertsPanel({ alerts, comparisonEnabled }: { alerts: AlertCounts; comparisonEnabled: boolean }) {
  const funnelInsights: Insight[] = [
    { title: "Baja tasa de sesión a vista", count: alerts.lowView, severity: "attention", meaning: "Una proporción baja de las sesiones llega a consultar productos.", scope: "Embudo general del ecommerce.", action: "Revisar navegación, accesos a categorías y visibilidad del catálogo." },
    { title: "Alta caída entre vista y carrito", count: alerts.viewCart, severity: "critical", meaning: "Las vistas de producto no avanzan al carrito al ritmo esperado.", scope: "Productos o segmentos con fricción después de la PDP.", action: "Revisar precio, stock, contenido, talles y claridad del llamado a comprar." },
    { title: "Alta caída entre carrito y checkout", count: alerts.cartCheckout, severity: "critical", meaning: "Los carritos creados no progresan hacia el checkout.", scope: "Transición comercial y logística previa al pago.", action: "Evaluar costos de envío, promociones, disponibilidad y experiencia del carrito." },
    { title: "Alta caída entre checkout y compra", count: alerts.checkoutPurchase, severity: "critical", meaning: "Los checkouts iniciados no terminan en una compra.", scope: "Etapa final del proceso de compra.", action: "Revisar medios de pago, errores técnicos, costos finales y validaciones." },
  ];
  const participationInsights: Insight[] = comparisonEnabled ? [
    { title: "Macrocategoría pierde participación", count: alerts.macroLoss, severity: "attention", meaning: "Una macrocategoría representa menos del negocio que en el período comparado.", scope: "Calzado, Indumentaria o Accesorios, medido en puntos porcentuales.", action: "Abrir Categorías e identificar los segmentos que explican la pérdida." },
    { title: "Categoría pierde participación", count: alerts.categoryLoss, severity: "attention", meaning: "Una categoría redujo su aporte relativo frente al período anterior.", scope: "Categorías incluidas en los filtros actuales.", action: "Contrastar tráfico, avance del embudo, surtido y disponibilidad." },
    { title: "Marca pierde participación", count: alerts.brandLoss, severity: "attention", meaning: "La marca redujo su contribución relativa al negocio.", scope: "Marcas incluidas en el contexto seleccionado.", action: "Revisar los productos responsables y su exposición, precio y stock." },
    { title: "Producto responsable de caída", count: alerts.productLoss, severity: "critical", meaning: "El producto aporta una caída relevante respecto del período comparado.", scope: "Productos con contribución negativa dentro de la selección.", action: "Priorizar diagnóstico de tráfico, embudo, precio y disponibilidad del producto." },
  ] : [];
  const opportunityInsights: Insight[] = [
    { title: "Mucho tráfico sin avance", count: alerts.trafficNoAdvance, severity: "opportunity", meaning: "Existe interés, pero el tráfico no avanza suficientemente en el embudo.", scope: "Segmentos con sesiones o vistas altas y pocas acciones posteriores.", action: "Mejorar relevancia de destino, contenido y propuesta comercial." },
    { title: "Demanda sin stock", count: alerts.demandNoStock, severity: "critical", meaning: "Productos agotados continúan recibiendo demanda.", scope: "Productos sin stock que mantienen vistas en el período.", action: "Reponer, ofrecer alternativas o redirigir la demanda hacia productos disponibles." },
    { title: "Stock sin rotación", count: alerts.lowRotation, severity: "attention", meaning: "Hay inventario disponible sin ventas durante el período.", scope: "Productos con stock y sin rotación registrada.", action: "Revisar exposición, precio, contenido y estrategia promocional." },
  ];
  const total = [...funnelInsights, ...participationInsights, ...opportunityInsights]
    .reduce((sum, insight) => sum + insight.count, 0);
  if (total === 0) return <Empty text="No se detectaron alertas para los filtros seleccionados." />;
  return (
    <div className="actionable-alerts">
      <div className="alerts-intro"><div><AlertTriangle /><span><b>Insights accionables</b><small>Qué pasó, dónde ocurre y qué acción considerar.</small></span></div><strong>{total} casos priorizados</strong></div>
      <InsightGroup icon={<Funnel />} title="Fricciones del embudo" description="Etapas donde el volumen deja de avanzar." insights={funnelInsights} />
      <InsightGroup icon={<Boxes />} title="Pérdida de participación" description="Segmentos que retroceden frente al período comparado." insights={participationInsights} />
      <InsightGroup icon={<Lightbulb />} title="Oportunidades comerciales y stock" description="Casos donde una acción comercial puede recuperar demanda o rotación." insights={opportunityInsights} />
    </div>
  );
}
