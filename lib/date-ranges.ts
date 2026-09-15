export type ComparableDateRange = { from: string; to: string };
export type DateComparisonMode = "previous_day" | "previous_period" | "previous_week" | "none";

const DAY_IN_MS = 86_400_000;

function asUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function shiftDate(value: string, days: number): string {
  return toIsoDate(new Date(asUtcDate(value).getTime() + days * DAY_IN_MS));
}

export function rangeDays(range: ComparableDateRange): number {
  return Math.round((asUtcDate(range.to).getTime() - asUtcDate(range.from).getTime()) / DAY_IN_MS) + 1;
}

export function rangesOverlap(first: ComparableDateRange, second: ComparableDateRange): boolean {
  return first.from <= second.to && second.from <= first.to;
}

export function comparisonRange(
  range: ComparableDateRange,
  mode: DateComparisonMode,
): ComparableDateRange | null {
  if (mode === "none") return null;
  const days = rangeDays(range);

  if (mode === "previous_day") {
    return days === 1
      ? { from: shiftDate(range.from, -1), to: shiftDate(range.to, -1) }
      : null;
  }

  if (mode === "previous_week") {
    const shifted = {
      from: shiftDate(range.from, -7),
      to: shiftDate(range.to, -7),
    };
    return rangesOverlap(range, shifted) ? null : shifted;
  }

  return {
    from: shiftDate(range.from, -days),
    to: shiftDate(range.to, -days),
  };
}

export function resolveComparisonMode(
  range: ComparableDateRange,
  selectedMode: DateComparisonMode,
): DateComparisonMode {
  if (selectedMode === "none" || selectedMode === "previous_period") return selectedMode;
  const days = rangeDays(range);
  if (selectedMode === "previous_day") return days === 1 ? selectedMode : "previous_period";
  if (selectedMode === "previous_week") return days >= 2 && days <= 7 ? selectedMode : "previous_period";
  return "previous_period";
}
