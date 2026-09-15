import { PackageSearch, Tags, TrendingDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { pp, rate } from "@/lib/analytics";
import { averageRevenuePerUnit, itemConversion } from "@/lib/integrations/ga4/brands-products";
import { ga4PercentageChange, ga4RateDelta } from "@/lib/integrations/ga4/dashboard";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/formatters";
import type {
  GA4BrandProductPageData,
  GA4CategoryMetricRow,
  GA4ProductSortKey,
} from "@/lib/integrations/ga4/types";
import type { DateRange, MetricTotals, ProductPerformance as ProductRow } from "@/types/analytics";
import type { GroupRow } from "./dashboard-types";
import { Section, Variation } from "./ui";

type Props = { rows: ProductRow[]; brands: GroupRow[]; current: MetricTotals; previous: MetricTotals; losses: ProductRow[]; comparisonEnabled: boolean; range: DateRange; store: string };
type RealState = { status: "idle" } | { status: "error"; key: string } | { status: "success"; key: string; data: GA4BrandProductPageData };
type SortKey = "itemRevenue" | "itemsPurchased" | "conversion";

const shareDelta = (row: ProductRow | GroupRow, current: MetricTotals, previous: MetricTotals) => pp(rate(row.revenue, current.revenue), rate(row.previous.revenue, previous.revenue));
const updatedLabel = (value: string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(value));
const sortRows = <T extends GA4CategoryMetricRow>(rows: T[], key: SortKey, direction: "asc" | "desc") => {
  const factor = direction === "desc" ? -1 : 1;
  return [...rows].sort((left, right) => {
    const leftValue = key === "conversion" ? itemConversion(left) ?? -1 : left[key];
    const rightValue = key === "conversion" ? itemConversion(right) ?? -1 : right[key];
    return (leftValue - rightValue) * factor;
  });
};
const points = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${formatNumber(value, 1)} p.p.`;

function RealProductPerformance({ range, comparisonEnabled }: Pick<Props, "range" | "comparisonEnabled">) {
  const [state, setState] = useState<RealState>({ status: "idle" });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [brandSearch, setBrandSearch] = useState("");
  const [brandSort, setBrandSort] = useState<SortKey>("itemRevenue");
  const [brandDirection, setBrandDirection] = useState<"asc" | "desc">("desc");
  const [productSort, setProductSort] = useState<GA4ProductSortKey>("revenue");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(50);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [search]);
  const query = new URLSearchParams({
    dateFrom: range.from,
    dateTo: range.to,
    compare: String(comparisonEnabled),
    page: String(page),
    pageSize: String(pageSize),
    search: debouncedSearch,
    sortBy: productSort,
    sortDirection,
  }).toString();
  const requestKey = query;
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/ga4/brands-products?${query}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("unavailable"); setState({ status: "success", key: requestKey, data: await response.json() as GA4BrandProductPageData }); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setState({ status: "error", key: requestKey }); });
    return () => controller.abort();
  }, [query, requestKey]);
  const status = state.status !== "idle" && state.key === requestKey ? state.status : "loading";
  const data = state.status === "success" && state.key === requestKey ? state.data : null;
  const compared = data?.comparison?.hasData ? data.comparison : null;
  const brandRows = useMemo(() => {
    if (!data) return [];
    const searchTerm = brandSearch.trim().toLocaleLowerCase("es-AR");
    const filtered = searchTerm
      ? data.brands.filter((row) => row.name.toLocaleLowerCase("es-AR").includes(searchTerm))
      : data.brands;
    return sortRows(filtered, brandSort, brandDirection);
  }, [brandDirection, brandSearch, brandSort, data]);
  const productRows = data?.productPage.items ?? [];
  if (status === "loading") return <p className="attribution-note">Cargando marcas y productos reales de GA4…</p>;
  if (status === "error" || !data) return <p className="attribution-note">No se pudieron cargar marcas y productos de GA4.</p>;
  if (!data.hasData) return <p className="attribution-note">GA4 no devolvió marcas para el período seleccionado.</p>;
  const previousBrands = new Map((compared?.brands ?? []).map((row) => [row.name.toLocaleLowerCase("es-AR"), row]));
  const { highInterest, highConversion, cartFriction } = data.opportunities;
  return <>
    {data.comparisonError && <p className="attribution-note">Comparación no disponible.</p>}
    <div className="diagnostic-grid"><article><PackageSearch /><strong>Alto interés / baja conversión</strong><p>{highInterest.map((row) => row.itemName).join(", ") || "Sin casos relativos"}</p></article><article><Tags /><strong>Alta conversión / bajo tráfico</strong><p>{highConversion.map((row) => row.itemName).join(", ") || "Sin casos relativos"}</p></article><article><TrendingDown /><strong>Alto carrito / bajo checkout</strong><p>{cartFriction.map((row) => row.itemName).join(", ") || "Sin casos relativos"}</p></article></div>
    <Section title="Performance por marca" eyebrow="GA4 · Datos reales" action={<span className="status-badge status-healthy">Actualizado: {updatedLabel(data.updatedAt)}</span>}>
      <div className="performance-toolbar performance-toolbar-brand">
        <label><span>Buscar marca</span><input value={brandSearch} onChange={(event) => setBrandSearch(event.target.value)} placeholder="Nombre de marca" /></label>
        <label><span>Ordenar por</span><select value={brandSort} onChange={(event) => setBrandSort(event.target.value as SortKey)}><option value="itemRevenue">Ingresos</option><option value="itemsPurchased">Unidades</option><option value="conversion">Ratio compra/vista</option></select></label>
        <label><span>Dirección</span><select value={brandDirection} onChange={(event) => setBrandDirection(event.target.value as "asc" | "desc")}><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></label>
        <span className="toolbar-result">{formatNumber(brandRows.length)} marcas</span>
      </div>
      <div className="table-scroll performance-table"><table><thead><tr><th>Marca</th><th>Ingresos</th><th>Unidades</th><th title="Unidades compradas ÷ vistas del producto. GA4 contabiliza eventos, no usuarios únicos.">Ratio compra/vista</th><th>Vistas</th><th>Carritos</th><th>Checkouts</th><th>Ingreso medio</th><th>Δ ingresos</th><th>Δ unidades</th><th>Δ ratio</th></tr></thead><tbody>{brandRows.slice(0, 30).map((row) => { const prior = previousBrands.get(row.name.toLocaleLowerCase("es-AR")); return <tr key={row.name}><td><strong>{row.name}</strong></td><td>{formatCurrency(row.itemRevenue, true)}</td><td>{formatNumber(row.itemsPurchased)}</td><td title="Unidades compradas ÷ vistas del producto">{itemConversion(row) === null ? "—" : formatPercentage(itemConversion(row) ?? 0)}</td><td>{formatNumber(row.itemsViewed)}</td><td>{formatNumber(row.itemsAddedToCart)}</td><td>{formatNumber(row.itemsCheckedOut)}</td><td>{averageRevenuePerUnit(row) === null ? "—" : formatCurrency(averageRevenuePerUnit(row) ?? 0, true)}</td><td><Variation value={prior ? ga4PercentageChange(row.itemRevenue, prior.itemRevenue) ?? undefined : undefined} /></td><td><Variation value={prior ? ga4PercentageChange(row.itemsPurchased, prior.itemsPurchased) ?? undefined : undefined} /></td><td>{points(prior ? ga4RateDelta(row.itemsPurchased, row.itemsViewed, prior.itemsPurchased, prior.itemsViewed) : null)}</td></tr>; })}</tbody></table></div>
      <p className="metric-help">Ratio compra/vista = unidades compradas ÷ vistas del producto. Puede superar 100% porque GA4 registra eventos y cantidades, no una conversión de usuarios únicos.</p>
    </Section>
    <Section title="Performance por producto" eyebrow={`${formatNumber(data.productCount)} productos · GA4 real`} className="mt-4">
      {!data.productDetailAvailable ? <p className="attribution-note">Detalle de productos no disponible.</p> : <><div className="performance-toolbar performance-toolbar-product"><label className="toolbar-search"><span>Buscar</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID, producto o marca" /></label><label><span>Ordenar por</span><select value={productSort} onChange={(event) => { setProductSort(event.target.value as GA4ProductSortKey); setPage(1); }}><option value="revenue">Ingresos</option><option value="purchased">Unidades</option><option value="conversion">Ratio compra/vista</option><option value="views">Vistas</option><option value="addedToCart">Carritos</option><option value="checkedOut">Checkouts</option><option value="itemName">Producto</option><option value="itemBrand">Marca</option></select></label><label><span>Dirección</span><select value={sortDirection} onChange={(event) => { setSortDirection(event.target.value as "asc" | "desc"); setPage(1); }}><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></label><label><span>Por página</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as 25 | 50 | 100); setPage(1); }}><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label></div>{data.productPage.totalItems === 0 ? <p className="attribution-note">{debouncedSearch ? "No hay resultados para esta búsqueda." : "Sin productos para este período."}</p> : <><div className="product-results-bar"><span>Mostrando {(data.productPage.page - 1) * data.productPage.pageSize + 1}–{Math.min(data.productPage.page * data.productPage.pageSize, data.productPage.totalItems)} de {formatNumber(data.productPage.totalItems)} productos</span><div className="pagination-controls"><button className="button-secondary" disabled={!data.productPage.hasPreviousPage} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</button><span>Página {data.productPage.page} de {data.productPage.totalPages}</span><button className="button-secondary" disabled={!data.productPage.hasNextPage} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div></div><div className="table-scroll performance-table"><table><thead><tr><th>Producto</th><th>ID</th><th>Marca</th><th>Macrocategoría</th><th>Categoría</th><th>Ingresos</th><th>Unidades</th><th title="Unidades compradas ÷ vistas del producto. GA4 contabiliza eventos, no usuarios únicos.">Ratio compra/vista</th><th>Vistas</th><th>Carritos</th><th>Checkouts</th><th>Δ ingresos</th><th>Δ unidades</th><th>Δ ratio</th></tr></thead><tbody>{productRows.map((row) => { const prior = row.previous; return <tr key={row.itemId}><td><strong>{row.itemName}</strong></td><td>{row.itemId}</td><td>{row.itemBrand}</td><td>{row.macroCategory}</td><td>{row.category}</td><td>{formatCurrency(row.itemRevenue, true)}</td><td>{formatNumber(row.itemsPurchased)}</td><td title="Unidades compradas ÷ vistas del producto">{itemConversion(row) === null ? "—" : formatPercentage(itemConversion(row) ?? 0)}</td><td>{formatNumber(row.itemsViewed)}</td><td>{formatNumber(row.itemsAddedToCart)}</td><td>{formatNumber(row.itemsCheckedOut)}</td><td><Variation value={prior ? ga4PercentageChange(row.itemRevenue, prior.itemRevenue) ?? undefined : undefined} /></td><td><Variation value={prior ? ga4PercentageChange(row.itemsPurchased, prior.itemsPurchased) ?? undefined : undefined} /></td><td>{points(prior ? ga4RateDelta(row.itemsPurchased, row.itemsViewed, prior.itemsPurchased, prior.itemsViewed) : null)}</td></tr>; })}</tbody></table></div><p className="metric-help">Ratio compra/vista = unidades compradas ÷ vistas del producto. No representa usuarios únicos y puede superar 100% cuando se compran varias unidades.</p><div className="pagination-controls pagination-bottom"><button className="button-secondary" disabled={!data.productPage.hasPreviousPage} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</button><span>Página {data.productPage.page} de {data.productPage.totalPages}</span><button className="button-secondary" disabled={!data.productPage.hasNextPage} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div></>}</>}
    </Section>
  </>;
}

export function ProductPerformance({ rows, brands, current, previous, losses, comparisonEnabled, range, store }: Props) {
  if (store === "Sportotal") return <RealProductPerformance range={range} comparisonEnabled={comparisonEnabled} />;
  const winningBrands = comparisonEnabled ? brands.filter((brand) => shareDelta(brand, current, previous) > 0) : [];
  const losingBrands = comparisonEnabled ? brands.filter((brand) => shareDelta(brand, current, previous) < 0) : [];
  const sortedProducts = [...rows].sort((a, b) => b.productViews - a.productViews).slice(0, 14);
  return <><div className="diagnostic-grid">{comparisonEnabled ? <><article><Tags /><strong>Marcas que ganan participación</strong><p>{winningBrands.slice(0, 3).map((brand) => brand.name).join(", ") || "Sin cambios"}</p></article><article><TrendingDown /><strong>Marcas que pierden participación</strong><p>{losingBrands.slice(0, 3).map((brand) => brand.name).join(", ") || "Sin cambios"}</p></article><article><PackageSearch /><strong>Productos que explican la caída</strong><p>{losses.slice(0, 2).map((product) => product.name).join(", ") || "Sin caídas relevantes"}</p></article></> : <article><Tags /><strong>Comparación temporal</strong><p>Sin comparación</p></article>}</div><Section title="Conversión por producto" eyebrow={`${rows.length} resultados · El recorrido comienza en vistas`}><div className="table-scroll"><table><thead><tr>{["Producto", "Vistas", "Vista → carrito", "Carrito → checkout", "Checkout → compra", "Conversión final", "Part. venta", "Δ participación", "Stock", "Cobertura"].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{sortedProducts.map((product) => { const share = rate(product.revenue, current.revenue); const delta = comparisonEnabled ? shareDelta(product, current, previous) : null; return <tr key={product.productId}><td><strong>{product.name}</strong><small>{product.brand} · {product.category}</small></td><td>{formatNumber(product.productViews)}</td><td>{formatPercentage(rate(product.addToCarts, product.productViews))}</td><td>{formatPercentage(rate(product.beginCheckouts, product.addToCarts))}</td><td>{formatPercentage(rate(product.purchases, product.beginCheckouts))}</td><td>{formatPercentage(rate(product.purchases, product.productViews))}</td><td>{formatPercentage(share)}</td><td>{delta === null ? <span className="variation-neutral">—</span> : <span className={delta >= 0 ? "variation-positive" : "variation-negative"}>{delta > 0 ? "+" : ""}{formatPercentage(delta)} pp</span>}</td><td>{formatNumber(product.totalStock)}</td><td>{product.coverDays === null ? "Sin rotación" : `${formatNumber(product.coverDays)} días`}</td></tr>; })}</tbody></table></div></Section></>;
}
