import { useEffect, useRef, useState } from "react";
import { Briefcase, Loader2, Search, X } from "lucide-react";
import { stocksApi, type Market, type Position, type SearchResult } from "@/lib/stocksApi";
import { money } from "./format";
import { cx } from "./ui";

const PLACEHOLDER: Record<Market, string> = {
  US: "e.g. Apple, NVDA, Costco",
  CA: "e.g. Royal Bank, SHOP.TO, Enbridge",
  IN: "e.g. Infosys, RELIANCE, HDFC Bank",
};

const today = () => new Date().toISOString().slice(0, 10);

/** Type-ahead search limited to the market's exchanges, with an optional "I own this stock" position
 *  (purchase date -> historical close, purchase price, shares) for a P&L and BUY / HOLD / SELL report. */
export default function StockPicker({ token, market, busy, onAnalyse }: {
  token: string;
  market: Market;
  busy: boolean;
  onAnalyse: (symbol: string, position?: Position) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [own, setOwn] = useState(false);
  const [date, setDate] = useState("");
  const [price, setPrice] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [shares, setShares] = useState("");
  const [close, setClose] = useState<{ date: string; close: number } | null>(null);
  const [closeState, setCloseState] = useState<"" | "loading" | "error">("");
  const [error, setError] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    setQ(""); setPicked(null); setResults([]); setClose(null); setDate(""); setPrice(""); setShares(""); setPriceTouched(false);
  }, [market]);

  useEffect(() => {
    if (picked && q === `${picked.symbol} — ${picked.name}`) return;
    const query = q.trim();
    if (query.length < 1) {
      setResults([]);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      stocksApi.search(token, query, market)
        .then((r) => { if (id === seq.current) { setResults(r); setActive(0); setOpen(true); } })
        .catch(() => { if (id === seq.current) setResults([]); })
        .finally(() => { if (id === seq.current) setLoading(false); });
    }, 300);
    return () => clearTimeout(t);
  }, [q, token, market, picked]);

  const symbol = picked?.symbol || results[active]?.symbol || "";

  // Purchase date -> the actual closing price that day (last session on or before it).
  useEffect(() => {
    setClose(null);
    if (!own || !date || !symbol) return;
    let live = true;
    setCloseState("loading");
    stocksApi.priceOn(token, symbol, market, date)
      .then((r) => {
        if (!live) return;
        setClose({ date: r.date, close: r.close });
        setCloseState("");
        if (!priceTouched) setPrice(String(r.close));
      })
      .catch(() => live && setCloseState("error"));
    return () => { live = false; };
  }, [own, date, symbol, token, market, priceTouched]);

  const choose = (r: SearchResult) => {
    setPicked(r);
    setQ(`${r.symbol} — ${r.name}`);
    setOpen(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!symbol) return;
    if (!own) return onAnalyse(symbol);
    const pos: Position = {};
    if (date) pos.purchase_date = date;
    if (price) {
      const p = Number(price);
      if (!(p > 0)) return setError("Purchase price must be a positive number.");
      pos.purchase_price = p;
    }
    if (shares) {
      const s = Number(shares);
      if (!(s > 0)) return setError("Shares must be a positive number.");
      pos.shares = s;
    }
    if (!pos.purchase_date && !pos.purchase_price) return setError("Enter a purchase date or a purchase price.");
    setOwn(false);
    onAnalyse(symbol, pos);
  };

  const field = "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
  return (
    <form onSubmit={submit} className="relative w-full sm:max-w-2xl">
      <div className="flex w-full gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPicked(null); }}
            onFocus={() => results.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (!open || !results.length) return;
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter" && !picked) { e.preventDefault(); choose(results[active]); }
              else if (e.key === "Escape") setOpen(false);
            }}
            placeholder={`Research a stock — ${PLACEHOLDER[market]}`}
            className={cx(field, "pl-9 pr-9")}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          {open && results.length > 0 && (
            <ul role="listbox" className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover py-1 text-sm shadow-lg">
              {results.map((r, i) => (
                <li key={r.symbol} role="option" aria-selected={i === active}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(r)}
                    className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left ${i === active ? "bg-muted" : "hover:bg-muted/60"}`}>
                    <span className="w-28 shrink-0 font-medium">{r.symbol}</span>
                    <span className="truncate">{r.name}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{r.exchange}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && !loading && q.trim() && results.length === 0 && (
            <div className="absolute z-40 mt-1 w-full rounded-lg border border-border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-lg">
              No listing in this market matches “{q.trim()}”.
            </div>
          )}
        </div>
        <button type="button" aria-pressed={own} title="I own this stock: add my purchase"
          onClick={() => {
            if (!own && !picked && results[active]) choose(results[active]);  // commit the highlighted stock
            setOpen(false);
            setOwn((o) => !o);
          }}
          className={cx("flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition",
            own ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted")}>
          <Briefcase className="h-4 w-4" /> <span className="hidden sm:inline">I own it</span>
        </button>
        <button disabled={busy || !symbol}
          className="h-9 shrink-0 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50">
          {own ? "Check" : "Analyse"}
        </button>
      </div>

      {own && (
        <div className="absolute left-0 right-0 z-30 mt-2 rounded-lg border border-border bg-card p-3 shadow-lg sm:right-auto sm:w-[34rem]">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold">My position {symbol ? <span className="font-normal text-muted-foreground">· {symbol}</span> : <span className="font-normal text-muted-foreground">· pick a stock first</span>}</span>
            <button type="button" onClick={() => setOwn(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="text-[11px] font-medium text-muted-foreground">Purchase date
              <input type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} className={cx(field, "mt-1")} />
            </label>
            <label className="text-[11px] font-medium text-muted-foreground">Price paid per share
              <input inputMode="decimal" value={price} onChange={(e) => { setPrice(e.target.value); setPriceTouched(true); }}
                placeholder={close ? String(close.close) : "optional"} className={cx(field, "mt-1")} />
            </label>
            <label className="text-[11px] font-medium text-muted-foreground">Shares
              <input inputMode="decimal" value={shares} onChange={(e) => setShares(e.target.value)} placeholder="optional" className={cx(field, "mt-1")} />
            </label>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {closeState === "loading" ? "Looking up the closing price…"
              : closeState === "error" ? "No closing price found for that date."
                : close ? <>Close on {close.date}{close.date !== date ? " (last trading session on or before your date)" : ""}:{" "}
                  <b className="text-foreground">{money(close.close, undefined, market)}</b>
                  {priceTouched && price && Number(price) !== close.close ? " · your entered price is used" : " · used as the purchase price unless you enter yours"}</>
                  : "Pick the purchase date to use that day's closing price, and/or enter what you actually paid. Add shares to see profit in money."}
          </p>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          <button disabled={busy || !symbol} className="mt-3 h-9 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            Check my position{symbol ? ` in ${symbol}` : ""}
          </button>
        </div>
      )}
    </form>
  );
}
