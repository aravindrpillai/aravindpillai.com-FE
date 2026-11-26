import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Brain, Check, ChevronRight, Loader2, RefreshCw, RotateCcw, Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { HORIZONS, HORIZON_LABEL, type Horizon, type Learning, type Market } from "@/lib/stocksApi";
import {
  trackerApi, type Checkpoint, type EquityPoint, type Lesson, type Mark, type Override, type Prediction, type Suggestion, type TrackerSummary,
} from "@/lib/stocksTrackerApi";
import { MARKET_META, METHOD_IDS, METHOD_META, money, pct, pts, signCls, when } from "./format";
import { Card, CardHead, EmptyState, Kpi, Meter, Pill, Segmented, VerdictPill, cx } from "./ui";

const BENCH_LABEL: Record<string, string> = { "^GSPC": "S&P 500", "^GSPTSE": "S&P/TSX", "^NSEI": "Nifty 50" };
const EXIT_LABEL: Record<string, string> = { target: "target hit", stop: "stop-loss hit", final: "final checkpoint", hard_cap: "hard cap" };
const CAUSE_LABEL: Record<string, string> = {
  market_wide_move: "Market-wide move", news_misread: "News misread", technical_false_signal: "Technical false signal",
  stop_too_tight: "Stop too tight", target_too_far: "Target too far", event_risk: "Event risk", valuation: "Valuation",
  timing: "Timing", data_quality: "Data quality", other: "Other",
};

function minutesText(m: number) {
  const h = Math.floor(m / 60), mm = Math.round(m % 60);
  return h ? `${h}h ${String(mm).padStart(2, "0")}m` : `${mm}m`;
}

function progressText(p: Prediction) {
  if (p.status === "pending") return `Starts ${p.entry_mode === "next_open" ? "at the next open, " : ""}${when(p.entry_at)}`;
  const done = p.progress_unit === "min" ? `${minutesText(p.progress_done)} of ${minutesText(p.progress_total)}`
    : `Day ${Math.round(p.progress_done)} of ${Math.round(p.progress_total)}`;
  if (p.status === "closed") return `Closed · ${EXIT_LABEL[p.exit_reason] ?? p.exit_reason}`;
  return done;
}

const strategyReturn = (p: Prediction) => (p.status === "closed" ? p.final_return : p.last_return);

export function OutcomeBadge({ p }: { p: Prediction }) {
  if (p.status !== "closed") return <Pill tone={p.status === "pending" ? "neutral" : "info"}>{p.status === "pending" ? "Waiting for entry" : "Open"}</Pill>;
  if (p.outcome === "profit") return <Pill tone="good">▲ Profit</Pill>;
  if (p.outcome === "loss") return <Pill tone="bad">▼ Loss</Pill>;
  return <Pill>● Breakeven</Pill>;
}

function ProgressBar({ p, compact }: { p: Prediction; compact?: boolean }) {
  const v = p.progress_total ? Math.min(100, (p.progress_done / p.progress_total) * 100) : 0;
  return (
    <div className={compact ? "w-28" : ""}>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cx("h-full rounded-full", p.status === "closed" ? "bg-muted-foreground/40" : "bg-primary")} style={{ width: `${p.status === "closed" ? 100 : v}%` }} />
      </div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground">{progressText(p)}</div>
    </div>
  );
}

