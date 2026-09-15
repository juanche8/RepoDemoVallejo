import { formatNumber } from "@/lib/formatters";
import type { PaidGroupRow } from "./paid-media-types";
import { Section } from "./ui";

export type UtmRow = PaidGroupRow & { sample: PaidGroupRow["rows"][number]; errors: string[] };

export function UtmControl({ rows }: { rows: UtmRow[] }) {
  return <Section title="Control de etiquetado UTM" eyebrow="Normalización y coincidencia con GA4" className="mt-4"><div className="table-scroll"><table><thead><tr>{["Source", "Medium", "Campaign", "Content", "Sesiones", "Estado", "Posibles errores"].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.slice(0, 16).map((row, index) => <tr key={`${row.key}-${index}`}><td>{row.sample.source || "—"}</td><td>{row.sample.medium || "—"}</td><td>{row.sample.campaign || "—"}</td><td>{row.sample.content || "—"}</td><td>{formatNumber(row.current.ga4Sessions)}</td><td><span className={`status-badge ${row.errors.length ? "status-attention" : "status-healthy"}`}>{row.errors.length ? "Revisar" : "Normalizado"}</span></td><td>{row.errors.join(" · ") || "Sin observaciones"}</td></tr>)}</tbody></table></div></Section>;
}
