// Small, failure-tolerant localStorage helpers (private mode may throw).

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null || value === "") localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

const RETURN_KEY = "resolver.returnTo";

export function rememberReturnPath(path: string): void {
  writeLocal(RETURN_KEY, path);
}

export function takeReturnPath(): string | null {
  const value = readLocal(RETURN_KEY);
  writeLocal(RETURN_KEY, null);
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}
