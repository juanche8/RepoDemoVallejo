import { TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { pp, rate } from "@/lib/analytics";
import { participationShares } from "@/lib/dashboard-rules";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/formatters";
import {
  categoryConversion,
} from "@/lib/integrations/ga4/categories";
import {
  ga4PercentageChange,
  ga4RateDelta,
} from "@/lib/integrations/ga4/dashboard";
import type {
  GA4CategoriesData,
  GA4CategoryMetricRow,
} from "@/lib/integrations/ga4/types";
import type { DateRange, MacroCategory, MetricTotals } from "@/types/analytics";
import type { GroupRow } from "./dashboard-types";
import { Section, Variation } from "./ui";

const colors: Record<MacroCategory, string> = {
  Calzado: "var(--gv-blue)",
  Indumentaria: "var(--gv-blue-medium)",
  Accesorios: "var(--gv-blue-dark)",
};
const headers = [
  "Macrocategoría", "Vistas", "Part. vistas", "Carritos", "Vista → carrito",
  "Checkouts", "Carrito → checkout", "Compras", "Conversión vista → compra",
  "Venta", "Unidades", "Part. venta", "Δ participación",
];

type Props = {
  rows: GroupRow[];
  current: MetricTotals;
  previous: MetricTotals;
  dailyShares: Array<Record<string, string | number>>;
  diagnostics: Array<GroupRow & { message: string }>;
  comparisonEnabled: boolean;
  range: DateRange;
  store: string;
};

type RealState =
  | { status: "idle" }
  | { status: "error"; key: string }
  | { status: "success"; key: string; data: GA4CategoriesData };

function updatedLabel(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));
}

function comparisonRow(
  data: GA4CategoriesData | null,
  name: string,
): GA4CategoryMetricRow | undefined {
  return data?.macros.find((row) => row.name === name);
}

function pointsLabel(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${formatNumber(value, 1)} p.p.`;
}

function RealCategoryPerformance({
  range,
  comparisonEnabled,
}: Pick<Props, "range" | "comparisonEnabled">) {
  const [state, setState] = useState<RealState>({ status: "idle" });
  const requestKey = `${range.from}:${range.to}:${comparisonEnabled}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/ga4/categories?dateFrom=${range.from}&dateTo=${range.to}&compare=${comparisonEnabled}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("categories unavailable");
        const data = await response.json() as GA4CategoriesData;
        setState({ status: "success", key: requestKey, data });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", key: requestKey });
      });
    return () => controller.abort();
  }, [comparisonEnabled, range.from, range.to, requestKey]);

  const status = state.status !== "idle" && state.key === requestKey
    ? state.status
    : "loading";
  if (status === "loading") {
    return <p className="attribution-note">Cargando categorías reales de GA4…</p>;
  }
  if (status === "error" || state.status !== "success") {
    return <p className="attribution-note">No se pudieron cargar los datos de categorías de GA4.</p>;
  }
  const { data } = state;
  if (!data.hasData) {
    return <p className="attribution-note">GA4 no devolvió categorías para el período seleccionado.</p>;
  }
  const compared = data.comparison?.hasData ? data.comparison : null;
  const topDetails = data.details.slice(0, 10);
  return (
    <>
      {data.comparisonError && <p className="attribution-note">Comparación no disponible.</p>}
      <Section
        title="Comparativo de macrocategorías"
        eyebrow="GA4 · Datos reales"
        action={<span className="status-badge status-healthy">Actualizado: {updatedLabel(data.updatedAt)}</span>}
      >
        <div className="table-scroll">
          <table>
            <thead><tr><th>Macrocategoría</th><th>Vistas de ítems</th><th>Carritos</th><th>Checkouts</th><th>Unidades compradas</th><th>Ingresos</th><th>Vista → compra</th><th>Δ carritos</th><th>Δ unidades</th><th>Δ ingresos</th><th>Δ conversión</th></tr></thead>
            <tbody>{data.macros.map((row) => {
              const previousRow = comparisonRow(compared, row.name);
              const conversion = categoryConversion(row);
              const conversionDelta = previousRow
                ? ga4RateDelta(
                    row.itemsPurchased,
                    row.itemsViewed,
                    previousRow.itemsPurchased,
                    previousRow.itemsViewed,
                  )
                : null;
              return <tr key={row.name}><td><strong>{row.name}</strong></td><td>{formatNumber(row.itemsViewed)}</td><td>{formatNumber(row.itemsAddedToCart)}</td><td>{formatNumber(row.itemsCheckedOut)}</td><td>{formatNumber(row.itemsPurchased)}</td><td>{formatCurrency(row.itemRevenue, true)}</td><td>{conversion === null ? "—" : formatPercentage(conversion)}</td><td><Variation value={previousRow ? ga4PercentageChange(row.itemsAddedToCart, previousRow.itemsAddedToCart) ?? undefined : undefined} /></td><td><Variation value={previousRow ? ga4PercentageChange(row.itemsPurchased, previousRow.itemsPurchased) ?? undefined : undefined} /></td><td><Variation value={previousRow ? ga4PercentageChange(row.itemRevenue, previousRow.itemRevenue) ?? undefined : undefined} /></td><td>{pointsLabel(conversionDelta)}</td></tr>;
            })}</tbody>
          </table>
        </div>
      </Section>
      <Section title="Categorías comerciales" eyebrow="itemCategory3 · Top 10 por ingresos" className="mt-4">
        {!data.detailAvailable ? <p className="attribution-note">Detalle de categorías no disponible.</p> : <div className="table-scroll"><table><thead><tr><th>Categoría</th><th>Vistas</th><th>Carritos</th><th>Checkouts</th><th>Unidades</th><th>Ingresos</th><th>Conversión</th></tr></thead><tbody>{topDetails.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{formatNumber(row.itemsViewed)}</td><td>{formatNumber(row.itemsAddedToCart)}</td><td>{formatNumber(row.itemsCheckedOut)}</td><td>{formatNumber(row.itemsPurchased)}</td><td>{formatCurrency(row.itemRevenue, true)}</td><td>{categoryConversion(row) === null ? "—" : formatPercentage(categoryConversion(row) ?? 0)}</td></tr>)}</tbody></table></div>}
      </Section>
      {data.detailAvailable && <Section title="Género / audiencia" eyebrow="itemCategory · Dimensión secundaria" className="mt-4"><div className="table-scroll"><table><thead><tr><th>Audiencia</th><th>Vistas</th><th>Carritos</th><th>Unidades</th><th>Ingresos</th></tr></thead><tbody>{data.audiences.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{formatNumber(row.itemsViewed)}</td><td>{formatNumber(row.itemsAddedToCart)}</td><td>{formatNumber(row.itemsPurchased)}</td><td>{formatCurrency(row.itemRevenue, true)}</td></tr>)}</tbody></table></div></Section>}
      {data.uncategorizedPercentage >= 1 && <p className="attribution-note">Sin categoría: {formatPercentage(data.uncategorizedPercentage)} de las vistas.</p>}
    </>
  );
}

