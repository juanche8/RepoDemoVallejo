import { BarChart3 } from "lucide-react";

export type PaidAlert = { label: string; count: number; status: "critical" | "attention" | "opportunity" };

export function PaidMediaAlerts({ alerts }: { alerts: PaidAlert[] }) {
  return <section className="card p-5 mt-4"><div className="mb-5"><p className="section-eyebrow mb-1 text-[9px] font-extrabold uppercase tracking-[.18em]">Desvíos y oportunidades priorizadas</p><h2 className="display text-base font-bold">Alertas de Paid Media</h2></div><div className="alerts-grid">{alerts.map((alert) => <article className="alert-card" key={alert.label}><header><BarChart3 /><span className={`status-badge status-${alert.status}`}>{alert.status === "critical" ? "Crítico" : alert.status === "attention" ? "Atención" : "Oportunidad"}</span></header><strong>{alert.label}</strong><p>{alert.count} casos detectados en el período seleccionado.</p></article>)}</div></section>;
}
