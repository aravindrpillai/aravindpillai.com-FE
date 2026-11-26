// Resolver is mounted under /resolver in the site's router; every in-app path goes through rpath().
export const RESOLVER_BASE = "/resolver";

export function rpath(path: string): string {
  return `${RESOLVER_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
