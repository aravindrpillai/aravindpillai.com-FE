import { ApiError } from "@/pages/resolver/api/client";
import { pick, strings } from "@/pages/resolver/i18n";

/** Friendly text for any error. Never a stack trace or raw JSON. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNetwork) return strings.errors.network;
    return pick(strings.errors, error.code, strings.errors.generic);
  }
  return strings.errors.generic;
}

export function errorCode(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null;
}

export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.code !== "validation_failed") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(error.details)) {
    if (Array.isArray(value) && value.length) out[key] = String(value[0]);
  }
  return out;
}
