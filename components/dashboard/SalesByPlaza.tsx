import { BarChart3, Map, MapPin, TrendingDown, TrendingUp } from "lucide-react";
import { getSalesByPlazaViewModel } from "@/types/geography";
import { Section } from "./ui";

const kpis = [
  "Pedidos",
  "Facturación",
  "Unidades vendidas",
  "Ticket promedio",
  "Provincias con ventas",
  "Plazas activas",
];

const provinceHeaders = [
  "Provincia", "Pedidos", "Facturación", "Unidades", "Ticket promedio",
  "Participación %", "Δ pedidos", "Δ facturación", "Δ participación",
];

const plazaHeaders = [
  "Plaza", "Provincia", "Pedidos", "Facturación", "Unidades",
  "Ticket promedio", "Participación", "Δ pedidos", "Δ facturación", "Δ ticket",
];

const rankings = [
  { title: "Top plazas por facturación", icon: <BarChart3 /> },
  { title: "Top plazas por pedidos", icon: <MapPin /> },
  { title: "Top plazas por ticket promedio", icon: <TrendingUp /> },
  { title: "Plazas con mayor crecimiento", icon: <TrendingUp /> },
  { title: "Plazas con mayor caída", icon: <TrendingDown /> },
];

function PendingTable({ headers }: { headers: string[] }) {
  return (
    <div className="table-scroll geography-table">
      <table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody><tr><td colSpan={headers.length}>Disponible al conectar los pedidos reales de VTEX.</td></tr></tbody>
      </table>
    </div>
  );
}

export function SalesByPlaza({ ecommerce }: { ecommerce: string }) {
  let viewModel;
  try {
    viewModel = getSalesByPlazaViewModel(ecommerce);
  } catch {
    viewModel = {
      connection: null,
      hasData: false,
      sourceLabel: "VTEX · Pendiente de conexión",
      message: "Este ecommerce todavía no tiene una fuente VTEX configurada.",
    };
  }
  return (
    <div className="sales-by-plaza">
      <Section title="Venta por plaza" eyebrow="VTEX · Pendiente de conexión" action={<span className="status-badge status-attention">Fuente pendiente</span>}>
        <div className="geography-intro"><MapPin /><div><strong>Distribución geográfica de pedidos ecommerce</strong><p>{viewModel.message}</p><small>La ubicación futura será la dirección de entrega del pedido, no la ubicación del usuario en GA4.</small></div></div>
        <div className="geography-kpis">{kpis.map((kpi) => <article key={kpi}><span>{kpi}</span><strong>—</strong><small>Pendiente de VTEX</small></article>)}</div>
      </Section>

      <Section title="Venta por provincia" eyebrow="Nivel superior de análisis" className="mt-4">
        <PendingTable headers={provinceHeaders} />
      </Section>

      <Section title="Venta por plaza" eyebrow="Plaza = ciudad + provincia" className="mt-4">
        <div className="performance-toolbar geography-toolbar">
          <label className="toolbar-search"><span>Buscar plaza</span><input disabled placeholder="Ciudad o provincia" /></label>
          <label><span>Provincia</span><select disabled><option>Todas</option></select></label>
          <label><span>Plaza</span><select disabled><option>Todas</option></select></label>
          <label><span>Ordenar por</span><select disabled><option>Facturación</option><option>Pedidos</option><option>Unidades</option><option>Ticket promedio</option><option>Crecimiento</option></select></label>
        </div>
        <PendingTable headers={plazaHeaders} />
      </Section>

      <div className="geography-lower-grid">
        <Section title="Mapa de ventas por plaza" eyebrow="Visualización geográfica futura" className="mt-4">
          <div className="geography-map-placeholder"><Map /><strong>Mapa de Argentina</strong><p>Disponible al conectar VTEX.</p></div>
        </Section>
        <Section title="Rankings de plazas" eyebrow="Lectura comercial futura" className="mt-4">
          <div className="geography-rankings">{rankings.map((ranking) => <article key={ranking.title}>{ranking.icon}<span>{ranking.title}</span><strong>—</strong></article>)}</div>
        </Section>
      </div>
      <p className="geography-source-note">Fuente prevista: VTEX · dirección de entrega seleccionada en cada pedido.</p>
    </div>
  );
}
