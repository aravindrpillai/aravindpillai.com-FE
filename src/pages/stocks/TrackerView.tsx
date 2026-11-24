import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, RefreshCw, RotateCcw, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { HORIZONS, HORIZON_LABEL, type Horizon, type Market } from "@/lib/stocksApi";
import {
  trackerApi, type Checkpoint, type Lesson, type Override, type Prediction, type Suggestion, type TrackerSummary,
} from "@/lib/stocksTrackerApi";
import { MARKET_META, money, when } from "./format";

const BENCH_LABEL: Record<string, string> = { "^GSPC": "S&P 500", "^GSPTSE": "S&P/TSX", "^NSEI": "Nifty 50" };
const EXIT_LABEL: Record<string, string> = { target: "target hit", stop: "stop-loss hit", final: "final checkpoint", hard_cap: "hard cap" };
const CAUSE_LABEL: Record<string, string> = {
  market_wide_move: "Market-wide move", news_misread: "News misread", technical_false_signal: "Technical false signal",
  stop_too_tight: "Stop too tight", target_too_far: "Target too far", event_risk: "Event risk", valuation: "Valuation",
  timing: "Timing", data_quality: "Data quality", other: "Other",
};

const pctText = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)}%`);
const ptsText = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)} pts`);
const signCls = (v: number | null | undefined) =>
  v === null || v === undefined ? "text-muted-foreground" : v > 0 ? "text-emerald-700 dark:text-emerald-400" : v < 0 ? "text-red-700 dark:text-red-400" : "";

function minutesText(m: number) {
  const h = Math.floor(m / 60), mm = Math.round(m % 60);
  return h ? `${h}h ${String(mm).padStart(2, "0")}m` : `${mm}m`;
}

function progressText(p: Prediction) {
  if (p.status === "pending") return `Starts ${p.entry_mode === "next_open" ? "at the next open" : ""} ${when(p.entry_at)}`.replace("  ", " ");
  const done = p.progress_unit === "min" ? `${minutesText(p.progress_done)} of ${minutesText(p.progress_total)}`
    : `Day ${Math.round(p.progress_done)} of ${Math.round(p.progress_total)}`;
  if (p.status === "closed") return `${done} · closed (${EXIT_LABEL[p.exit_reason] ?? p.exit_reason})`;
  return done;
}

export function OutcomeBadge({ p }: { p: Prediction }) {
  if (p.status !== "closed") return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{p.status === "pending" ? "Waiting for entry" : "Open"}</span>;
  const map = {
    profit: ["▲ Profit", "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"],
    loss: ["▼ Loss", "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"],
    breakeven: ["● Breakeven", "bg-muted text-foreground"],
    "": ["—", "bg-muted text-muted-foreground"],
  } as const;
  const [label, cls] = map[p.outcome] ?? map[""];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>;
}

function BeatChip({ v }: { v: boolean | null }) {
  if (v === null) return null;
  return <span className={`text-[11px] ${v ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{v ? "Beat market: Y" : "Beat market: N"}</span>;
}

function ProgressBar({ p }: { p: Prediction }) {
  const pct = p.progress_total ? Math.min(100, (p.progress_done / p.progress_total) * 100) : 0;
  const finals = p.checkpoints.filter((c) => c.kind !== "extended" && c.kind !== "hard_cap");
  return (
    <div className="min-w-[10rem]">
      <div className="relative h-2 rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${p.status === "closed" ? "bg-muted-foreground/50" : "bg-primary"}`} style={{ width: `${pct}%` }} />
        {p.progress_unit === "day" && finals.filter((c) => c.day).map((c) => (
          <span key={c.key} title={c.label} className={`absolute top-1/2 h-3 w-0.5 -translate-y-1/2 ${c.status === "done" ? "bg-foreground" : "bg-muted-foreground/60"}`}
            style={{ left: `${Math.min(100, ((c.day ?? 0) / p.progress_total) * 100)}%` }} />
        ))}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{progressText(p)}</div>
    </div>
  );
}

