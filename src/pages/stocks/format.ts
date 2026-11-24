import type { AIReview, Market } from "@/lib/stocksApi";

export function money(v: number | null | undefined, currency?: string, market?: Market) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const cur = currency || (market === "IN" ? "INR" : market === "CA" ? "CAD" : "USD");
  const locale = cur === "INR" ? "en-IN" : cur === "CAD" ? "en-CA" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency", currency: cur, currencyDisplay: cur === "CAD" ? "narrowSymbol" : "symbol",
      maximumFractionDigits: v >= 1000 ? 0 : 2,
    }).format(v) + (cur === "CAD" ? " CAD" : "");
  } catch {
    return v.toFixed(2);
  }
}

export const num = (v: number | null | undefined, d = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : v.toFixed(d);

export function ago(iso: string | null | undefined) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function duration(from: string | null | undefined, to?: string | null) {
  if (!from) return "—";
  const ms = (to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime();
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

export const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export const VERDICT_LABEL: Record<string, string> = { strong_buy: "Strong buy", buy: "Buy", hold: "Hold", avoid: "Avoid" };

export function verdictClass(v?: AIReview["verdict"]) {
  switch (v) {
    case "strong_buy":
    case "buy":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
    case "hold":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
    case "avoid":
      return "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function scoreClass(v: number | null | undefined) {
  if (v === null || v === undefined) return "text-muted-foreground";
  if (v >= 70) return "text-emerald-700 dark:text-emerald-400";
  if (v >= 50) return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}

export const MARKET_META: Record<Market, { flag: string; label: string; short: string }> = {
  US: { flag: "🇺🇸", label: "United States", short: "US" },
  CA: { flag: "🇨🇦", label: "Canada", short: "Canada" },
  IN: { flag: "🇮🇳", label: "India", short: "India" },
};
export const marketLabel = (m: Market) => `${MARKET_META[m]?.flag ?? ""} ${MARKET_META[m]?.short ?? m}`;