function Votes({ p }: { p: Prediction }) {
  const m = p.methods ?? {};
  const any = METHOD_IDS.some((id) => m[id]);
  if (!any) return <span className="text-[11px] text-muted-foreground">{p.ai_verdict ? `Claude ${p.ai_verdict}` : "—"}</span>;
  return (
    <span className="flex items-center gap-1">
      {METHOD_IDS.map((id) => {
        const v = m[id];
        return (
          <span key={id} title={`${METHOD_META[id].label}: ${v ? (v.bullish ? "buy" : "no") + (v.probability != null ? ` · ${Math.round(v.probability)}%` : "") : "off"}`}
            className={cx("flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold",
              !v ? "bg-muted text-muted-foreground/50" : v.bullish ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300")}>
            {{ native: "N", claude: "C", openai: "G" }[id]}
          </span>
        );
      })}
    </span>
  );
}

// =============================================================================== main view
export default function TrackerView({ token, market, isOwner, onOpenCandidate }: {
  token: string;
  market: Market;
  isOwner: boolean;
  onOpenCandidate: (candidateId: number) => void;
}) {
  const [summary, setSummary] = useState<TrackerSummary | null>(null);
  const [rows, setRows] = useState<Prediction[]>([]);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [marksLoading, setMarksLoading] = useState(false);
  const [status, setStatus] = useState<"open" | "closed" | "all">("all");
  const [horizon, setHorizon] = useState<Horizon | "">("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState<number | null>(null);
  const [learningOpen, setLearningOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([trackerApi.summary(token, market), trackerApi.predictions(token, market, status, horizon)]);
      setSummary(s);
      setRows(r);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, market, status, horizon]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => {  // refresh while a pass runs (every 3 s) or while positions are open (every minute)
    const fast = summary?.pass_running;
    const anyOpen = summary?.horizons.some((h) => h.open > 0);
    if (!fast && !anyOpen) return;
    const id = window.setInterval(load, fast ? 3000 : 60000);
    return () => window.clearInterval(id);
  }, [summary?.pass_running, summary?.horizons, load]);

  // "If bought at the recommendation and held to now" — fetched after the list, refreshed every 5 minutes.
  const ids = useMemo(() => rows.map((r) => r.id).slice(0, 300), [rows]);
  useEffect(() => {
    if (!ids.length) return;
    let live = true;
    const go = () => {
      setMarksLoading(true);
      trackerApi.marks(token, market, ids).then((m) => live && setMarks((prev) => ({ ...prev, ...m })))
        .catch(() => {}).finally(() => live && setMarksLoading(false));
    };
    go();
    const t = window.setInterval(go, 300000);
    return () => { live = false; window.clearInterval(t); };
  }, [token, market, ids]);

  const evaluateNow = async () => {
    try {
      await trackerApi.evaluate(token);
      setSummary((s) => (s ? { ...s, pass_running: true } : s));
      setTimeout(load, 1500);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const bench = summary?.benchmarks?.[market];
  const benchLabel = BENCH_LABEL[bench ?? ""] ?? bench ?? "index";
  const shown = rows.filter((p) => !q.trim() || `${p.ticker} ${p.name}`.toLowerCase().includes(q.trim().toLowerCase()));
  const pf = summary?.portfolio;
  const open = rows.filter((p) => p.status === "open");
  const avgOpen = open.length ? open.reduce((s, p) => s + (p.last_return ?? 0), 0) / open.length : null;
  const held = rows.map((p) => marks[String(p.id)]?.now_return).filter((x): x is number => typeof x === "number");
  const avgHeld = held.length ? held.reduce((a, b) => a + b, 0) / held.length : null;
  const totalOpen = summary?.horizons.reduce((n, h) => n + h.open, 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">Track record · {MARKET_META[market].flag} {MARKET_META[market].label}</h2>
          <p className="text-xs text-muted-foreground">
            Every pick is followed from the moment it is suggested · vs {benchLabel} · checked every {summary?.every_minutes ?? 15} min
            {summary?.last_evaluated_at ? ` · last ${when(summary.last_evaluated_at)}` : ""}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setLearningOpen(true)} className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
            <Brain className="h-4 w-4" /> Learning
            {(summary?.pending_suggestions ?? 0) > 0 && <span className="rounded bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{summary?.pending_suggestions}</span>}
          </button>
          <button onClick={evaluateNow} disabled={summary?.pass_running} className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted disabled:opacity-60">
            {summary?.pass_running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="hidden sm:inline">{summary?.pass_running ? "Evaluating…" : "Evaluate now"}</span>
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-border bg-card px-4 py-2 text-sm">{error}</div>}

      {/* headline numbers */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Closed trades" value={pf?.trades ?? 0} sub={`${pf?.wins ?? 0} won · ${pf?.losses ?? 0} lost`} />
        <Kpi label="Win rate" value={pf?.trades ? `${pf.win_rate}%` : "—"} valueCls={pf?.win_rate != null ? (pf.win_rate >= 50 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : ""} />
        <Kpi label="Avg per trade" value={pct(pf?.avg_return)} valueCls={signCls(pf?.avg_return)} sub="following the exit rules" />
        <Kpi label="Total P&L" value={pct(pf?.total_return, 1)} valueCls={signCls(pf?.total_return)} sub="equal stake in every pick"
          hint="Sum of every closed trade's return: the P&L, in % of one stake, of putting the same amount into every pick" />
        <Kpi label="Profit factor" value={pf?.profit_factor != null ? pf.profit_factor.toFixed(2) : "—"} sub="gains ÷ losses"
          valueCls={pf?.profit_factor != null ? (pf.profit_factor >= 1 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : ""} />
        <Kpi label={`vs ${benchLabel}`} value={pts(pf?.avg_alpha, 1)} valueCls={signCls(pf?.avg_alpha)} sub="avg alpha per trade" />
        <Kpi label="Open / waiting" value={totalOpen} sub={avgOpen != null ? <>avg <span className={signCls(avgOpen)}>{pct(avgOpen)}</span> unrealised</> : totalOpen ? "waiting for entry" : "nothing open"} />
        <Kpi label="If held to today" value={avgHeld != null ? pct(avgHeld) : marksLoading ? "…" : "—"} valueCls={signCls(avgHeld)}
          sub={`avg of ${held.length} shown, bought at the pick`} hint="Ignores the exit rules: bought at the recommendation and never sold" />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHead title="Cumulative P&L" subtitle="Closed picks in order of closing, equal stake each (% of one stake)"
            actions={pf?.best && pf?.worst ? (
              <span className="text-[11px] text-muted-foreground">best <b className="text-emerald-600 dark:text-emerald-400">{pf.best.ticker} {pct(pf.best.return, 1)}</b> · worst <b className="text-red-600 dark:text-red-400">{pf.worst.ticker} {pct(pf.worst.return, 1)}</b></span>
            ) : undefined} />
          <div className="p-3 sm:p-4"><EquityChart data={summary?.equity ?? []} /></div>
        </Card>
        <Card className="xl:col-span-2">
          <MethodAccuracy learning={summary?.learning ?? {}} />
        </Card>
      </div>

      {/* per horizon */}
      <div className="grid gap-3 md:grid-cols-3">
        {HORIZONS.map((h) => {
          const r = summary?.horizons.find((x) => x.horizon === h.id);
          return (
            <Card key={h.id} className="p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">{h.label}</h3>
                <span className="text-[11px] text-muted-foreground">{r?.open ?? 0} open · {r?.closed ?? 0} closed</span>
              </div>
              {r && r.closed > 0 ? (
                <>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold tabular-nums">{r.win_rate}%</span>
                    <span className="text-xs text-muted-foreground">win rate</span>
                  </div>
                  <Meter value={r.win_rate} marker={50} className="mt-1.5" />
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div><dt className="text-muted-foreground">Avg return</dt><dd className={cx("font-semibold tabular-nums", signCls(r.avg_return))}>{pct(r.avg_return)}</dd></div>
                    <div><dt className="text-muted-foreground">Avg alpha</dt><dd className={cx("font-semibold tabular-nums", signCls(r.avg_alpha))}>{pts(r.avg_alpha, 1)}</dd></div>
                    <div><dt className="text-muted-foreground">Beat index</dt><dd className="font-semibold tabular-nums">{r.beat_market_rate}%</dd></div>
                  </dl>
                  <p className="mt-2 text-[11px] text-muted-foreground">{r.profit} profit · {r.loss} loss · {r.breakeven} breakeven (±{summary?.breakeven_pct?.[h.id] ?? "—"}%)</p>
                </>
              ) : <p className="mt-3 text-sm text-muted-foreground">No closed {h.label.toLowerCase()} picks yet.</p>}
            </Card>
          );
        })}
      </div>

      {/* predictions */}
      <Card>
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
          <h3 className="mr-2 text-sm font-semibold">Every recommendation</h3>
          <Segmented size="sm" value={status} onChange={setStatus}
            options={[{ id: "all", label: "All" }, { id: "open", label: "Open" }, { id: "closed", label: "Closed" }]} />
          <Segmented size="sm" value={horizon} onChange={setHorizon}
            options={[{ id: "" as const, label: "All horizons" }, ...HORIZONS.map((h) => ({ id: h.id, label: h.label }))]} />
          <label className="relative sm:ml-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by stock"
              className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm outline-none focus:border-primary sm:w-48" />
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : shown.length === 0 ? (
          <div className="p-4">
            <EmptyState title={status === "open" ? "No open recommendations" : "Nothing here yet"}>
              Every pick of a scan (and every horizon that passes in a single-stock analysis) is tracked automatically from the moment it is suggested.
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="stocks-scroll hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1040px] text-sm">
                <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Stock</th>
                    <th className="px-3 py-2 font-medium">Recommended</th>
                    <th className="px-3 py-2 text-right font-medium">Strategy P&L</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Price now</th>
                    <th className="px-3 py-2 text-right font-medium">If held to now</th>
                    <th className="px-3 py-2 text-right font-medium">vs index now</th>
                    <th className="px-3 py-2 font-medium">Votes</th>
                    <th className="px-3 py-2 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => {
                    const mk = marks[String(p.id)];
                    const sr = strategyReturn(p);
                    return (
                      <tr key={p.id} onClick={() => setDrawer(p.id)} className="cursor-pointer border-t border-border align-middle transition hover:bg-muted/40">
                        <td className="px-4 py-2.5">
                          <div className="font-semibold">{p.ticker}</div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><span>{HORIZON_LABEL[p.horizon]}</span>{p.source === "single" && <span>· single</span>}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="tabular-nums">{money(p.entry_price ?? p.suggested_price, p.currency, p.market)}</div>
                          <div className="text-[11px] text-muted-foreground">{when(p.suggested_at)}</div>
                        </td>
                        <td className={cx("px-3 py-2.5 text-right font-semibold tabular-nums", signCls(sr))}>{pct(sr)}</td>
                        <td className="px-3 py-2.5"><ProgressBar p={p} compact /></td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{mk ? money(mk.now_price, p.currency, p.market) : marksLoading ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" /> : "—"}</td>
                        <td className={cx("px-3 py-2.5 text-right font-semibold tabular-nums", signCls(mk?.now_return))}>{pct(mk?.now_return)}</td>
                        <td className={cx("px-3 py-2.5 text-right tabular-nums", signCls(mk?.now_alpha))}>{pts(mk?.now_alpha, 1)}</td>
                        <td className="px-3 py-2.5"><Votes p={p} /></td>
                        <td className="px-3 py-2.5"><OutcomeBadge p={p} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-border lg:hidden">
              {shown.map((p) => {
                const mk = marks[String(p.id)];
                const sr = strategyReturn(p);
                return (
                  <li key={p.id}>
                    <button onClick={() => setDrawer(p.id)} className="w-full px-4 py-3 text-left hover:bg-muted/40">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{p.ticker}</span>
                        <Pill>{HORIZON_LABEL[p.horizon]}</Pill>
                        <span className="ml-auto"><OutcomeBadge p={p} /></span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div><div className="text-muted-foreground">Bought at</div><div className="font-medium tabular-nums">{money(p.entry_price ?? p.suggested_price, p.currency, p.market)}</div></div>
                        <div><div className="text-muted-foreground">Strategy</div><div className={cx("font-semibold tabular-nums", signCls(sr))}>{pct(sr)}</div></div>
                        <div><div className="text-muted-foreground">Held to now</div><div className={cx("font-semibold tabular-nums", signCls(mk?.now_return))}>{mk ? pct(mk.now_return) : marksLoading ? "…" : "—"}</div></div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1"><ProgressBar p={p} /></div>
                        <Votes p={p} />
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">Recommended {when(p.suggested_at)}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground sm:px-5">
          <b>Strategy P&L</b> follows the plan (exit at target, stop or the final checkpoint). <b>If held to now</b> ignores the exits: bought at the
          recommendation and never sold, marked at the latest price. Votes: N = native, C = Claude, G = ChatGPT (green = said buy).
        </p>
      </Card>

      <PredictionDrawer token={token} id={drawer} mark={drawer != null ? marks[String(drawer)] : undefined} onClose={() => setDrawer(null)} onOpenCandidate={onOpenCandidate} />
      <LearningSheet token={token} market={market} isOwner={isOwner} open={learningOpen} learning={summary?.learning ?? {}} onClose={() => { setLearningOpen(false); load(); }} />
    </div>
  );
}

// =============================================================================== equity curve
function EquityChart({ data }: { data: EquityPoint[] }) {
  if (data.length < 2) return <p className="py-10 text-center text-sm text-muted-foreground">The curve appears once at least two picks have closed.</p>;
  const rows = [{ at: "", cum: 0, ret: 0, ticker: "start", horizon: "swing" as Horizon, i: 0 }, ...data.map((d, i) => ({ ...d, i: i + 1 }))];
  const last = rows[rows.length - 1].cum;
  const stroke = "hsl(var(--primary))";
  return (
    <div className="h-56 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="i" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" minTickGap={32}
            tickFormatter={(i) => (i ? `#${i}` : "")} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" width={44} tickFormatter={(v) => `${v}%`} />
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
          <Tooltip cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const r = payload[0].payload as EquityPoint & { i: number };
            if (!r.i) return null;
            return (
              <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                <div className="font-semibold">#{r.i} · {r.ticker} <span className="font-normal text-muted-foreground">{HORIZON_LABEL[r.horizon]}</span></div>
                <div className="text-muted-foreground">{when(r.at)}</div>
                <div className="mt-1 flex justify-between gap-4"><span className="text-muted-foreground">This trade</span><span className="tabular-nums">{pct(r.ret)}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Cumulative</span><span className="font-semibold tabular-nums">{pct(r.cum)}</span></div>
              </div>
            );
          }} />
          <Area type="linear" dataKey="cum" stroke={stroke} strokeWidth={2} fill="url(#eq-fill)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
      <span className="sr-only">Cumulative P&L ends at {pct(last)} after {data.length} closed trades.</span>
    </div>
  );
}

// =============================================================================== method accuracy
function MethodAccuracy({ learning }: { learning: Partial<Record<Horizon, Learning>> }) {
  const [h, setH] = useState<Horizon>("swing");
  const l = learning[h];
  return (
    <>
      <CardHead title="Which method is right more often" subtitle="Scored against closed outcomes; drives each method's weight in the next run"
        actions={<Segmented size="sm" value={h} onChange={setH} options={HORIZONS.map((x) => ({ id: x.id, label: x.label }))} />} />
      <div className="p-4">
        {!l ? <p className="text-sm text-muted-foreground">No data.</p> : (
          <>
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr><th className="pb-1.5 font-medium">Method</th><th className="pb-1.5 text-right font-medium">Calls right</th><th className="pb-1.5 text-right font-medium">Buy calls won</th><th className="pb-1.5 text-right font-medium">Weight now</th></tr>
              </thead>
              <tbody>
                {METHOD_IDS.map((id) => {
                  const a = l.methods?.[id];
                  return (
                    <tr key={id} className="border-t border-border">
                      <td className="py-2"><span className="flex items-center gap-1.5 font-medium"><span className={cx("h-2 w-2 rounded-full", METHOD_META[id].dot)} />{METHOD_META[id].label}</span></td>
                      <td className="py-2 text-right tabular-nums">{a ? <>{a.hit_rate}% <span className="text-muted-foreground">({a.n})</span></> : "—"}</td>
                      <td className="py-2 text-right tabular-nums">{a?.buy_win_rate != null ? `${a.buy_win_rate}%` : "—"}</td>
                      <td className="py-2 text-right">
                        <span className="inline-flex items-center gap-2"><Meter value={(l.weights?.[id] ?? 0) * 100 * 2} className="w-10" /><b className="tabular-nums">{((l.weights?.[id] ?? 0) * 100).toFixed(0)}%</b></span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Applied to the next run</div>
              <ul className="space-y-1 text-xs text-muted-foreground">{l.notes.map((n, i) => <li key={i}>• {n}</li>)}</ul>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// =============================================================================== one prediction
function PredictionDrawer({ token, id, mark, onClose, onOpenCandidate }: {
  token: string; id: number | null; mark?: Mark; onClose: () => void; onOpenCandidate: (candidateId: number) => void;
}) {
  const [p, setP] = useState<Prediction | null>(null);
  useEffect(() => {
    if (id == null) return;
    setP(null);
    trackerApi.prediction(token, id).then(setP).catch(() => setP(null));
  }, [token, id]);

  return (
    <Sheet open={id != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
        {!p ? <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
          <div className="space-y-5 pb-8 text-sm">
            <SheetHeader className="space-y-1.5 pr-8 text-left">
              <SheetTitle className="flex flex-wrap items-baseline gap-2 text-2xl font-semibold tracking-tight">
                {p.ticker} <span className="text-sm font-normal text-muted-foreground">{p.name}</span>
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-1.5 text-xs">
                <Pill>{HORIZON_LABEL[p.horizon]}</Pill><OutcomeBadge p={p} />
                {p.status === "closed" && p.beat_market !== null && <Pill tone={p.beat_market ? "good" : "bad"}>{p.beat_market ? "Beat" : "Lagged"} {BENCH_LABEL[p.benchmark] ?? p.benchmark}</Pill>}
                <span>recommended {when(p.suggested_at)}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Kpi label="Bought at" value={money(p.entry_price ?? p.suggested_price, p.currency, p.market)}
                sub={p.entry_price ? `${p.entry_mode === "next_open" ? "next open · " : ""}${when(p.entry_at)}` : `planned ${when(p.entry_at)}`} />
              <Kpi label="Strategy P&L" value={pct(strategyReturn(p))} valueCls={signCls(strategyReturn(p))} sub={p.status === "closed" ? EXIT_LABEL[p.exit_reason] : "so far, open"} />
              <Kpi label="If held to now" value={pct(mark?.now_return)} valueCls={signCls(mark?.now_return)}
                sub={mark?.now_price != null ? `${money(mark.now_price, p.currency, p.market)} · ${pts(mark.now_alpha, 1)} vs index` : "—"} />
              <Kpi label="Stop-loss" value={money(p.stop_loss, p.currency, p.market)} />
              <Kpi label="Target" value={money(p.target, p.currency, p.market)} />
              <Kpi label="Predicted" value={p.win_probability != null ? `${Math.round(p.win_probability)}% win` : "—"}
                sub={p.expected_value != null ? `EV ${pct(p.expected_value)}` : undefined} />
            </div>

            <ProgressBar p={p} />
            {p.calendar_approximate && <p className="text-xs text-muted-foreground">Some checkpoint dates are beyond the exchange's published holiday calendar and assume a normal weekday schedule.</p>}
            {p.error && <p className="text-xs text-amber-700 dark:text-amber-400">{p.error}</p>}

            <MethodsAtPick p={p} />

            <Card as="div">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr><th className="px-3 py-1.5 text-left font-medium">Result</th><th className="px-3 py-1.5 text-right font-medium">Stock</th><th className="px-3 py-1.5 text-right font-medium">Index</th><th className="px-3 py-1.5 text-right font-medium">Alpha</th></tr>
                </thead>
                <tbody className="tabular-nums">
                  <ResultRow label={`Exit at target/stop${p.exit_reason ? ` (${EXIT_LABEL[p.exit_reason]})` : ""}`} r={p.exit_return} i={p.exit_index_return} a={p.exit_alpha} basis={p.outcome_basis === "exit"} />
                  <ResultRow label={`Hold to final checkpoint${p.hold_complete ? "" : " (pending)"}`} r={p.hold_return} i={p.hold_index_return} a={p.hold_alpha} basis={p.outcome_basis === "hold"} />
                  {mark && <ResultRow label="Bought and held to now" r={mark.now_return} i={mark.now_index_return} a={mark.now_alpha} basis={false} />}
                </tbody>
              </table>
              <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">★ decides the outcome. Best move after entry {pct(p.max_runup)} · worst {pct(p.max_drawdown)}.</p>
            </Card>

            <div>
              <h4 className="mb-1.5 text-sm font-semibold">Checkpoints</h4>
              <Card as="div" className="stocks-scroll overflow-x-auto">
                <table className="w-full min-w-[460px] text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr><th className="px-3 py-1.5 text-left font-medium">Checkpoint</th><th className="px-3 py-1.5 text-left font-medium">Due</th><th className="px-3 py-1.5 text-right font-medium">Price</th><th className="px-3 py-1.5 text-right font-medium">Return</th><th className="px-3 py-1.5 text-right font-medium">Alpha</th></tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {p.checkpoints.map((c: Checkpoint) => (
                      <tr key={c.key} className="border-t border-border">
                        <td className="px-3 py-1.5">{c.label}{c.kind === "interim" ? <span className="text-muted-foreground"> · tracking</span> : c.kind === "extended" ? <span className="text-muted-foreground"> · secondary</span> : ""}</td>
                        <td className="px-3 py-1.5">{when(c.due_at)}</td>
                        <td className="px-3 py-1.5 text-right">{c.status === "done" ? money(c.price, p.currency, p.market) : c.status}</td>
                        <td className={cx("px-3 py-1.5 text-right", signCls(c.return))}>{pct(c.return)}</td>
                        <td className={cx("px-3 py-1.5 text-right", signCls(c.alpha))}>{pts(c.alpha)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>

            {p.extended_note && <p className="rounded-lg bg-muted/50 px-4 py-3 text-xs">{p.extended_note}</p>}

            {p.loss_analysis && (
              <Card as="div" className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold">Post-mortem</h4>
                  <Pill tone="warn">{CAUSE_LABEL[p.loss_analysis.cause] ?? p.loss_analysis.cause}</Pill>
                  <span className="text-[11px] text-muted-foreground">
                    {p.loss_analysis.trigger === "both" ? "loss + lagged the index" : p.loss_analysis.trigger === "loss" ? "loss" : "lagged the index"} ·{" "}
                    {p.loss_analysis.method === "rules" ? "rule-based (no AI available)" : `${p.loss_analysis.method === "openai" ? "ChatGPT" : "Claude"} ${p.loss_analysis.model}`}
                  </span>
                </div>
                <p className="leading-relaxed">{p.loss_analysis.explanation}</p>
                {p.loss_analysis.what_was_missed && <p className="text-muted-foreground"><b className="text-foreground">Missed: </b>{p.loss_analysis.what_was_missed}</p>}
                {p.loss_analysis.revisit_note && <p className="text-xs text-muted-foreground">{p.loss_analysis.revisit_note}</p>}
                {(p.lessons ?? []).length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold">Lessons fed into future AI reviews</h5>
                    <ul className="list-disc pl-5 text-muted-foreground">{p.lessons!.map((l) => <li key={l.id}>{l.text}{!l.active && " (off)"}</li>)}</ul>
                  </div>
                )}
                {(p.suggestions ?? []).length > 0 && <p className="text-xs text-muted-foreground">{p.suggestions!.length} scoring suggestion(s) — see Learning.</p>}
              </Card>
            )}
            {p.analysis_status === "pending" && <p className="text-xs text-muted-foreground">Post-mortem queued for the next tracker pass.</p>}

            {p.candidate_id && (
              <button onClick={() => onOpenCandidate(p.candidate_id!)} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                Open the original analysis (decision, chart, indicators, AI reviews) <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MethodsAtPick({ p }: { p: Prediction }) {
  const m = p.methods ?? {};
  if (!METHOD_IDS.some((id) => m[id])) return null;
  const won = p.status === "closed" ? p.outcome === "profit" : null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {METHOD_IDS.map((id) => {
        const v = m[id];
        const right = v && won !== null ? v.bullish === won : null;
        return (
          <div key={id} className="rounded-lg border border-border px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className={cx("h-1.5 w-1.5 rounded-full", METHOD_META[id].dot)} />{METHOD_META[id].short}</div>
            {v ? (
              <>
                <div className="mt-1 flex items-center gap-1.5">{v.verdict ? <VerdictPill verdict={v.verdict} /> : <Pill>{v.bullish ? "buy" : "no"}</Pill>}</div>
                <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">{v.probability != null ? `${Math.round(v.probability)}% win` : ""}{m.ranks?.[id] ? ` · #${m.ranks[id]}` : ""}</div>
                {right !== null && <div className={cx("mt-1 text-[11px] font-semibold", right ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{right ? "✓ called it" : "✕ wrong"}</div>}
              </>
            ) : <div className="mt-1 text-xs text-muted-foreground">off</div>}
          </div>
        );
      })}
    </div>
  );
}

function ResultRow({ label, r, i, a, basis }: { label: string; r: number | null; i: number | null; a: number | null; basis: boolean }) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-1.5">{basis && "★ "}{label}</td>
      <td className={cx("px-3 py-1.5 text-right font-medium", signCls(r))}>{pct(r)}</td>
      <td className={cx("px-3 py-1.5 text-right", signCls(i))}>{pct(i)}</td>
      <td className={cx("px-3 py-1.5 text-right", signCls(a))}>{pts(a)}</td>
    </tr>
  );
}

// =============================================================================== learning
function LearningSheet({ token, market, isOwner, open, learning, onClose }: {
  token: string; market: Market; isOwner: boolean; open: boolean; learning: Partial<Record<Horizon, Learning>>; onClose: () => void;
}) {
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([trackerApi.suggestions(token), trackerApi.lessons(token, market)]);
      setSugs(s.suggestions);
      setOverrides(s.overrides);
      setLessons(l);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token, market]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const act = async (fn: () => Promise<unknown>) => {
    setError("");
    try { await fn(); await load(); } catch (e) { setError((e as Error).message); }
  };
  const pending = useMemo(() => sugs.filter((s) => s.status === "pending"), [sugs]);
  const decided = useMemo(() => sugs.filter((s) => s.status !== "pending").slice(0, 20), [sugs]);
  const btn = "flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
        <div className="space-y-6 pb-8 text-sm">
          <SheetHeader className="text-left">
            <SheetTitle className="text-xl font-semibold">Learning</SheetTitle>
            <SheetDescription className="text-xs">
              Two kinds of learning feed every new run. <b>Automatic</b>: each method's weight, probability calibration, the score threshold and the
              technical group weights adapt to closed results (bounded, and shrunk toward no change until there is enough history). <b>Lessons</b>:
              post-mortems of losing or lagging picks become rules given to Claude and ChatGPT. Scoring changes to stocks.yaml still need
              {isOwner ? " your" : " the owner's"} approval.
            </SheetDescription>
          </SheetHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}

          <section>
            <h4 className="mb-2 font-semibold">Automatic learning · {MARKET_META[market].label}</h4>
            <div className="space-y-2">
              {HORIZONS.map((h) => {
                const l = learning[h.id];
                if (!l) return null;
                return (
                  <Card as="div" key={h.id} className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-sm">{h.label}</b>
                      <Pill tone={l.active ? "good" : "neutral"}>{l.active ? `active · ${l.closed} closed` : `waiting · ${l.closed} closed`}</Pill>
                      {l.active && <span className="text-[11px] text-muted-foreground">evidence weight {(l.shrink * 100).toFixed(0)}%</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Weights: {METHOD_IDS.map((m) => `${METHOD_META[m].short} ${(l.weights[m] * 100).toFixed(0)}%`).join(" · ")}</span>
                      {l.active && <span>Calibration {pts(l.probability_bias, 1)}</span>}
                      {l.active && <span>Score threshold {l.threshold_shift >= 0 ? "+" : ""}{l.threshold_shift.toFixed(1)}</span>}
                      {l.extra_regime_penalty > 0 && <span>Extra falling-market penalty {l.extra_regime_penalty.toFixed(1)}</span>}
                    </div>
                    {Object.keys(l.group_tilt ?? {}).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(l.group_tilt).map(([g, t]) => <Pill key={g} tone={t > 1.02 ? "good" : t < 0.98 ? "bad" : "neutral"}>{g} ×{t.toFixed(2)}</Pill>)}
                      </div>
                    )}
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">{l.notes.map((n, i) => <li key={i}>• {n}</li>)}</ul>
                  </Card>
                );
              })}
            </div>
          </section>

          <section>
            <h4 className="mb-2 font-semibold">Suggested scoring changes ({pending.length})</h4>
            {pending.length === 0 ? <p className="text-muted-foreground">None pending.</p> : (
              <ul className="space-y-2">
                {pending.map((s) => (
                  <li key={s.id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-xs">{s.path}</code>
                      <span className="text-xs tabular-nums">{s.current_value} → <b>{s.suggested_value}</b></span>
                      {isOwner && (
                        <span className="ml-auto flex gap-1">
                          <button onClick={() => act(() => trackerApi.decide(token, s.id, "approve"))} className={btn}><Check className="h-3 w-3" /> Approve</button>
                          <button onClick={() => act(() => trackerApi.decide(token, s.id, "dismiss"))} className={btn}><X className="h-3 w-3" /> Dismiss</button>
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{s.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4 className="mb-2 font-semibold">Applied changes ({overrides.length})</h4>
            {overrides.length === 0 ? <p className="text-muted-foreground">The pipeline uses stocks.yaml as written.</p> : (
              <ul className="space-y-1">
                {overrides.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                    <code>{o.path}</code> = <b className="tabular-nums">{o.value}</b>
                    <span className="text-muted-foreground">since {when(o.created_at)}</span>
                    {isOwner && <button onClick={() => act(() => trackerApi.revert(token, o.id))} className={cx(btn, "ml-auto")}><RotateCcw className="h-3 w-3" /> Revert</button>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4 className="mb-2 font-semibold">Lessons · {MARKET_META[market].label} ({lessons.filter((l) => l.active).length} active)</h4>
            {lessons.length === 0 ? <p className="text-muted-foreground">No lessons yet — they appear after the first losing or lagging prediction is analysed.</p> : (
              <ul className="space-y-1.5">
                {lessons.map((l) => (
                  <li key={l.id} className={cx("rounded-lg border border-border px-3 py-2", !l.active && "opacity-60")}>
                    <div className="flex items-start gap-2">
                      <Pill>{HORIZON_LABEL[l.horizon]}</Pill>
                      <span className="flex-1">{l.text}</span>
                      {isOwner && <button onClick={() => act(() => trackerApi.setLesson(token, l.id, !l.active))} className={cx(btn, "shrink-0")}>{l.active ? "Turn off" : "Turn on"}</button>}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {CAUSE_LABEL[l.cause] ?? l.cause} · used in {l.times_used} review(s){l.priority < 1 ? ` · priority ${l.priority}` : ""}{l.note ? ` · ${l.note}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {decided.length > 0 && (
            <section>
              <h4 className="mb-2 font-semibold">Decided</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {decided.map((s) => <li key={s.id}><code>{s.path}</code> {s.current_value} → {s.suggested_value} · {s.status} {when(s.decided_at)}</li>)}
              </ul>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