function CheckpointChips({ cps }: { cps: Checkpoint[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {cps.filter((c) => c.kind !== "hard_cap" || c.status === "done").map((c) => (
        <span key={c.key} title={c.status === "done" ? `${c.label}: ${pctText(c.return)} vs index ${pctText(c.index_return)}` : `${c.label}: due ${when(c.due_at)}`}
          className={`rounded-md border px-1.5 py-0.5 text-[10px] tabular-nums ${c.kind === "final" ? "border-foreground/40" : "border-border"} ${c.status === "done" ? "" : "text-muted-foreground"}`}>
          {c.label} {c.status === "done" ? <b className={signCls(c.return)}>{pctText(c.return, 1)}</b> : c.status === "skipped" ? "skipped" : "…"}
        </span>
      ))}
    </div>
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
  const [status, setStatus] = useState<"open" | "closed" | "all">("open");
  const [horizon, setHorizon] = useState<Horizon | "">("");
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

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl">Prediction Tracker · {MARKET_META[market].flag} {MARKET_META[market].label}</h2>
        <span className="text-xs text-muted-foreground">
          vs {BENCH_LABEL[bench ?? ""] ?? bench} · checked every {summary?.every_minutes ?? 15} min
          {summary?.last_evaluated_at ? ` · last ${when(summary.last_evaluated_at)}` : ""}
        </span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setLearningOpen(true)} className="relative flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm hover:bg-muted">
            Learning
            {(summary?.pending_suggestions ?? 0) > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{summary?.pending_suggestions}</span>
            )}
          </button>
          <button onClick={evaluateNow} disabled={summary?.pass_running} className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm hover:bg-muted disabled:opacity-60">
            {summary?.pass_running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {summary?.pass_running ? "Evaluating…" : "Evaluate now"}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-border bg-card px-4 py-2 text-sm">{error}</div>}

      {/* track record */}
      <div className="grid gap-3 md:grid-cols-3">
        {HORIZONS.map((h) => {
          const r = summary?.horizons.find((x) => x.horizon === h.id);
          return (
            <div key={h.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">{h.label}</h3>
                <span className="text-xs text-muted-foreground">{r?.open ?? 0} open · {r?.closed ?? 0} closed</span>
              </div>
              {r && r.closed > 0 ? (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div><dt className="text-[11px] text-muted-foreground">Win rate</dt><dd className="text-lg font-semibold tabular-nums">{r.win_rate}%</dd></div>
                  <div><dt className="text-[11px] text-muted-foreground">Beat {BENCH_LABEL[bench ?? ""] ?? "index"}</dt><dd className="text-lg font-semibold tabular-nums">{r.beat_market_rate}%</dd></div>
                  <div><dt className="text-[11px] text-muted-foreground">Avg return</dt><dd className={`tabular-nums ${signCls(r.avg_return)}`}>{pctText(r.avg_return)}</dd></div>
                  <div><dt className="text-[11px] text-muted-foreground">Avg alpha</dt><dd className={`tabular-nums ${signCls(r.avg_alpha)}`}>{ptsText(r.avg_alpha)}</dd></div>
                  <div className="col-span-2 text-[11px] text-muted-foreground">
                    {r.profit} profit · {r.loss} loss · {r.breakeven} breakeven (±{summary?.breakeven_pct?.[h.id] ?? "—"}%)
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No closed {h.label.toLowerCase()} predictions yet.</p>
              )}
            </div>
          );
        })}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-xl border border-border text-sm">
          {(["open", "closed", "all"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 capitalize ${status === s ? "bg-muted font-medium" : "text-muted-foreground"}`}>{s}</button>
          ))}
        </div>
        <div className="inline-flex overflow-hidden rounded-xl border border-border text-sm">
          {[{ id: "" as const, label: "All horizons" }, ...HORIZONS].map((h) => (
            <button key={h.id || "all"} onClick={() => setHorizon(h.id)} className={`px-3 py-1.5 ${horizon === h.id ? "bg-muted font-medium" : "text-muted-foreground"}`}>{h.label}</button>
          ))}
        </div>
      </div>

      {/* list */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {status === "open" ? "No open predictions." : "Nothing here yet."} Every pick of a Run Analysis (and every horizon that passes in
          “Analyse a stock”) is tracked automatically from the moment it is suggested.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">Stock</th>
                <th className="px-3 py-2 font-medium">Suggested</th>
                <th className="px-3 py-2 text-right font-medium">Entry</th>
                <th className="px-3 py-2 text-right font-medium">Return</th>
                <th className="px-3 py-2 text-right font-medium">vs index</th>
                <th className="px-3 py-2 font-medium">Progress</th>
                <th className="px-3 py-2 font-medium">Checkpoints</th>
                <th className="px-3 py-2 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const ret = p.status === "closed" ? p.final_return : p.last_return;
                const alpha = p.status === "closed" ? p.final_alpha : p.last_alpha;
                return (
                  <tr key={p.id} onClick={() => setDrawer(p.id)} className="cursor-pointer border-b border-border align-top last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <div className="font-medium">{p.ticker}</div>
                      <div className="text-[11px] text-muted-foreground">{HORIZON_LABEL[p.horizon]}{p.source === "single" ? " · single stock" : ""}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{when(p.suggested_at)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(p.entry_price, p.currency, p.market)}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${signCls(ret)}`}>{pctText(ret)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${signCls(alpha)}`}>{ptsText(alpha)}</td>
                    <td className="px-3 py-2"><ProgressBar p={p} /></td>
                    <td className="px-3 py-2"><CheckpointChips cps={p.checkpoints} /></td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-start gap-1">
                        <OutcomeBadge p={p} />
                        <BeatChip v={p.status === "closed" ? p.beat_market : null} />
                        {p.analysis_status === "done" && <span className="text-[11px] text-muted-foreground">post-mortem ready</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PredictionDrawer token={token} id={drawer} onClose={() => setDrawer(null)} onOpenCandidate={onOpenCandidate} />
      <LearningSheet token={token} market={market} isOwner={isOwner} open={learningOpen} onClose={() => { setLearningOpen(false); load(); }} />
    </section>
  );
}

// =============================================================================== one prediction
function PredictionDrawer({ token, id, onClose, onOpenCandidate }: {
  token: string; id: number | null; onClose: () => void; onOpenCandidate: (candidateId: number) => void;
}) {
  const [p, setP] = useState<Prediction | null>(null);
  useEffect(() => {
    if (id == null) return;
    setP(null);
    trackerApi.prediction(token, id).then(setP).catch(() => setP(null));
  }, [token, id]);

  return (
    <Sheet open={id != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {!p ? <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
          <div className="space-y-5 pb-8 text-sm">
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle className="flex flex-wrap items-baseline gap-2 font-display text-2xl">
                {p.ticker} <span className="text-base font-normal text-muted-foreground">{p.name}</span>
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-muted px-2 py-0.5">{HORIZON_LABEL[p.horizon]}</span>
                <OutcomeBadge p={p} /> <BeatChip v={p.status === "closed" ? p.beat_market : null} />
                <span>vs {BENCH_LABEL[p.benchmark] ?? p.benchmark}</span>
              </SheetDescription>
            </SheetHeader>

            <ProgressBar p={p} />
            {p.calendar_approximate && <p className="text-xs text-muted-foreground">Some checkpoint dates are beyond the exchange's published holiday calendar and assume a normal weekday schedule.</p>}
            {p.error && <p className="text-xs text-amber-700 dark:text-amber-400">{p.error}</p>}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Suggested", `${money(p.suggested_price, p.currency, p.market)}`, when(p.suggested_at)],
                ["Entry", money(p.entry_price, p.currency, p.market), p.entry_price ? `${p.entry_mode === "next_open" ? "next open · " : ""}${when(p.entry_at)}` : `planned ${when(p.entry_at)}`],
                ["Stop-loss", money(p.stop_loss, p.currency, p.market), ""],
                ["Target", money(p.target, p.currency, p.market), ""],
              ].map(([k, v, sub]) => (
                <div key={k} className="rounded-xl border border-border px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">{k}</div>
                  <div className="font-semibold tabular-nums">{v}</div>
                  {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted text-muted-foreground">
                  <tr><th className="px-3 py-1.5 text-left font-medium">Result</th><th className="px-3 py-1.5 text-right font-medium">Stock</th>
                    <th className="px-3 py-1.5 text-right font-medium">Index</th><th className="px-3 py-1.5 text-right font-medium">Alpha</th></tr>
                </thead>
                <tbody className="tabular-nums">
                  <ResultRow label={`Exit at target/stop${p.exit_reason ? ` (${EXIT_LABEL[p.exit_reason]})` : ""}`} r={p.exit_return} i={p.exit_index_return} a={p.exit_alpha}
                    basis={p.outcome_basis === "exit"} />
                  <ResultRow label={`Hold to final checkpoint${p.hold_complete ? "" : " (pending)"}`} r={p.hold_return} i={p.hold_index_return} a={p.hold_alpha}
                    basis={p.outcome_basis === "hold"} />
                  {p.status !== "closed" && <ResultRow label="Now" r={p.last_return} i={p.last_index_return} a={p.last_alpha} basis={false} />}
                </tbody>
              </table>
              <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
                ★ decides the outcome. Best move after entry {pctText(p.max_runup)} · worst {pctText(p.max_drawdown)}.
              </p>
            </div>

            <div>
              <h4 className="mb-1 font-medium">Checkpoints</h4>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-muted-foreground">
                    <tr><th className="px-3 py-1.5 text-left font-medium">Checkpoint</th><th className="px-3 py-1.5 text-left font-medium">Due</th>
                      <th className="px-3 py-1.5 text-right font-medium">Price</th><th className="px-3 py-1.5 text-right font-medium">Return</th>
                      <th className="px-3 py-1.5 text-right font-medium">Index</th><th className="px-3 py-1.5 text-right font-medium">Alpha</th></tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {p.checkpoints.map((c) => (
                      <tr key={c.key} className="border-t border-border">
                        <td className="px-3 py-1.5">{c.label}{c.kind === "interim" ? <span className="text-muted-foreground"> · tracking</span> : c.kind === "extended" ? <span className="text-muted-foreground"> · secondary</span> : ""}</td>
                        <td className="px-3 py-1.5">{when(c.due_at)}</td>
                        <td className="px-3 py-1.5 text-right">{c.status === "done" ? money(c.price, p.currency, p.market) : c.status}</td>
                        <td className={`px-3 py-1.5 text-right ${signCls(c.return)}`}>{pctText(c.return)}</td>
                        <td className={`px-3 py-1.5 text-right ${signCls(c.index_return)}`}>{pctText(c.index_return)}</td>
                        <td className={`px-3 py-1.5 text-right ${signCls(c.alpha)}`}>{ptsText(c.alpha)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {p.extended_note && <p className="rounded-xl bg-muted/50 px-4 py-3 text-xs">{p.extended_note}</p>}

            {p.loss_analysis && (
              <div className="space-y-2 rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium">Post-mortem</h4>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{CAUSE_LABEL[p.loss_analysis.cause] ?? p.loss_analysis.cause}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {p.loss_analysis.trigger === "both" ? "loss + lagged the index" : p.loss_analysis.trigger === "loss" ? "loss" : "lagged the index"} ·{" "}
                    {p.loss_analysis.method === "claude" ? `Claude ${p.loss_analysis.model}` : "rule-based (Claude unavailable)"}
                  </span>
                </div>
                <p className="leading-relaxed">{p.loss_analysis.explanation}</p>
                {p.loss_analysis.what_was_missed && <p className="text-muted-foreground"><b className="text-foreground">Missed: </b>{p.loss_analysis.what_was_missed}</p>}
                {p.loss_analysis.revisit_note && <p className="text-xs text-muted-foreground">{p.loss_analysis.revisit_note}</p>}
                {(p.lessons ?? []).length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium">Lessons learned</h5>
                    <ul className="list-disc pl-5 text-muted-foreground">{p.lessons!.map((l) => <li key={l.id}>{l.text}{!l.active && " (off)"}</li>)}</ul>
                  </div>
                )}
                {(p.suggestions ?? []).length > 0 && (
                  <p className="text-xs text-muted-foreground">{p.suggestions!.length} scoring suggestion(s) — see Learning.</p>
                )}
              </div>
            )}
            {p.analysis_status === "pending" && <p className="text-xs text-muted-foreground">Post-mortem queued for the next tracker pass.</p>}

            {p.candidate_id && (
              <button onClick={() => onOpenCandidate(p.candidate_id!)} className="text-xs font-medium text-primary hover:underline">
                Open the original analysis (chart, indicators, Claude's reasoning) →
              </button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ResultRow({ label, r, i, a, basis }: { label: string; r: number | null; i: number | null; a: number | null; basis: boolean }) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-1.5">{basis && "★ "}{label}</td>
      <td className={`px-3 py-1.5 text-right font-medium ${signCls(r)}`}>{pctText(r)}</td>
      <td className={`px-3 py-1.5 text-right ${signCls(i)}`}>{pctText(i)}</td>
      <td className={`px-3 py-1.5 text-right ${signCls(a)}`}>{ptsText(a)}</td>
    </tr>
  );
}

// =============================================================================== learning
function LearningSheet({ token, market, isOwner, open, onClose }: {
  token: string; market: Market; isOwner: boolean; open: boolean; onClose: () => void;
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

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <div className="space-y-6 pb-8 text-sm">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-2xl">Learning</SheetTitle>
            <SheetDescription className="text-xs">
              Lessons from losing or lagging predictions are added to future Claude reviews ({MARKET_META[market].label}, same horizon).
              Scoring suggestions change nothing until {isOwner ? "you approve them" : "the owner approves them"}; an approved change applies
              from the next run and can be reverted.
            </SheetDescription>
          </SheetHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div>
            <h4 className="mb-2 font-medium">Suggested scoring changes ({pending.length})</h4>
            {pending.length === 0 ? <p className="text-muted-foreground">None pending.</p> : (
              <ul className="space-y-2">
                {pending.map((s) => (
                  <li key={s.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-xs">{s.path}</code>
                      <span className="tabular-nums text-xs">{s.current_value} → <b>{s.suggested_value}</b></span>
                      {isOwner && (
                        <span className="ml-auto flex gap-1">
                          <button onClick={() => act(() => trackerApi.decide(token, s.id, "approve"))} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"><Check className="h-3 w-3" /> Approve</button>
                          <button onClick={() => act(() => trackerApi.decide(token, s.id, "dismiss"))} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"><X className="h-3 w-3" /> Dismiss</button>
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{s.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="mb-2 font-medium">Applied changes ({overrides.length})</h4>
            {overrides.length === 0 ? <p className="text-muted-foreground">The pipeline uses stocks.yaml as written.</p> : (
              <ul className="space-y-1">
                {overrides.map((o) => (
                  <li key={o.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                    <code>{o.path}</code> = <b className="tabular-nums">{o.value}</b>
                    <span className="text-muted-foreground">since {when(o.created_at)}</span>
                    {isOwner && (
                      <button onClick={() => act(() => trackerApi.revert(token, o.id))} className="ml-auto flex items-center gap-1 rounded-lg border border-border px-2 py-1 hover:bg-muted">
                        <RotateCcw className="h-3 w-3" /> Revert
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="mb-2 font-medium">Lessons · {MARKET_META[market].label} ({lessons.filter((l) => l.active).length} active)</h4>
            {lessons.length === 0 ? <p className="text-muted-foreground">No lessons yet — they appear after the first losing or lagging prediction is analysed.</p> : (
              <ul className="space-y-1.5">
                {lessons.map((l) => (
                  <li key={l.id} className={`rounded-lg border border-border px-3 py-2 ${l.active ? "" : "opacity-60"}`}>
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px]">{HORIZON_LABEL[l.horizon]}</span>
                      <span className="flex-1">{l.text}</span>
                      {isOwner && (
                        <button onClick={() => act(() => trackerApi.setLesson(token, l.id, !l.active))} className="shrink-0 rounded-lg border border-border px-2 py-0.5 text-[11px] hover:bg-muted">
                          {l.active ? "Turn off" : "Turn on"}
                        </button>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {CAUSE_LABEL[l.cause] ?? l.cause} · used in {l.times_used} review(s){l.priority < 1 ? ` · priority ${l.priority}` : ""}{l.note ? ` · ${l.note}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {decided.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium">Decided</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {decided.map((s) => <li key={s.id}><code>{s.path}</code> {s.current_value} → {s.suggested_value} · {s.status} {when(s.decided_at)}</li>)}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
