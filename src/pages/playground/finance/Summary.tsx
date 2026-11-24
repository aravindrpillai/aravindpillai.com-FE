import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, Home, Landmark, Loader2, Pencil, PiggyBank, Printer, RefreshCw,
  ShieldAlert, ShieldCheck, Sparkles, Target, TrendingUp, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  financeApi, type FinanceMetrics, type FinancePillar, type FinanceRecord, type FinanceReport,
} from "@/lib/playgroundApi";
import { errorText, usePlayground } from "../PlaygroundGate";
import { EMPLOYMENT_OPTIONS, money } from "./data";

/* ── look & feel ── */
const GRADE_WORD: Record<string, string> = { A: "Excellent", B: "Good", C: "Fair", D: "Needs work", F: "At risk" };
const scoreColor = (s: number) =>
  s >= 75 ? "hsl(var(--success))" : s >= 60 ? "hsl(38 92% 50%)" : s >= 40 ? "hsl(24 90% 55%)" : "hsl(var(--destructive))";

const PILLAR_ICON: Record<FinancePillar["key"], typeof Wallet> = {
  saving: PiggyBank, safety_net: ShieldCheck, debt: Landmark, housing: Home, growth: TrendingUp,
};
const PILLAR_TONE: Record<FinancePillar["status"], { bar: string; text: string; chip: string; word: string }> = {
  strong: { bar: "bg-success", text: "text-success", chip: "bg-success/10 text-success", word: "Strong" },
  ok: { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300", word: "OK" },
  weak: { bar: "bg-destructive", text: "text-destructive", chip: "bg-destructive/10 text-destructive", word: "Weak" },
};
const STATUS_CHIP: Record<string, string> = {
  healthy: "bg-success/10 text-success",
  concerning: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  critical: "bg-destructive/10 text-destructive",
};
const SEVERITY: Record<string, { chip: string; border: string }> = {
  high: { chip: "bg-destructive/10 text-destructive", border: "border-l-destructive" },
  medium: { chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300", border: "border-l-amber-500" },
  low: { chip: "bg-info/10 text-info", border: "border-l-info" },
};
const SPEND_LABEL: Record<string, string> = {
  rent_mortgage: "Housing", loan_payments: "Loan repayments", insurance_premiums: "Insurance",
  subscriptions: "Subscriptions", variable_expenses: "Everyday spending",
};
const SPEND_COLOR: Record<string, string> = {
  rent_mortgage: "hsl(262 60% 58%)", loan_payments: "hsl(0 72% 58%)", insurance_premiums: "hsl(199 80% 50%)",
  subscriptions: "hsl(38 92% 52%)", variable_expenses: "hsl(330 65% 58%)", left: "hsl(var(--success))",
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.4, delay },
});

