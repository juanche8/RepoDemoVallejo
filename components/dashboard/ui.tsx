"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/formatters";

export const money = formatCurrency;
export const num = formatNumber;
export const pct = formatPercentage;

export function Variation({ value }: { value: number | null | undefined }) {
  if (value === undefined) return <span className="variation-neutral">—</span>;
  if (value === null) return <span className="variation-neutral">Nuevo</span>;
  const up = value > 0;
  const flat = Math.abs(value) < 0.05;
  return (
    <span className={`inline-flex items-center gap-1 font-extrabold ${flat ? "variation-neutral" : up ? "variation-positive" : "variation-negative"}`}>
      {flat ? <Minus className="h-3 w-3" /> : up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {formatPercentage(Math.abs(value))}
    </span>
  );
}

type SectionProps = {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Section({ title, eyebrow, action, children, className = "" }: SectionProps) {
  return (
    <section className={`card p-5 ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>{eyebrow && <p className="section-eyebrow mb-1 text-[9px] font-extrabold uppercase tracking-[.18em]">{eyebrow}</p>}<h2 className="display text-base font-bold">{title}</h2></div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ text = "No hay datos para los filtros seleccionados." }: { text?: string }) {
  return <div className="grid min-h-40 place-items-center rounded-xl bg-[#f7f8f5] p-6 text-center text-xs text-[#737c74]">{text}</div>;
}
