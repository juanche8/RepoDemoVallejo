"use client";

import { Building2, ChevronDown } from "lucide-react";

const syncSources = [
  { source: "GA4", time: "09:42", status: "Sincronizado" },
  { source: "VTEX", time: "09:38", status: "Sincronizado" },
  { source: "Meta Ads", time: "09:35", status: "Simulado" },
  { source: "Google Ads", time: "09:36", status: "Simulado" },
] as const;

type Props = {
  store: string;
  onStoreChange: (value: string) => void;
};

export function InstitutionalHeader({ store, onStoreChange }: Props) {
  return (
    <header className="institutional-header">
      <div className="logo-placeholder" aria-label="Espacio reservado para el logo de Grupo Vallejo">
        <Building2 aria-hidden="true" />
        <span>Logo</span>
      </div>
      <div className="brand-heading">
        <p>Grupo Vallejo</p>
        <h1>Radar Ecommerce</h1>
        <span>Inteligencia de conversión y producto</span>
      </div>
      <div className="header-actions">
        <div className="sync-status" aria-label="Estado simulado de sincronización">
          {syncSources.map((item) => (
            <span key={item.source} title={`${item.source}: ${item.status} a las ${item.time}`}>
              <b>{item.source}</b>
              <small>{item.time} · {item.status}</small>
            </span>
          ))}
        </div>
        <label className="header-store">
          <span>Ecommerce</span>
          <span className="select-wrap">
            <select value={store} onChange={(event) => onStoreChange(event.target.value)} aria-label="Ecommerce">
              <option>Todos</option><option>Sportotal</option><option>Vallejo Calzados</option><option>Freekick</option>
            </select>
            <ChevronDown aria-hidden="true" />
          </span>
        </label>
      </div>
    </header>
  );
}
