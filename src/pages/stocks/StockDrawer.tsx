import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HORIZON_LABEL, stocksApi, type Candidate, type Scorecard } from "@/lib/stocksApi";
import PriceChart from "./PriceChart";
import { VERDICT_LABEL, ago, marketLabel, money, num, scoreClass, verdictClass } from "./format";

const GROUP_LABEL: Record<string, string> = {
  trend: "Trend", momentum: "Momentum", volatility: "Volatility", volume: "Volume", structure: "Structure", fundamental: "Fundamentals",
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
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
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
  const r = c.ai_review;
  const signalsByGroup = (t?.signals ?? []).reduce<Record<string, typeof t.signals>>((acc, s) => {
    (acc[s.group] ||= []).push(s);
    return acc;
  }, {});
  const fundSignals = (t?.fundamentals?.signals as { text: string; effect: number }[] | undefined) ?? [];

  return (
    <div className="space-y-5 pb-8">
      <SheetHeader className="space-y-1 text-left">
        <SheetTitle className="flex flex-wrap items-baseline gap-2 font-display text-2xl">
          {c.ticker}
          <span className="text-base font-normal text-muted-foreground">{c.name}</span>
        </SheetTitle>
        <SheetDescription className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-muted px-2 py-0.5">{marketLabel(c.market)}</span>
          <span className="rounded-full bg-muted px-2 py-0.5">{HORIZON_LABEL[c.horizon]}</span>
          {c.origin === "watchlist" && <span className="rounded-full bg-muted px-2 py-0.5">Watchlist (no news catalyst)</span>}
          {c.origin === "single" && <span className="rounded-full bg-muted px-2 py-0.5">No recent news found</span>}
          <StatusChip c={c} />
        </SheetDescription>
      </SheetHeader>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Price" value={money(c.price, c.currency, c.market)} />
        <Stat label="Final score" value={num(c.final_score, 0)} cls={scoreClass(c.final_score)} />
        <Stat label="Technical" value={num(c.technical_score, 0)} cls={scoreClass(c.technical_score)} />
        <Stat label="News" value={c.origin === "news" ? num(c.news_score, 0) : "—"} cls={scoreClass(c.news_score)} />
        <Stat label="Fundamentals" value={num(c.fundamental_score, 0)} cls={scoreClass(c.fundamental_score)} />
      </div>

      {c.status !== "selected" && c.rejection_reason && (
        <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm">
          <span className="font-medium">Why it was not picked: </span>
          {c.rejection_reason}
        </div>
      )}

      <Tabs defaultValue="chart">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="chart">Chart</TabsTrigger>
          <TabsTrigger value="ai">AI review</TabsTrigger>
          <TabsTrigger value="indicators">Indicators{t?.scorecard ? ` (${t.scorecard.total})` : ""}</TabsTrigger>
          <TabsTrigger value="news">News ({c.articles?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="space-y-4 pt-3">
          {t ? (
            <>
              <Levels c={c} />
              <PriceChart technical={t} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No price data{c.error ? `: ${c.error}` : "."}</p>
          )}
        </TabsContent>

        <TabsContent value="ai" className="space-y-4 pt-3 text-sm">
          {!r || r.status !== "ok" ? (
            <p className="text-muted-foreground">
              {r?.status === "skipped" ? "Claude review was skipped" : r?.status === "refused" ? "Claude declined to review" : "No AI review"}
              {r?.error ? ` — ${r.error}` : "."} This stock was scored on quantitative signals only.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${verdictClass(r.verdict)}`}>{VERDICT_LABEL[r.verdict] ?? r.verdict}</span>
                <span className="text-xs text-muted-foreground">
                  confidence <b className="text-foreground">{r.confidence}%</b> · {r.agrees_with_quant ? "agrees with" : "disagrees with"} the quant view ·{" "}
                  {r.model}
                </span>
              </div>
              <p className="font-medium">{r.summary}</p>
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{r.reasoning}</p>
              <ListBlock title="Key risks" items={r.key_risks} />
              <ListBlock title="Conflicting signals" items={r.conflicting_signals ?? []} />
              <p className="text-xs text-muted-foreground">
                Tokens: {r.input_tokens?.toLocaleString()} in / {r.output_tokens?.toLocaleString()} out
              </p>
            </>
          )}
        </TabsContent>

        <TabsContent value="indicators" className="space-y-4 pt-3 text-sm">
          {t && (
            <>
              {t.scorecard && <ScorecardView sc={t.scorecard} />}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {Object.entries(t.sub_scores).map(([k, v]) => (
                  <Stat key={k} label={GROUP_LABEL[k] ?? k} value={num(v, 0)} cls={scoreClass(v)} />
                ))}
              </div>
              {!t.scorecard && Object.entries(signalsByGroup).map(([g, sigs]) => (
                <div key={g}>
                  <h4 className="mb-1 font-medium">{GROUP_LABEL[g] ?? g}</h4>
                  <ul className="space-y-0.5">
                    {sigs.map((s, i) => <SignalLine key={i} effect={s.effect} text={s.text} />)}
                  </ul>
                </div>
              ))}
              {fundSignals.length > 0 && (
                <div>
                  <h4 className="mb-1 font-medium">Fundamentals</h4>
                  <ul className="space-y-0.5">{fundSignals.map((s, i) => <SignalLine key={i} effect={s.effect} text={s.text} />)}</ul>
                </div>
              )}
              <IndicatorTable values={t.indicators} />
              <p className="text-xs text-muted-foreground">
                {t.bars} {t.interval} bars over {t.period} from {t.provider} · last bar {ago(t.last_bar_at)}
              </p>
            </>
          )}
        </TabsContent>

        <TabsContent value="news" className="space-y-3 pt-3 text-sm">
          {c.news_summary && <p className="rounded-xl bg-muted/50 px-4 py-3">{c.news_summary}</p>}
          {c.horizon_reason && <p className="text-xs text-muted-foreground">Horizon: {c.horizon_reason}</p>}
          <p className="text-xs text-muted-foreground">
            {c.source_count} source(s) · {c.mention_count} distinct stories · sentiment {num(c.sentiment, 2)} · catalysts:{" "}
            {c.catalysts.join(", ") || "—"}
          </p>
          {(c.articles ?? []).length === 0 && <p className="text-muted-foreground">No news articles behind this candidate.</p>}
          <ul className="divide-y divide-border">
            {(c.articles ?? []).map((a) => (
              <li key={a.id} className="py-2.5">
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1 font-medium hover:underline">
                  {a.title}
                  <ExternalLink className="mt-1 h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
                </a>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {a.source_name} · {ago(a.published_at)} · {a.catalyst} · sentiment {num(a.sentiment, 2)}
                  {a.is_duplicate && " · same story as another source"}
                  {a.ticker_method && ` · ticker via ${a.ticker_method}`}
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

const SIGNAL_STYLE = {
  bullish: ["▲ Bullish", "text-emerald-700 dark:text-emerald-400"],
  bearish: ["▼ Bearish", "text-red-700 dark:text-red-400"],
  neutral: ["● Neutral", "text-muted-foreground"],
} as const;

function ScorecardView({ sc }: { sc: Scorecard }) {
  const groups = Array.from(new Set(sc.rows.map((r) => r.group)));
  const pct = (n: number) => `${(n / Math.max(1, sc.total)) * 100}%`;
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-medium">{sc.total} indicators</h4>
          <span className="text-xs text-muted-foreground">
            <b className="text-emerald-700 dark:text-emerald-400">{sc.bullish} bullish</b> ·{" "}
            <b className="text-red-700 dark:text-red-400">{sc.bearish} bearish</b> · {sc.neutral} neutral
          </span>
        </div>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <span className="h-full bg-emerald-600" style={{ width: pct(sc.bullish) }} />
          <span className="h-full bg-muted-foreground/40" style={{ width: pct(sc.neutral) }} />
          <span className="h-full bg-red-600" style={{ width: pct(sc.bearish) }} />
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Indicator</th>
              <th className="px-3 py-1.5 text-left font-medium">Signal</th>
              <th className="px-3 py-1.5 text-left font-medium">Reading</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g}>
              <tr className="border-t border-border bg-muted/40">
                <td colSpan={3} className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{GROUP_LABEL[g] ?? g}</td>
              </tr>
              {sc.rows.filter((r) => r.group === g).map((r) => {
                const [label, cls] = SIGNAL_STYLE[r.signal];
                return (
                  <tr key={r.indicator} className="border-t border-border align-top">
                    <td className="whitespace-nowrap px-3 py-1.5 font-medium">{r.indicator}</td>
                    <td className={`whitespace-nowrap px-3 py-1.5 ${cls}`}>{label}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{r.detail}</td>
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
  const map = {
    selected: ["Selected", "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"],
    rejected: ["Rejected", "bg-muted text-muted-foreground"],
    failed: ["Failed", "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"],
    pending: ["In progress", "bg-muted text-muted-foreground"],
  } as const;
  const [label, cls] = map[c.status] ?? map.pending;
  return <span className={`rounded-full px-2 py-0.5 ${cls}`}>{label}{c.pick ? ` · #${c.pick.rank}` : ""}</span>;
}

export function Stat({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function Levels({ c }: { c: Candidate }) {
  const t = c.technical!;
  const r = c.ai_review?.status === "ok" ? c.ai_review : null;
  const m = (v: number | null | undefined) => money(v, c.currency, c.market);
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium" />
            <th className="px-3 py-1.5 text-right font-medium">Entry</th>
            <th className="px-3 py-1.5 text-right font-medium">Stop-loss</th>
            <th className="px-3 py-1.5 text-right font-medium">Target(s)</th>
            <th className="px-3 py-1.5 text-right font-medium">R/R</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          <tr className="border-t border-border">
            <td className="px-3 py-1.5 text-muted-foreground">Quant</td>
            <td className="px-3 py-1.5 text-right">{m(t.entry_low)} – {m(t.entry_high)}</td>
            <td className="px-3 py-1.5 text-right">{m(t.stop_loss)}</td>
            <td className="px-3 py-1.5 text-right">{t.targets.map(m).join(" / ")}</td>
            <td className="px-3 py-1.5 text-right">{num(t.risk_reward, 2)}</td>
          </tr>
          {r && (
            <tr className="border-t border-border">
              <td className="px-3 py-1.5 text-muted-foreground">Claude</td>
              <td className="px-3 py-1.5 text-right">{m(r.suggested_entry)}</td>
              <td className="px-3 py-1.5 text-right">{m(r.suggested_stop)}</td>
              <td className="px-3 py-1.5 text-right">{m(r.suggested_target)}</td>
              <td className="px-3 py-1.5 text-right">
                {r.suggested_entry && r.suggested_stop && r.suggested_target && r.suggested_entry > r.suggested_stop
                  ? num((r.suggested_target - r.suggested_entry) / (r.suggested_entry - r.suggested_stop), 2)
                  : "—"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SignalLine({ effect, text }: { effect: number; text: string }) {
  const [sym, cls] = effect > 0 ? ["▲", "text-emerald-700 dark:text-emerald-400"] : effect < 0 ? ["▼", "text-red-700 dark:text-red-400"] : ["●", "text-muted-foreground"];
  return (
    <li className="flex gap-2">
      <span className={`w-3 shrink-0 text-xs leading-5 ${cls}`} aria-label={effect > 0 ? "bullish" : effect < 0 ? "bearish" : "neutral"}>{sym}</span>
      <span>{text}</span>
    </li>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h4 className="mb-1 font-medium">{title}</h4>
      <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

const INDICATOR_ROWS: [string, string, number?][] = [
  ["rsi", "RSI", 1], ["stoch_k", "Stochastic %K", 1], ["stoch_d", "Stochastic %D", 1], ["roc", "ROC %", 2], ["williams_r", "Williams %R", 1],
  ["macd", "MACD", 3], ["macd_signal", "MACD signal", 3], ["adx", "ADX", 1], ["plus_di", "+DI", 1], ["minus_di", "-DI", 1],
  ["sma20", "SMA 20", 2], ["sma50", "SMA 50", 2], ["sma200", "SMA 200", 2], ["ema20", "EMA 20", 2], ["ema50", "EMA 50", 2],
  ["supertrend", "Supertrend", 2], ["ichi_span_a", "Ichimoku span A", 2], ["ichi_span_b", "Ichimoku span B", 2],
  ["bb_upper", "Bollinger upper", 2], ["bb_lower", "Bollinger lower", 2], ["bb_pct_b", "Bollinger %b", 2], ["atr", "ATR", 2],
  ["atr_pct", "ATR % of price", 2], ["vwap", "VWAP", 2], ["mfi", "MFI", 1], ["volume_ratio", "Volume vs avg", 2],
  ["week52_high", "52-week high", 2], ["week52_low", "52-week low", 2],
];

function IndicatorTable({ values }: { values: Technical_["indicators"] }) {
  const flags = [
    values.breakout ? "Breakout" : null, values.breakdown ? "Breakdown" : null,
    values.golden_cross_recent ? "Golden cross (recent)" : null, values.death_cross_recent ? "Death cross (recent)" : null,
    values.cross ? `SMA50 ${values.cross} SMA200` : null,
  ].filter(Boolean);
  return (
    <div>
      <h4 className="mb-1 font-medium">Latest values</h4>
      {flags.length > 0 && <p className="mb-2 text-xs text-muted-foreground">{flags.join(" · ")}</p>}
      <div className="grid grid-cols-2 gap-x-6 text-xs sm:grid-cols-3">
        {INDICATOR_ROWS.filter(([k]) => typeof values[k] === "number").map(([k, label, d]) => (
          <div key={k} className="flex justify-between border-b border-border py-1">
            <span className="text-muted-foreground">{label}</span>
            <span className="tabular-nums">{(values[k] as number).toFixed(d ?? 2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type Technical_ = NonNullable<Candidate["technical"]>;
