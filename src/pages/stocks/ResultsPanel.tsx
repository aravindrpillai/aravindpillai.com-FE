import { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, ExternalLink, Info, XCircle } from "lucide-react";
import { HORIZONS, type Candidate, type Ensemble, type Horizon, type MethodId, type MethodView, type RunDetail } from "@/lib/stocksApi";
import { METHOD_IDS, METHOD_META, REGIME_META, marketLabel, methodsOf, money, num, pct, scoreClass, signCls } from "./format";
import StockReport from "./StockReport";
import { Card, CardHead, EmptyState, Meter, MethodVote, Pill, ScoreRing, Segmented, VerdictPill, cx } from "./ui";

export default function ResultsPanel({ detail, onOpen }: { detail: RunDetail; onOpen: (id: number) => void }) {
  if (detail.run.kind === "single") return <SingleResult detail={detail} onOpen={onOpen} />;
  const market = detail.run.market;
  const total = detail.picks.length;
  const screened = detail.candidates.filter((c) => c.status !== "selected").length;
  const withPicks = HORIZONS.filter((h) => detail.picks.some((p) => p.horizon === h.id));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{total ? "Buy opportunities" : "No strong buying opportunities"} · {marketLabel(market)}</h2>
          <p className="text-xs text-muted-foreground">
            {total
              ? `${total} stock${total === 1 ? "" : "s"} met every requirement: solid fundamentals, a positive expected value after costs, agreement between the native engine, Claude and ChatGPT, and no AI veto. `
              : ""}
            {detail.candidates.length} candidates analysed; {screened} screened out and not shown (weak fundamentals, red flags, no statistical edge or an AI
            “avoid”). The list is never padded to fill slots.
          </p>
        </div>
        <RegimeBadge c={detail.candidates.find((c) => c.technical?.context?.regime)} />
      </div>

      {total === 0 ? (
        <EmptyState icon={<Info className="h-5 w-5" />} title="There are currently no strong buying opportunities in this scan">
          No stock in today's news-driven candidates cleared the bar. Buying nothing is a valid decision when the evidence does not support
          a trade. Try again after the next session, or research a specific stock with the search box above.
        </EmptyState>
      ) : (
        <>
          <HowItWorks />
          {withPicks.map((h) => {
            const picks = detail.picks.filter((p) => p.horizon === h.id);
            return (
              <section key={h.id} className="space-y-2.5">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-base font-semibold">{h.label}</h3>
                  <span className="text-xs text-muted-foreground">{h.blurb}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {picks.map((c) => <PickCard key={c.id} c={c} onOpen={onOpen} />)}
                </div>
              </section>
            );
          })}
          {withPicks.length < HORIZONS.length && (
            <p className="text-xs text-muted-foreground">
              No qualifying {HORIZONS.filter((h) => !withPicks.includes(h)).map((h) => h.label.toLowerCase()).join(" or ")} opportunity in this run.
            </p>
          )}
          <ComparisonCard candidates={detail.candidates.filter((c) => c.status === "selected")} onOpen={onOpen} />
        </>
      )}
    </div>
  );
}

function RegimeBadge({ c }: { c?: Candidate }) {
  const r = c?.technical?.context?.regime;
  if (!r) return null;
  const meta = REGIME_META[r.state] ?? REGIME_META.unknown;
  return <span className={cx("rounded-md px-2 py-1 text-xs font-medium", meta.cls)} title={r.label}>{meta.label}{r.roc20 != null ? ` · index ${pct(r.roc20, 1)} (20d)` : ""}</span>;
}

