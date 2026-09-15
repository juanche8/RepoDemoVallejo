"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/formatters";
import { metaChange, metaTotals } from "@/lib/integrations/meta-ads/normalize";
import type { MetaAdsData, MetaCampaignMetric } from "@/lib/integrations/meta-ads/types";
import type { DateRange, Store } from "@/types/analytics";
import type { AdPlatform } from "@/types/paid-media";
import { Empty, Section, Variation } from "./ui";

type Props = {
  store: Store;
  range: DateRange;
  compareRange: DateRange | null;
  platform: AdPlatform | "Todas";
  campaign: string;
  onPlatformChange: (value: AdPlatform | "Todas") => void;
  onCampaignChange: (value: string) => void;
};

type State =
  | { status: "loading"; key: string }
  | { status: "error"; key: string; message: string }
  | { status: "success"; key: string; data: MetaAdsData };

type PublicMetaError = {
  meta_connection_status?: string;
  message?: string;
};

function updatedLabel(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));
}

function ratioLabel(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)}×`;
}

function Kpi({
  label,
  value,
  change,
  source,
}: {
  label: string;
  value: string;
  change?: number | null;
  source?: string;
}) {
  return (
    <article className="paid-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {source && <small>{source}</small>}
      {change !== undefined && <Variation value={change ?? undefined} />}
    </article>
  );
}

export function MetaPaidMediaPanel(props: Props) {
  const compare = props.compareRange !== null;
  const requestKey = `${props.store}:${props.range.from}:${props.range.to}:${compare}`;
  const [state, setState] = useState<State>({ status: "loading", key: requestKey });

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      store: props.store,
      dateFrom: props.range.from,
      dateTo: props.range.to,
      compare: String(compare),
    });
    fetch(`/api/meta-ads/insights?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as PublicMetaError;
          setState({
            status: "error",
            key: requestKey,
            message: payload.message ?? "Meta Ads está temporalmente no disponible.",
          });
          return;
        }
        setState({ status: "success", key: requestKey, data: await response.json() as MetaAdsData });
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({
            status: "error",
            key: requestKey,
            message: "Meta Ads está temporalmente no disponible.",
          });
        }
      });
    return () => controller.abort();
  }, [compare, props.range.from, props.range.to, props.store, requestKey]);

  const data = state.status === "success" && state.key === requestKey ? state.data : null;
  const campaignOptions = data?.campaigns.map((row) => row.campaignName) ?? [];
  const effectiveCampaign = campaignOptions.includes(props.campaign) ? props.campaign : "Todas";
  const localFilters = (
    <div className="paid-local-filters">
      <label>
        Plataforma
        <select value={props.platform} onChange={(event) => {
          props.onPlatformChange(event.target.value as AdPlatform | "Todas");
          props.onCampaignChange("Todas");
        }}>
          <option>Todas</option>
          <option>Meta Ads</option>
          <option>Google Ads</option>
        </select>
      </label>
      <label>
        Campaña
        <select value={effectiveCampaign} onChange={(event) => props.onCampaignChange(event.target.value)} disabled={props.platform === "Google Ads"}>
          <option>Todas</option>
          {campaignOptions.map((campaignName) => <option key={campaignName}>{campaignName}</option>)}
        </select>
      </label>
    </div>
  );

  if (props.platform === "Google Ads") {
    return <Section title="Paid Media" eyebrow="Google Ads · Conexión pendiente" action={localFilters}><Empty text="Google Ads todavía no tiene una fuente de datos conectada." /></Section>;
  }
  if (state.status === "loading" || state.key !== requestKey) {
    return <Section title="Paid Media" eyebrow="Meta Ads · Datos reales" action={localFilters}><p className="attribution-note">Cargando datos reales de Meta Ads…</p></Section>;
  }
  if (state.status === "error" || !data) {
    const message = state.status === "error"
      ? state.message
      : "Meta Ads está temporalmente no disponible.";
    return <Section title="Paid Media" eyebrow="Meta Ads · Datos reales" action={localFilters}><Empty text={message} /></Section>;
  }

  const campaigns = effectiveCampaign === "Todas"
    ? data.campaigns
    : data.campaigns.filter((row) => row.campaignName === effectiveCampaign);
  const previousCampaigns = effectiveCampaign === "Todas"
    ? data.comparison?.campaigns ?? []
    : (data.comparison?.campaigns ?? []).filter((row) => row.campaignName === effectiveCampaign);
  const totals = effectiveCampaign === "Todas"
    ? data.totals
    : metaTotals(campaigns, null);
  const previous = effectiveCampaign === "Todas"
    ? data.comparison?.totals ?? null
    : metaTotals(previousCampaigns, null);
  const previousById = new Map(previousCampaigns.map((row) => [row.campaignId, row]));

  return (
    <div className="paid-media-view">
      <Section title="Paid Media" eyebrow="Meta Ads · Datos reales" action={localFilters}>
        <p className="attribution-note">Meta es la fuente de atribución publicitaria. El valor atribuido por Meta no se suma a los ingresos ecommerce de GA4.</p>
        {data.comparisonError && <p className="attribution-note">Comparación no disponible.</p>}
        <div className="paid-kpi-grid">
          <Kpi label="Inversión" value={formatCurrency(totals.spend, true)} change={previous ? metaChange(totals.spend, previous.spend) : undefined} />
          <Kpi label="Impresiones" value={formatNumber(totals.impressions)} change={previous ? metaChange(totals.impressions, previous.impressions) : undefined} />
          <Kpi label="Alcance" value={totals.reach === null ? "No disponible" : formatNumber(totals.reach)} source={effectiveCampaign === "Todas" ? "Consulta agregada de cuenta" : "No aditivo por campaña"} />
          <Kpi label="Clics" value={formatNumber(totals.clicks)} change={previous ? metaChange(totals.clicks, previous.clicks) : undefined} />
          <Kpi label="CTR" value={totals.ctr === null ? "—" : formatPercentage(totals.ctr * 100)} />
          <Kpi label="CPC" value={totals.cpc === null ? "—" : formatCurrency(totals.cpc)} />
          <Kpi label="Compras atribuidas" value={formatNumber(totals.purchases)} source="Meta Pixel purchase" change={previous ? metaChange(totals.purchases, previous.purchases) : undefined} />
          <Kpi label="Valor atribuido por Meta" value={formatCurrency(totals.attributedPurchaseValue, true)} source="No es ingreso ecommerce adicional" change={previous ? metaChange(totals.attributedPurchaseValue, previous.attributedPurchaseValue) : undefined} />
          <Kpi label="CPA" value={totals.cpa === null ? "—" : formatCurrency(totals.cpa)} change={previous ? metaChange(totals.cpa, previous.cpa) : undefined} />
          <Kpi label="ROAS" value={ratioLabel(totals.roas)} change={previous ? metaChange(totals.roas, previous.roas) : undefined} />
        </div>
        <p className="attribution-note">Diagnóstico interno: omni_purchase {formatNumber(totals.omniPurchases)}; valor omni {formatCurrency(totals.omniPurchaseValue, true)}. Actualizado: {updatedLabel(data.updatedAt)}.</p>
      </Section>

      <Section title="Performance por campaña" eyebrow="Meta Ads · Ordenado por inversión" className="mt-4">
        {campaigns.length === 0 ? <Empty text="No hay campañas para el período seleccionado." /> : <div className="table-scroll"><table><thead><tr>{["Campaña", "Inversión", "Impresiones", "Clics", "Compras", "Valor atribuido", "CPA", "ROAS", "Δ inversión", "Δ compras", "Δ valor", "Δ CPA", "Δ ROAS"].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{campaigns.map((row: MetaCampaignMetric) => { const old = previousById.get(row.campaignId); return <tr key={row.campaignId}><td><strong>{row.campaignName}</strong></td><td>{formatCurrency(row.spend, true)}</td><td>{formatNumber(row.impressions)}</td><td>{formatNumber(row.clicks)}</td><td>{formatNumber(row.purchases)}</td><td>{formatCurrency(row.attributedPurchaseValue, true)}</td><td>{row.cpa === null ? "—" : formatCurrency(row.cpa)}</td><td>{ratioLabel(row.roas)}</td><td><Variation value={old ? metaChange(row.spend, old.spend) ?? undefined : undefined} /></td><td><Variation value={old ? metaChange(row.purchases, old.purchases) ?? undefined : undefined} /></td><td><Variation value={old ? metaChange(row.attributedPurchaseValue, old.attributedPurchaseValue) ?? undefined : undefined} /></td><td><Variation value={old ? metaChange(row.cpa, old.cpa) ?? undefined : undefined} /></td><td><Variation value={old ? metaChange(row.roas, old.roas) ?? undefined : undefined} /></td></tr>; })}</tbody></table></div>}
      </Section>

      {props.platform === "Todas" && <Section title="Google Ads" eyebrow="Conexión pendiente" className="mt-4"><p className="attribution-note">La estructura está preparada, pero todavía no se muestran datos simulados ni reales de Google Ads.</p></Section>}
    </div>
  );
}
