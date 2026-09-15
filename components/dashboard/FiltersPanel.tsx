import { ChevronDown, X } from "lucide-react";
import { presetRange, rangeDays } from "@/lib/analytics";
import { dependentProductOptions } from "@/lib/dashboard-rules";
import { DATA_TODAY } from "@/lib/mock-data";
import type {
  ComparisonMode,
  DatePreset,
  DateRange,
  Filters,
  Product,
} from "@/types/analytics";

const labels: Record<DatePreset, string> = {
  today: "Hoy",
  yesterday: "Ayer",
  last7: "Últimos 7 días",
  last30: "Últimos 30 días",
  month: "Mes actual",
  custom: "Rango personalizado",
};

type SelectProps = {
  label: string;
  value: string;
  options: Array<string | { value: string; label: string }>;
  onChange: (value: string) => void;
};

function Select({ label, value, options, onChange }: SelectProps) {
  const all = ["Macrocategoría", "Categoría", "Marca", "Provincia"].includes(label)
    ? "Todas"
    : "Todos";

  return (
    <label className="filter-field">
      <span>{label}</span>
      <span className="filter-control">
        <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
          <option>{all}</option>
          {options.map((option) => {
            const value = typeof option === "string" ? option : option.value;
            const text = typeof option === "string" ? option : option.label;
            return <option key={value} value={value}>{text}</option>;
          })}
        </select>
        <ChevronDown aria-hidden="true" />
      </span>
    </label>
  );
}

type Props = {
  filters: Filters;
  products: Product[];
  commercialChannels: string[];
  acquisitionChannels: string[];
  provinces: string[];
  preset: DatePreset;
  custom: DateRange;
  compare: ComparisonMode;
  moreFilters: boolean;
  mobileOpen: boolean;
  onFilter: (key: keyof Filters, value: string) => void;
  onPreset: (value: DatePreset) => void;
  onCustom: (value: DateRange) => void;
  onCompare: (value: ComparisonMode) => void;
  onMoreFilters: () => void;
  onCloseMobile: () => void;
};

export function FiltersPanel(props: Props) {
  const options = dependentProductOptions(props.filters, props.products);
  const singleDay = rangeDays(presetRange(props.preset, props.custom)) === 1;
  const selectedDays = rangeDays(presetRange(props.preset, props.custom));

  const dateControls = (
    <div className="date-controls">
      <div>
        <span>Rango de fechas</span>
        <div>
          {(Object.keys(labels) as DatePreset[]).map((value) => (
            <button key={value} className={props.preset === value ? "active" : ""} onClick={() => props.onPreset(value)}>{labels[value]}</button>
          ))}
        </div>
        {props.preset === "custom" && (
          <div className="custom-dates">
            <input type="date" aria-label="Fecha desde" value={props.custom.from} max={props.custom.to} onChange={(event) => props.onCustom({ ...props.custom, from: event.target.value })} />
            <input type="date" aria-label="Fecha hasta" value={props.custom.to} min={props.custom.from} max={DATA_TODAY} onChange={(event) => props.onCustom({ ...props.custom, to: event.target.value })} />
          </div>
        )}
      </div>
      <label>
        <span>Comparación</span>
        <select value={props.compare} onChange={(event) => props.onCompare(event.target.value as ComparisonMode)}>
          {singleDay && <option value="previous_day">Día anterior</option>}
          <option value="previous_period">Período anterior equivalente</option>
          {!singleDay && selectedDays <= 7 && <option value="previous_week">Mismos días de la semana anterior</option>}
          <option value="none">Sin comparación</option>
        </select>
      </label>
    </div>
  );
  const primaryFilters = (
    <div className="filter-grid filter-grid-primary">
      <Select label="Macrocategoría" value={props.filters.macroCategory} options={options.macroCategories} onChange={(value) => props.onFilter("macroCategory", value)} />
      <Select label="Categoría" value={props.filters.category} options={options.categories} onChange={(value) => props.onFilter("category", value)} />
      <Select label="Marca" value={props.filters.brand} options={options.brands} onChange={(value) => props.onFilter("brand", value)} />
    </div>
  );
  const secondaryFilters = (
    <div className="filter-grid filter-grid-secondary">
      <Select label="Producto" value={props.filters.product} options={options.products} onChange={(value) => props.onFilter("product", value)} />
      <Select label="Canal comercial" value={props.filters.commercialChannel} options={props.commercialChannels} onChange={(value) => props.onFilter("commercialChannel", value)} />
      <Select label="Canal de adquisición" value={props.filters.acquisitionChannel} options={props.acquisitionChannels} onChange={(value) => props.onFilter("acquisitionChannel", value)} />
      <Select label="Provincia" value={props.filters.province} options={props.provinces} onChange={(value) => props.onFilter("province", value)} />
      <Select label="Dispositivo" value={props.filters.device} options={["Desktop", "Mobile", "Tablet"]} onChange={(value) => props.onFilter("device", value)} />
    </div>
  );
  const body = (
    <>
      {dateControls}
      {primaryFilters}
      <button className="more-filters-toggle" type="button" aria-expanded={props.moreFilters} onClick={props.onMoreFilters}>Más filtros<ChevronDown aria-hidden="true" /></button>
      {props.moreFilters && <div className="more-filters-panel">{secondaryFilters}</div>}
    </>
  );

  return (
    <>
      <section className="filter-panel">{body}</section>
      {props.mobileOpen && (
        <div className="mobile-filter-overlay">
          <div>
            <button className="close" onClick={props.onCloseMobile}><X /></button>
            {body}
            <button className="apply" onClick={props.onCloseMobile}>Aplicar filtros</button>
          </div>
        </div>
      )}
    </>
  );
}
