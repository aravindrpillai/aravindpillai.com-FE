import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Info, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import type { Action, Advice, AIOutlook, OutlookHorizon, Scenario, StockReport as Report } from "@/lib/stocksApi";
import { METHOD_META, ago, money, num, pct, scoreClass, signCls, when } from "./format";
import { Card, CardHead, Kpi, Meter, Pill, ScoreRing, Segmented, cx } from "./ui";

const ACTION_STYLE: Record<Action, { cls: string; icon: typeof TrendingUp; blurb: string }> = {
  BUY: { cls: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950", icon: TrendingUp,
    blurb: "Strong opportunity: fundamentals, valuation and prospects support buying." },
  HOLD: { cls: "bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950", icon: Info,
    blurb: "Thesis intact; holding is a reasonable risk-adjusted choice, but not a buy now." },
  SELL: { cls: "bg-red-600 text-white dark:bg-red-500 dark:text-red-950", icon: TrendingDown,
    blurb: "Outlook deteriorated or downside outweighs the expected upside." },
};
const HZ_LABEL = { days: "Next few days", months: "Next few months", year: "Next 12 months" } as const;
const PILLAR_LABEL: Record<string, string> = {
  growth: "Growth", profitability: "Profitability", cash_flow: "Cash flow", balance_sheet: "Balance sheet",
  valuation: "Valuation", analyst: "Analyst view", ownership: "Ownership & insiders",
};

function DataTag({ kind }: { kind: "data" | "forecast" }) {
  return kind === "data"
    ? <Pill tone="info" title="From market data providers">Market data</Pill>
    : <Pill tone="warn" title="Model / AI estimate — not a guarantee">Forecast</Pill>;
}

