/**
 * Admin panel -> Playground -> FinanceAI submissions: everyone who filled in the FinanceAI questionnaire,
 * their answers, the computed metrics and the AI report (backend: arp/panel/playground/finance/records/).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate, panelRequest, relative } from "@/lib/panelApi";
import type { FinanceRecord } from "@/lib/playgroundApi";
import { money } from "@/pages/playground/finance/data";
import { usePanel } from "./context";

interface Row {
  id: string;
  name: string;
  age: number;
  city: string;
  employment_status: string;
  dependents: number;
  currency: string;
  monthly_income: number;
  monthly_expenses: number;
  monthly_surplus: number;
  net_worth: number;
  score: number | null;
  grade: string | null;
  headline: string;
  has_report: boolean;
  report_count: number;
  ip: string;
  user_agent: string;
  access_mode: string;
  provider: string;
  model: string;
  created_at: string;
  updated_at: string;
}

type Detail = Row & FinanceRecord;

const api = {
  list: (t: string) => panelRequest<Row[]>("GET", "playground/finance/records/", t),
  get: (t: string, id: string) => panelRequest<Detail>("GET", `playground/finance/records/${id}/`, t),
  remove: (t: string, id: string) => panelRequest<null>("DELETE", `playground/finance/records/${id}/`, t),
};

const GRADE_STYLE: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700", B: "bg-emerald-100 text-emerald-700", C: "bg-amber-100 text-amber-800",
  D: "bg-orange-100 text-orange-800", F: "bg-red-100 text-red-700",
};

const ANSWERS: [keyof FinanceRecord, string, "money" | "text"][] = [
  ["primary_income", "Main income / month", "money"],
  ["secondary_income", "Other income / month", "money"],
  ["rent_mortgage", "Rent / mortgage", "money"],
  ["loan_payments", "Loan repayments / month", "money"],
  ["insurance_premiums", "Insurance / month", "money"],
  ["subscriptions", "Subscriptions / month", "money"],
  ["variable_expenses", "Everyday spending / month", "money"],
  ["emergency_fund", "Emergency fund", "money"],
  ["savings_balance", "Other savings", "money"],
  ["investments", "Investments", "money"],
  ["property_value", "Property value", "money"],
  ["outstanding_loans", "Loans outstanding", "money"],
];

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium tabular-nums">{v}</span>
    </div>
  );
}

function DetailDialog({ id, onClose, onDeleted }: { id: string | null; onClose: () => void; onDeleted: (id: string) => void }) {
  const { token, fail } = usePanel();
  const [d, setD] = useState<Detail | null>(null);

  useEffect(() => {
    setD(null);
    if (!id) return;
    api.get(token, id).then(setD).catch((e) => {
      fail(e, "Failed to load submission");
      onClose();
    });
  }, [id, token, fail, onClose]);

  const remove = async () => {
    if (!d || !window.confirm("Delete this submission and its report? The user's report link will stop working.")) return;
    try {
      await api.remove(token, d.id);
      toast.success("Submission deleted");
      onDeleted(d.id);
    } catch (e) {
      fail(e, "Delete failed");
    }
  };

  const c = d?.currency || "USD";
  const r = d?.ai_response;
  const m = d?.metrics;

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-3xl">
        {!d ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {d.name || "Anonymous"} · {d.age} · {d.city || "—"}
                {d.grade && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${GRADE_STYLE[d.grade] ?? ""}`}>{d.score} · {d.grade}</span>}
              </DialogTitle>
              <DialogDescription>
                {fmtDate(d.created_at)} · IP <span className="font-mono">{d.ip || "—"}</span> · {d.access_mode === "code" ? "access code" : d.access_mode === "trial" ? "free trial" : "unknown access"}
                {d.report_count > 0 && ` · ${d.report_count} report${d.report_count > 1 ? "s" : ""} generated (${d.provider} ${d.model})`}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 md:grid-cols-2">
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profile</h3>
                <KV k="Employment" v={d.employment_status.replace("_", " ")} />
                <KV k="Dependents" v={d.dependents} />
                <KV k="Currency" v={d.currency} />
                <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Answers</h3>
                {ANSWERS.map(([key, label]) => <KV key={key} k={label} v={money(Number(d[key] ?? 0), c)} />)}
                <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Goals</h3>
                <p className="whitespace-pre-wrap rounded-xl bg-muted/50 p-3 text-sm">{d.goals || "—"}</p>
              </section>

              <section>
                {m && (
                  <>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Computed</h3>
                    <KV k="Income / expenses" v={`${money(m.monthly_income, c)} / ${money(m.monthly_expenses, c)}`} />
                    <KV k="Left over / month" v={money(m.monthly_surplus, c)} />
                    <KV k="Savings rate" v={`${m.savings_rate_percent ?? "—"}%`} />
                    <KV k="Housing / debt payments" v={`${m.housing_percent ?? "—"}% / ${m.debt_service_percent ?? "—"}%`} />
                    <KV k="Cash cushion" v={`${m.cash_cushion_months ?? "—"} months`} />
                    <KV k="Net worth" v={money(m.net_worth, c)} />
                    <div className="mt-2 grid grid-cols-5 gap-1.5">
                      {m.pillars.map((p) => (
                        <div key={p.key} className="rounded-lg bg-muted/50 p-1.5 text-center" title={`${p.value} (target ${p.target})`}>
                          <p className="truncate text-[10px] text-muted-foreground">{p.label}</p>
                          <p className="text-sm font-bold">{p.points}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI report</h3>
                {!r ? (
                  <p className="text-sm text-muted-foreground">Not generated (the user stopped before the report).</p>
                ) : (
                  <div className="space-y-3 text-sm">
                    {r.headline && <p className="font-semibold">{r.headline}</p>}
                    <p className="text-muted-foreground">{r.health_score?.summary}</p>
                    {(r.recommendations ?? []).length > 0 && (
                      <ol className="list-decimal space-y-1 pl-5">
                        {r.recommendations.map((x, k) => (
                          <li key={k}><span className="font-medium">{x.title}</span>{x.impact && <span className="text-emerald-700"> · {x.impact}</span>}</li>
                        ))}
                      </ol>
                    )}
                    {(r.risk_flags ?? []).length > 0 && (
                      <ul className="space-y-1">
                        {r.risk_flags.map((f, k) => (
                          <li key={k} className="text-xs"><span className="font-semibold uppercase text-red-600">{f.severity}</span> {f.flag}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <p className="mt-4 break-all text-[11px] text-muted-foreground">{d.user_agent || "No user agent"}</p>
              </section>
            </div>

            <div className="flex justify-end border-t border-border pt-4">
              <Button variant="ghost" className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={remove}>
                <Trash2 size={14} /> Delete submission
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function FinanceSubmissionsCard() {
  const { token, fail } = usePanel();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.list(token));
    } catch (e) {
      fail(e, "Failed to load FinanceAI submissions");
    } finally {
      setLoading(false);
    }
  }, [token, fail]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!rows || !s) return rows;
    return rows.filter((r) => [r.name, r.city, r.ip, r.employment_status, r.currency, r.grade].some((v) => v?.toLowerCase().includes(s)));
  }, [rows, q]);

  const closeDialog = useCallback(() => setOpen(null), []);
  const reported = rows?.filter((r) => r.has_report).length ?? 0;
  const people = new Set(rows?.map((r) => r.ip)).size;

  return (
    <section className="rounded-2xl border-2 border-border bg-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold">FinanceAI submissions</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {rows ? `${rows.length} questionnaire${rows.length === 1 ? "" : "s"} from ${people} IP${people === 1 ? "" : "s"} · ${reported} with a report` : "Everyone who tried FinanceAI"}. Click a row to see everything they entered.
          </p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, city, IP…" className="h-9 w-48 rounded-xl pl-8" />
        </div>
        <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </header>

      {!shown ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : shown.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{q ? "No matches." : "Nobody has tried FinanceAI yet."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Who</th>
                <th className="px-3 py-2 font-medium">Income / mo</th>
                <th className="px-3 py-2 font-medium">Left over</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">IP</th>
                <th className="px-5 py-2 font-medium">Access</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} onClick={() => setOpen(r.id)} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/40">
                  <td className="whitespace-nowrap px-5 py-2.5" title={fmtDate(r.created_at)}>{relative(r.created_at)}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{r.name || <span className="text-muted-foreground">Anonymous</span>}</p>
                    <p className="text-xs text-muted-foreground">{[r.age ? `${r.age}` : null, r.city, r.employment_status.replace("_", " ")].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{money(r.monthly_income, r.currency)}</td>
                  <td className={`whitespace-nowrap px-3 py-2.5 tabular-nums ${r.monthly_surplus < 0 ? "text-red-600" : ""}`}>{money(r.monthly_surplus, r.currency)}</td>
                  <td className="px-3 py-2.5">
                    {r.grade ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${GRADE_STYLE[r.grade] ?? ""}`}>{r.score} · {r.grade}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">no report</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs" title={r.user_agent}>{r.ip || "—"}</td>
                  <td className="px-5 py-2.5 text-xs text-muted-foreground">{r.access_mode === "code" ? "code" : r.access_mode === "trial" ? "trial" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DetailDialog id={open} onClose={closeDialog} onDeleted={(id) => {
        setRows((rs) => (rs || []).filter((x) => x.id !== id));
        setOpen(null);
      }} />
    </section>
  );
}
