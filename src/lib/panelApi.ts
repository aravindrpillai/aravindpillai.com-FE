/**
 * Client for the admin panel backend (arp/panel/...).
 *
 * Login sends the admin password (ADMIN_PANEL_PW in the backend env file) once and gets a signed
 * session token back; only that token is kept (sessionStorage, so closing the tab signs out).
 */
const BASE: string = import.meta.env.VITE_API_BASE_URL; // e.g. http://localhost:8000/arp/
const TOKEN_KEY = "admin_panel_session";

export class PanelHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function readPanelToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function storePanelToken(token: string) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export async function panelRequest<T>(method: string, path: string, token: string, body?: unknown): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(`${BASE}panel/${path}`, {
      method,
      headers: { "Content-Type": "application/json", token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new PanelHttpError(0, "Could not reach the server.");
  }
  const json = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = json?.messages?.[0] ?? json?.detail ?? `Request failed (${resp.status})`;
    throw new PanelHttpError(resp.status, String(msg));
  }
  return (json?.data ?? null) as T;
}

// ---------------------------------------------------------------- types
export interface Overview {
  anonymous: { total: number; last_7_days: number; latest: string | null };
  notepad: { total: number; locked: number };
  qchat: { chats: number };
  stocks: { users: number; active: number; expired: number; runs: number };
  ai: { providers: { id: string; label: string; ready: boolean }[] };
}

export interface AnonymousMessage {
  id: number;
  message: string;
  location: string | null;
  cordinates: string | null;
  time: string;
  ip: string | null;
  isp: string | null;
  visitor_id: string | null;
  user_agent: string | null;
  client_info: Record<string, unknown> | null;
  network_info: Record<string, unknown> | null;
}

