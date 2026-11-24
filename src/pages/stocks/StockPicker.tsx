import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { stocksApi, type Market, type SearchResult } from "@/lib/stocksApi";
import { MARKET_META } from "./format";

const PLACEHOLDER: Record<Market, string> = {
  US: "e.g. Apple, NVDA, Costco",
  CA: "e.g. Royal Bank, SHOP.TO, Enbridge",
  IN: "e.g. Infosys, RELIANCE, HDFC Bank",
};

/** Type-ahead search limited to the selected market's exchanges; pick a result, then Analyse. */
export default function StockPicker({ token, market, busy, onAnalyse }: {
  token: string;
  market: Market;
  busy: boolean;
  onAnalyse: (symbol: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    setQ("");
    setPicked(null);
    setResults([]);
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

  const choose = (r: SearchResult) => {
    setPicked(r);
    setQ(`${r.symbol} — ${r.name}`);
    setOpen(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = picked?.symbol || results[active]?.symbol;
    if (sym) onAnalyse(sym);
  };

  return (
    <form onSubmit={submit} className="relative flex w-full gap-2 sm:max-w-xl">
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
          placeholder={`Analyse a ${MARKET_META[market].label} stock — ${PLACEHOLDER[market]}`}
          className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-9 text-sm outline-none focus:border-primary"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        {open && results.length > 0 && (
          <ul role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-popover py-1 text-sm shadow-lg">
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
          <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-lg">
            No {MARKET_META[market].label} listing matches “{q.trim()}”.
          </div>
        )}
      </div>
      <button disabled={busy || !(picked || results.length)}
        className="h-10 shrink-0 rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">
        Analyse
      </button>
    </form>
  );
}
