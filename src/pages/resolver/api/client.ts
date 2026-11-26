import type { ApiErrorBody } from "./types";

// Same convention as the site's other API clients: VITE_API_BASE_URL is the backend's "arp/" root
// (e.g. http://localhost:8000/arp/); Resolver lives at <root>resolver/api/v1.
const ROOT: string = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? `${window.location.origin}/arp/`;
export const API_BASE = `${ROOT.replace(/\/+$/, "")}/resolver/api/v1`;
const TOKEN_KEY = "resolver.token";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null): void {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable: session-only */
    }
  },
  onUnauthorized(listener: Listener): () => void {
    unauthorizedListeners.add(listener);
    return () => unauthorizedListeners.delete(listener);
  },
};

// ETag cache for polled GETs: a 304 returns the last body we saw.
const etagCache = new Map<string, { etag: string; body: unknown }>();

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
  etag?: boolean;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = { Accept: "application/json", "X-Request-ID": newId().replace(/-/g, "") };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  const cached = options.etag && method === "GET" ? etagCache.get(url) : undefined;
  if (cached) headers["If-None-Match"] = cached.etag;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "network", "Network error");
  }

  if (response.status === 304 && cached) return cached.body as T;
  if (response.status === 204) return undefined as T;

  let body: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    if (response.status === 401 && token) {
      tokenStore.set(null);
      unauthorizedListeners.forEach((l) => l());
    }
    throw new ApiError(response.status, err?.code ?? "internal_error", err?.message ?? "Request failed", err?.details ?? {});
  }

  if (options.etag && method === "GET") {
    const tag = response.headers.get("ETag");
    if (tag) etagCache.set(url, { etag: tag, body });
  }
  return body as T;
}

export function clearEtagCache(): void {
  etagCache.clear();
}