/* ── pieces ── */
const ScoreRing = ({ score, size = 168, stroke = 12, children }: { score: number; size?: number; stroke?: number; children?: React.ReactNode }) => {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={scoreColor(score)} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ - (score / 100) * circ }}
          transition={{ duration: 1.4, ease: "easeOut" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
};

const Card = ({ title, icon: Icon, iconClass = "text-success", children, className = "", right }: {
  title: string; icon: typeof Wallet; iconClass?: string; children: React.ReactNode; className?: string; right?: React.ReactNode;
}) => (
  <section className={`rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6 ${className}`}>
    <header className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
        <Icon className={`h-5 w-5 ${iconClass}`} /> {title}
      </h2>
      {right}
    </header>
    {children}
  </section>
);

const Stat = ({ label, value, sub, tone = "text-foreground" }: { label: string; value: string; sub?: string; tone?: string }) => (
  <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className={`mt-1 font-heading text-xl font-bold tabular-nums sm:text-2xl ${tone}`}>{value}</p>
    {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
  </div>
);

/* ── Generating screen: shows what is happening instead of a bare spinner ── */
const STAGES = [
  "Adding up your income and spending",
  "Checking your safety net",
  "Stress-testing your debt",
  "Comparing with healthy benchmarks",
  "Matching everything to your goals",
  "Writing your action plan",
];

const GeneratingScreen = () => {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((v) => Math.min(STAGES.length - 1, v + 1)), 2600);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 shadow-card">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10">
          <Sparkles className="h-7 w-7 animate-pulse text-success" />
        </div>
        <h2 className="text-center font-heading text-xl font-bold text-foreground">Building your report</h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">This usually takes 15–30 seconds.</p>
        <ul className="mt-6 space-y-3">
          {STAGES.map((s, k) => (
            <motion.li key={s} initial={{ opacity: 0, x: -8 }} animate={{ opacity: k <= i ? 1 : 0.35, x: 0 }}
              transition={{ delay: k * 0.05 }} className="flex items-center gap-3 text-sm">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                k < i ? "bg-success text-success-foreground" : k === i ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
              }`}>
                {k < i ? <Check className="h-3.5 w-3.5" /> : k === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <span className={k <= i ? "text-foreground" : "text-muted-foreground"}>{s}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
};

/* ── sections ── */
const Pillars = ({ m }: { m: FinanceMetrics }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
    {m.pillars.map((p, k) => {
      const Icon = PILLAR_ICON[p.key] ?? Wallet;
      const tone = PILLAR_TONE[p.status];
      return (
        <motion.div key={p.key} {...fadeUp(0.05 * k)} className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Icon className={`h-4 w-4 ${tone.text}`} /> {p.label}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.chip}`}>{tone.word}</span>
          </div>
          <p className="mt-3 font-heading text-2xl font-bold tabular-nums text-foreground">
            {p.points}<span className="text-sm font-medium text-muted-foreground">/{p.max}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div className={`h-full rounded-full ${tone.bar}`} initial={{ width: 0 }}
              whileInView={{ width: `${(p.points / p.max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.8 }} />
          </div>
          <p className="mt-3 text-xs text-foreground">{p.value}</p>
          <p className="text-[11px] text-muted-foreground">Target: {p.target}</p>
        </motion.div>
      );
    })}
  </div>
);

const MoneyFlow = ({ m, report }: { m: FinanceMetrics; report: FinanceReport }) => {
  const c = m.currency;
  const left = Math.max(0, m.monthly_surplus);
  const rows = [
    ...m.spending.filter((s) => s.amount > 0).sort((a, b) => b.amount - a.amount),
    ...(left > 0 ? [{ key: "left", amount: left, percent_of_income: m.monthly_income > 0 ? Math.round((left / m.monthly_income) * 1000) / 10 : null }] : []),
  ];
  const notes = report.budget_breakdown ?? {};
  return (
    <Card title="Where your money goes" icon={Wallet}
      right={<span className="text-xs text-muted-foreground">per month · {money(m.monthly_income, c)} in</span>}>
      <div className="grid items-center gap-6 md:grid-cols-[220px_1fr]">
        <div className="relative mx-auto h-52 w-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="amount" nameKey="key" innerRadius={64} outerRadius={96} paddingAngle={2} stroke="none">
                {rows.map((r) => <Cell key={r.key} fill={SPEND_COLOR[r.key] ?? "hsl(var(--muted-foreground))"} />)}
              </Pie>
              <Tooltip formatter={(v: number, k: string) => [money(v, c), k === "left" ? "Left over" : SPEND_LABEL[k] ?? k]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] text-muted-foreground">{m.monthly_surplus >= 0 ? "Left over" : "Short by"}</span>
            <span className={`font-heading text-lg font-bold tabular-nums ${m.monthly_surplus >= 0 ? "text-success" : "text-destructive"}`}>
              {money(Math.abs(m.monthly_surplus), c)}
            </span>
          </div>
        </div>
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const n = r.key === "left" ? null : notes[r.key];
            return (
              <li key={r.key} className="flex items-start gap-3 py-2.5">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SPEND_COLOR[r.key] }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{r.key === "left" ? "Left over to save" : SPEND_LABEL[r.key] ?? r.key}</span>
                    {n?.status && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_CHIP[n.status]}`}>{n.status}</span>}
                  </div>
                  {n?.note && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.note}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-foreground">{money(r.amount, c)}</p>
                  {r.percent_of_income !== null && <p className="text-[11px] tabular-nums text-muted-foreground">{r.percent_of_income}%</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {report.income_expense_summary?.verdict && (
        <p className="mt-4 rounded-2xl bg-muted/50 px-4 py-3 text-sm leading-relaxed text-foreground">{report.income_expense_summary.verdict}</p>
      )}
    </Card>
  );
};

/* ── Main component ── */
const Summary = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const session = usePlayground();

  const [record, setRecord] = useState<FinanceRecord | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (force = false) => {
    if (!sessionId) return;
    setGenerating(true);
    setError(null);
    try {
      let rec = force ? null : await financeApi.get(session.token, sessionId);
      if (rec) setRecord(rec);
      if (!rec || !rec.ai_response) rec = await financeApi.report(session.token, sessionId, force);
      setRecord(rec);
    } catch (e) {
      const msg = errorText(session, e, "Something went wrong while building your report. Please try again.");
      if (msg) setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (generating) return <GeneratingScreen />;

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 text-center shadow-card">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-3 text-sm text-foreground">{error}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" onClick={() => navigate(`/finance-advisor/questions/${sessionId}`)}>Edit answers</Button>
            <Button onClick={() => run()} className="bg-success text-success-foreground hover:bg-success/90">Try again</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!record || !record.ai_response) return null;

  const report = record.ai_response;
  const m = record.metrics;
  const c = m.currency;
  const score = m.score;
  const grade = m.grade;
  const firstName = record.name?.split(" ")[0];
  const employment = EMPLOYMENT_OPTIONS.find((o) => o.value === record.employment_status.replace("_", "-"))?.label ?? record.employment_status;
  const recs = report.recommendations ?? [];
  const risks = report.risk_flags ?? [];
  const strengths = report.strengths ?? [];
  const sa = report.savings_assets_assessment;
  const debt = report.debt_analysis;
  const goals = report.goal_alignment;
  const hasDebt = m.total_debt > 0 || record.loan_payments > 0;

  return (
    <div className="min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <button onClick={() => navigate(`/finance-advisor/questions/${sessionId}`)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Edit my answers
          </button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => run(true)}>
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Save as PDF
            </Button>
          </div>
        </div>

        {/* Hero */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ background: scoreColor(score) }} />
          <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {firstName ? `${firstName}'s money check-up` : "Your money check-up"} · {new Date(record.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
              </p>
              <h1 className="mt-2 font-heading text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                {report.headline || GRADE_WORD[grade]}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">{report.health_score?.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {[`${record.age} yrs`, record.city, employment, record.dependents ? `${record.dependents} dependent${record.dependents > 1 ? "s" : ""}` : null, c]
                  .filter(Boolean).map((t) => (
                    <span key={t as string} className="rounded-full border border-border bg-background px-2.5 py-1 text-muted-foreground">{t}</span>
                  ))}
              </div>
            </div>
            <div className="flex justify-center">
              <ScoreRing score={score}>
                <span className="font-heading text-5xl font-bold tabular-nums text-foreground">{score}</span>
                <span className="text-xs text-muted-foreground">out of 100</span>
                <span className="mt-1 rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ color: scoreColor(score), background: "hsl(var(--muted))" }}>
                  {grade} · {GRADE_WORD[grade]}
                </span>
              </ScoreRing>
            </div>
          </div>
        </motion.section>

        {/* Pillars */}
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            <strong className="text-foreground">How the score is built:</strong> five pillars, 20 points each, measured against standard benchmarks.
          </p>
          <Pillars m={m} />
        </div>

        {/* Key numbers */}
        <motion.div {...fadeUp()} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Monthly income" value={money(m.monthly_income, c)} sub={`${money(m.monthly_expenses, c)} spent`} />
          <Stat label="Left over" value={money(m.monthly_surplus, c)} tone={m.monthly_surplus >= 0 ? "text-success" : "text-destructive"}
            sub={`${money(m.annual_surplus, c, true)} a year · ${m.savings_rate_percent ?? 0}% of income`} />
          <Stat label="Cash cushion" value={m.cash_cushion_months === null ? "—" : `${m.cash_cushion_months} mo`}
            tone={(m.cash_cushion_months ?? 0) >= 6 ? "text-success" : (m.cash_cushion_months ?? 0) >= 3 ? "text-amber-600" : "text-destructive"}
            sub={m.six_month_cushion_gap > 0 ? `${money(m.six_month_cushion_gap, c, true)} short of 6 months` : "6+ months covered"} />
          <Stat label="Net worth" value={money(m.net_worth, c, true)} tone={m.net_worth >= 0 ? "text-foreground" : "text-destructive"}
            sub={`${money(m.total_assets, c, true)} owned · ${money(m.total_debt, c, true)} owed`} />
        </motion.div>

        <motion.div {...fadeUp()}><MoneyFlow m={m} report={report} /></motion.div>

        {/* Strengths & risks */}
        <motion.div {...fadeUp()} className="grid gap-6 md:grid-cols-2">
          <Card title="What's going well" icon={CheckCircle2}>
            {strengths.length ? (
              <ul className="space-y-2.5">
                {strengths.map((s, k) => (
                  <li key={k} className="flex gap-2.5 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {s}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-2.5">
                {m.pillars.filter((p) => p.status === "strong").map((p) => (
                  <li key={p.key} className="flex gap-2.5 text-sm text-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {p.label}: {p.value}</li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Watch out for" icon={ShieldAlert} iconClass="text-destructive">
            {risks.length ? (
              <ul className="space-y-3">
                {risks.map((f, k) => (
                  <li key={k} className={`rounded-xl border border-border border-l-4 bg-background/50 px-3 py-2.5 ${SEVERITY[f.severity]?.border ?? ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{f.flag}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${SEVERITY[f.severity]?.chip ?? ""}`}>{f.severity}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{f.action}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No red flags. Nice work. 🎉</p>
            )}
          </Card>
        </motion.div>

        {/* Action plan */}
        <motion.div {...fadeUp()}>
          <Card title="Your action plan" icon={Target} iconClass="text-info" right={<span className="text-xs text-muted-foreground">Do these in order</span>}>
            <ol className="relative space-y-4">
              {recs.map((r, k) => (
                <li key={k} className="relative flex gap-4">
                  {k < recs.length - 1 && <span className="absolute left-[15px] top-9 h-[calc(100%-12px)] w-px bg-border" />}
                  <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-sm font-bold text-success-foreground">{k + 1}</span>
                  <div className="flex-1 rounded-2xl border border-border bg-background/50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{r.title}</p>
                      {r.timeframe && <span className="rounded-full bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info">{r.timeframe}</span>}
                      {r.impact && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">{r.impact}</span>}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{r.detail}</p>
                    {r.rationale && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground"><span className="font-semibold">Why: </span>{r.rationale}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </motion.div>

        {/* Safety net, investing, debt */}
        <motion.div {...fadeUp()} className={`grid gap-6 ${hasDebt ? "md:grid-cols-2" : ""}`}>
          <Card title="Savings & investing" icon={PiggyBank}>
            <div className="space-y-4 text-sm">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-foreground">Emergency cushion</span>
                  <span className="tabular-nums text-muted-foreground">{m.cash_cushion_months ?? 0} of 6 months</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${(m.cash_cushion_months ?? 0) >= 6 ? "bg-success" : "bg-amber-500"}`}
                    style={{ width: `${Math.min(100, ((m.cash_cushion_months ?? 0) / 6) * 100)}%` }} />
                </div>
                {sa?.emergency_fund_note && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{sa.emergency_fund_note}</p>}
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-foreground">Invested vs. target for your age</span>
                  <span className="tabular-nums text-muted-foreground">{m.investments_x_income ?? 0}x / {m.investments_target_x}x income</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-info" style={{ width: `${Math.min(100, ((m.investments_x_income ?? 0) / m.investments_target_x) * 100)}%` }} />
                </div>
                {sa?.investments_note && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{sa.investments_note}</p>}
              </div>
              {sa?.savings_vs_age_verdict && <p className="rounded-2xl bg-muted/50 px-4 py-3 text-sm text-foreground">{sa.savings_vs_age_verdict}</p>}
            </div>
          </Card>
          {hasDebt && (
            <Card title="Debt" icon={Landmark} iconClass="text-destructive"
              right={debt?.status && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_CHIP[debt.status]}`}>{debt.status}</span>}>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: "Owed", v: money(m.total_debt, c, true) },
                  { l: "Repayments", v: `${m.debt_service_percent ?? 0}%`, s: "of income" },
                  { l: "Debt-free in", v: m.months_to_debt_free ? (m.months_to_debt_free >= 24 ? `${Math.round(m.months_to_debt_free / 12)} yrs` : `${m.months_to_debt_free} mo`) : "—", s: "at this pace" },
                ].map((x) => (
                  <div key={x.l} className="rounded-2xl bg-muted/50 p-3 text-center">
                    <p className="text-[11px] text-muted-foreground">{x.l}</p>
                    <p className="font-heading text-lg font-bold tabular-nums text-foreground">{x.v}</p>
                    {x.s && <p className="text-[10px] text-muted-foreground">{x.s}</p>}
                  </div>
                ))}
              </div>
              {debt?.repayment_strategy && <p className="mt-4 text-sm leading-relaxed text-foreground">{debt.repayment_strategy}</p>}
              <p className="mt-2 text-[11px] text-muted-foreground">Debt-free estimate ignores interest, so the real time is a little longer.</p>
            </Card>
          )}
        </motion.div>

        {/* Goals */}
        {goals && (
          <motion.div {...fadeUp()}>
            <Card title="Are you on track for your goals?" icon={Target} iconClass="text-info">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex justify-center">
                  <ScoreRing score={goals.alignment_score ?? 0} size={104} stroke={9}>
                    <span className="font-heading text-2xl font-bold tabular-nums">{goals.alignment_score ?? 0}%</span>
                    <span className="text-[10px] text-muted-foreground">on track</span>
                  </ScoreRing>
                </div>
                <div className="flex-1 space-y-3">
                  <p className="text-sm leading-relaxed text-foreground">{goals.analysis}</p>
                  {(goals.gaps ?? []).length > 0 && (
                    <ul className="space-y-1.5">
                      {goals.gaps.map((g, k) => (
                        <li key={k} className="flex gap-2 text-sm text-muted-foreground"><span className="text-amber-500">→</span> {g}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Footer */}
        <div className="flex flex-col items-center gap-4 pb-10 pt-2">
          <div className="flex flex-wrap justify-center gap-2 print:hidden">
            <Button variant="outline" className="gap-1.5 rounded-xl" onClick={() => navigate(`/finance-advisor/questions/${sessionId}`)}>
              <Pencil className="h-4 w-4" /> Tweak my numbers
            </Button>
            <Button variant="outline" className="gap-1.5 rounded-xl" onClick={() => navigate("/finance-advisor")}>
              <Sparkles className="h-4 w-4" /> Start a new check-up
            </Button>
          </div>
          <p className="max-w-md text-center text-[11px] leading-relaxed text-muted-foreground">
            Figures are calculated from your answers; the explanations are written by AI. This is general information, not
            regulated financial advice — talk to a qualified advisor before big decisions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Summary;
