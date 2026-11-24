import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { HORIZONS, type Candidate, type Horizon, type RunDetail } from "@/lib/stocksApi";
import { VERDICT_LABEL, marketLabel, money, num, scoreClass, verdictClass } from "./format";

export default function ResultsPanel({ detail, onOpen }: { detail: RunDetail; onOpen: (id: number) => void }) {
  if (detail.run.kind === "single") return <SingleResult detail={detail} onOpen={onOpen} />;
  const market = detail.run.market;
  return (
    <section className="space-y-6">
      <h2 className="font-display text-2xl">Top picks · {marketLabel(market)}</h2>

      {HORIZONS.map((h) => {
        const picks = detail.picks.filter((p) => p.horizon === h.id);
        return (
          <div key={h.id}>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="text-lg font-semibold">{h.label}</h3>
              <span className="text-xs text-muted-foreground">{h.blurb}</span>
            </div>
            {picks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No {h.label.toLowerCase()} pick passed the selection rules in this run. See the candidate list below for the reasons.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {picks.map((c) => <PickCard key={c.id} c={c} onOpen={onOpen} />)}
              </div>
            )}
          </div>
        );
      })}

      <CandidateTables candidates={detail.candidates} onOpen={onOpen} />
    </section>
  );
}

/** One stock, three horizons: a verdict card per horizon (passes / does not pass, and why). */
function SingleResult({ detail, onOpen }: { detail: RunDetail; onOpen: (id: number) => void }) {
  const first = detail.candidates[0];
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-2xl">{detail.run.symbol}</h2>
        {first?.name && <span className="text-muted-foreground">{first.name}</span>}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{marketLabel(detail.run.market)}</span>
        {first && <span className="text-lg font-semibold tabular-nums">{money(first.price, first.currency, first.market)}</span>}
      </div>
      {first?.news_summary && <p className="text-sm text-muted-foreground">{first.news_summary}</p>}
      <div className="grid gap-3 md:grid-cols-3">
        {HORIZONS.map((h) => {
          const c = detail.candidates.find((x) => x.horizon === h.id);
          if (!c) return null;
          const passes = c.status === "selected";
          const r = c.ai_review?.status === "ok" ? c.ai_review : null;
          const t = c.technical;
          const sc = t?.scorecard;
          const m = (v: number | null | undefined) => money(v, c.currency, c.market);
          return (
            <article key={h.id} className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft">
              <header className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold">{h.label}</h3>
                  <p className="text-[11px] text-muted-foreground">{h.blurb}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${passes
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : c.status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300" : "bg-muted text-muted-foreground"}`}>
                  {passes ? "✓ Passes" : c.status === "failed" ? "Failed" : "Does not pass"}
                </span>
              </header>
              <div className={`mt-2 text-3xl font-semibold tabular-nums ${scoreClass(c.final_score)}`}>{num(c.final_score, 0)}</div>
              <div className="text-[11px] text-muted-foreground">final score · tech {num(c.technical_score, 0)} · quant {num(c.quant_score, 0)}</div>
              {r && (
                <span className={`mt-2 w-fit rounded-full px-2 py-0.5 text-xs font-medium ${verdictClass(r.verdict)}`}>
                  Claude: {VERDICT_LABEL[r.verdict]} · {r.confidence}%
                </span>
              )}
              {sc && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {sc.total} indicators: <b className="text-emerald-700 dark:text-emerald-400">{sc.bullish} bullish</b> ·{" "}
                  <b className="text-red-700 dark:text-red-400">{sc.bearish} bearish</b> · {sc.neutral} neutral
                </p>
              )}
              {t && (
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div><dt className="text-muted-foreground">Entry</dt><dd className="tabular-nums">{m(t.entry_low)}–{m(t.entry_high)}</dd></div>
                  <div><dt className="text-muted-foreground">Stop</dt><dd className="tabular-nums text-red-700 dark:text-red-400">{m(t.stop_loss)}</dd></div>
                  <div><dt className="text-muted-foreground">Target</dt><dd className="tabular-nums text-emerald-700 dark:text-emerald-400">{m(t.targets?.[0])}</dd></div>
                </dl>
              )}
              <p className="mt-3 line-clamp-5 text-sm">{passes ? c.pick?.reason : c.rejection_reason}</p>
              <button onClick={() => onOpen(c.id)} className="mt-auto pt-3 text-left text-xs font-medium text-primary hover:underline">
                Chart, {sc?.total ?? ""} indicators & full AI reasoning →
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PickCard({ c, onOpen }: { c: Candidate; onOpen: (id: number) => void }) {
  const t = c.technical;
  const r = c.ai_review?.status === "ok" ? c.ai_review : null;
  const m = (v: number | null | undefined) => money(v, c.currency, c.market);
  const ind = t?.indicators ?? {};
  const keyInd = [
    typeof ind.rsi === "number" ? `RSI ${ind.rsi.toFixed(0)}` : null,
    typeof ind.adx === "number" ? `ADX ${ind.adx.toFixed(0)}` : null,
    ind.supertrend_dir === 1 ? "Supertrend ↑" : ind.supertrend_dir === -1 ? "Supertrend ↓" : null,
    typeof ind.macd_hist === "number" ? (ind.macd_hist > 0 ? "MACD +" : "MACD −") : null,
    typeof ind.volume_ratio === "number" ? `Vol ${ind.volume_ratio.toFixed(1)}×` : null,
    ind.breakout ? "Breakout" : null,
    ind.golden_cross_recent ? "Golden cross" : null,
    t?.scorecard ? `${t.scorecard.bullish}/${t.scorecard.total} bullish` : null,
  ].filter(Boolean) as string[];

  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft">
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">{c.pick?.rank}</span>
            <button onClick={() => onOpen(c.id)} className="text-lg font-semibold hover:underline">{c.ticker}</button>
          </div>
          <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{c.name}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold tabular-nums">{m(c.price)}</div>
          <div className={`text-xs tabular-nums ${scoreClass(c.final_score)}`}>score {num(c.final_score, 0)}</div>
        </div>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        {r ? (
          <span className={`rounded-full px-2 py-0.5 font-medium ${verdictClass(r.verdict)}`}>
            Claude: {VERDICT_LABEL[r.verdict]} · {r.confidence}%
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">No AI review</span>
        )}
        {c.origin === "watchlist" && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">watchlist</span>}
      </div>

      {t && (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div><dt className="text-muted-foreground">Entry</dt><dd className="tabular-nums">{m(t.entry_low)}–{m(t.entry_high)}</dd></div>
          <div><dt className="text-muted-foreground">Stop</dt><dd className="tabular-nums text-red-700 dark:text-red-400">{m(t.stop_loss)}</dd></div>
          <div><dt className="text-muted-foreground">Target</dt><dd className="tabular-nums text-emerald-700 dark:text-emerald-400">{m(t.targets?.[0])}</dd></div>
        </dl>
      )}
      {t && <div className="mt-1 text-[11px] text-muted-foreground">R/R {num(t.risk_reward, 2)} · tech {num(c.technical_score, 0)} · news {c.origin === "news" ? num(c.news_score, 0) : "—"}{c.fundamental_score != null ? ` · fund ${num(c.fundamental_score, 0)}` : ""}</div>}

      {keyInd.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {keyInd.map((k) => <span key={k} className="rounded-md border border-border px-1.5 py-0.5 text-[11px]">{k}</span>)}
        </div>
      )}

      <p className="mt-3 line-clamp-4 text-sm">{c.pick?.reason}</p>

      {(c.top_articles ?? []).length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-2 text-xs">
          {c.top_articles!.slice(0, 3).map((a) => (
            <li key={a.id}>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="group inline-flex gap-1 hover:underline">
                <span className="line-clamp-1">{a.title}</span>
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
              </a>
              <span className="text-muted-foreground"> · {a.source_name}</span>
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => onOpen(c.id)} className="mt-auto pt-3 text-left text-xs font-medium text-primary hover:underline">
        Chart, indicators & full AI reasoning →
      </button>
    </article>
  );
}

function CandidateTables({ candidates, onOpen }: { candidates: Candidate[]; onOpen: (id: number) => void }) {
  const [h, setH] = useState<Horizon>("intraday");
  const rows = candidates.filter((c) => c.horizon === h).sort((a, b) => (b.final_score ?? -1) - (a.final_score ?? -1));
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">All candidates</h3>
        <div className="inline-flex overflow-hidden rounded-xl border border-border text-sm">
          {HORIZONS.map((x) => (
            <button key={x.id} onClick={() => setH(x.id)} className={`px-3 py-1.5 ${h === x.id ? "bg-muted font-medium" : "text-muted-foreground"}`}>
              {x.label} ({candidates.filter((c) => c.horizon === x.id).length})
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 pr-2 font-medium">Stock</th>
              <th className="py-2 pr-2 text-right font-medium">Price</th>
              <th className="py-2 pr-2 text-right font-medium">News</th>
              <th className="py-2 pr-2 text-right font-medium">Tech</th>
              <th className="py-2 pr-2 text-right font-medium">Quant</th>
              <th className="py-2 pr-2 font-medium">Claude</th>
              <th className="py-2 pr-2 text-right font-medium">Final</th>
              <th className="py-2 font-medium">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const r = c.ai_review?.status === "ok" ? c.ai_review : null;
              return (
                <tr key={c.id} onClick={() => onOpen(c.id)} className="cursor-pointer border-b border-border align-top hover:bg-muted/50">
                  <td className="py-2 pr-2">
                    <div className="font-medium">{c.ticker} <span className="text-[11px] font-normal text-muted-foreground">{c.market}</span></div>
                    <div className="line-clamp-1 max-w-[12rem] text-xs text-muted-foreground">{c.origin === "watchlist" ? "watchlist fill" : `${c.source_count} src · ${c.catalysts[0] ?? ""}`}</div>
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{money(c.price, c.currency, c.market)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{c.origin === "news" ? num(c.news_score, 0) : "—"}</td>
                  <td className={`py-2 pr-2 text-right tabular-nums ${scoreClass(c.technical_score)}`}>{num(c.technical_score, 0)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{num(c.quant_score, 0)}</td>
                  <td className="py-2 pr-2 text-xs">{r ? <span className={`rounded-full px-2 py-0.5 ${verdictClass(r.verdict)}`}>{VERDICT_LABEL[r.verdict]} {r.confidence}%</span> : <span className="text-muted-foreground">{c.ai_review?.status ?? "—"}</span>}</td>
                  <td className={`py-2 pr-2 text-right font-semibold tabular-nums ${scoreClass(c.final_score)}`}>{num(c.final_score, 0)}</td>
                  <td className="py-2 text-xs">
                    {c.status === "selected" ? (
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">✓ Selected #{c.pick?.rank}</span>
                    ) : c.status === "pending" ? (
                      <span className="text-muted-foreground">{c.stage.replace("_", " ")}…</span>
                    ) : (
                      <span className={c.status === "failed" ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}>
                        {c.status === "failed" ? "✕ " : ""}{c.rejection_reason}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
