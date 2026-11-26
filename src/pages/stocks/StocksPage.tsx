import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3, History, Loader2, Lock, LogOut, Moon, Play, Square, Sun, Target, Trash2, TrendingUp,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  StocksHttpError, followRun, readStocksToken, stocksApi, storeStocksToken,
  type CandidateStage, type Market, type PipelineEvent, type Position, type Run, type RunDetail, type RunKind, type RunSummary, type StocksConfig,
} from "@/lib/stocksApi";
import ProgressPanel, { RunBadge } from "./ProgressPanel";
import ResultsPanel from "./ResultsPanel";
import StockDrawer from "./StockDrawer";
import StockPicker from "./StockPicker";
import TrackerView from "./TrackerView";
import { MARKET_META, duration, when } from "./format";
import { EmptyState, Segmented, cx } from "./ui";

const MARKET_KEY = "stocks_market";
const THEME_KEY = "stocks_theme";
const MARKETS: Market[] = ["US", "CA", "IN"];

function readMarket(): Market {
  try {
    const m = localStorage.getItem(MARKET_KEY) as Market | null;
    return m && MARKETS.includes(m) ? m : "US";
  } catch {
    return "US";
  }
}

/** The stocks theme (and dark mode, if chosen) live on <html> only while this page is mounted. */
function useStocksTheme() {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved ? saved === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const el = document.documentElement;
    const hadDark = el.classList.contains("dark");
    el.classList.add("stocks-theme");
    return () => {
      el.classList.remove("stocks-theme");
      if (!hadDark) el.classList.remove("dark");
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch { /* storage unavailable */ }
  }, [dark]);
  return [dark, () => setDark((d) => !d)] as const;
}

