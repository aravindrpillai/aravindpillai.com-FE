import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import {
  HORIZONS, STAGE_LABEL, STAGE_ORDER, type CandidateStage, type PipelineEvent, type Run, type RunStats, type StockStage,
} from "@/lib/stocksApi";
import { MARKET_META, duration } from "./format";

const PIPELINE_STAGES = [
  { id: "collecting", label: "Collect news" },
  { id: "extracting", label: "Extract stocks" },
  { id: "selecting", label: "Pick candidates" },
  { id: "analysing", label: "Analyse" },
  { id: "aggregating", label: "Rank" },
  { id: "reporting", label: "Report" },
  { id: "done", label: "Done" },
];

export default function ProgressPanel({ run, events, candidates, onOpen, collapsed = false }: {
  run: Run;
  events: PipelineEvent[];
  candidates: CandidateStage[];
  onOpen: (candidateId: number) => void;
  collapsed?: boolean;
}) {
  const s = run.stats;
  const active = run.status === "queued" || run.status === "running";
  const [, force] = useState(0);
  const [expanded, setExpanded] = useState(!collapsed);
  useEffect(() => setExpanded(!collapsed), [collapsed, run.id]);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active]);

  if (!s) return null;
  const STEPS = run.kind === "single" ? PIPELINE_STAGES : PIPELINE_STAGES.filter((x) => x.id !== "reporting");
  const stageIdx = STEPS.findIndex((x) => x.id === (run.status === "completed" ? "done" : s.stage));
  const title = run.kind === "single" ? `${run.symbol} analysis` : `${MARKET_META[run.market]?.label ?? run.market} scan`;
  const tokens = (x?: { input_tokens: number; output_tokens: number }) => x ? `${((x.input_tokens + x.output_tokens) / 1000).toFixed(1)}k tokens` : "";

  if (!expanded) {
    return (
      <section className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-card px-4 py-2.5 text-xs shadow-soft">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-muted-foreground">#{run.id} · {duration(run.started_at || run.created_at, run.finished_at)}</span>
        <RunBadge run={run} />
        <span className="text-muted-foreground">{s.articles.fetched} articles · {s.stocks_extracted} stocks · {s.queue.published} analyses ·
          Claude {s.ai.calls} calls · ChatGPT {s.openai?.calls ?? 0} calls · {s.picks} picks</span>
        <button onClick={() => setExpanded(true)} className="ml-auto font-medium text-primary hover:underline">Show run details</button>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">{title} <span className="font-normal text-muted-foreground">· run #{run.id}</span></h2>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <RunBadge run={run} />
          <span className="tabular-nums">⏱ {duration(run.started_at || run.created_at, active ? null : run.finished_at)}</span>
          {collapsed && <button onClick={() => setExpanded(false)} className="text-xs font-medium text-primary hover:underline">Hide</button>}
        </div>
      </div>

      {/* stage stepper */}
      <ol className={`grid grid-cols-3 gap-2 ${run.kind === "single" ? "sm:grid-cols-7" : "sm:grid-cols-6"}`}>
        {STEPS.map((st, i) => {
          const rec = s.stages.find((x) => x.name === st.id);
          const done = run.status === "completed" ? true : i < stageIdx;
          const current = active && i === stageIdx;
          const failed = !active && run.status !== "completed" && i === stageIdx;
          return (
            <li key={st.id} className={`rounded-xl border px-3 py-2 text-xs ${current ? "border-primary bg-primary/5" : "border-border"}`}>
              <div className="flex items-center gap-1.5 font-medium">
                {done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : current ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : failed ? <XCircle className="h-3.5 w-3.5 text-red-600" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                {st.label}
              </div>
              {rec && st.id !== "done" && (
                <div className="mt-0.5 tabular-nums text-muted-foreground">{duration(rec.started_at, rec.finished_at)}</div>
              )}
            </li>
          );
        })}
      </ol>

      {/* counters */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-9">
        <Counter label="Articles fetched" value={s.articles.fetched} />
        <Counter label="Unique stories" value={s.articles.unique} />
        <Counter label="Stocks extracted" value={s.stocks_extracted} />
        {HORIZONS.map((h) => <Counter key={h.id} label={`${h.label} candidates`} value={s.candidates[h.id] ?? 0} />)}
        <Counter label="Claude calls" value={s.ai.calls} hint={s.ai.enabled ? tokens(s.ai) : "off"} />
        <Counter label="ChatGPT calls" value={s.openai?.calls ?? 0} hint={s.openai?.enabled ? tokens(s.openai) : "off"} />
        <Counter label="Picks" value={s.picks} />
      </div>
      <LearningLine stats={s} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Sources stats={s} />
        <QueueBox stats={s} />
      </div>

      <StockStages candidates={candidates} onOpen={onOpen} />

      <Problems stats={s} runError={run.error} />
      <EventLog events={events} />
    </section>
  );
}

export function RunBadge({ run }: { run: Run }) {
  const map: Record<string, string> = {
    queued: "bg-muted text-muted-foreground",
    running: "bg-primary/10 text-primary",
    completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
    cancelled: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[run.status]}`}>{run.cancel_requested && run.status === "running" ? "cancelling…" : run.status}</span>;
}

function LearningLine({ stats }: { stats: RunStats }) {
  const l = stats.learning;
  if (!l || !Object.keys(l).length) return null;
  const active = HORIZONS.filter((h) => l[h.id]?.active);
  const closed = HORIZONS.reduce((n, h) => n + (l[h.id]?.closed ?? 0), 0);
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
      <b className="text-foreground">Learning applied: </b>
      {active.length
        ? active.map((h) => `${h.label} (${l[h.id]!.closed} closed; weights ${Object.entries(l[h.id]!.weights).map(([m, w]) => `${m} ${w.toFixed(2)}`).join(", ")})`).join(" · ")
        : `${closed} closed prediction(s) so far in this market — the configured weights are used until each horizon has enough history.`}
    </div>
  );
}

function Counter({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value ?? 0}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Sources({ stats }: { stats: RunStats }) {
  const rows = Object.entries(stats.sources);
  const max = Math.max(1, ...rows.map(([, v]) => v.articles));
  const icon = (st: string) =>
    st === "ok" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-label="ok" />
      : st === "pending" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="pending" />
      : st === "disabled" ? <Circle className="h-3.5 w-3.5 text-muted-foreground" aria-label="disabled" />
      : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-label={st} />;
  return (
    <div className="rounded-xl border border-border p-3">
      <h3 className="mb-2 text-sm font-medium">Articles per source</h3>
      <ul className="space-y-1.5 text-xs">
        {rows.map(([id, v]) => (
          <li key={id} className="grid grid-cols-[1rem_9rem_1fr_2.5rem] items-center gap-2" title={v.errors?.[0] || v.status}>
            {icon(v.status)}
            <span className={`truncate ${v.status === "disabled" ? "text-muted-foreground" : ""}`}>
              {v.name} <span className="text-muted-foreground">{v.market}</span>
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]" style={{ width: `${(v.articles / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums">{v.status === "disabled" ? "off" : v.articles}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">Hover a source for its error. Amber = blocked by robots.txt or failed.</p>
    </div>
  );
}

function QueueBox({ stats }: { stats: RunStats }) {
  const q = stats.queue;
  const total = Math.max(1, q.published);
  const seg = [
    { label: "Completed", v: q.completed, cls: "bg-emerald-600" },
    { label: "In progress", v: q.in_progress, cls: "bg-primary" },
    { label: "Queued", v: q.pending, cls: "bg-muted-foreground/40" },
    { label: "Failed (dead-letter)", v: q.failed, cls: "bg-red-600" },
  ];
  return (
    <div className="rounded-xl border border-border p-3">
      <h3 className="mb-2 text-sm font-medium">Work queue</h3>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted">
        {seg.map((x) => x.v > 0 && <span key={x.label} className={`${x.cls} h-full`} style={{ width: `${(x.v / total) * 100}%` }} />)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
        {seg.map((x) => (
          <div key={x.label} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${x.cls}`} />
            <span className="text-muted-foreground">{x.label}</span>
            <b className="tabular-nums">{x.v}</b>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Retries</span>
          <b className="tabular-nums">{q.retried}</b>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {q.published} items published · {stats.ai.enabled ? `Claude ${stats.ai.model ?? ""}` : `Claude off: ${stats.ai.reason}`} ·{" "}
        {stats.openai?.enabled ? `ChatGPT ${stats.openai.model ?? ""}` : `ChatGPT off${stats.openai?.reason ? `: ${stats.openai.reason}` : ""}`}
      </p>
    </div>
  );
}

function StockStages({ candidates, onOpen }: { candidates: CandidateStage[]; onOpen: (id: number) => void }) {
  if (!candidates.length) return null;
  return (
    <div className="rounded-xl border border-border p-3">
      <h3 className="mb-2 text-sm font-medium">Each stock</h3>
      <div className="grid gap-3 lg:grid-cols-3">
        {HORIZONS.map((h) => {
          const rows = candidates.filter((c) => c.horizon === h.id);
          return (
            <div key={h.id}>
              <div className="mb-1 text-xs font-medium text-muted-foreground">{h.label}</div>
              <ul className="space-y-1">
                {rows.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => onOpen(c.id)} className="grid w-full grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs hover:bg-muted">
                      <span className="truncate font-medium">{c.ticker}</span>
                      <StageTrack stage={c.stage} />
                      <span className="text-right tabular-nums text-muted-foreground">{c.final_score != null ? c.final_score.toFixed(0) : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Queued → Fetching data → ~70 indicators + backtest → Claude & ChatGPT (parallel) → Ensemble score → Selected / Rejected</p>
    </div>
  );
}

function StageTrack({ stage }: { stage: StockStage }) {
  const terminal = stage === "selected" || stage === "rejected" || stage === "failed";
  const idx = terminal ? STAGE_ORDER.length : STAGE_ORDER.indexOf(stage);
  const endCls = stage === "selected" ? "text-emerald-700 dark:text-emerald-400" : stage === "failed" ? "text-red-700 dark:text-red-400" : "text-muted-foreground";
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex flex-1 gap-0.5" aria-hidden>
        {STAGE_ORDER.map((st, i) => (
          <span key={st} className={`h-1.5 flex-1 rounded-full ${stage === "failed" && i >= idx - 1 ? "bg-red-500/60" : i < idx ? "bg-emerald-600" : i === idx ? "animate-pulse bg-primary" : "bg-muted"}`} />
        ))}
      </span>
      <span className={`w-24 shrink-0 truncate ${terminal ? endCls + " font-medium" : ""}`}>{STAGE_LABEL[stage]}</span>
    </span>
  );
}

function Problems({ stats, runError }: { stats: RunStats; runError: string }) {
  const items = [...(runError ? [{ at: "", message: runError, ticker: "", level: "error" }] : []),
    ...stats.errors.map((e) => ({ ...e, level: "error" })), ...stats.warnings.map((w) => ({ ...w, level: "warning" }))];
  if (!items.length) return null;
  return (
    <details className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" open={!!runError || stats.errors.length > 0}>
      <summary className="cursor-pointer font-medium">
        {stats.errors.length + (runError ? 1 : 0)} error(s), {stats.warnings.length} warning(s)
      </summary>
      <ul className="mt-2 space-y-1">
        {items.slice(0, 40).map((x, i) => (
          <li key={i} className="flex gap-2">
            {x.level === "error" ? <XCircle className="mt-0.5 h-3 w-3 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />}
            <span>{x.ticker && <b>{x.ticker} </b>}{x.message}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function EventLog({ events }: { events: PipelineEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  useEffect(() => {
    if (follow && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [events, follow]);
  return (
    <details className="rounded-xl border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">Live log ({events.length})</summary>
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
        }}
        className="mt-2 max-h-72 overflow-y-auto font-mono text-[11px] leading-5"
      >
        {events.map((e) => (
          <div key={e.id} className={e.level === "error" ? "text-red-700 dark:text-red-400" : e.level === "warning" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>
            <span className="opacity-60">{new Date(e.at).toLocaleTimeString()}</span>{" "}
            {e.ticker && <b className="text-foreground">{e.ticker}{e.horizon ? `/${e.horizon}` : ""} </b>}
            {e.message}
          </div>
        ))}
      </div>
    </details>
  );
}
