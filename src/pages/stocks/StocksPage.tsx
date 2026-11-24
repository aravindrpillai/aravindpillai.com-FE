import { useCallback, useEffect, useRef, useState } from "react";
import { History, Loader2, Lock, LogOut, Play, Square, Target, Trash2, TrendingUp } from "lucide-react";
import {
  StocksHttpError, followRun, readStocksToken, stocksApi, storeStocksToken,
  type CandidateStage, type Market, type PipelineEvent, type Run, type RunDetail, type RunKind, type RunSummary, type StocksConfig,
} from "@/lib/stocksApi";
import ProgressPanel, { RunBadge } from "./ProgressPanel";
import ResultsPanel from "./ResultsPanel";
import StockDrawer from "./StockDrawer";
import StockPicker from "./StockPicker";
import TrackerView from "./TrackerView";
import { MARKET_META, duration, when } from "./format";

const MARKET_KEY = "stocks_market";
const MARKETS: Market[] = ["US", "CA", "IN"];

function readMarket(): Market {
  try {
    const m = localStorage.getItem(MARKET_KEY) as Market | null;
    return m && MARKETS.includes(m) ? m : "US";
  } catch {
    return "US";
  }
}

const isActive = (r?: Run | null) => r?.status === "queued" || r?.status === "running";

// ---------------------------------------------------------------- password gate
function Gate({ onUnlock, notice }: { onUnlock: (token: string, cfg: StocksConfig) => void; notice?: string }) {
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      // Everyone, the owner included, signs in with a user created in the admin panel.
      const token = (await stocksApi.login(username.trim().toLowerCase(), pw)).token;
      const cfg = await stocksApi.config(token);
      storeStocksToken(token);
      onUnlock(token, cfg);
    } catch (err) {
      const data = err instanceof StocksHttpError ? (err.data as { attempts_left?: number; blocked?: boolean } | null) : null;
      if (data?.blocked) {
        setBlocked(true);
        setError((err as Error).message);
      } else if (err instanceof StocksHttpError && err.status === 401) {
        const left = data?.attempts_left;
        setError(`Wrong username or password.${left !== undefined
          ? left > 0 ? ` ${left} more wrong attempt${left === 1 ? "" : "s"} allowed before this IP is blocked.`
            : " One more wrong password will block this IP."
          : ""}`);
      } else setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border-2 border-border bg-card p-6 shadow-soft sm:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-warm shadow-glow">
          <Lock className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="mb-1 text-center font-display text-2xl">Stocks</h1>
        <p className="mb-5 text-center text-sm text-muted-foreground">News → analysis → Claude review → top picks</p>
        {notice && <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-center text-sm">{notice}</p>}
        <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username"
          autoComplete="username" autoCapitalize="none"
          className="mb-2 h-12 w-full rounded-xl border-2 border-input bg-background px-3 outline-none focus:border-primary" />
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" autoComplete="current-password"
          className="h-12 w-full rounded-xl border-2 border-input bg-background px-3 outline-none focus:border-primary" />
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <button disabled={!username.trim() || !pw || busy || blocked} className="mt-4 h-12 w-full rounded-xl bg-gradient-warm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {busy ? "Checking…" : "Unlock"}
        </button>
        <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-center">
          <p className="text-sm font-medium">Looking for the free trial? 🙂</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Lovely idea. Every run has Claude read the entire market's news, and my bank account has politely asked me
            to stop being so generous. So Stocks is invite-only. If you'd like an account, ask me nicely and I'll think
            about it.
          </p>
        </div>
      </form>
    </main>
  );
}