export interface NotepadRow {
  id: number;
  code: string | null;
  box_hash: string;
  locked: boolean;
  blocked: boolean;
  version: number;
  size: number;
  empty: boolean;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type Expiry = { mode: "never" } | { mode: "minutes"; minutes: number } | { mode: "at"; at: string };

export interface StocksUser {
  id: number;
  username: string;
  note: string;
  is_active: boolean;
  is_owner: boolean;
  expires_at: string | null;
  expired: boolean;
  status: "active" | "expired" | "disabled";
  created_at: string | null;
  last_login_at: string | null;
  login_count: number;
}

export interface LoginBlock {
  id: number;
  ip: string;
  failures: number;
  blocked: boolean;
  blocked_at: string | null;
  first_failed_at: string | null;
  last_failed_at: string | null;
  last_username: string;
}

export interface LoginBlocks {
  rules: { max_failed_attempts: number; block_minutes: number; client_ip_header: string };
  ips: LoginBlock[];
}

/** Lookup of an IP (ip-api.com, cached a week on the server). */
export interface IPIntel {
  data: Partial<{
    country: string; country_code: string; continent: string; region: string; region_code: string;
    city: string; district: string; zip: string; lat: number; lon: number; timezone: string;
    utc_offset_seconds: number; currency: string; isp: string; org: string; as: string; as_name: string;
    reverse_dns: string; mobile: boolean; proxy: boolean; hosting: boolean;
  }>;
  error: string;
  fetched_at: string | null;
}

export interface BlockedIP extends LoginBlock {
  intel: IPIntel | null;
  attempts: number;
  usernames: string[];
  anonymous_messages: number;
}

export interface BlockedIPDetail extends LoginBlock {
  intel: IPIntel | null;
  attempts: {
    total: number;
    wrong_password: number;
    while_blocked: number;
    first_at: string | null;
    last_at: string | null;
    usernames: { username: string; count: number; last_at: string | null }[];
    user_agents: { user_agent: string; count: number; last_at: string | null }[];
    recent: { at: string | null; outcome: "wrong_password" | "blocked"; username: string; user_agent: string; headers: Record<string, string> }[];
  };
  anonymous_messages: AnonymousMessage[];
}

export interface AIProvider {
  provider: "claude" | "openai";
  label: string;
  enabled: boolean;
  is_default: boolean;
  api_key_set: boolean;
  api_key_hint: string;
  api_key_unreadable: boolean;
  base_url: string;
  organization: string;
  models: string[];
  max_tokens: number;
  temperature: number | null;
  top_p: number | null;
  system_prompt: string;
  ready: boolean;
  updated_at: string | null;
}

export type AIProviderUpdate = Partial<{
  enabled: boolean;
  is_default: boolean;
  api_key: string;
  clear_api_key: boolean;
  base_url: string;
  organization: string;
  models: string[];
  max_tokens: number;
  temperature: number | string | null;
  top_p: number | string | null;
  system_prompt: string;
}>;

/** Someone allowed to use /ai: their page is /ai/<username>/<chat>, unlocked with their own code. */
export interface AIUser {
  id: number;
  username: string;
  code: string | null; // null = can't be decrypted (SECRET_KEY changed): set a new one
  note: string;
  is_active: boolean;
  conversations: number;
  created_at: string | null;
  last_used_at: string | null;
}

// ---------------------------------------------------------------- calls
export const panelApi = {
  login: (password: string) =>
    panelRequest<{ token: string; expires_at: string }>("POST", "login/", "", { password }),
  session: (t: string) => panelRequest<{ ok: boolean }>("GET", "session/", t),
  overview: (t: string) => panelRequest<Overview>("GET", "overview/", t),

  anonymous: (t: string) => panelRequest<AnonymousMessage[]>("GET", "anonymous/", t),
  deleteAnonymous: (t: string, id: number) => panelRequest<{ deleted: number }>("DELETE", `anonymous/${id}/`, t),
  deleteAnonymousMany: (t: string, ids: number[]) =>
    panelRequest<{ deleted: number }>("POST", "anonymous/delete/", t, { ids }),

  notepads: (t: string) => panelRequest<NotepadRow[]>("GET", "textbox/", t),
  deleteNotepad: (t: string, id: number) => panelRequest<null>("DELETE", `textbox/${id}/`, t),
  removeNotepadPin: (t: string, id: number) => panelRequest<null>("POST", `textbox/${id}/remove-pin/`, t),

  stocksUsers: (t: string) => panelRequest<StocksUser[]>("GET", "stocks/users/", t),
  createStocksUser: (t: string, body: { username: string; password: string; note?: string; expiry: Expiry; is_owner?: boolean }) =>
    panelRequest<StocksUser>("POST", "stocks/users/", t, body),
  updateStocksUser: (
    t: string,
    id: number,
    body: Partial<{ password: string; note: string; is_active: boolean; is_owner: boolean; expiry: Expiry; sign_out: boolean }>
  ) => panelRequest<StocksUser>("PATCH", `stocks/users/${id}/`, t, body),
  deleteStocksUser: (t: string, id: number) => panelRequest<null>("DELETE", `stocks/users/${id}/`, t),
  stocksLoginBlocks: (t: string) => panelRequest<LoginBlocks>("GET", "stocks/login-blocks/", t),
  unblockStocksLogin: (t: string, id: number) => panelRequest<null>("DELETE", `stocks/login-blocks/${id}/`, t),
  blockedIPs: (t: string) =>
    panelRequest<{ rules: LoginBlocks["rules"]; ips: BlockedIP[] }>("GET", "security/blocked-ips/", t),
  blockedIP: (t: string, id: number) => panelRequest<BlockedIPDetail>("GET", `security/blocked-ips/${id}/`, t),
  refreshBlockedIP: (t: string, id: number) => panelRequest<IPIntel>("POST", `security/blocked-ips/${id}/refresh/`, t),

  aiUsers: (t: string) => panelRequest<{ users: AIUser[]; unassigned_conversations: number }>("GET", "ai/users/", t),
  createAIUser: (t: string, body: { username: string; code?: string; note?: string }) =>
    panelRequest<AIUser>("POST", "ai/users/", t, body),
  updateAIUser: (t: string, id: number, body: Partial<{ code: string; note: string; is_active: boolean; sign_out: boolean }>) =>
    panelRequest<AIUser>("PATCH", `ai/users/${id}/`, t, body),
  deleteAIUser: (t: string, id: number) => panelRequest<null>("DELETE", `ai/users/${id}/`, t),
  claimUnassignedAI: (t: string, id: number) =>
    panelRequest<{ moved: number }>("POST", `ai/users/${id}/claim-unassigned/`, t),
  aiProviders: (t: string) => panelRequest<AIProvider[]>("GET", "ai/providers/", t),
  updateAIProvider: (t: string, provider: string, body: AIProviderUpdate) =>
    panelRequest<AIProvider>("PUT", `ai/providers/${provider}/`, t, body),
  testAIProvider: (t: string, provider: string, body: { api_key?: string; base_url?: string }) =>
    panelRequest<{ models: string[] }>("POST", `ai/providers/${provider}/test/`, t, body),
};

// ---------------------------------------------------------------- formatting
export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function relative(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = (t - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [31536000, "year"], [2592000, "month"], [86400, "day"], [3600, "hour"], [60, "minute"],
  ];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [secs, unit] of units) if (abs >= secs) return rtf.format(Math.round(diff / secs), unit);
  return rtf.format(Math.round(diff), "second");
}

export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
