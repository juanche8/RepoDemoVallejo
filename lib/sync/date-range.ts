import type { SyncMode } from "@/types/sync";

export type SyncDateRange = {
  dateFrom: string;
  dateTo: string;
};

export type ResolveSyncDateRangeInput = {
  mode: SyncMode;
  targetDate?: string;
  lastSuccessfulDate?: string;
  initialDate?: string;
  reprocessDays: number;
  dateFrom?: string;
  dateTo?: string;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: string, field: string): Date {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error(`${field} debe usar el formato YYYY-MM-DD.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} no contiene una fecha válida.`);
  }

  return date;
}

function subtractDays(value: string, days: number): string {
  const date = parseIsoDate(value, "lastSuccessfulDate");
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function assertOrdered(dateFrom: string, dateTo: string): void {
  parseIsoDate(dateFrom, "dateFrom");
  parseIsoDate(dateTo, "dateTo");
  if (dateFrom > dateTo) {
    throw new Error("dateFrom no puede ser posterior a dateTo.");
  }
}

export function resolveSyncDateRange(
  input: ResolveSyncDateRangeInput,
): SyncDateRange {
  if (!Number.isInteger(input.reprocessDays) || input.reprocessDays < 0) {
    throw new Error("reprocessDays debe ser un entero no negativo.");
  }

  if (input.mode === "force") {
    if (!input.dateFrom || !input.dateTo) {
      throw new Error("forceReprocess requiere dateFrom y dateTo.");
    }
    assertOrdered(input.dateFrom, input.dateTo);
    return { dateFrom: input.dateFrom, dateTo: input.dateTo };
  }

  if (!input.targetDate) {
    throw new Error("La sincronización incremental requiere targetDate.");
  }
  parseIsoDate(input.targetDate, "targetDate");

  if (!input.lastSuccessfulDate) {
    if (!input.initialDate) {
      throw new Error(
        "La primera sincronización requiere una fecha inicial configurada.",
      );
    }
    assertOrdered(input.initialDate, input.targetDate);
    return { dateFrom: input.initialDate, dateTo: input.targetDate };
  }

  parseIsoDate(input.lastSuccessfulDate, "lastSuccessfulDate");
  if (input.lastSuccessfulDate > input.targetDate) {
    throw new Error("lastSuccessfulDate no puede ser posterior a targetDate.");
  }

  const overlapDays = Math.max(input.reprocessDays - 1, 0);
  return {
    dateFrom: subtractDays(input.lastSuccessfulDate, overlapDays),
    dateTo: input.targetDate,
  };
}