export function CategoryPerformance({ rows, current, previous, dailyShares, diagnostics, comparisonEnabled, range, store }: Props) {
  if (store === "Sportotal") {
    return <RealCategoryPerformance range={range} comparisonEnabled={comparisonEnabled} />;
  }
  const viewShares = participationShares(rows.map((row) => row.productViews));
  return (
    <>
      <Section title="Evolución de participación en ventas" eyebrow="Calzado · Indumentaria · Accesorios">
        <div className="chart-large">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyShares}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" />
              <YAxis unit="%" />
              <Tooltip formatter={(value) => formatPercentage(Number(value))} />
              <Legend />
              {(Object.keys(colors) as MacroCategory[]).map((macro) => (
                <Line key={macro} dataKey={macro} stroke={colors[macro]} strokeWidth={3} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>
      <Section title="Comparativo de macrocategorías" eyebrow="El análisis segmentado comienza en vistas de producto" className="mt-4">
        <div className="table-scroll">
          <table>
            <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, index) => {
                const share = rate(row.revenue, current.revenue);
                const previousShare = rate(row.previous.revenue, previous.revenue);
                const delta = comparisonEnabled ? pp(share, previousShare) : null;
                return (
                  <tr key={row.name}>
                    <td><strong>{row.name}</strong></td>
                    <td>{formatNumber(row.productViews)}</td>
                    <td>{formatPercentage(viewShares[index])}</td>
                    <td>{formatNumber(row.addToCarts)}</td>
                    <td>{formatPercentage(rate(row.addToCarts, row.productViews))}</td>
                    <td>{formatNumber(row.beginCheckouts)}</td>
                    <td>{formatPercentage(rate(row.beginCheckouts, row.addToCarts))}</td>
                    <td>{formatNumber(row.purchases)}</td>
                    <td>{formatPercentage(rate(row.purchases, row.productViews))}</td>
                    <td>{formatCurrency(row.revenue, true)}</td>
                    <td>{formatNumber(row.units)}</td>
                    <td>{formatPercentage(share)}</td>
                    <td>{delta === null ? <span className="variation-neutral">—</span> : <span className={delta >= 0 ? "variation-positive" : "variation-negative"}>{delta > 0 ? "+" : ""}{formatPercentage(delta)} pp</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
      <div className="diagnostic-grid">
        {diagnostics.map((item) => (
          <article key={item.name}><TrendingUp /><strong>{item.name}</strong><p>{item.message}</p></article>
        ))}
      </div>
    </>
  );
}
