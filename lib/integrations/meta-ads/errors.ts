export type MetaErrorCode =
  | "META_TOKEN_INVALID"
  | "META_TOKEN_EXPIRED"
  | "META_PERMISSION_DENIED"
  | "META_ACCOUNT_ACCESS_DENIED"
  | "META_RATE_LIMITED"
  | "META_API_UNAVAILABLE"
  | "META_BAD_RESPONSE"
  | "META_UNKNOWN_ERROR";

export type MetaConnectionStatus =
  | "connected"
  | "reauthorization_required"
  | "permission_error"
  | "account_error"
  | "rate_limited"
  | "unavailable";

export type MetaLogicalEndpoint = "account" | "campaigns" | "reach" | "comparison";

export type MetaErrorContext = {
  ecommerce: string;
  accountId: string;
  dateFrom: string;
  dateTo: string;
  endpoint: MetaLogicalEndpoint;
};

type MetaApiErrorPayload = {
  code?: number;
  error_subcode?: number;
  message?: string;
  type?: string;
};

const EXPIRED_TOKEN_SUBCODES = new Set([458, 459, 460, 463, 464, 467]);
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

export class MetaIntegrationError extends Error {
  readonly code: MetaErrorCode;
  readonly connectionStatus: MetaConnectionStatus;
  readonly context: MetaErrorContext;
  readonly httpStatus?: number;

  constructor(
    code: MetaErrorCode,
    connectionStatus: MetaConnectionStatus,
    context: MetaErrorContext,
    httpStatus?: number,
  ) {
    super(code === "META_TOKEN_EXPIRED" || code === "META_TOKEN_INVALID"
      ? "Meta access token requires renewal."
      : "Meta Ads request failed.");
    this.name = "MetaIntegrationError";
    this.code = code;
    this.connectionStatus = connectionStatus;
    this.context = context;
    this.httpStatus = httpStatus;
  }
}

export function classifyMetaApiError(
  httpStatus: number,
  payload: MetaApiErrorPayload | undefined,
): Pick<MetaIntegrationError, "code" | "connectionStatus"> {
  const code = payload?.code;
  const subcode = payload?.error_subcode;
  const message = payload?.message?.toLowerCase() ?? "";
  if (code === 190 && (EXPIRED_TOKEN_SUBCODES.has(subcode ?? -1) || message.includes("expired"))) {
    return { code: "META_TOKEN_EXPIRED", connectionStatus: "reauthorization_required" };
  }
  if (code === 190 || httpStatus === 401) {
    return { code: "META_TOKEN_INVALID", connectionStatus: "reauthorization_required" };
  }
  if (RATE_LIMIT_CODES.has(code ?? -1) || httpStatus === 429) {
    return { code: "META_RATE_LIMITED", connectionStatus: "rate_limited" };
  }
  if ((code === 200 || code === 100 || httpStatus === 404) && message.includes("account")) {
    return { code: "META_ACCOUNT_ACCESS_DENIED", connectionStatus: "account_error" };
  }
  if (code === 10 || code === 200 || code === 294 || httpStatus === 403) {
    return { code: "META_PERMISSION_DENIED", connectionStatus: "permission_error" };
  }
  if (code === 1 || code === 2 || httpStatus >= 500) {
    return { code: "META_API_UNAVAILABLE", connectionStatus: "unavailable" };
  }
  return { code: "META_UNKNOWN_ERROR", connectionStatus: "unavailable" };
}

export function createMetaApiError(
  httpStatus: number,
  payload: MetaApiErrorPayload | undefined,
  context: MetaErrorContext,
): MetaIntegrationError {
  const classification = classifyMetaApiError(httpStatus, payload);
  return new MetaIntegrationError(
    classification.code,
    classification.connectionStatus,
    context,
    httpStatus,
  );
}

export function metaPublicError(error: unknown): {
  meta_connection_status: MetaConnectionStatus;
  message: string;
} {
  const status = error instanceof MetaIntegrationError
    ? error.connectionStatus
    : "unavailable";
  const message = status === "reauthorization_required"
    ? "Meta Ads requiere reconexión."
    : status === "permission_error" || status === "account_error"
      ? "No se pudo acceder a Meta Ads para esta marca."
      : "Meta Ads está temporalmente no disponible.";
  return { meta_connection_status: status, message };
}

export function metaErrorDiagnostic(error: unknown): Record<string, unknown> {
  if (!(error instanceof MetaIntegrationError)) {
    return { code: "META_UNKNOWN_ERROR", connectionStatus: "unavailable" };
  }
  return {
    code: error.code,
    connectionStatus: error.connectionStatus,
    ecommerce: error.context.ecommerce,
    accountId: error.context.accountId,
    dateFrom: error.context.dateFrom,
    dateTo: error.context.dateTo,
    endpoint: error.context.endpoint,
    httpStatus: error.httpStatus,
  };
}

export function asComparisonError(error: unknown): unknown {
  if (!(error instanceof MetaIntegrationError)) return error;
  return new MetaIntegrationError(
    error.code,
    error.connectionStatus,
    { ...error.context, endpoint: "comparison" },
    error.httpStatus,
  );
}