function HowItWorks() {
  return (
    <details className="group rounded-xl border border-border bg-card shadow-soft">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium">
        <Info className="h-4 w-4 text-primary" /> How a pick is decided
        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition group-open:rotate-90" />
      </summary>
      <ol className="grid gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
        <li><b className="text-foreground">1 · Native engine.</b> ~70 indicators in 7 groups (trend, momentum, volatility, volume, structure,
          relative strength &amp; market regime, over-extension risk) + news + fundamentals, blended with a backtest of the same set-up on the
          stock's own history, after costs.</li>
        <li><b className="text-foreground">2 · Two independent AI reviews.</b> Claude and ChatGPT get the same package, in parallel, and each
          returns a verdict, confidence, calibrated win probability and per-factor ratings.</li>
        <li><b className="text-foreground">3 · Weighted ensemble.</b> Each method's weight comes from its tracked accuracy in this market and
          horizon. Probabilities are calibrated with the track record, and the score is cut when the methods disagree.</li>
        <li><b className="text-foreground">4 · Gates.</b> No AI veto, enough methods agree, minimum win probability, positive expected value
          after costs, minimum score and risk/reward. Anything that fails is rejected, with the reason shown.</li>
      </ol>
    </details>
  );
}

// ------------------------------------------------------------------------------------------- pick card
function PickCard({ c, onOpen }: { c: Candidate; onOpen: (id: number) => void }) {
  const t = c.technical;
  const e = c.ensemble;
  const m = (v: number | null | undefined) => money(v, c.currency, c.market);
  const methods = methodsOf(c);
  return (
    <Card as="article" className="flex flex-col p-4">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-foreground text-xs font-bold text-background">{c.pick?.rank}</span>
        <div className="min-w-0 flex-1">
          <button onClick={() => onOpen(c.id)} className="text-base font-semibold hover:underline">{c.ticker}</button>
          <div className="truncate text-xs text-muted-foreground">{c.name}</div>
        </div>
        <div className="text-right">
          <div className="text-base font-semibold tabular-nums">{m(c.price)}</div>
          {c.origin === "watchlist" && <Pill className="mt-0.5">watchlist</Pill>}
        </div>
      </header>

      <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-3">
        <ScoreRing value={c.final_score} size={52} label="Final ensemble score" />
        <dl className="grid grid-cols-3 gap-2">
          <Metric label="Win prob." value={c.win_probability != null ? `${Math.round(c.win_probability)}%` : "—"} cls={scoreClass(c.win_probability)} />
          <Metric label="Exp. value" value={pct(c.expected_value)} cls={signCls(c.expected_value)} />
          <Metric label="R/R" value={num(t?.risk_reward, 2)} />
        </dl>
      </div>

      <div className="mt-3 space-y-1.5 rounded-lg bg-muted/50 px-3 py-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-medium uppercase tracking-wide">Votes</span>
          {e?.votes != null && <span>{e.votes}/{e.available} say buy{e.weights_source === "learned" ? " · learned weights" : ""}</span>}
        </div>
        {METHOD_IDS.map((id) => <MethodVote key={id} id={id} view={methods[id]} />)}
      </div>

      {t && (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <Metric label="Entry" value={`${m(t.entry_low)}–${m(t.entry_high)}`} small />
          <Metric label="Stop" value={m(t.stop_loss)} cls="text-red-600 dark:text-red-400" small />
          <Metric label="Target" value={m(t.targets?.[0])} cls="text-emerald-600 dark:text-emerald-400" small />
        </dl>
      )}

      <WhyBuy c={c} />

      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{c.pick?.reason}</p>

      {(c.top_articles ?? []).length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-border pt-2 text-xs">
          {c.top_articles!.slice(0, 2).map((a) => (
            <li key={a.id} className="truncate">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="group inline-flex max-w-full items-center gap-1 hover:underline">
                <span className="truncate">{a.title}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
              </a>
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => onOpen(c.id)} className="mt-auto flex items-center gap-1 pt-3 text-left text-xs font-semibold text-primary hover:underline">
        How this was decided · chart · indicators <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </Card>
  );
}

const HOLD_FOR: Record<Horizon, string> = { intraday: "today's session", swing: "about 2 weeks (10 trading days)", long_term: "about 6 months" };

/** The investment case in numbers: horizon, upside to target, expected value, fundamental quality and strengths. */
function WhyBuy({ c }: { c: Candidate }) {
  const t = c.technical;
  const q = (t?.fundamentals?.quality ?? null) as { score?: number | null; strengths?: string[]; event_risk?: string | null; upside_to_target?: number | null } | null;
  const entry = t?.entry_low != null && t?.entry_high != null ? (t.entry_low + t.entry_high) / 2 : null;
  const toTarget = entry && t?.targets?.[0] ? 100 * (t.targets[0] / entry - 1) : null;
  return (
    <div className="mt-3 space-y-1.5 rounded-lg border border-emerald-600/20 bg-emerald-50/60 px-3 py-2 text-xs dark:bg-emerald-950/20">
      <div className="font-semibold text-emerald-700 dark:text-emerald-300">Why it's a buy</div>
      <p className="text-muted-foreground">
        Horizon: <b className="text-foreground">{HOLD_FOR[c.horizon]}</b>. Target <b className="text-foreground">{pct(toTarget, 1)}</b> from entry;
        expected value <b className={signCls(c.expected_value)}>{pct(c.expected_value)}</b> per trade after costs
        {c.win_probability != null ? <> at a {Math.round(c.win_probability)}% estimated win rate</> : null}.
        {q?.score != null && <> Fundamental quality <b className={scoreClass(q.score)}>{Math.round(q.score)}/100</b>.</>}
        {q?.upside_to_target != null && <> Analysts' mean target {pct(q.upside_to_target, 0)} away.</>}
      </p>
      {(q?.strengths ?? []).slice(0, 2).map((s, i) => (
        <div key={i} className="flex gap-1.5 text-muted-foreground"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />{s}</div>
      ))}
      {q?.event_risk && <div className="flex gap-1.5 text-amber-700 dark:text-amber-400"><Info className="mt-0.5 h-3 w-3 shrink-0" />{q.event_risk}</div>}
      <p className="text-[10px] text-muted-foreground">Expected values and targets are estimates, not guaranteed returns.</p>
    </div>
  );
}

function Metric({ label, value, cls, small }: { label: string; value: string; cls?: string; small?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cx("truncate font-semibold tabular-nums", small ? "text-xs" : "text-sm", cls)}>{value}</dd>
    </div>
  );
}

// ------------------------------------------------------------------------------------------- comparison
function rankOf(e: Ensemble | undefined, id: MethodId | "final") {
  return e?.ranks?.[id];
}

function ComparisonCard({ candidates, onOpen }: { candidates: Candidate[]; onOpen: (id: number) => void }) {
  const [h, setH] = useState<Horizon>(() => HORIZONS.find((x) => candidates.some((c) => c.horizon === x.id && c.status === "selected"))?.id
    ?? HORIZONS.find((x) => candidates.some((c) => c.horizon === x.id))?.id ?? "swing");
  const rows = useMemo(() => candidates.filter((c) => c.horizon === h)
    .sort((a, b) => (rankOf(a.ensemble, "final") ?? 999) - (rankOf(b.ensemble, "final") ?? 999) || (b.final_score ?? -1) - (a.final_score ?? -1)),
    [candidates, h]);
  return (
    <Card>
      <CardHead
        title="Method comparison & ranking"
        subtitle="The recommended stocks, with the rank each method gave them on its own among all analysed candidates, and the final ensemble rank"
        actions={<Segmented size="sm" value={h} onChange={setH}
          options={HORIZONS.map((x) => ({ id: x.id, label: x.label, count: candidates.filter((c) => c.horizon === x.id).length }))} />}
      />
      {rows.length === 0 ? (
        <div className="p-4"><EmptyState title="No candidates in this horizon" /></div>
      ) : (
        <>
          {/* desktop */}
          <div className="stocks-scroll hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Final</th>
                  <th className="px-3 py-2 font-medium">Stock</th>
                  {METHOD_IDS.map((id) => (
                    <th key={id} className="px-3 py-2 font-medium">
                      <span className="inline-flex items-center gap-1.5"><span className={cx("h-1.5 w-1.5 rounded-full", METHOD_META[id].dot)} />{METHOD_META[id].short}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Win prob.</th>
                  <th className="px-3 py-2 text-right font-medium">Exp. value</th>
                  <th className="px-3 py-2 text-right font-medium">Score</th>
                  <th className="px-3 py-2 font-medium">Decision</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const methods = methodsOf(c);
                  return (
                    <tr key={c.id} onClick={() => onOpen(c.id)} className="cursor-pointer border-t border-border align-top transition hover:bg-muted/40">
                      <td className="px-3 py-2.5"><RankBadge rank={rankOf(c.ensemble, "final") ?? c.rank} picked={c.status === "selected"} /></td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold">{c.ticker}</div>
                        <div className="max-w-[11rem] truncate text-[11px] text-muted-foreground">{c.name || (c.origin === "watchlist" ? "watchlist fill" : "")}</div>
                      </td>
                      {METHOD_IDS.map((id) => <td key={id} className="px-3 py-2.5"><MethodCell view={methods[id]} rank={rankOf(c.ensemble, id)} /></td>)}
                      <td className={cx("px-3 py-2.5 text-right font-medium tabular-nums", scoreClass(c.win_probability))}>{c.win_probability != null ? `${Math.round(c.win_probability)}%` : "—"}</td>
                      <td className={cx("px-3 py-2.5 text-right tabular-nums", signCls(c.expected_value))}>{pct(c.expected_value)}</td>
                      <td className={cx("px-3 py-2.5 text-right font-semibold tabular-nums", scoreClass(c.final_score))}>{num(c.final_score, 0)}</td>
                      <td className="max-w-[18rem] px-3 py-2.5 text-xs"><Decision c={c} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* mobile / tablet */}
          <ul className="divide-y divide-border lg:hidden">
            {rows.map((c) => {
              const methods = methodsOf(c);
              return (
                <li key={c.id}>
                  <button onClick={() => onOpen(c.id)} className="w-full space-y-2 px-4 py-3 text-left hover:bg-muted/40">
                    <div className="flex items-center gap-2.5">
                      <RankBadge rank={rankOf(c.ensemble, "final") ?? c.rank} picked={c.status === "selected"} />
                      <span className="font-semibold">{c.ticker}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{c.name}</span>
                      <span className={cx("text-sm font-semibold tabular-nums", scoreClass(c.final_score))}>{num(c.final_score, 0)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {METHOD_IDS.map((id) => (
                        <div key={id} className="rounded-md bg-muted/50 px-2 py-1.5">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className={cx("h-1.5 w-1.5 rounded-full", METHOD_META[id].dot)} />{METHOD_META[id].short}</div>
                          <MethodCell view={methods[id]} rank={rankOf(c.ensemble, id)} compact />
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="text-muted-foreground">Win <b className={scoreClass(c.win_probability)}>{c.win_probability != null ? `${Math.round(c.win_probability)}%` : "—"}</b></span>
                      <span className="text-muted-foreground">EV <b className={signCls(c.expected_value)}>{pct(c.expected_value)}</b></span>
                    </div>
                    <div className="text-xs"><Decision c={c} /></div>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

function RankBadge({ rank, picked }: { rank?: number | null; picked: boolean }) {
  return (
    <span className={cx("inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-bold tabular-nums",
      picked ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950" : "bg-muted text-muted-foreground")}>
      {rank ?? "—"}
    </span>
  );
}

function MethodCell({ view, rank, compact }: { view?: MethodView; rank?: number; compact?: boolean }) {
  if (!view?.available) return <span className="text-[11px] text-muted-foreground" title={view?.reason}>off</span>;
  return (
    <div className="min-w-0 space-y-1" title={view.detail}>
      <div className="flex items-center gap-1.5">
        <VerdictPill verdict={view.verdict} />
        {!compact && rank != null && <span className="text-[11px] tabular-nums text-muted-foreground">#{rank}</span>}
      </div>
      <div className="flex items-center gap-1.5">
        <Meter value={view.score} className="w-10 shrink-0" />
        <span className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">{num(view.score, 0)}{view.probability != null ? ` · ${Math.round(view.probability)}%` : ""}</span>
      </div>
      {compact && rank != null && <div className="text-[10px] text-muted-foreground">rank #{rank}</div>}
    </div>
  );
}

function Decision({ c }: { c: Candidate }) {
  if (c.status === "selected") {
    return <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Picked #{c.pick?.rank}</span>;
  }
  if (c.status === "pending") return <span className="text-muted-foreground">{c.stage.replace("_", " ")}…</span>;
  const failed = c.ensemble?.gates?.filter((g) => !g.passed) ?? [];
  return (
    <span className={cx("inline-flex items-start gap-1", c.status === "failed" ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="line-clamp-2">{failed.length ? failed.map((g) => g.label).join(" · ") : c.rejection_reason}</span>
    </span>
  );
}

// ------------------------------------------------------------------------------------------- single stock
/** One stock, three horizons: a decision card per horizon (passes / does not pass, and why). */
function SingleResult({ detail, onOpen }: { detail: RunDetail; onOpen: (id: number) => void }) {
  const first = detail.candidates[0];
  return (
    <div className="space-y-4">
      {detail.report ? <StockReport r={detail.report} /> : (
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">{detail.run.symbol}</h2>
            {first?.name && <span className="text-muted-foreground">{first.name}</span>}
            <Pill>{marketLabel(detail.run.market)}</Pill>
            {first && <span className="ml-auto text-xl font-semibold tabular-nums">{money(first.price, first.currency, first.market)}</span>}
          </div>
          {first?.news_summary && <p className="mt-2 text-sm text-muted-foreground">{first.news_summary}</p>}
          <div className="mt-2"><RegimeBadge c={first} /></div>
        </Card>
      )}
      <div className="pt-2">
        <h3 className="text-base font-semibold">Trade set-ups by horizon</h3>
        <p className="text-xs text-muted-foreground">Whether a fresh entry passes every buy gate for each holding period, with entry, stop and target.</p>
      </div>
      <HowItWorks />
      <div className="grid gap-3 lg:grid-cols-3">
        {HORIZONS.map((h) => {
          const c = detail.candidates.find((x) => x.horizon === h.id);
          if (!c) return null;
          const passes = c.status === "selected";
          const t = c.technical;
          const methods = methodsOf(c);
          const m = (v: number | null | undefined) => money(v, c.currency, c.market);
          const failed = c.ensemble?.gates?.filter((g) => !g.passed) ?? [];
          return (
            <Card as="article" key={h.id} className="flex flex-col p-4">
              <header className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold">{h.label}</h3>
                  <p className="text-[11px] text-muted-foreground">{h.blurb}</p>
                </div>
                <Pill tone={passes ? "good" : c.status === "failed" ? "bad" : "neutral"}>
                  {passes ? "✓ Passes" : c.status === "failed" ? "Failed" : "Does not pass"}
                </Pill>
              </header>
              <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-3">
                <ScoreRing value={c.final_score} size={52} />
                <dl className="grid grid-cols-3 gap-2">
                  <Metric label="Win prob." value={c.win_probability != null ? `${Math.round(c.win_probability)}%` : "—"} cls={scoreClass(c.win_probability)} />
                  <Metric label="Exp. value" value={pct(c.expected_value)} cls={signCls(c.expected_value)} />
                  <Metric label="R/R" value={num(t?.risk_reward, 2)} />
                </dl>
              </div>
              <div className="mt-3 space-y-1.5 rounded-lg bg-muted/50 px-3 py-2">
                {METHOD_IDS.map((id) => <MethodVote key={id} id={id} view={methods[id]} />)}
              </div>
              {t && (
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Metric label="Entry" value={`${m(t.entry_low)}–${m(t.entry_high)}`} small />
                  <Metric label="Stop" value={m(t.stop_loss)} cls="text-red-600 dark:text-red-400" small />
                  <Metric label="Target" value={m(t.targets?.[0])} cls="text-emerald-600 dark:text-emerald-400" small />
                </dl>
              )}
              {!passes && failed.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs">
                  {failed.map((g) => (
                    <li key={g.id} className="flex gap-1.5 text-muted-foreground"><XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" /><span><b className="text-foreground">{g.label}:</b> {g.detail}</span></li>
                  ))}
                </ul>
              )}
              <p className="mt-3 line-clamp-4 text-sm text-muted-foreground">{passes ? c.pick?.reason : !failed.length && c.rejection_reason}</p>
              <button onClick={() => onOpen(c.id)} className="mt-auto flex items-center gap-1 pt-3 text-left text-xs font-semibold text-primary hover:underline">
                Full decision, chart & {t?.scorecard?.total ?? ""} indicators <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
