export type VtexErrorCode =
  | "VTEX_CONFIG_MISSING"
  | "VTEX_AUTH_ERROR"
  | "VTEX_PERMISSION_DENIED"
  | "VTEX_ACCOUNT_ERROR"
  | "VTEX_RATE_LIMITED"
  | "VTEX_API_UNAVAILABLE"
  | "VTEX_BAD_RESPONSE"
  | "VTEX_UNKNOWN_ERROR";

export class VtexIntegrationError extends Error {
  readonly code: VtexErrorCode;
  readonly status?: number;

  constructor(code: VtexErrorCode, status?: number) {
    super(code);
    this.name = "VtexIntegrationError";
    this.code = code;
    this.status = status;
  }
}

export function classifyVtexError(status: number): VtexIntegrationError {
  if (status === 401) return new VtexIntegrationError("VTEX_AUTH_ERROR", status);
  if (status === 403) return new VtexIntegrationError("VTEX_PERMISSION_DENIED", status);
  if (status === 404) return new VtexIntegrationError("VTEX_ACCOUNT_ERROR", status);
  if (status === 429) return new VtexIntegrationError("VTEX_RATE_LIMITED", status);
  if (status >= 500) return new VtexIntegrationError("VTEX_API_UNAVAILABLE", status);
  if (status >= 400) return new VtexIntegrationError("VTEX_BAD_RESPONSE", status);
  return new VtexIntegrationError("VTEX_UNKNOWN_ERROR", status);
}

export function safeVtexError(error: unknown): { code: VtexErrorCode; status?: number } {
  if (error instanceof VtexIntegrationError) return { code: error.code, status: error.status };
  if (error instanceof Error && /^VTEX_[A-Z_]+:/.test(error.message)) {
    return { code: error.message.split(":")[0] as VtexErrorCode };
  }
  return { code: "VTEX_UNKNOWN_ERROR" };
}
