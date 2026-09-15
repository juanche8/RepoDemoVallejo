import { createGoogleServiceAccountAccessToken } from "../google-auth.ts";
import type {
  GoogleSheetsValuesResponse,
  ReadSheetRangeInput,
} from "./types.ts";

const SHEETS_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
type Environment = Record<string, string | undefined>;

function serverOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Google Sheets: el lector solo puede ejecutarse en servidor.");
  }
}

function validateInput(input: ReadSheetRangeInput): void {
  if (!input.spreadsheetId.trim()) {
    throw new Error("Google Sheets: falta spreadsheetId.");
  }
  if (!input.sheetName.trim()) {
    throw new Error("Google Sheets: falta sheetName.");
  }
  if (!input.range.trim()) {
    throw new Error("Google Sheets: falta range.");
  }
}

function sheetRange(input: ReadSheetRangeInput): string {
  const safeSheetName = input.sheetName.replace(/'/g, "''");
  return `'${safeSheetName}'!${input.range}`;
}

export async function readSheetRange(
  input: ReadSheetRangeInput,
  options: {
    environment?: Environment;
    accessToken?: string;
    request?: typeof fetch;
  } = {},
): Promise<GoogleSheetsValuesResponse> {
  serverOnly();
  validateInput(input);
  const environment = options.environment ?? process.env;
  const accessToken = options.accessToken
    ?? await createGoogleServiceAccountAccessToken(environment, SHEETS_READONLY_SCOPE);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(input.spreadsheetId)}/values/${encodeURIComponent(sheetRange(input))}?majorDimension=ROWS`;
  const response = await (options.request ?? fetch)(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Google Sheets: error de autenticación.");
    }
    if (response.status === 403) {
      throw new Error("Google Sheets: la cuenta de servicio no tiene acceso de lectura.");
    }
    if (response.status === 404) {
      throw new Error("Google Sheets: planilla o rango no encontrado.");
    }
    throw new Error(`Google Sheets API respondió HTTP ${response.status}.`);
  }
  return response.json() as Promise<GoogleSheetsValuesResponse>;
}

export { SHEETS_READONLY_SCOPE };
