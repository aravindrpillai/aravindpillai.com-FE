import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Check, Clock, Gauge, ListChecks, Loader2, Lock, MapPin, Minus, PieChart, Plus, Search, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CITIES, CURRENCIES, EMPLOYMENT_OPTIONS, FinanceIntake, GOAL_IDEAS, STEPS, WizardStep,
  currencyForCity, currencySymbol, defaultIntake, guessCurrency, money,
} from "./data";
import { financeApi, type FinanceRecord } from "@/lib/playgroundApi";
import { errorText, usePlayground } from "../PlaygroundGate";

const TOTAL_STEPS = 5;

/* ── Searchable city picker (any city can be typed) ── */
const CityPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => (query ? CITIES.filter((c) => c.toLowerCase().includes(query.toLowerCase())) : CITIES).slice(0, 30),
    [query]
  );
  const exact = CITIES.some((c) => c.toLowerCase() === query.trim().toLowerCase());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (city: string) => {
    onChange(city);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative" ref={ref}>
      <div
        className={`flex h-11 w-full cursor-text items-center gap-2 rounded-xl border bg-background px-3 transition-colors ${
          open ? "border-success ring-2 ring-success/20" : "border-input"
        }`}
        onClick={() => setOpen(true)}
      >
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
        {open ? (
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Start typing your city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (filtered[0] && query) pick(filtered[0]);
                else if (query.trim()) pick(query.trim());
              }
              if (e.key === "Escape") setOpen(false);
            }}
          />
        ) : (
          <span className={`flex-1 text-sm ${value ? "text-foreground" : "text-muted-foreground"}`}>{value || "Where do you live?"}</span>
        )}
        {value && !open ? <Check className="h-4 w-4 text-success" /> : <Search className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-popover shadow-elevated scrollbar-thin"
          >
            {query.trim() && !exact && (
              <button
                type="button"
                className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm text-success hover:bg-success/5"
                onClick={() => pick(query.trim())}
              >
                <Plus className="h-3.5 w-3.5" /> Use “{query.trim()}”
              </button>
            )}
            {filtered.map((city) => (
              <button
                key={city}
                type="button"
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-accent/10 ${
                  value === city ? "bg-success/10 font-medium text-success" : "text-foreground"
                }`}
                onClick={() => pick(city)}
              >
                {city}
                {value === city && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Money input: currency prefix, thousands separators, optional live hint ── */
const MoneyField = ({
  label, hint, value, onChange, currency, placeholder, extra, autoFocus, onEnter,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  currency: string;
  placeholder?: string;
  extra?: React.ReactNode;
  autoFocus?: boolean;
  onEnter?: () => void;
}) => {
  const symbol = currencySymbol(currency);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {extra}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
          {symbol}
        </span>
        <Input
          inputMode="numeric"
          autoFocus={autoFocus}
          placeholder={placeholder ?? "0"}
          className="h-11 rounded-xl bg-background text-base tabular-nums"
          style={{ paddingLeft: `${Math.max(1.75, symbol.length * 0.55 + 1.1)}rem` }}
          value={value ? Math.round(value).toLocaleString() : ""}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 12);
            onChange(digits ? Number(digits) : 0);
          }}
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        />
      </div>
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
};

const Stepper = ({ value, onChange, min = 0, max = 20 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) => (
  <div className="flex h-11 items-center gap-1 rounded-xl border border-input bg-background px-1">
    <button type="button" aria-label="Less" onClick={() => onChange(Math.max(min, value - 1))}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40" disabled={value <= min}>
      <Minus className="h-4 w-4" />
    </button>
    <span className="flex-1 text-center text-base font-semibold tabular-nums">{value}</span>
    <button type="button" aria-label="More" onClick={() => onChange(Math.min(max, value + 1))}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40" disabled={value >= max}>
      <Plus className="h-4 w-4" />
    </button>
  </div>
);

/* ── Live snapshot: updates as you type ── */
const Snapshot = ({ data }: { data: FinanceIntake }) => {
  const income = data.primaryIncome + data.secondaryIncome;
  const spend = data.rent + data.insurance + data.subscriptions + data.loanPayments + data.variableExpenses;
  const left = income - spend;
  const rate = income > 0 ? Math.round((left / income) * 100) : null;
  const spentPct = income > 0 ? Math.min(100, (spend / income) * 100) : 0;
  const c = data.currency;
  const mood =
    rate === null ? "Add your income to see your snapshot." :
    rate >= 20 ? "Great — you're saving a healthy share. 🌱" :
    rate >= 10 ? "Decent. A little more saving would go a long way." :
    rate >= 0 ? "Tight month — very little is left over." :
    "You're spending more than you earn. We'll help with that.";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-success" /> Your live snapshot
      </p>
      <div className="space-y-2 text-sm">
        <Row label="Coming in" value={money(income, c)} tone="text-success" />
        <Row label="Going out" value={money(spend, c)} tone="text-foreground" />
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <motion.div className={`h-full rounded-full ${left < 0 ? "bg-destructive" : "bg-success"}`}
            animate={{ width: `${income > 0 ? spentPct : 0}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>
        <Row label="Left each month" value={money(left, c)} tone={left < 0 ? "text-destructive" : "text-success"} bold />
        {rate !== null && <Row label="Savings rate" value={`${rate}%`} tone={rate >= 20 ? "text-success" : rate >= 0 ? "text-orange-500" : "text-destructive"} />}
      </div>
      <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">{mood}</p>
    </div>
  );
};

const Row = ({ label, value, tone, bold }: { label: string; value: string; tone: string; bold?: boolean }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-muted-foreground">{label}</span>
    <span className={`tabular-nums ${tone} ${bold ? "text-base font-bold" : "font-semibold"}`}>{value}</span>
  </div>
);

/* ── Welcome ── */
const Welcome = ({ onStart, onBack }: { onStart: () => void; onBack: () => void }) => (
  <div className="flex min-h-screen items-center justify-center px-4 py-10">
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Home
      </button>
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-card sm:p-9">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-success/10 blur-2xl" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
          <Clock className="h-3.5 w-3.5" /> Takes about 3 minutes
        </span>
        <h1 className="mt-4 font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl">
          How healthy are your finances, really?
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Answer five quick screens about your money. You'll get a clear score, see exactly where your money goes,
          and a short action plan built around your own numbers.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Gauge, title: "A score out of 100", text: "Across 5 pillars, with the math shown" },
            { icon: PieChart, title: "Where it all goes", text: "Every expense as a % of income" },
            { icon: ListChecks, title: "Your next moves", text: "3–5 steps, ranked by impact" },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-border bg-background/60 p-3">
              <Icon className="h-5 w-5 text-success" />
              <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
        <Button onClick={onStart} size="lg" className="mt-7 h-12 w-full gap-2 rounded-xl bg-success text-base text-success-foreground hover:bg-success/90">
          Let's start <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" /> No bank logins or account numbers. Rough estimates are fine.
        </p>
      </div>
    </motion.div>
  </div>
);

/* ── helpers ── */
const intakeToPayload = (d: FinanceIntake) => ({
  name: d.name,
  currency: d.currency,
  dependents: d.dependents,
  age: d.age,
  city: d.location,
  employment_status: d.employmentStatus.replace("-", "_"),
  primary_income: d.primaryIncome,
  secondary_income: d.secondaryIncome,
  rent_mortgage: d.rent,
  insurance_premiums: d.insurance,
  subscriptions: d.subscriptions,
  loan_payments: d.loanPayments,
  outstanding_loans: d.totalOutstandingLoan,
  variable_expenses: d.variableExpenses,
  savings_balance: d.savingsBalance,
  investments: d.investments,
  property_value: d.propertyValue,
  emergency_fund: d.emergencyFund,
  goals: d.goalSummary,
});

const recordToIntake = (r: FinanceRecord): FinanceIntake => ({
  name: r.name ?? "",
  currency: r.currency || "USD",
  dependents: r.dependents ?? 0,
  age: r.age,
  location: r.city,
  employmentStatus: (r.employment_status.replace("_", "-") as FinanceIntake["employmentStatus"]) || "employed",
  primaryIncome: r.primary_income,
  secondaryIncome: r.secondary_income,
  rent: r.rent_mortgage,
  insurance: r.insurance_premiums,
  subscriptions: r.subscriptions,
  loanPayments: r.loan_payments ?? 0,
  totalOutstandingLoan: r.outstanding_loans,
  variableExpenses: r.variable_expenses,
  savingsBalance: r.savings_balance,
  investments: r.investments,
  propertyValue: r.property_value,
  emergencyFund: r.emergency_fund,
  goalSummary: r.goals,
});

/* ── Main component ── */
const Questions = () => {
  const navigate = useNavigate();
  const session = usePlayground();
  const { sessionId } = useParams<{ sessionId?: string }>();
  const [started, setStarted] = useState(!!sessionId);
  const [step, setStep] = useState<WizardStep>(1);
  const [data, setData] = useState<FinanceIntake>(() => ({ ...defaultIntake, currency: guessCurrency() }));
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(sessionId ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Reopened with /finance-advisor/questions/<id>: load the saved answers */
  useEffect(() => {
    if (!sessionId) return;
    financeApi
      .get(session.token, sessionId)
      .then((r) => {
        setData(recordToIntake(r));
        setRecordId(r.id);
        setCurrencyTouched(true);
      })
      .catch((e) => {
        if (session.handleAuthError(e)) return;
        setRecordId(null);
        setStarted(false);
        navigate("/finance-advisor", { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const set = <K extends keyof FinanceIntake>(key: K, val: FinanceIntake[K]) => setData((p) => ({ ...p, [key]: val }));

  const income = data.primaryIncome + data.secondaryIncome;
  const pctOfIncome = (v: number) =>
    income > 0 && v > 0 ? <span className="text-xs font-medium tabular-nums text-muted-foreground">{Math.round((v / income) * 100)}% of income</span> : null;

  const blocker = (): string | null => {
    if (step === 1) {
      if (!(data.age >= 16 && data.age <= 100)) return "Enter your age (16–100).";
      if (!data.location) return "Pick your city — it changes the cost-of-living advice.";
    }
    if (step === 2 && data.primaryIncome <= 0) return "Add your main monthly income to continue.";
    return null;
  };

  const saveStep = async (): Promise<string | null> => {
    try {
      const payload = intakeToPayload(data);
      if (recordId) {
        await financeApi.update(session.token, recordId, payload);
        return recordId;
      }
      const record = await financeApi.create(session.token, payload);
      setRecordId(record.id);
      navigate(`/finance-advisor/questions/${record.id}`, { replace: true });
      return record.id;
    } catch (e) {
      const msg = errorText(session, e, "Couldn't save your answers. Please try again.");
      if (msg) setError(msg);
      return null;
    }
  };

  const next = async () => {
    if (blocker() || loading) return;
    setLoading(true);
    setError(null);
    const id = await saveStep();
    if (!id) return setLoading(false);
    if (step < TOTAL_STEPS) {
      setLoading(false);
      setStep((s) => (s + 1) as WizardStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate(`/finance-advisor/summary/${id}`);
    }
  };

  const back = () => {
    setError(null);
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
    else if (!sessionId) setStarted(false);
    else navigate("/");
  };

  const toggleGoal = (text: string) => {
    const lines = data.goalSummary.split("\n").map((l) => l.trim()).filter(Boolean);
    const has = lines.includes(text);
    set("goalSummary", (has ? lines.filter((l) => l !== text) : [...lines, text]).join("\n"));
  };
  const goalLines = data.goalSummary.split("\n").map((l) => l.trim());

  if (!started) return <Welcome onStart={() => setStarted(true)} onBack={() => navigate("/")} />;

  const c = data.currency;
  const field = (props: Omit<Parameters<typeof MoneyField>[0], "currency" | "onEnter">) => (
    <MoneyField {...props} currency={c} onEnter={next} />
  );

  const content: Record<WizardStep, JSX.Element> = {
    1: (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">First name <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input className="h-11 rounded-xl bg-background" placeholder="So we can say hi" maxLength={80}
              value={data.name} onChange={(e) => set("name", e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Age</Label>
            <Input className="h-11 rounded-xl bg-background text-base tabular-nums" inputMode="numeric" placeholder="30"
              value={data.age || ""} onChange={(e) => set("age", Number(e.target.value.replace(/\D/g, "").slice(0, 3)) || 0)}
              onKeyDown={(e) => e.key === "Enter" && next()} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">City</Label>
            <CityPicker value={data.location} onChange={(v) => {
              setData((p) => ({ ...p, location: v, currency: !currencyTouched && currencyForCity(v) ? currencyForCity(v)! : p.currency }));
            }} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Currency</Label>
            <Select value={data.currency} onValueChange={(v) => { set("currency", v); setCurrencyTouched(true); }}>
              <SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {CURRENCIES.map((o) => (
                  <SelectItem key={o.code} value={o.code}>{currencySymbol(o.code)} · {o.code} — {o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">What do you do?</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {EMPLOYMENT_OPTIONS.map((o) => {
              const on = data.employmentStatus === o.value;
              return (
                <button key={o.value} type="button" onClick={() => set("employmentStatus", o.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-sm transition-all ${
                    on ? "border-success bg-success/10 font-semibold text-foreground" : "border-border bg-background text-muted-foreground hover:border-success/40"
                  }`}>
                  <span className="text-xl" aria-hidden>{o.emoji}</span>
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">People who depend on you</Label>
            <Stepper value={data.dependents} onChange={(v) => set("dependents", v)} />
            <p className="text-xs text-muted-foreground">Kids, parents or a partner you support.</p>
          </div>
        </div>
      </div>
    ),
    2: (
      <div className="grid gap-5 sm:grid-cols-2">
        {field({ label: "Main income", hint: "Your take-home pay each month, after tax.", value: data.primaryIncome,
          onChange: (v) => set("primaryIncome", v), placeholder: "e.g. 4,000", autoFocus: true })}
        {field({ label: "Other income", hint: "Side gigs, rent received, freelance, a partner's contribution.", value: data.secondaryIncome,
          onChange: (v) => set("secondaryIncome", v) })}
      </div>
    ),
    3: (
      <div className="space-y-6">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-success">Fixed bills</p>
          <div className="grid gap-5 sm:grid-cols-2">
            {field({ label: "Rent or mortgage", value: data.rent, onChange: (v) => set("rent", v), extra: pctOfIncome(data.rent), autoFocus: true })}
            {field({ label: "Loan & card repayments", hint: "Monthly EMIs: car, student, personal loans, card minimums.",
              value: data.loanPayments, onChange: (v) => set("loanPayments", v), extra: pctOfIncome(data.loanPayments) })}
            {field({ label: "Insurance", hint: "Health, life, car, home — per month.", value: data.insurance,
              onChange: (v) => set("insurance", v), extra: pctOfIncome(data.insurance) })}
            {field({ label: "Subscriptions", hint: "Streaming, phone, gym, apps.", value: data.subscriptions,
              onChange: (v) => set("subscriptions", v), extra: pctOfIncome(data.subscriptions) })}
          </div>
        </div>
        <div className="border-t border-border pt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-info">Everyday spending</p>
          {field({ label: "Everything else", hint: "Groceries, transport, eating out, shopping, school fees, medical — a typical month.",
            value: data.variableExpenses, onChange: (v) => set("variableExpenses", v), extra: pctOfIncome(data.variableExpenses) })}
        </div>
      </div>
    ),
    4: (
      <div className="space-y-6">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-success">What you own</p>
          <div className="grid gap-5 sm:grid-cols-2">
            {field({ label: "Emergency fund", hint: "Cash set aside only for emergencies.", value: data.emergencyFund,
              onChange: (v) => set("emergencyFund", v), autoFocus: true })}
            {field({ label: "Other savings", hint: "Bank savings not counted above.", value: data.savingsBalance,
              onChange: (v) => set("savingsBalance", v) })}
            {field({ label: "Investments & pension", hint: "Stocks, mutual funds, retirement accounts.", value: data.investments,
              onChange: (v) => set("investments", v) })}
            {field({ label: "Property value", hint: "What your home or land would sell for. 0 if you rent.", value: data.propertyValue,
              onChange: (v) => set("propertyValue", v) })}
          </div>
        </div>
        <div className="border-t border-border pt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-destructive">What you owe</p>
          {field({ label: "Total left to repay on all loans", hint: "Mortgage, car, student, personal loans and card balances combined.",
            value: data.totalOutstandingLoan, onChange: (v) => set("totalOutstandingLoan", v) })}
        </div>
      </div>
    ),
    5: (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {GOAL_IDEAS.map((g) => {
            const on = goalLines.includes(g.text);
            return (
              <button key={g.label} type="button" onClick={() => toggleGoal(g.text)}
                className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm transition-all ${
                  on ? "border-success bg-success/10 font-medium text-foreground" : "border-border bg-background text-muted-foreground hover:border-success/40"
                }`}>
                <span aria-hidden>{g.emoji}</span> {g.label} {on && <Check className="h-3.5 w-3.5 text-success" />}
              </button>
            );
          })}
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Add details <span className="font-normal text-muted-foreground">(amounts and dates help a lot)</span></Label>
          <Textarea
            placeholder={`e.g. Save ${money(40000, c)} for a house deposit in 2 years, and retire by 55.`}
            className="min-h-[130px] resize-none rounded-xl bg-background"
            value={data.goalSummary}
            onChange={(e) => set("goalSummary", e.target.value)}
          />
        </div>
      </div>
    ),
  };

  const meta = STEPS[step];
  const why = blocker();

  return (
    <div className="min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header + progress */}
        <div className="mb-6 flex items-center gap-3">
          <button onClick={back} className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Step {step} of {TOTAL_STEPS}</span>
              <span>{step === TOTAL_STEPS ? "Last one!" : `About ${Math.max(1, TOTAL_STEPS - step)} min left`}</span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <button key={i} type="button" aria-label={`Step ${i + 1}`} disabled={i + 1 >= step}
                  onClick={() => setStep((i + 1) as WizardStep)}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <motion.div className="h-full bg-success" initial={false} animate={{ width: i + 1 <= step ? "100%" : "0%" }} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22 }}
                className="rounded-3xl border border-border bg-card p-5 shadow-card sm:p-7"
              >
                <div className="mb-6">
                  <span className="text-3xl" aria-hidden>{meta.emoji}</span>
                  <h1 className="mt-2 font-heading text-2xl font-bold text-foreground">
                    {step === 1 ? "First, a little about you" : step === 2 && data.name ? `Nice to meet you, ${data.name.split(" ")[0]}! ${meta.title}` : meta.title}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">{meta.subtitle}</p>
                </div>
                {content[step]}
              </motion.div>
            </AnimatePresence>

            {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

            <div className="mt-5 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={back} disabled={loading} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <div className="flex items-center gap-3">
                {why && <span className="hidden text-xs text-muted-foreground sm:inline">{why}</span>}
                <Button onClick={next} disabled={!!why || loading} size="lg"
                  className="h-11 gap-2 rounded-xl bg-success px-6 text-success-foreground hover:bg-success/90">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : step < TOTAL_STEPS ? <>Continue <ArrowRight className="h-4 w-4" /></> : <><Sparkles className="h-4 w-4" /> See my report</>}
                </Button>
              </div>
            </div>
            {why && <p className="mt-2 text-right text-xs text-muted-foreground sm:hidden">{why}</p>}
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <Snapshot data={data} />
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Questions;
