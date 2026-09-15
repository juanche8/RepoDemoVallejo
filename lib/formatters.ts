export const APP_LOCALE = "es-AR" as const;

const normalizeZero = (value: number) => Object.is(value, -0) ? 0 : value;
const decimal = (value: number, digits: number) => {
  const fixed = normalizeZero(value).toFixed(digits);
  const [integer, fraction] = fixed.split(".");
  return fraction ? `${integer},${fraction}` : integer;
};

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "0";
  const sign = value < 0 ? "-" : "";
  const fixed = Math.abs(normalizeZero(value)).toFixed(decimals);
  const [integer, fraction] = fixed.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${grouped}${fraction ? `,${fraction}` : ""}`;
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const absolute = Math.abs(value);
  const unit = absolute >= 1_000_000_000
    ? { divisor: 1_000_000_000, suffix: "mil M" }
    : absolute >= 1_000_000
      ? { divisor: 1_000_000, suffix: "M" }
      : absolute >= 1_000
        ? { divisor: 1_000, suffix: "mil" }
        : null;
  if (!unit) return formatNumber(value);
  const scaled = value / unit.divisor;
  const digits = Math.abs(scaled) < 10 && !Number.isInteger(scaled) ? 1 : 0;
  return `${decimal(scaled, digits)} ${unit.suffix}`;
}

export function formatCurrency(value: number, compact = false): string {
  return `$ ${compact ? formatCompact(value) : formatNumber(value)}`;
}

export function formatPercentage(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "0,0%";
  return `${decimal(value, decimals)}%`;
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return year && month && day ? `${day}/${month}/${year}` : isoDate;
}

export function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return month && day ? `${day}/${month}` : isoDate;
}
