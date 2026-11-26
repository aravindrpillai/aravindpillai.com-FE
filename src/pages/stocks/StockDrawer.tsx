import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HORIZON_LABEL, stocksApi, type AIReview, type Candidate, type MethodId, type Scorecard, type Technical } from "@/lib/stocksApi";
import PriceChart from "./PriceChart";
import { METHOD_IDS, METHOD_META, REGIME_META, ago, methodsOf, marketLabel, money, num, pct, pts, scoreClass, signCls } from "./format";
import { Card, Kpi, Meter, Pill, ScoreRing, VerdictPill, cx } from "./ui";

const GROUP_LABEL: Record<string, string> = {
  trend: "Trend", momentum: "Momentum", volatility: "Volatility", volume: "Volume", structure: "Structure",
  relative: "Relative strength & regime", risk: "Risk / over-extension", fundamental: "Fundamentals",
};

export default function StockDrawer({ token, candidateId, onClose }: {
  token: string;
  candidateId: number | null;
  onClose: () => void;
}) {
  const [c, setC] = useState<Candidate | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (candidateId == null) return;
    let live = true;
    setC(null);
    setError("");
    stocksApi.candidate(token, candidateId).then((d) => live && setC(d)).catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [token, candidateId]);

  return (
    <Sheet open={candidateId != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-4 sm:max-w-3xl sm:p-6 lg:max-w-4xl">
        {!c ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {error ? error : <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
        ) : (
          <Detail c={c} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Detail({ c }: { c: Candidate }) {
  const t = c.technical;
  const regime = t?.context?.regime;
  const reviews = c.reviews ?? { claude: c.ai_review };
  return (
    <div className="space-y-5 pb-8">
      <SheetHeader className="space-y-1.5 pr-8 text-left">
        <SheetTitle className="flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold tracking-tight">
          {c.ticker}
          <span className="text-sm font-normal text-muted-foreground">{c.name}</span>
          <span className="ml-auto text-xl tabular-nums">{money(c.price, c.currency, c.market)}</span>
        </SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-1.5 text-xs">
          <Pill>{marketLabel(c.market)}</Pill>
          <Pill>{HORIZON_LABEL[c.horizon]}</Pill>
          {regime && <span className={cx("rounded-md px-1.5 py-0.5 text-[11px] font-medium", (REGIME_META[regime.state] ?? REGIME_META.unknown).cls)}>{(REGIME_META[regime.state] ?? REGIME_META.unknown).label}</span>}
          {c.origin === "watchlist" && <Pill>Watchlist (no news catalyst)</Pill>}
          {c.origin === "single" && <Pill>No recent news found</Pill>}
          <StatusChip c={c} />
        </SheetDescription>
      </SheetHeader>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Final score" value={num(c.final_score, 0)} valueCls={scoreClass(c.final_score)} sub={c.ensemble?.ranks?.final ? `rank #${c.ensemble.ranks.final} of ${c.ensemble.ranked_of}` : undefined} />
        <Kpi label="Win probability" value={c.win_probability != null ? `${Math.round(c.win_probability)}%` : "—"} valueCls={scoreClass(c.win_probability)}
          sub={c.ensemble?.probability_bias ? `incl. ${pts(c.ensemble.probability_bias, 1)} calibration` : "calibrated ensemble"} />
        <Kpi label="Expected value" value={pct(c.expected_value)} valueCls={signCls(c.expected_value)} sub="per trade, after costs" />
        <Kpi label="Votes" value={c.ensemble?.votes != null ? `${c.ensemble.votes}/${c.ensemble.available}` : "—"} sub="methods saying buy" />
      </div>

      {c.status !== "selected" && c.rejection_reason && (
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
          <span className="font-semibold">Why it was not picked: </span>{c.rejection_reason}
        </div>
      )}

      <Tabs defaultValue="decision">
        <TabsList className="stocks-scroll h-auto w-full justify-start gap-0.5 overflow-x-auto p-0.5">
          <TabsTrigger value="decision">Decision</TabsTrigger>
          <TabsTrigger value="chart">Chart</TabsTrigger>
          <TabsTrigger value="ai">AI reviews</TabsTrigger>
          <TabsTrigger value="indicators">Indicators{t?.scorecard ? ` (${t.scorecard.total})` : ""}</TabsTrigger>
          <TabsTrigger value="backtest">Backtest</TabsTrigger>
          <TabsTrigger value="news">News ({c.articles?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="decision" className="space-y-4 pt-3"><DecisionTab c={c} /></TabsContent>

        <TabsContent value="chart" className="space-y-4 pt-3">
          {t ? (<><Levels c={c} /><PriceChart technical={t} /></>) : <p className="text-sm text-muted-foreground">No price data{c.error ? `: ${c.error}` : "."}</p>}
        </TabsContent>

        <TabsContent value="ai" className="pt-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <ReviewPanel id="claude" r={reviews.claude ?? null} />
            <ReviewPanel id="openai" r={reviews.openai ?? null} />
          </div>
        </TabsContent>

        <TabsContent value="indicators" className="space-y-4 pt-3 text-sm">{t && <IndicatorsTab t={t} />}</TabsContent>

        <TabsContent value="backtest" className="space-y-3 pt-3 text-sm">{t && <BacktestTab t={t} />}</TabsContent>

        <TabsContent value="news" className="space-y-3 pt-3 text-sm">
          {c.news_summary && <p className="rounded-lg bg-muted/50 px-4 py-3">{c.news_summary}</p>}
          {c.horizon_reason && <p className="text-xs text-muted-foreground">Horizon: {c.horizon_reason}</p>}
          <p className="text-xs text-muted-foreground">
            {c.source_count} source(s) · {c.mention_count} distinct stories · sentiment {num(c.sentiment, 2)} · catalysts: {c.catalysts.join(", ") || "—"}
          </p>
          {(c.articles ?? []).length === 0 && <p className="text-muted-foreground">No news articles behind this candidate.</p>}
          <ul className="divide-y divide-border">
            {(c.articles ?? []).map((a) => (
              <li key={a.id} className="py-2.5">
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1 font-medium hover:underline">
                  {a.title}<ExternalLink className="mt-1 h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
                </a>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {a.source_name} · {ago(a.published_at)} · {a.catalyst} · sentiment {num(a.sentiment, 2)}
                  {a.is_duplicate && " · same story as another source"}{a.ticker_method && ` · ticker via ${a.ticker_method}`}
                </div>
                {a.summary && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{a.summary}</p>}
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------------------------------------- decision
const FACTORS: { id: string; label: string; native: (c: Candidate) => number | null | undefined }[] = [
  { id: "trend", label: "Trend", native: (c) => c.technical?.sub_scores?.trend },
  { id: "momentum", label: "Momentum", native: (c) => c.technical?.sub_scores?.momentum },
  { id: "volume", label: "Volume / money flow", native: (c) => c.technical?.sub_scores?.volume },
  { id: "relative_strength", label: "Relative strength", native: (c) => c.technical?.sub_scores?.relative },
  { id: "news", label: "News", native: (c) => (c.origin === "news" ? c.news_score : null) },
  { id: "fundamentals", label: "Fundamentals", native: (c) => c.fundamental_score },
  { id: "risk", label: "Risk (high = low risk)", native: (c) => c.technical?.sub_scores?.risk },
];

function DecisionTab({ c }: { c: Candidate }) {
  const e = c.ensemble;
  const methods = methodsOf(c);
  if (!e?.methods) {
    return <p className="text-sm text-muted-foreground">This run predates the three-method ensemble; see the AI reviews tab for Claude's view.</p>;
  }
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-3">
        {METHOD_IDS.map((id) => {
          const v = methods[id];
          return (
            <Card key={id} as="div" className={cx("p-3", !v?.available && "opacity-60")}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold"><span className={cx("h-2 w-2 rounded-full", METHOD_META[id].dot)} />{METHOD_META[id].label}</span>
                {v?.available ? <VerdictPill verdict={v.verdict} /> : <Pill>off</Pill>}
              </div>
              {v?.available ? (
                <>
                  <div className="mt-2.5 flex items-center gap-3">
                    <ScoreRing value={v.score} size={40} label="Conviction" />
                    <dl className="grid flex-1 grid-cols-2 gap-1 text-xs">
                      <div><dt className="text-muted-foreground">Win prob.</dt><dd className="font-semibold tabular-nums">{Math.round(v.probability ?? 0)}%</dd></div>
                      <div><dt className="text-muted-foreground">Weight</dt><dd className="font-semibold tabular-nums">{((v.weight ?? 0) * 100).toFixed(0)}%</dd></div>
                      <div><dt className="text-muted-foreground">Own rank</dt><dd className="font-semibold tabular-nums">{e.ranks?.[id] ? `#${e.ranks[id]}/${e.ranked_of}` : "—"}</dd></div>
                      <div><dt className="text-muted-foreground">Vote</dt><dd className={cx("font-semibold", v.vote ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{v.vote ? "Buy" : "No"}</dd></div>
                    </dl>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{v.detail}</p>
                </>
              ) : <p className="mt-2 text-xs text-muted-foreground">{v?.reason || "Not used in this run."}</p>}
            </Card>
          );
        })}
      </div>

      <Card as="div">
        <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">Factor comparison <span className="font-normal text-muted-foreground">(0–100, 50 = neutral)</span></div>
        <div className="stocks-scroll overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead className="text-left text-muted-foreground">
              <tr><th className="px-4 py-2 font-medium">Factor</th>{METHOD_IDS.map((id) => <th key={id} className="px-3 py-2 font-medium">{METHOD_META[id].short}</th>)}</tr>
            </thead>
            <tbody>
              {FACTORS.map((f) => (
                <tr key={f.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{f.label}</td>
                  {METHOD_IDS.map((id) => {
                    const val = id === "native" ? f.native(c) : methods[id]?.available ? methods[id]?.factor_scores?.[f.id] : null;
                    return (
                      <td key={id} className="px-3 py-2">
                        {val == null ? <span className="text-muted-foreground">—</span> : (
                          <div className="flex items-center gap-2"><Meter value={val} className="w-16" /><span className={cx("tabular-nums", scoreClass(val))}>{Math.round(val)}</span></div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card as="div" className="p-4">
        <h4 className="mb-2 text-sm font-semibold">How the final decision was reached</h4>
        <ol className="space-y-2">
          {(e.steps ?? []).map((s, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                i === (e.steps?.length ?? 0) - 1 ? (e.passed ? "bg-emerald-600 text-white" : "bg-red-600 text-white") : "bg-muted text-muted-foreground")}>{i + 1}</span>
              <span className="leading-relaxed text-muted-foreground [&>b]:text-foreground">{s}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card as="div" className="p-4">
        <h4 className="mb-2 text-sm font-semibold">Gates</h4>
        <ul className="grid gap-2 sm:grid-cols-2">
          {(e.gates ?? []).map((g) => (
            <li key={g.id} className={cx("flex gap-2 rounded-lg border px-3 py-2 text-xs", g.passed ? "border-border" : "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20")}>
              {g.passed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="h-4 w-4 shrink-0 text-red-600" />}
              <span><b className="text-foreground">{g.label}</b><br /><span className="text-muted-foreground">{g.detail}</span></span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

// ------------------------------------------------------------------------------------------- AI reviews
function ReviewPanel({ id, r }: { id: Exclude<MethodId, "native">; r: AIReview | null }) {
  const meta = METHOD_META[id];
  return (
    <Card as="div" className="space-y-3 p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold"><span className={cx("h-2 w-2 rounded-full", meta.dot)} />{meta.label}</span>
        {r?.status === "ok" && <VerdictPill verdict={r.verdict} suffix={<span className="font-normal opacity-80"> · {r.confidence}%</span>} />}
      </div>
      {!r || r.status !== "ok" ? (
        <p className="text-muted-foreground">
          {r?.status === "skipped" ? `${meta.label} was not used` : r?.status === "refused" ? `${meta.label} declined to review` : r?.status === "error" ? `${meta.label} review failed` : "No review"}
          {r?.error ? ` — ${r.error}` : "."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><div className="text-muted-foreground">Win prob.</div><div className="font-semibold tabular-nums">{r.win_probability ?? "—"}%</div></div>
            <div><div className="text-muted-foreground">Exp. return</div><div className={cx("font-semibold tabular-nums", signCls(r.expected_return))}>{pct(r.expected_return)}</div></div>
            <div><div className="text-muted-foreground">vs quant</div><div className="font-semibold">{r.agrees_with_quant ? "agrees" : "disagrees"}</div></div>
          </div>
          <p className="font-medium">{r.summary}</p>
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-primary">Full reasoning</summary>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-muted-foreground">{r.reasoning}</p>
          </details>
          <ListBlock title="Key risks" items={r.key_risks} />
          <ListBlock title="Conflicting signals" items={r.conflicting_signals ?? []} />
          <p className="text-[11px] text-muted-foreground">{r.model} · {r.input_tokens?.toLocaleString()} in / {r.output_tokens?.toLocaleString()} out tokens</p>
        </>
      )}
    </Card>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h5 className="mb-1 text-xs font-semibold">{title}</h5>
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

// ------------------------------------------------------------------------------------------- backtest
function BacktestTab({ t }: { t: Technical }) {
  const b = t.backtest;
  if (!b?.enabled) return <p className="text-muted-foreground">Backtest is off for this run.</p>;
  const base = b.baseline;
  const rows: [string, string, string][] = [
    ["Trades", String(b.trades ?? 0), String(base?.trades ?? 0)],
    ["Win rate", b.win_rate != null ? `${b.win_rate}%` : "—", base?.win_rate != null ? `${base.win_rate}%` : "—"],
    ["Avg return / trade", pct(b.avg_return), pct(base?.avg_return)],
    ["Median return", pct(b.median_return), pct(base?.median_return)],
    ["Avg win / avg loss", `${pct(b.avg_win)} / ${pct(b.avg_loss)}`, `${pct(base?.avg_win)} / ${pct(base?.avg_loss)}`],
    ["Profit factor", num(b.profit_factor, 2), num(base?.profit_factor, 2)],
    ["Target / stop / time exits", `${b.target_hits ?? 0} / ${b.stop_hits ?? 0} / ${b.timeouts ?? 0}`, `${base?.target_hits ?? 0} / ${base?.stop_hits ?? 0} / ${base?.timeouts ?? 0}`],
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Similar set-ups" value={b.trades ?? 0} sub={b.reliable ? "enough history" : "small sample (weighted less)"} />
        <Kpi label="Win probability" value={`${b.win_probability ?? "—"}%`} valueCls={scoreClass(b.win_probability)} sub="shrunk toward baseline" />
        <Kpi label="Edge vs baseline" value={pct(b.edge)} valueCls={signCls(b.edge)} sub="avg return difference" />
        <Kpi label="Rules" value={`${b.stop_atr}×ATR / ${b.target_r}R`} sub={`hold ≤ ${b.hold_bars} bars · ${b.cost_pct}% costs`} />
      </div>
      <Card as="div">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr><th className="px-4 py-2 font-medium" /><th className="px-3 py-2 text-right font-medium">This set-up</th><th className="px-3 py-2 text-right font-medium">Every bar (baseline)</th></tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map(([k, a, z]) => (
              <tr key={k} className="border-t border-border"><td className="px-4 py-2 text-muted-foreground">{k}</td><td className="px-3 py-2 text-right font-medium">{a}</td><td className="px-3 py-2 text-right">{z}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Every past bar of this stock whose composite signal was within ±{b.tolerance} of today's ({num(b.composite_now, 2)})
        {b.same_side_of_sma200 != null ? `, on the same side of the 200-bar average,` : ""} was traded with this horizon's rules: enter at the next bar's
        open, stop at {b.stop_atr}×ATR, target at {b.target_r}× the risk, exit after {b.hold_bars} bars otherwise, minus {b.cost_pct}% round-trip costs. A
        bar touching both levels counts as the stop. Overlapping trades are thinned so one move is not counted many times.
        {b.note ? ` ${b.note}` : ""}
      </p>
    </>
  );
}

// ------------------------------------------------------------------------------------------- indicators
const SIGNAL_STYLE = {
  bullish: ["▲ Bullish", "text-emerald-600 dark:text-emerald-400"],
  bearish: ["▼ Bearish", "text-red-600 dark:text-red-400"],
  neutral: ["● Neutral", "text-muted-foreground"],
} as const;

function IndicatorsTab({ t }: { t: Technical }) {
  const rel = t.context?.relative ?? {};
  const fundSignals = (t.fundamentals?.signals as { text: string; effect: number }[] | undefined) ?? [];
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {Object.entries(t.sub_scores).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border px-3 py-2">
            <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground" title={GROUP_LABEL[k]}>{GROUP_LABEL[k] ?? k}</div>
            <div className={cx("text-lg font-semibold tabular-nums", scoreClass(v))}>{num(v, 0)}</div>
            <Meter value={v} />
            {t.context?.weights?.[k] != null && <div className="mt-1 text-[10px] text-muted-foreground">weight {(t.context.weights[k] * 100).toFixed(0)}%</div>}
          </div>
        ))}
      </div>
      {(rel.rs_mid != null || t.context?.regime) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {t.context?.regime && <span>{t.context.regime.label}</span>}
          {rel.rs_short != null && <span>RS short <b className={signCls(rel.rs_short)}>{pts(rel.rs_short, 1)}</b></span>}
          {rel.rs_mid != null && <span>RS medium <b className={signCls(rel.rs_mid)}>{pts(rel.rs_mid, 1)}</b></span>}
          {rel.rs_long != null && <span>RS long <b className={signCls(rel.rs_long)}>{pts(rel.rs_long, 1)}</b></span>}
          {rel.beta != null && <span>Beta <b className="text-foreground">{num(rel.beta, 2)}</b></span>}
        </div>
      )}
      {t.scorecard && <ScorecardView sc={t.scorecard} />}
      {fundSignals.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold">Fundamentals</h4>
          <ul className="space-y-0.5 text-xs">{fundSignals.map((s, i) => <li key={i} className={s.effect > 0 ? "text-emerald-600 dark:text-emerald-400" : s.effect < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>{s.effect > 0 ? "▲" : s.effect < 0 ? "▼" : "●"} {s.text}</li>)}</ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t.bars} {t.interval} bars over {t.period} from {t.provider} · last bar {ago(t.last_bar_at)}</p>
    </>
  );
}

function ScorecardView({ sc }: { sc: Scorecard }) {
  const groups = Array.from(new Set(sc.rows.map((r) => r.group)));
  const w = (n: number) => `${(n / Math.max(1, sc.total)) * 100}%`;
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-semibold">{sc.total} indicators</h4>
          <span className="text-xs text-muted-foreground">
            <b className="text-emerald-600 dark:text-emerald-400">{sc.bullish} bullish</b> · <b className="text-red-600 dark:text-red-400">{sc.bearish} bearish</b> · {sc.neutral} neutral
          </span>
        </div>
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <span className="h-full bg-emerald-500" style={{ width: w(sc.bullish) }} />
          <span className="h-full bg-muted-foreground/30" style={{ width: w(sc.neutral) }} />
          <span className="h-full bg-red-500" style={{ width: w(sc.bearish) }} />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr><th className="px-3 py-1.5 text-left font-medium">Indicator</th><th className="px-3 py-1.5 text-left font-medium">Signal</th><th className="hidden px-3 py-1.5 text-left font-medium sm:table-cell">Reading</th></tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g}>
              <tr className="border-t border-border bg-muted/30">
                <td colSpan={3} className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{GROUP_LABEL[g] ?? g}</td>
              </tr>
              {sc.rows.filter((r) => r.group === g).map((r) => {
                const [label, cls] = SIGNAL_STYLE[r.signal];
                return (
                  <tr key={r.indicator} className="border-t border-border align-top">
                    <td className="px-3 py-1.5 font-medium">{r.indicator}<div className="text-muted-foreground sm:hidden">{r.detail}</div></td>
                    <td className={cx("whitespace-nowrap px-3 py-1.5", cls)}>{label}</td>
                    <td className="hidden px-3 py-1.5 text-muted-foreground sm:table-cell">{r.detail}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

function StatusChip({ c }: { c: Candidate }) {
  const map = { selected: "good", rejected: "neutral", failed: "bad", pending: "neutral" } as const;
  const label = { selected: "Selected", rejected: "Rejected", failed: "Failed", pending: "In progress" }[c.status] ?? c.status;
  return <Pill tone={map[c.status] ?? "neutral"}>{label}{c.pick ? ` · #${c.pick.rank}` : ""}</Pill>;
}

function Levels({ c }: { c: Candidate }) {
  const t = c.technical!;
  const m = (v: number | null | undefined) => money(v, c.currency, c.market);
  const rr = (r: AIReview | null | undefined) => r && r.suggested_entry && r.suggested_stop && r.suggested_target && r.suggested_entry > r.suggested_stop
    ? num((r.suggested_target - r.suggested_entry) / (r.suggested_entry - r.suggested_stop), 2) : "—";
  const ai = (["claude", "openai"] as const).map((id) => ({ id, r: (c.reviews ?? { claude: c.ai_review })[id] })).filter((x) => x.r?.status === "ok");
  return (
    <div className="stocks-scroll overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[460px] text-sm">
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr><th className="px-3 py-1.5 text-left font-medium" /><th className="px-3 py-1.5 text-right font-medium">Entry</th><th className="px-3 py-1.5 text-right font-medium">Stop-loss</th><th className="px-3 py-1.5 text-right font-medium">Target(s)</th><th className="px-3 py-1.5 text-right font-medium">R/R</th></tr>
        </thead>
        <tbody className="tabular-nums">
          <tr className="border-t border-border">
            <td className="px-3 py-1.5 text-muted-foreground">Native (tracked)</td>
            <td className="px-3 py-1.5 text-right">{m(t.entry_low)} – {m(t.entry_high)}</td>
            <td className="px-3 py-1.5 text-right">{m(t.stop_loss)}</td>
            <td className="px-3 py-1.5 text-right">{t.targets.map(m).join(" / ")}</td>
            <td className="px-3 py-1.5 text-right">{num(t.risk_reward, 2)}</td>
          </tr>
          {ai.map(({ id, r }) => (
            <tr key={id} className="border-t border-border">
              <td className="px-3 py-1.5 text-muted-foreground">{METHOD_META[id].label}</td>
              <td className="px-3 py-1.5 text-right">{m(r!.suggested_entry)}</td>
              <td className="px-3 py-1.5 text-right">{m(r!.suggested_stop)}</td>
              <td className="px-3 py-1.5 text-right">{m(r!.suggested_target)}</td>
              <td className="px-3 py-1.5 text-right">{rr(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