// ---------------------------------------------------------------- page
export default function StocksPage() {
  const [token, setToken] = useState("");
  const [config, setConfig] = useState<StocksConfig | null>(null);
  const [booting, setBooting] = useState(true);
  const [gateNotice, setGateNotice] = useState("");

  useEffect(() => {
    document.title = "Stocks";
    const saved = readStocksToken();
    if (!saved) return setBooting(false);
    stocksApi.config(saved)
      .then((cfg) => { setToken(saved); setConfig(cfg); })
      .catch(() => storeStocksToken(""))
      .finally(() => setBooting(false));
  }, []);

  if (booting) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!token || !config) return <Gate notice={gateNotice} onUnlock={(t, c) => { setGateNotice(""); setToken(t); setConfig(c); }} />;
  return <Dashboard token={token} config={config} onLogout={(why) => { storeStocksToken(""); setToken(""); setConfig(null); setGateNotice(why || ""); }} />;
}

function Dashboard({ token, config, onLogout }: { token: string; config: StocksConfig; onLogout: (why?: string) => void }) {
  const session = config.session;
  const isOwner = !!session?.is_owner;

  // A user created in the admin panel is signed out the moment their access expires.
  useEffect(() => {
    if (!session?.expires_at) return;
    const ms = new Date(session.expires_at).getTime() - Date.now();
    const id = window.setTimeout(() => onLogout("Your access has expired."), Math.max(0, Math.min(ms, 2 ** 31 - 1)));
    return () => window.clearTimeout(id);
  }, [session?.expires_at, onLogout]);

  const [market, setMarketState] = useState<Market>(readMarket);
  const [view, setView] = useState<"analysis" | "tracker">("analysis");
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [liveRun, setLiveRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [stages, setStages] = useState<CandidateStage[]>([]);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState("");
  const [drawer, setDrawer] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const followCtl = useRef<AbortController | null>(null);
  const marketInfo = config.markets.find((m) => m.id === market);

  const setMarket = (m: Market) => {
    try { localStorage.setItem(MARKET_KEY, m); } catch { /* storage unavailable */ }
    setMarketState(m);
  };

  const loadRuns = useCallback(async (m: Market) => {
    const r = await stocksApi.runs(token, m).catch(() => [] as RunSummary[]);
    setRuns(r);
    return r;
  }, [token]);

  const loadDetail = useCallback(async (id: number) => {
    const d = await stocksApi.run(token, id);
    setDetail(d);
    setLiveRun(d.run);
    return d;
  }, [token]);

  const follow = useCallback(async (id: number) => {
    followCtl.current?.abort();
    const ctl = new AbortController();
    followCtl.current = ctl;
    setEvents([]);
    try {
      await followRun(token, id, (t) => {
        setLiveRun(t.run);
        setStages(t.candidates);
        if (t.events.length) setEvents((prev) => [...prev, ...t.events].slice(-1500));
      }, ctl.signal, () => setNotice("Connection dropped — reconnecting…"));
    } catch (e) {
      setNotice((e as Error).message);
    }
    if (!ctl.signal.aborted) {
      setNotice("");
      const d = await loadDetail(id).catch(() => null);
      if (d) loadRuns(d.run.market);
    }
  }, [token, loadDetail, loadRuns]);

  const select = useCallback(async (id: number) => {
    followCtl.current?.abort();
    setSelected(id);
    setDetail(null);
    setStages([]);
    setEvents([]);
    setHistoryOpen(false);
    try {
      const d = await loadDetail(id);
      setStages(d.candidates.map((c) => ({ id: c.id, ticker: c.ticker, market: c.market, horizon: c.horizon, stage: c.stage, status: c.status, final_score: c.final_score, attempts: c.attempts, error: c.error })));
      if (isActive(d.run)) follow(id);
      else stocksApi.events(token, id).then(setEvents).catch(() => {});
    } catch (e) {
      setNotice((e as Error).message);
    }
  }, [follow, loadDetail, token]);

  // On market change: show that market's running run, else its latest run.
  useEffect(() => {
    let live = true;
    followCtl.current?.abort();
    setSelected(null);
    setDetail(null);
    setLiveRun(null);
    setStages([]);
    setEvents([]);
    setNotice("");
    loadRuns(market).then((r) => {
      if (!live) return;
      const running = r.find((x) => isActive(x));
      if (running) select(running.id);
      else if (r.length) select(r[0].id);
    });
    return () => { live = false; };
  }, [market, loadRuns, select]);

  useEffect(() => () => followCtl.current?.abort(), []);

  const start = async (kind: RunKind, symbol?: string) => {
    setStarting(true);
    setNotice("");
    try {
      const run = await stocksApi.start(token, { market, kind, symbol });
      await loadRuns(market);
      setSelected(run.id);
      setDetail(null);
      setLiveRun(run);
      setStages([]);
      follow(run.id);
    } catch (e) {
      if (e instanceof StocksHttpError && e.status === 409) {
        const active = (e.data as { run?: Run })?.run;
        setNotice(e.message);
        if (active && active.market === market) select(active.id);
      } else setNotice((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const cancel = async () => {
    if (!liveRun) return;
    try {
      await stocksApi.cancel(token, liveRun.id);
      setNotice("Cancelling… the run stops after its current step.");
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm(`Delete run #${id} and everything it produced?`)) return;
    try {
      await stocksApi.remove(token, id);
      if (selected === id) { setSelected(null); setDetail(null); setLiveRun(null); }
      loadRuns(market);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const viewingActive = isActive(liveRun);
  const scanRunning = runs.some((r) => isActive(r) && r.kind === "scan");
  const showResults = detail && !isActive(detail.run);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-warm"><TrendingUp className="h-5 w-5 text-primary-foreground" /></span>
            <div>
              <h1 className="font-display text-xl leading-tight">Stocks</h1>
              <p className="text-[11px] text-muted-foreground">Intraday / Swing / Long-term · {config.claude.enabled ? `Claude ${config.claude.model}` : "Claude off (rule-based)"}</p>
            </div>
          </div>

          <div className="inline-flex overflow-hidden rounded-xl border border-border" role="tablist" aria-label="Country">
            {MARKETS.map((m) => (
              <button key={m} role="tab" aria-selected={market === m} onClick={() => setMarket(m)}
                className={`flex h-10 items-center gap-1.5 px-4 text-sm transition ${market === m ? "bg-foreground font-medium text-background" : "hover:bg-muted"}`}>
                <span aria-hidden>{MARKET_META[m].flag}</span> {MARKET_META[m].short}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-xl border border-border text-sm" role="tablist" aria-label="View">
              <button role="tab" aria-selected={view === "analysis"} onClick={() => setView("analysis")}
                className={`flex h-10 items-center gap-1.5 px-3 ${view === "analysis" ? "bg-muted font-medium" : "hover:bg-muted/60"}`}>
                <TrendingUp className="h-4 w-4" /> Analysis
              </button>
              <button role="tab" aria-selected={view === "tracker"} onClick={() => { setView("tracker"); setHistoryOpen(false); }}
                className={`flex h-10 items-center gap-1.5 px-3 ${view === "tracker" ? "bg-muted font-medium" : "hover:bg-muted/60"}`}>
                <Target className="h-4 w-4" /> Tracker
              </button>
            </div>
            {view === "analysis" && (
              <button onClick={() => setHistoryOpen((o) => !o)} className="flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm hover:bg-muted">
                <History className="h-4 w-4" /> History
              </button>
            )}
            {viewingActive && (
              <button onClick={cancel} disabled={liveRun?.cancel_requested} className="flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm hover:bg-muted disabled:opacity-50">
                <Square className="h-4 w-4" /> Cancel
              </button>
            )}
            <button onClick={() => start("scan")} disabled={starting || scanRunning}
              className="flex h-10 items-center gap-2 rounded-xl bg-gradient-warm px-5 font-medium text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-60">
              {starting || scanRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {scanRunning ? "Running…" : `Run Analysis · ${MARKET_META[market].short}`}
            </button>
            {session && (
              <span className="hidden text-right text-[11px] leading-tight text-muted-foreground sm:block" title={session.expires_at ? new Date(session.expires_at).toLocaleString() : undefined}>
                <span className="font-medium text-foreground">{session.username}{session.is_owner ? " · owner" : ""}</span>
                <br />
                {session.expires_at ? `until ${new Date(session.expires_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : "no expiry"}
              </span>
            )}
            <button onClick={() => onLogout()} title="Lock" className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2">
            <StockPicker token={token} market={market} busy={starting} onAnalyse={(sym) => start("single", sym)} />
            <span className="text-xs text-muted-foreground">
              Scan reads {marketInfo?.sources ?? 0} {MARKET_META[market].label} news sources · or analyse one stock across all three horizons
            </span>
          </div>
        </div>
      </header>

      {view === "tracker" ? (
        <div className="mx-auto max-w-7xl px-4 py-6">
          <TrackerView token={token} market={market} isOwner={isOwner} onOpenCandidate={setDrawer} />
        </div>
      ) : (
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        {historyOpen && (
          <aside className="w-full shrink-0 sm:w-72">
            <RunHistory market={market} runs={runs} selected={selected} onSelect={select} onDelete={isOwner ? remove : undefined} />
          </aside>
        )}
        <main className={`min-w-0 flex-1 space-y-6 ${historyOpen ? "hidden sm:block" : ""}`}>
          {!config.claude.enabled && (
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Claude is off ({config.claude.key_set ? "disabled in stocks.yaml" : "no Claude API key is set in the admin panel"}). Runs use rule-based extraction,
              horizon classification and scoring only.
            </div>
          )}
          {notice && <div className="rounded-xl border border-border bg-card px-4 py-2 text-sm">{notice}</div>}

          {!selected && !runs.length && (
            <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
              <h2 className="font-display text-2xl">No {MARKET_META[market].label} runs yet</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
                <b>Run Analysis</b> reads {marketInfo?.sources ?? 0} {MARKET_META[market].label} news sources, finds the listed stocks behind the
                news, runs 31 technical indicators on their price history, asks Claude for a second opinion and picks the top{" "}
                {config.selection.top_n ?? 3} per horizon. Or type a stock above to analyse just that one.
              </p>
            </div>
          )}

          {liveRun && <ProgressPanel run={liveRun} events={events} candidates={stages} onOpen={setDrawer} />}
          {showResults && <ResultsPanel detail={detail} onOpen={setDrawer} />}
        </main>
      </div>
      )}

      <StockDrawer token={token} candidateId={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

function RunHistory({ market, runs, selected, onSelect, onDelete }: {
  market: Market;
  runs: RunSummary[];
  selected: number | null;
  onSelect: (id: number) => void;
  onDelete?: (id: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <h2 className="mb-2 px-1 text-sm font-semibold">{MARKET_META[market].flag} {MARKET_META[market].label} runs</h2>
      {!runs.length && <p className="px-1 text-sm text-muted-foreground">No runs yet.</p>}
      <ul className="space-y-1">
        {runs.map((r) => (
          <li key={r.id}>
            <div className={`group rounded-xl px-2.5 py-2 text-sm ${selected === r.id ? "bg-muted" : "hover:bg-muted/60"}`}>
              <button onClick={() => onSelect(r.id)} className="w-full text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">#{r.id} · {r.kind === "single" ? r.symbol : "Market scan"}</span>
                  <RunBadge run={r} />
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{when(r.created_at)} · {duration(r.started_at || r.created_at, r.finished_at)}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {r.articles} articles · {r.candidates} {r.kind === "single" ? "horizons" : "candidates"} · {r.picks.length} {r.kind === "single" ? "pass" : "picks"}
                </div>
                {r.kind === "scan" && r.picks.length > 0 && <div className="mt-1 line-clamp-2 text-xs">{Array.from(new Set(r.picks.map((p) => p.ticker))).join(", ")}</div>}
              </button>
              {onDelete && !isActive(r) && (
                <button onClick={() => onDelete(r.id)} className="mt-1 hidden items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive group-hover:flex">
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
