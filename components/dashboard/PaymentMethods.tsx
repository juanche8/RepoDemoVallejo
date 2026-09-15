import { Building2, CreditCard, Grid3X3, Landmark, WalletCards } from "lucide-react";
import { getPaymentMethodsViewModel } from "@/types/payments";
import { Section } from "./ui";

const kpis = [
  "Pedidos",
  "Facturación",
  "Ticket promedio",
  "Medio más utilizado",
  "Cuota más utilizada",
  "% ventas financiadas",
  "% contado / una cuota",
  "% cuotas sin interés",
];

const paymentHeaders = [
  "Medio", "Pedidos", "Facturación", "Participación %", "Ticket promedio",
  "Cuotas promedio", "Δ pedidos", "Δ facturación", "Δ participación",
];

const installmentHeaders = ["Cuotas", "Pedidos", "Facturación", "Ticket promedio", "Participación"];
const providerHeaders = ["Gateway / proveedor", "Pedidos", "Facturación", "Participación", "Ticket promedio"];
const cardHeaders = ["Tarjeta", "Emisor", "Banco", "Pedidos", "Facturación", "Participación", "Ticket promedio"];

function PendingTable({ headers }: { headers: string[] }) {
  return (
    <div className="table-scroll geography-table">
      <table>
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody><tr><td colSpan={headers.length}>Disponible al conectar las transacciones reales de VTEX.</td></tr></tbody>
      </table>
    </div>
  );
}

export function PaymentMethods({ ecommerce }: { ecommerce: string }) {
  let viewModel;
  try {
    viewModel = getPaymentMethodsViewModel(ecommerce);
  } catch {
    viewModel = {
      connection: null,
      hasData: false,
      sourceLabel: "VTEX · Pendiente de conexión",
      message: "Este ecommerce todavía no tiene una fuente VTEX configurada.",
    };
  }

  return (
    <div className="payment-methods">
      <Section title="Medios de pago" eyebrow="VTEX · Pendiente de conexión" action={<span className="status-badge status-attention">Fuente pendiente</span>}>
        <div className="geography-intro">
          <CreditCard />
          <div><strong>Cómo pagan los clientes y qué opciones financieras utilizan</strong><p>{viewModel.message}</p></div>
        </div>
        <div className="payment-kpis">
          {kpis.map((kpi) => <article key={kpi}><span>{kpi}</span><strong>—</strong><small>Pendiente de VTEX</small></article>)}
        </div>
      </Section>

      <Section title="Performance por medio de pago" eyebrow="Lectura comercial futura" className="mt-4">
        <PendingTable headers={paymentHeaders} />
      </Section>

      <div className="payment-grid">
        <Section title="Uso de cuotas" eyebrow="Distribución futura" className="mt-4"><PendingTable headers={installmentHeaders} /></Section>
        <Section title="Gateway / proveedor" eyebrow="Procesamiento futuro" className="mt-4"><PendingTable headers={providerHeaders} /></Section>
      </div>

      <Section title="Tarjeta / emisor / banco" eyebrow="Detalle financiero futuro" className="mt-4">
        <PendingTable headers={cardHeaders} />
      </Section>

      <div className="payment-grid">
        <Section title="Medio de pago × cuotas" eyebrow="Matriz futura" className="mt-4">
          <div className="payment-placeholder"><Grid3X3 /><strong>Disponible al conectar VTEX</strong><p>Podrá alternar entre pedidos y facturación.</p></div>
        </Section>
        <Section title="Oportunidades financieras" eyebrow="Insights futuros" className="mt-4">
          <div className="payment-opportunities">
            {[WalletCards, Building2, Landmark].map((Icon, index) => <article key={index}><Icon /><span>—</span><small>Regla inactiva hasta contar con datos reales</small></article>)}
          </div>
        </Section>
      </div>
      <p className="geography-source-note">Fuente prevista: VTEX · transacciones asociadas a cada pedido.</p>
    </div>
  );
}
