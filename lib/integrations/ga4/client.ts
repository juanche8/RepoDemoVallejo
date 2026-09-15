import { normalizeGA4Response } from "./normalize.ts";
import {
  createGoogleServiceAccountAccessToken,
  normalizePrivateKey,
} from "../google-auth.ts";
import type {
  GA4ApiResponse,
  GA4NormalizedRow,
  GA4QueryInput,
  GA4ReportDefinition,
} from "./types";

export const GA4_DIMENSIONS = [
  "date",
  "sessionDefaultChannelGroup",
  "sessionSource",
  "sessionMedium",
  "sessionCampaignName",
  "deviceCategory",
] as const;

export const GA4_METRICS = [
  "activeUsers",
  "newUsers",
  "sessions",
  "engagedSessions",
  "engagementRate",
  "ecommercePurchases",
  "purchaseRevenue",
] as const;

const DEFAULT_PAGE_SIZE = 100_000;
const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

type Environment = Record<string, string | undefined>;

type GA4RequestPageInput = {
  input: GA4QueryInput;
  accessToken: string;
  limit: number;
  offset: number;
  definition?: GA4ReportDefinition;
};

export type GA4PageRequester = (
  input: GA4RequestPageInput,
) => Promise<GA4ApiResponse>;

export type FetchGA4ReportOptions = {
  environment?: Environment;
  requestPage?: GA4PageRequester;
  pageSize?: number;
  accessToken?: string;
};


function serverOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("source=ga4: este módulo solo puede ejecutarse en servidor.");
  }
}

function context(input: GA4QueryInput): string {
  return `source=ga4 propertyId=${input.propertyId} dateFrom=${input.dateFrom} dateTo=${input.dateTo}`;
}

export { normalizePrivateKey } from "../google-auth.ts";

export function parseGA4PageSize(value: string | undefined): number {
  if (!value) return DEFAULT_PAGE_SIZE;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

export function buildGA4RequestBody(
  input: GA4QueryInput,
  limit: number,
  offset: number,
  definition: GA4ReportDefinition = {
    dimensions: GA4_DIMENSIONS,
    metrics: GA4_METRICS,
  },
) {
  if (!input.propertyId.trim()) {
    throw new Error("source=ga4: falta propertyId.");
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.dateFrom)
    || !/^\d{4}-\d{2}-\d{2}$/.test(input.dateTo)
    || input.dateFrom > input.dateTo
  ) {
    throw new Error(`${context(input)}: rango de fechas inválido.`);
  }

  return {
    dateRanges: [{ startDate: input.dateFrom, endDate: input.dateTo }],
    dimensions: definition.dimensions.map((name) => ({ name })),
    metrics: definition.metrics.map((name) => ({ name })),
    ...(definition.dimensionFilter
      ? { dimensionFilter: definition.dimensionFilter }
      : {}),
    limit: String(limit),
    offset: String(offset),
  };
}

export const requestGA4Page: GA4PageRequester = async ({
  input,
  accessToken,
  limit,
  offset,
  definition,
}) => {
  serverOnly();
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(input.propertyId)}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildGA4RequestBody(input, limit, offset, definition)),
    },
  );
  if (!response.ok) {
    throw new Error(
      `${context(input)}: Google Analytics Data API respondió HTTP ${response.status}.`,
    );
  }
  return response.json() as Promise<GA4ApiResponse>;
};

export async function fetchGA4ApiReport(
  input: GA4QueryInput,
  definition: GA4ReportDefinition,
  options: FetchGA4ReportOptions = {},
): Promise<GA4ApiResponse> {
  serverOnly();
  const environment = options.environment ?? process.env;
  const pageSize = options.pageSize
    ?? parseGA4PageSize(environment.GA4_PAGE_SIZE);
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error(`${context(input)}: pageSize debe ser un entero positivo.`);
  }

  buildGA4RequestBody(input, pageSize, 0, definition);
  const requester = options.requestPage ?? requestGA4Page;
  const accessToken = options.accessToken
    ?? await createGoogleServiceAccountAccessToken(environment, GA4_SCOPE);
  let offset = 0;
  let result: GA4ApiResponse | undefined;

  while (true) {
    const response = await requester({
      input,
      accessToken,
      limit: pageSize,
      offset,
      definition,
    });
    result ??= {
      dimensionHeaders: response.dimensionHeaders,
      metricHeaders: response.metricHeaders,
      rows: [],
      rowCount: response.rowCount,
    };
    result.rows?.push(...(response.rows ?? []));

    const received = response.rows?.length ?? 0;
    const total = response.rowCount ?? received;
    offset += received;
    if (offset >= total) break;
    if (received === 0) {
      throw new Error(`${context(input)}: respuesta paginada sin filas.`);
    }
  }

  return result ?? { rows: [], rowCount: 0 };
}

export async function fetchGA4Report(
  input: GA4QueryInput,
  options: FetchGA4ReportOptions = {},
): Promise<GA4NormalizedRow[]> {
  const response = await fetchGA4ApiReport(input, {
    dimensions: GA4_DIMENSIONS,
    metrics: GA4_METRICS,
  }, options);
  return normalizeGA4Response(response, input);
}
