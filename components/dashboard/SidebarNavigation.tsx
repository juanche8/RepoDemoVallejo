import { AlertTriangle, BarChart3, ChevronDown, CreditCard, Funnel, MapPin, Sparkles, Tags } from "lucide-react";
import { tabs, type Tab } from "./dashboard-types";

const icons = [Funnel, BarChart3, Tags, MapPin, CreditCard, BarChart3, AlertTriangle, Sparkles];

export function SidebarNavigation({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <>
      <aside className="radar-sidebar">
        <div className="radar-mark">RE</div>
        {tabs.map((tab, index) => {
          const Icon = icons[index];
          return (
            <button key={tab} className={active === tab ? "active" : ""} onClick={() => onChange(tab)} aria-label={tab} title={tab}>
              <Icon />
              <span>{tab}</span>
            </button>
          );
        })}
      </aside>
      <label className="mobile-nav">
        <span>Sección</span>
        <select aria-label="Sección" value={active} onChange={(event) => onChange(event.target.value as Tab)}>
          {tabs.map((tab) => <option key={tab}>{tab}</option>)}
        </select>
        <ChevronDown aria-hidden="true" />
      </label>
    </>
  );
}