export default function StockReport({ r }: { r: Report }) {
  const m = (v: number | null | undefined) => money(v, r.currency, r.market);
  const d = r.decision;
  const st = ACTION_STYLE[d.action];
  const advices = (["claude", "openai"] as const).filter((k) => r.advice?.[k]);
  const [advSrc, setAdvSrc] = useState<"claude" | "openai">(advices[0] ?? "claude");
  const adv: Advice | undefined = r.advice?.[advSrc];

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------ verdict */}
      <Card className="overflow-hidden">
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">{r.symbol}</h2>
              <span className="text-muted-foreground">{r.name}</span>
              <span className="text-xl font-semibold tabular-nums">{m(r.price)}</span>
              {r.as_of && <span className="text-[11px] text-muted-foreground">last close {when(r.as_of)}</span>}
            </div>
            {adv?.headline && <p className="mt-2 text-base font-medium leading-snug">{adv.headline}</p>}
            <p className="mt-1 text-sm text-muted-foreground">{st.blurb}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["native", "claude", "openai"] as const).map((k) => {
                const v = d.votes[k];
                return (
                  <span key={k} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs">
                    <span className={cx("h-1.5 w-1.5 rounded-full", METHOD_META[k].dot, !v && "opacity-30")} />
                    {METHOD_META[k].short}
                    {v ? <b className={v.action === "BUY" ? "text-emerald-600 dark:text-emerald-400" : v.action === "SELL" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}>
                      {v.action}</b> : <span className="text-muted-foreground">off</span>}
                    {v && <span className="tabular-nums text-muted-foreground">{v.confidence}%</span>}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex flex-row items-center gap-4 lg:flex-col lg:items-end">
            <span className={cx("inline-flex items-center gap-2 rounded-xl px-5 py-3 text-2xl font-bold tracking-wide", st.cls)}>
              <st.icon className="h-6 w-6" /> {d.action}
            </span>
            <div className="text-xs text-muted-foreground lg:text-right">
              <div><b className="text-foreground">{d.confidence}%</b> confidence</div>
              <div>{d.agreement} methods agree</div>
            </div>
          </div>
        </div>
        <p className="flex items-start gap-1.5 border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground sm:px-5">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {r.disclaimer} This is research, not personal financial advice.
        </p>
      </Card>

      {/* ------------------------------------------------ position */}
      {r.position && <PositionCard r={r} m={m} />}

      {/* ------------------------------------------------ justification */}
      <Card>
        <CardHead title="Why this recommendation" subtitle="Each method's conclusion and how the final call was reconciled"
          actions={advices.length > 1 ? <Segmented size="sm" value={advSrc} onChange={setAdvSrc}
            options={advices.map((k) => ({ id: k, label: METHOD_META[k].short }))} /> : undefined} />
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-5">
          <div className="space-y-3 text-sm lg:col-span-3">
            {adv ? (
              <>
                <p className="whitespace-pre-line leading-relaxed">{adv.justification}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([["Fundamentals", adv.fundamentals_assessment], ["Valuation", adv.valuation_assessment],
                    ["Growth prospects", adv.growth_assessment], ["Technicals & market", adv.technical_assessment]] as const)
                    .filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-muted/50 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</div>
                        <p className="mt-0.5 text-xs leading-relaxed">{v}</p>
                      </div>
                    ))}
                </div>
                {adv.position_guidance && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                    <b>{r.position ? "For your position: " : "Guidance: "}</b>{adv.position_guidance}
                    {adv.suggested_stop ? <> · suggested stop {m(adv.suggested_stop)}</> : null}
                  </div>
                )}
              </>
            ) : <p className="text-muted-foreground">No AI conclusion in this run; the decision rests on the native engine.</p>}
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Native engine</div>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">{d.native.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          </div>
          <div className="space-y-3 lg:col-span-2">
            <div className="rounded-lg border border-border p-3">
              <div className="mb-1.5 text-xs font-semibold">How the final call was made</div>
              <ol className="space-y-1 text-xs text-muted-foreground">{d.steps.map((s, i) => <li key={i}>{i + 1}. {s}</li>)}</ol>
            </div>
            {adv && adv.risks.length > 0 && <Bullets title="Key risks" items={adv.risks} tone="bad" />}
            {adv && adv.catalysts.length > 0 && <Bullets title="Catalysts" items={adv.catalysts} tone="good" />}
          </div>
        </div>
        {adv && adv.key_metrics.length > 0 && (
          <div className="grid grid-cols-2 gap-2 border-t border-border p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-5">
            {adv.key_metrics.map((k) => (
              <div key={k.name} className="rounded-lg border border-border px-3 py-2" title={k.note}>
                <div className="truncate text-[11px] text-muted-foreground">{k.name}</div>
                <div className={cx("truncate text-sm font-semibold tabular-nums",
                  k.assessment === "positive" ? "text-emerald-600 dark:text-emerald-400" : k.assessment === "negative" ? "text-red-600 dark:text-red-400" : "")}>{k.value}</div>
                <div className="line-clamp-2 text-[10px] text-muted-foreground">{k.note}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ------------------------------------------------ outlook */}
      <OutlookCard r={r} m={m} />

      {/* ------------------------------------------------ fundamentals + analysts */}
      <div className="grid gap-4 xl:grid-cols-2">
        <FundamentalsCard r={r} />
        <AnalystCard r={r} m={m} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <OwnershipCard r={r} />
        <SectorPeersCard r={r} />
      </div>

      {/* ------------------------------------------------ news */}
      <NewsCard r={r} />
    </div>
  );
}

function Bullets({ title, items, tone }: { title: string; items: string[]; tone: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
        {tone === "bad" ? <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}{title}
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ position
function PositionCard({ r, m }: { r: Report; m: (v: number | null | undefined) => string }) {
  const p = r.position!;
  return (
    <Card>
      <CardHead title="Your position" subtitle={p.price_basis === "close_on_date"
        ? `Bought at the closing price of ${p.close_on_date_day ?? p.purchase_date}${p.close_on_date_day && p.close_on_date_day !== p.purchase_date ? ` (last session on or before ${p.purchase_date})` : ""}`
        : `Bought at the price you entered${p.purchase_date ? ` on ${p.purchase_date}` : ""}${p.close_on_date ? ` (that day's close: ${m(p.close_on_date)})` : ""}`}
        actions={<DataTag kind="data" />} />
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-6">
        <Kpi label="Bought at" value={m(p.purchase_price)} sub={p.purchase_date ?? undefined} />
        <Kpi label="Price now" value={m(p.current_price)} />
        <Kpi label="Return" value={pct(p.return_pct)} valueCls={signCls(p.return_pct)} />
        <Kpi label="Profit / loss" value={p.pnl != null ? `${p.pnl >= 0 ? "+" : "−"}${m(Math.abs(p.pnl))}` : "—"} valueCls={signCls(p.pnl)}
          sub={p.shares ? `${p.shares} share${p.shares === 1 ? "" : "s"}` : "add shares to see money"} />
        <Kpi label="Cost" value={p.cost != null ? m(p.cost) : "—"} />
        <Kpi label="Value now" value={p.value != null ? m(p.value) : "—"} />
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------ outlook
function OutlookCard({ r, m }: { r: Report; m: (v: number | null | undefined) => string }) {
  const o = r.outlook;
  const [src, setSrc] = useState<"model" | "ai">("model");
  const hasAI = r.ai_outlook.length > 0;
  if (!o.available) return <Card className="p-4 text-sm text-muted-foreground">Price outlook unavailable: {o.reason}</Card>;
  const rows: { key: keyof typeof HZ_LABEL; sc: Record<"bear" | "base" | "bull", Scenario>; exp: number; extra?: OutlookHorizon; ai?: AIOutlook }[] =
    src === "model"
      ? (o.horizons ?? []).map((h) => ({ key: h.key, sc: h.scenarios, exp: h.expected_return_pct, extra: h }))
      : r.ai_outlook.map((h) => ({ key: h.key, sc: h.scenarios, exp: h.expected_return_pct, ai: h }));
  return (
    <Card>
      <CardHead title="Price outlook & scenarios"
        subtitle={src === "model"
          ? `Statistical model: ${o.annual_volatility_pct}% annual volatility, drift ${o.annual_drift_pct}%/yr (stock's own trend ${o.stock_trend_pct}%/yr, shrunk toward the long-run market average)`
          : "Claude / ChatGPT scenarios, starting from the model and adjusted for specific evidence (averaged when both answered)"}
        actions={<><DataTag kind="forecast" />{hasAI && <Segmented size="sm" value={src} onChange={setSrc}
          options={[{ id: "model", label: "Statistical model" }, { id: "ai", label: "AI view" }]} />}</>} />
      <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-3">
        {rows.map((h) => (
          <div key={h.key} className="rounded-lg border border-border p-3">
            <div className="flex items-baseline justify-between">
              <h4 className="text-sm font-semibold">{HZ_LABEL[h.key]}</h4>
              <span className="text-[11px] text-muted-foreground">prob.-weighted <b className={signCls(h.exp)}>{pct(h.exp)}</b></span>
            </div>
            {h.extra && (
              <div className="mt-1 text-[11px] text-muted-foreground">
                Likely {m(h.extra.range_likely[0])} – {m(h.extra.range_likely[1])} · wide {m(h.extra.range_wide[0])} – {m(h.extra.range_wide[1])}
                <br />Chance of being higher than today: <b className="text-foreground">{h.extra.probability_of_gain}%</b>
              </div>
            )}
            <table className="mt-2 w-full text-xs">
              <thead className="text-muted-foreground"><tr><th className="py-1 text-left font-medium">Scenario</th><th className="py-1 text-right font-medium">Prob.</th>
                <th className="py-1 text-right font-medium">Price</th><th className="py-1 text-right font-medium">Return</th>
                {r.position && <th className="py-1 text-right font-medium">Your P&L</th>}</tr></thead>
              <tbody className="tabular-nums">
                {(["bull", "base", "bear"] as const).map((k) => {
                  const s = h.sc[k];
                  return (
                    <tr key={k} className="border-t border-border">
                      <td className="py-1.5 font-medium capitalize">{k === "base" ? "Base" : k === "bull" ? "Bullish" : "Bearish"}</td>
                      <td className="py-1.5 text-right">{Math.round(s.probability)}%</td>
                      <td className="py-1.5 text-right">{m(s.price)}</td>
                      <td className={cx("py-1.5 text-right", signCls(s.return_pct))}>{pct(s.return_pct, 1)}</td>
                      {r.position && <td className={cx("py-1.5 text-right", signCls(s.position_pnl ?? s.vs_purchase_pct))}>
                        {s.position_pnl != null ? `${s.position_pnl >= 0 ? "+" : "−"}${m(Math.abs(s.position_pnl))}` : pct(s.vs_purchase_pct, 1)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {h.extra?.historical && (
              <p className="mt-2 text-[10px] text-muted-foreground">
                History ({h.extra.historical.windows} past windows): 10th pct {pct(h.extra.historical.p10, 1)}, median {pct(h.extra.historical.median, 1)},
                90th pct {pct(h.extra.historical.p90, 1)}; {h.extra.historical.share_positive}% gained.
              </p>
            )}
            {h.ai && Object.entries(h.ai.comments).map(([k, c]) => c && (
              <p key={k} className="mt-2 text-[11px] text-muted-foreground"><b className="text-foreground">{METHOD_META[k as "claude"]?.short ?? k}:</b> {c}</p>
            ))}
          </div>
        ))}
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground sm:px-5">
        Scenarios are estimates of a range of outcomes, not predictions of a specific price. Bear / base / bull are the average outcome in the
        worst 25%, middle 50% and best 25% of the model's distribution; the probability-weighted return is their weighted average.
      </p>
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------ fundamentals
function FundamentalsCard({ r }: { r: Report }) {
  const q = r.quality;
  const f = r.fundamentals;
  const n = (k: string) => (typeof f[k] === "number" ? (f[k] as number) : null);
  const ratio = (k: string, d = 1) => (n(k) != null ? n(k)!.toFixed(d) : "—");
  const pc = (k: string) => (n(k) != null ? pct(n(k)! * 100, 0) : "—");
  const big = (k: string) => (n(k) != null ? `${(n(k)! / 1e9).toFixed(1)}B` : "—");
  const metrics: [string, string][] = [
    ["Revenue growth", pc("revenue_growth")], ["EPS growth", pc("eps_growth")], ["Gross margin", pc("gross_margin")],
    ["Operating margin", pc("operating_margin")], ["Net margin", pc("profit_margin")], ["ROE", pc("roe")],
    ["Free cash flow", big("free_cashflow")], ["Total debt", big("total_debt")], ["Cash", big("total_cash")],
    ["Debt / equity", ratio("debt_to_equity", 2)], ["P/E", ratio("pe_trailing")], ["Forward P/E", ratio("pe_forward")],
    ["PEG", ratio("peg", 2)], ["EV / EBITDA", ratio("ev_to_ebitda")], ["Price / sales", ratio("price_to_sales")],
  ];
  return (
    <Card>
      <CardHead title="Fundamental quality" subtitle={`${q.coverage} of ${q.pillars_total} pillars with data · ${f.sector || ""}${f.industry ? ` · ${f.industry}` : ""}`}
        actions={<DataTag kind="data" />} />
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <ScoreRing value={q.score} size={60} label="Quality score" />
          <div className="grid flex-1 grid-cols-1 gap-1.5 sm:grid-cols-2">
            {Object.entries(q.pillars).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="w-32 shrink-0 text-muted-foreground">{PILLAR_LABEL[k] ?? k}</span>
                <Meter value={v} className="flex-1" />
                <span className={cx("w-7 text-right tabular-nums", scoreClass(v))}>{v == null ? "—" : Math.round(v)}</span>
              </div>
            ))}
          </div>
        </div>
        {q.red_flags.length > 0 && (
          <ul className="space-y-1">{q.red_flags.map((x, i) => (
            <li key={i} className="flex gap-1.5 text-xs"><AlertTriangle className={cx("mt-0.5 h-3.5 w-3.5 shrink-0", x.severity === "severe" ? "text-red-600" : "text-amber-500")} />
              <span><b>{x.severity === "severe" ? "Red flag" : "Caution"}:</b> {x.text}</span></li>))}</ul>
        )}
        {q.event_risk && <p className="flex gap-1.5 text-xs"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />{q.event_risk}</p>}
        {q.strengths.length > 0 && (
          <ul className="space-y-1">{q.strengths.map((x, i) => (
            <li key={i} className="flex gap-1.5 text-xs"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{x}</li>))}</ul>
        )}
        <dl className="grid grid-cols-3 gap-x-4 gap-y-2 border-t border-border pt-3 sm:grid-cols-5">
          {metrics.map(([k, v]) => <div key={k}><dt className="text-[10px] text-muted-foreground">{k}</dt><dd className="text-xs font-semibold tabular-nums">{v}</dd></div>)}
        </dl>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------ analysts
function AnalystCard({ r, m }: { r: Report; m: (v: number | null | undefined) => string }) {
  const f = r.fundamentals;
  const a = r.research.analyst;
  const cur = a?.rating_trend?.[0];
  const total = cur ? cur.strong_buy + cur.buy + cur.hold + cur.sell + cur.strong_sell : 0;
  const lo = f.target_low as number | null, mean = f.target_mean as number | null, hi = f.target_high as number | null;
  const pos = (v: number | null) => (lo != null && hi != null && v != null && hi > lo ? Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100)) : null);
  const cal = r.research.calendar;
  return (
    <Card>
      <CardHead title="Analyst ratings & price targets" subtitle={f.analyst_count ? `${f.analyst_count} analysts · consensus ${f.recommendation_key || "—"} (${num(f.recommendation_mean as number, 1)} on 1 = strong buy … 5 = sell)` : "No analyst coverage data"}
        actions={<DataTag kind="data" />} />
      <div className="space-y-4 p-4 sm:p-5">
        {cur && total > 0 && (
          <div>
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {([["strong_buy", "bg-emerald-600"], ["buy", "bg-emerald-400"], ["hold", "bg-amber-400"], ["sell", "bg-red-400"], ["strong_sell", "bg-red-600"]] as const).map(([k, c]) =>
                cur[k] > 0 && <span key={k} className={cx("h-full", c)} style={{ width: `${(cur[k] / total) * 100}%` }} />)}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Strong buy {cur.strong_buy} · Buy {cur.buy} · Hold {cur.hold} · Sell {cur.sell} · Strong sell {cur.strong_sell}
              {a?.upgrades_90d != null && ` · 90 days: ${a.upgrades_90d} upgrade(s), ${a.downgrades_90d} downgrade(s), ${a.target_raises_90d} target raise(s), ${a.target_cuts_90d} cut(s)`}</p>
          </div>
        )}
        {mean != null && (
          <div>
            <div className="relative mt-3 h-1.5 rounded-full bg-muted">
              {pos(r.price) != null && <span title="Price now" className="absolute -top-1 h-3.5 w-1 rounded bg-foreground" style={{ left: `${pos(r.price)}%` }} />}
              {pos(mean) != null && <span title="Mean target" className="absolute -top-1 h-3.5 w-1 rounded bg-primary" style={{ left: `${pos(mean)}%` }} />}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
              <span>Low {m(lo)}</span><span>Mean <b className="text-primary">{m(mean)}</b> ({pct(r.quality.upside_to_target, 0)} vs now)</span><span>High {m(hi)}</span>
            </div>
          </div>
        )}
        {cal?.next_earnings && (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs">Next earnings <b>{cal.next_earnings}</b>{cal.days_to_earnings != null ? ` (in ${cal.days_to_earnings} days)` : ""}
            {cal.eps_estimate != null && ` · consensus EPS ${num(cal.eps_estimate, 2)}`}{cal.revenue_estimate != null && ` · revenue ${(cal.revenue_estimate / 1e9).toFixed(1)}B`}
            {r.research.estimates?.eps_growth_this_year != null && ` · EPS growth this year ${pct(r.research.estimates.eps_growth_this_year * 100, 0)}`}</p>
        )}
        {(a?.recent_actions ?? []).length > 0 && (
          <div className="stocks-scroll overflow-x-auto">
            <table className="w-full min-w-[420px] text-xs">
              <thead className="text-left text-muted-foreground"><tr><th className="py-1 font-medium">Date</th><th className="py-1 font-medium">Firm</th><th className="py-1 font-medium">Rating</th><th className="py-1 text-right font-medium">Target</th></tr></thead>
              <tbody>{a!.recent_actions!.map((x, i) => (
                <tr key={i} className="border-t border-border"><td className="py-1.5">{x.date}</td><td className="py-1.5">{x.firm}</td>
                  <td className="py-1.5">{x.from && x.from !== x.to ? `${x.from} → ` : ""}<b>{x.to}</b>{x.action === "up" ? " ▲" : x.action === "down" ? " ▼" : ""}</td>
                  <td className="py-1.5 text-right tabular-nums">{x.prior_target && x.prior_target !== x.target ? `${num(x.prior_target, 0)} → ` : ""}{num(x.target, 0)}</td></tr>))}</tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------ ownership
function OwnershipCard({ r }: { r: Report }) {
  const f = r.fundamentals;
  const ins = r.research.insiders;
  const inst = r.research.institutions;
  const fmtV = (v: number) => `${v < 0 ? "−" : ""}${Math.abs(v) >= 1e6 ? `${(Math.abs(v) / 1e6).toFixed(1)}M` : Math.abs(v).toLocaleString()}`;
  return (
    <Card>
      <CardHead title="Institutional & insider activity" actions={<DataTag kind="data" />} />
      <div className="space-y-3 p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-2">
          <Kpi label="Institutions" value={f.held_institutions != null ? `${((f.held_institutions as number) * 100).toFixed(0)}%` : "—"} sub="of shares" />
          <Kpi label="Insiders" value={f.held_insiders != null ? `${((f.held_insiders as number) * 100).toFixed(1)}%` : "—"} sub="of shares" />
          <Kpi label="Short interest" value={f.short_percent_float != null ? `${((f.short_percent_float as number) * 100).toFixed(1)}%` : "—"} sub="of float" />
        </div>
        {ins && (
          <p className="text-xs text-muted-foreground">Insiders, last {ins.window_days} days: <b className="text-foreground">{ins.buys} buy(s)</b> ({fmtV(ins.buy_value)}) ·{" "}
            <b className="text-foreground">{ins.sells} sale(s)</b> ({fmtV(ins.sell_value)}). Routine sales (option exercises, tax) are common; buying is the stronger signal.</p>
        )}
        {inst && (
          <div className="stocks-scroll overflow-x-auto">
            <table className="w-full min-w-[360px] text-xs">
              <thead className="text-left text-muted-foreground"><tr><th className="py-1 font-medium">Top holder</th><th className="py-1 text-right font-medium">Holds</th><th className="py-1 text-right font-medium">Last change</th></tr></thead>
              <tbody>{inst.top.slice(0, 6).map((h, i) => (
                <tr key={i} className="border-t border-border"><td className="py-1.5">{h.holder}</td><td className="py-1.5 text-right tabular-nums">{h.pct != null ? `${(h.pct * 100).toFixed(2)}%` : "—"}</td>
                  <td className={cx("py-1.5 text-right tabular-nums", signCls(h.pct_change))}>{h.pct_change != null ? pct(h.pct_change * 100, 1) : "—"}</td></tr>))}</tbody>
            </table>
            <p className="mt-1 text-[11px] text-muted-foreground">{inst.increasing} of the top 10 added, {inst.decreasing} trimmed in the latest filings.</p>
          </div>
        )}
        {!ins && !inst && <p className="text-xs text-muted-foreground">No ownership data available for this listing.</p>}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------ sector & peers
function SectorPeersCard({ r }: { r: Report }) {
  const s = r.research.sector;
  const peers = r.research.peers?.peers ?? [];
  const f = r.fundamentals;
  return (
    <Card>
      <CardHead title="Sector & competitors" subtitle={s ? `${s.sector} sector (${s.etf}) vs S&P 500` : "Peer comparison is available for US listings"} actions={<DataTag kind="data" />} />
      <div className="space-y-3 p-4 sm:p-5">
        {s && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            {([["1 month", s.m1_return, s.index_m1_return], ["3 months", s.m3_return, s.index_m3_return], ["6 months", s.m6_return, s.index_m6_return]] as const).map(([k, a, b]) => (
              <div key={k} className="rounded-lg border border-border px-3 py-2">
                <div className="text-[11px] text-muted-foreground">{k}</div>
                <div className={cx("font-semibold tabular-nums", signCls(a))}>{pct(a, 1)}</div>
                <div className="text-[10px] text-muted-foreground">index {pct(b, 1)}</div>
              </div>
            ))}
          </div>
        )}
        {peers.length > 0 ? (
          <div className="stocks-scroll overflow-x-auto">
            <table className="w-full min-w-[480px] text-xs">
              <thead className="text-left text-muted-foreground"><tr><th className="py-1 font-medium">Company</th><th className="py-1 text-right font-medium">P/E</th><th className="py-1 text-right font-medium">Fwd P/E</th>
                <th className="py-1 text-right font-medium">Rev. growth</th><th className="py-1 text-right font-medium">Net margin</th><th className="py-1 text-right font-medium">1y</th></tr></thead>
              <tbody className="tabular-nums">
                <tr className="border-t border-border bg-primary/5 font-semibold"><td className="py-1.5">{r.symbol} (this stock)</td><td className="py-1.5 text-right">{num(f.pe_trailing as number, 1)}</td>
                  <td className="py-1.5 text-right">{num(f.pe_forward as number, 1)}</td><td className="py-1.5 text-right">{f.revenue_growth != null ? pct((f.revenue_growth as number) * 100, 0) : "—"}</td>
                  <td className="py-1.5 text-right">{f.profit_margin != null ? `${((f.profit_margin as number) * 100).toFixed(0)}%` : "—"}</td>
                  <td className={cx("py-1.5 text-right", signCls(f.week52_change as number))}>{f.week52_change != null ? pct((f.week52_change as number) * 100, 0) : "—"}</td></tr>
                {peers.map((p) => (
                  <tr key={p.symbol} className="border-t border-border"><td className="py-1.5">{p.symbol} <span className="text-muted-foreground">{p.name}</span></td>
                    <td className="py-1.5 text-right">{num(p.pe, 1)}</td><td className="py-1.5 text-right">{num(p.forward_pe, 1)}</td>
                    <td className="py-1.5 text-right">{p.revenue_growth != null ? pct(p.revenue_growth * 100, 0) : "—"}</td>
                    <td className="py-1.5 text-right">{p.profit_margin != null ? `${(p.profit_margin * 100).toFixed(0)}%` : "—"}</td>
                    <td className={cx("py-1.5 text-right", signCls(p.week52_change))}>{p.week52_change != null ? pct(p.week52_change * 100, 0) : "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-xs text-muted-foreground">No peer data for this listing.</p>}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------------------------------------ news
function NewsCard({ r }: { r: Report }) {
  const impactTone = { positive: "good", negative: "bad", neutral: "neutral" } as const;
  return (
    <Card>
      <CardHead title="Latest material news"
        subtitle={r.news.length ? `${r.news.length} development(s) that could affect the company, most material first${r.news[0]?.curated_by !== "rules" ? " · abstracts and impact by AI" : " · impact from headline sentiment"}`
          : "No material company news found in the sources for this run"} />
      <ul className="divide-y divide-border">
        {r.news.map((n, i) => (
          <li key={i} className="px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <Pill tone={impactTone[n.impact]}>{n.impact === "positive" ? "▲ Positive" : n.impact === "negative" ? "▼ Negative" : "● Neutral"}</Pill>
              <Pill>{n.category}</Pill>
              {n.materiality != null && <span className="text-muted-foreground">materiality {n.materiality}</span>}
              <span className="ml-auto text-muted-foreground">{n.source_name} · {n.published_at ? `${new Date(n.published_at).toLocaleDateString()} (${ago(n.published_at)})` : "date unknown"}</span>
            </div>
            <a href={n.url} target="_blank" rel="noopener noreferrer" className="group mt-1 inline-flex items-start gap-1 text-sm font-semibold hover:underline">
              {n.title}<ExternalLink className="mt-1 h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
            </a>
            {n.abstract && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.abstract}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

