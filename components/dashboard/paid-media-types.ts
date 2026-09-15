import { sumPaid } from "@/lib/paid-media-analytics";
import type { AdPlatform, PaidMediaMetric, PaidMediaTotals } from "@/types/paid-media";

export type PaidGroupRow = {
  key: string;
  label: string;
  platform?: AdPlatform;
  objective?: string;
  rows: PaidMediaMetric[];
  current: PaidMediaTotals;
  previous: PaidMediaTotals;
};

export function groupPaidRows(
  current: PaidMediaMetric[], previous: PaidMediaMetric[], key: keyof PaidMediaMetric,
): PaidGroupRow[] {
  return [...new Set(current.map((row) => String(row[key])))].map((value) => {
    const rows = current.filter((row) => String(row[key]) === value);
    const oldRows = previous.filter((row) => String(row[key]) === value);
    return {
      key: value, label: value, platform: rows[0]?.platform,
      objective: rows[0]?.campaignObjective, rows,
      current: sumPaid(rows), previous: sumPaid(oldRows),
    };
  });
}
