import ApiClient from "@/lib/api";

// Shared by /links and /listall/textbox. Password is checked by the backend (ADMIN_LINKS_PW).
const KEY = "admin_links_token";

export function readAdminToken(): string {
  try {
    return sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function storeAdminToken(token: string) {
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

/** GET an admin endpoint with the password header. status 0 = network error. */
export function adminGet<T = unknown>(envPath: string, token: string) {
  return adminRequest<T>("GET", envPath, token);
}

/** DELETE an admin endpoint with the password header. status 0 = network error. */
export function adminDelete<T = unknown>(envPath: string, token: string) {
  return adminRequest<T>("DELETE", envPath, token);
}

/** POST (no body) to an admin endpoint with the password header. status 0 = network error. */
export function adminPost<T = unknown>(envPath: string, token: string) {
  return adminRequest<T>("POST", envPath, token);
}

async function adminRequest<T>(
  method: "GET" | "POST" | "DELETE",
  envPath: string,
  token: string
): Promise<{ status: number; data: T | null }> {
  try {
    const resp = await fetch(ApiClient.buildFullUrl(envPath), {
      method,
      headers: { "Content-Type": "application/json", token },
    });
    const body = await resp.json().catch(() => null);
    return { status: resp.status, data: (body?.data ?? null) as T | null };
  } catch {
    return { status: 0, data: null };
  }
}