const isActive = (r?: Run | null) => r?.status === "queued" || r?.status === "running";

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <BarChart3 className="h-4 w-4" />
      </span>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight">Stocks</div>
        <div className="hidden text-[11px] text-muted-foreground sm:block">Research desk</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- sign-in
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
  const input = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-6 shadow-soft sm:p-7">
          <div className="mb-5 flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h1 className="text-base font-semibold">Sign in</h1>
          </div>
          <p className="-mt-3 mb-5 text-xs text-muted-foreground">Native engine · Claude · ChatGPT → one ranked decision</p>
          {notice && <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-sm">{notice}</p>}
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="su">Username</label>
          <input id="su" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username"
            autoCapitalize="none" className={cx(input, "mb-3")} />
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="sp">Password</label>
          <input id="sp" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" className={input} />
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <button disabled={!username.trim() || !pw || busy || blocked}
            className="mt-5 h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
            {busy ? "Checking…" : "Sign in"}
          </button>
        </form>
        <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-3 text-center">
          <p className="text-sm font-medium">Looking for the free trial? 🙂</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Lovely idea. Every run has two AI models read the entire market's news, and my bank account has politely asked
            me to stop being so generous. So Stocks is invite-only. If you'd like an account, ask me nicely and I'll
            think about it.
          </p>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- page
export default function StocksPage() {
  const [token, setToken] = useState("");
  const [config, setConfig] = useState<StocksConfig | null>(null);
  const [booting, setBooting] = useState(true);
  const [gateNotice, setGateNotice] = useState("");
  const [dark, toggleDark] = useStocksTheme();

  useEffect(() => {
    document.title = "Stocks";
    const saved = readStocksToken();
    if (!saved) return setBooting(false);
    stocksApi.config(saved)
      .then((cfg) => { setToken(saved); setConfig(cfg); })
      .catch(() => storeStocksToken(""))
      .finally(() => setBooting(false));
  }, []);

  if (booting) return <div className="flex min-h-[100dvh] items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!token || !config) return <Gate notice={gateNotice} onUnlock={(t, c) => { setGateNotice(""); setToken(t); setConfig(c); }} />;
  return <Dashboard token={token} config={config} dark={dark} toggleDark={toggleDark}
    onLogout={(why) => { storeStocksToken(""); setToken(""); setConfig(null); setGateNotice(why || ""); }} />;
}

type View = "analysis" | "tracker";

function Dashboard({ token, config, onLogout, dark, toggleDark }: {
  token: string; config: StocksConfig; onLogout: (why?: string) => void; dark: boolean; toggleDark: () => void;
}) {
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
  const [view, setView] = useState<View>("analysis");
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [liveRun, setLiveRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [stages, setStages] = useState<CandidateStage[]>([]);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState("");
  const [drawer, setDrawer] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);       // mobile / tablet sheet
  const [sidebar, setSidebar] = useState(true);                // desktop column
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
    setView("analysis");
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

  const start = async (kind: RunKind, symbol?: string, position?: Position) => {
    setStarting(true);
    setNotice("");
    setView("analysis");
    try {
      const run = await stocksApi.start(token, { market, kind, symbol, position });
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
  const marketOptions = MARKETS.map((m) => ({ id: m, label: <><span aria-hidden>{MARKET_META[m].flag}</span><span className="hidden sm:inline">{MARKET_META[m].short}</span></> }));
  const viewOptions = [
    { id: "analysis" as View, label: <><TrendingUp className="h-3.5 w-3.5" /> Analysis</> },
    { id: "tracker" as View, label: <><Target className="h-3.5 w-3.5" /> Track record</> },
  ];
  const historyList = <RunHistory market={market} runs={runs} selected={selected} onSelect={select} onDelete={isOwner ? remove : undefined} />;

  return (
    <div className="min-h-[100dvh] bg-background pb-20 text-foreground md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-3 sm:px-5">
          <Logo />
          <div className="mx-1 hidden h-6 w-px bg-border md:block" />
          <Segmented ariaLabel="Country" value={market} onChange={setMarket} options={marketOptions} size="sm" />
          <Segmented ariaLabel="View" value={view} onChange={setView} options={viewOptions} size="sm" className="hidden md:inline-flex" />
          <div className="ml-auto flex items-center gap-1.5">
            <ProviderStatus config={config} />
            <button onClick={toggleDark} title={dark ? "Light mode" : "Dark mode"} aria-label="Toggle dark mode"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {session && (
              <span className="hidden text-right text-[11px] leading-tight text-muted-foreground lg:block"
                title={session.expires_at ? new Date(session.expires_at).toLocaleString() : undefined}>
                <span className="font-medium text-foreground">{session.username}{session.is_owner ? " · owner" : ""}</span>
                <br />{session.expires_at ? `until ${new Date(session.expires_at).toLocaleDateString()}` : "no expiry"}
              </span>
            )}
            <button onClick={() => onLogout()} title="Sign out" aria-label="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="border-t border-border">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:px-5">
            <StockPicker token={token} market={market} busy={starting} onAnalyse={(sym, pos) => start("single", sym, pos)} />
            <div className="flex items-center gap-2 sm:ml-auto">
              <button onClick={() => (window.innerWidth >= 1024 ? setSidebar((s) => !s) : setHistoryOpen(true))}
                className={cx("hidden h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted md:flex",
                  sidebar && "lg:bg-muted")}>
                <History className="h-4 w-4" /> Runs
              </button>
              {viewingActive && (
                <button onClick={cancel} disabled={liveRun?.cancel_requested}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50">
                  <Square className="h-3.5 w-3.5" /> Cancel
                </button>
              )}
              <button onClick={() => start("scan")} disabled={starting || scanRunning}
                className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60 sm:flex-none">
                {starting || scanRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {scanRunning ? "Scan running…" : `Scan ${MARKET_META[market].short}`}
              </button>
            </div>
          </div>
        </div>
      </header>

      {view === "tracker" ? (
        <main className="mx-auto max-w-[1440px] px-3 py-5 sm:px-5">
          <TrackerView token={token} market={market} isOwner={isOwner} onOpenCandidate={setDrawer} />
        </main>
      ) : (
        <div className="mx-auto flex max-w-[1440px] gap-5 px-3 py-5 sm:px-5">
          {sidebar && <aside className="hidden w-72 shrink-0 lg:block"><div className="sticky top-[7.5rem]">{historyList}</div></aside>}
          <main className="min-w-0 flex-1 space-y-5">
            {!config.claude.enabled && !config.openai?.enabled && (
              <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Neither Claude nor ChatGPT is configured, so runs use the native engine only. Add keys in the admin panel (AI settings).
              </div>
            )}
            {notice && <div className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm">{notice}</div>}

            {!selected && !runs.length && (
              <EmptyState icon={<TrendingUp className="h-5 w-5" />} title={`No ${MARKET_META[market].label} runs yet`}>
                <b>Scan</b> reads {marketInfo?.sources ?? 0} {MARKET_META[market].label} news sources, finds the listed stocks behind the
                news, runs ~70 indicators and a backtest of each set-up, gets independent reviews from Claude and ChatGPT, and combines
                all three into the top {config.selection.top_n ?? 3} picks per horizon. Or search one stock above.
              </EmptyState>
            )}

            {liveRun && <ProgressPanel run={liveRun} events={events} candidates={stages} onOpen={setDrawer} collapsed={!!showResults} />}
            {showResults && <ResultsPanel detail={detail} onOpen={setDrawer} />}
          </main>
        </div>
      )}

      {/* mobile / tablet: run history sheet */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-sm overflow-y-auto p-4">
          <SheetHeader className="mb-3 text-left"><SheetTitle className="text-base">Runs · {MARKET_META[market].label}</SheetTitle></SheetHeader>
          {historyList}
        </SheetContent>
      </Sheet>

      {/* mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {[
          { id: "analysis", label: "Analysis", icon: TrendingUp, on: view === "analysis" && !historyOpen, act: () => { setView("analysis"); setHistoryOpen(false); } },
          { id: "runs", label: "Runs", icon: History, on: historyOpen, act: () => setHistoryOpen(true) },
          { id: "tracker", label: "Track record", icon: Target, on: view === "tracker" && !historyOpen, act: () => { setView("tracker"); setHistoryOpen(false); } },
        ].map((t) => (
          <button key={t.id} onClick={t.act} className={cx("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
            t.on ? "text-primary" : "text-muted-foreground")}>
            <t.icon className="h-5 w-5" /> {t.label}
          </button>
        ))}
      </nav>

      <StockDrawer token={token} candidateId={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

function ProviderStatus({ config }: { config: StocksConfig }) {
  const items = [
    { label: "Native", on: true, title: "Native engine: ~70 indicators + backtest" },
    { label: "Claude", on: config.claude.enabled, title: config.claude.enabled ? `Claude ${config.claude.model}` : "Claude is off" },
    { label: "ChatGPT", on: !!config.openai?.enabled, title: config.openai?.enabled ? `ChatGPT ${config.openai.model}` : "ChatGPT is off (no key in the admin panel)" },
  ];
  return (
    <div className="mr-1 hidden items-center gap-3 rounded-lg border border-border px-2.5 py-1.5 xl:flex">
      {items.map((i) => (
        <span key={i.label} title={i.title} className={cx("flex items-center gap-1.5 text-[11px] font-medium", i.on ? "text-foreground" : "text-muted-foreground line-through")}>
          <span className={cx("h-1.5 w-1.5 rounded-full", i.on ? "bg-emerald-500" : "bg-muted-foreground/40")} /> {i.label}
        </span>
      ))}
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
    <div className="rounded-xl border border-border bg-card shadow-soft">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <h2 className="text-sm font-semibold">{MARKET_META[market].flag} Runs</h2>
        <span className="text-[11px] text-muted-foreground">{runs.length}</span>
      </div>
      {!runs.length && <p className="px-3 py-4 text-sm text-muted-foreground">No runs yet.</p>}
      <ul className="stocks-scroll max-h-[calc(100dvh-14rem)] space-y-0.5 overflow-y-auto p-1.5">
        {runs.map((r) => (
          <li key={r.id}>
            <div className={cx("group rounded-lg px-2.5 py-2 text-sm transition", selected === r.id ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : "hover:bg-muted")}>
              <button onClick={() => onSelect(r.id)} className="w-full text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{r.kind === "single" ? r.symbol : "Market scan"} <span className="text-xs font-normal text-muted-foreground">#{r.id}</span></span>
                  <RunBadge run={r} />
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{when(r.created_at)} · {duration(r.started_at || r.created_at, r.finished_at)}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {r.articles} articles · {r.candidates} {r.kind === "single" ? "horizons" : "candidates"} · {r.picks.length} {r.kind === "single" ? "pass" : "picks"}
                </div>
                {r.kind === "scan" && r.picks.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Array.from(new Set(r.picks.map((p) => p.ticker))).slice(0, 9).map((t) => (
                      <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">{t}</span>
                    ))}
                  </div>
                )}
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
