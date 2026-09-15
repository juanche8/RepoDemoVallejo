export type ReadSheetRangeInput = {
  spreadsheetId: string;
  sheetName: string;
  range: string;
};

export type GoogleSheetsValue = string | number | boolean | null;

export type GoogleSheetsValuesResponse = {
  range?: string;
  majorDimension?: "ROWS" | "COLUMNS";
  values?: GoogleSheetsValue[][];
};

export type GoogleAdsSheetRow = {
  date: string;
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  campaignType: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
};
