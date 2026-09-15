import type {
  GoogleAdsSheetRow,
  GoogleSheetsValue,
  GoogleSheetsValuesResponse,
} from "../google-sheets/types.ts";

export const GOOGLE_ADS_SHEET_HEADERS = [
  "date",
  "campaign_id",
  "campaign_name",
  "campaign_status",
  "campaign_type",
  "impressions",
  "clicks",
  "cost",
  "conversions",
  "conversion_value",
  "ctr",
  "cpc",
  "cpa",
  "roas",
] as const;

type Header = typeof GOOGLE_ADS_SHEET_HEADERS[number];

function headerName(value: GoogleSheetsValue | undefined): string {
  return String(value ?? "").trim().toLocaleLowerCase("en-US");
}

export function validateGoogleAdsSheetHeaders(
  headers: GoogleSheetsValue[],
): Map<Header, number> {
  const positions = new Map(headers.map((value, index) => [headerName(value), index]));
  const missing = GOOGLE_ADS_SHEET_HEADERS.filter((header) => !positions.has(header));
  if (missing.length) {
    throw new Error(`Google Ads Sheet: faltan columnas obligatorias: ${missing.join(", ")}.`);
  }
  return new Map(GOOGLE_ADS_SHEET_HEADERS.map((header) => [header, positions.get(header)!]));
}

function textValue(
  row: GoogleSheetsValue[],
  indexes: Map<Header, number>,
  header: Header,
  rowNumber: number,
): string {
  const value = String(row[indexes.get(header)!] ?? "").trim();
  if (!value) {
    throw new Error(`Google Ads Sheet: valor vacío en ${header}, fila ${rowNumber}.`);
  }
  return value;
}

function numberValue(
  row: GoogleSheetsValue[],
  indexes: Map<Header, number>,
  header: Header,
  rowNumber: number,
): number {
  const raw = row[indexes.get(header)!];
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    throw new Error(`Google Ads Sheet: número inválido en ${header}, fila ${rowNumber}.`);
  }
  const parsed = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`Google Ads Sheet: número inválido en ${header}, fila ${rowNumber}.`);
  }
  return parsed;
}

function dateValue(value: string, rowNumber: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Google Ads Sheet: fecha inválida en fila ${rowNumber}.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Google Ads Sheet: fecha inválida en fila ${rowNumber}.`);
  }
  return value;
}

export function normalizeGoogleAdsSheetValues(
  response: GoogleSheetsValuesResponse,
): GoogleAdsSheetRow[] {
  const values = response.values ?? [];
  if (values.length === 0) return [];
  const indexes = validateGoogleAdsSheetHeaders(values[0]);
  return values.slice(1).map((row, index) => {
    const rowNumber = index + 2;
    return {
      date: dateValue(textValue(row, indexes, "date", rowNumber), rowNumber),
      campaignId: textValue(row, indexes, "campaign_id", rowNumber),
      campaignName: textValue(row, indexes, "campaign_name", rowNumber),
      campaignStatus: textValue(row, indexes, "campaign_status", rowNumber),
      campaignType: textValue(row, indexes, "campaign_type", rowNumber),
      impressions: numberValue(row, indexes, "impressions", rowNumber),
      clicks: numberValue(row, indexes, "clicks", rowNumber),
      cost: numberValue(row, indexes, "cost", rowNumber),
      conversions: numberValue(row, indexes, "conversions", rowNumber),
      conversionValue: numberValue(row, indexes, "conversion_value", rowNumber),
      ctr: numberValue(row, indexes, "ctr", rowNumber),
      cpc: numberValue(row, indexes, "cpc", rowNumber),
      cpa: numberValue(row, indexes, "cpa", rowNumber),
      roas: numberValue(row, indexes, "roas", rowNumber),
    };
  });
}
