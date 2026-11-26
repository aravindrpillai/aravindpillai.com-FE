/** Small, consistent building blocks for the /stocks screens (cards, KPIs, pills, segmented controls, meters). */
import type { ReactNode } from "react";
import type { MethodView, Verdict } from "@/lib/stocksApi";
import { METHOD_META, VERDICT_LABEL, scoreClass, scoreFill, verdictClass } from "./format";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ className, children, as: Tag = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" }) {
  return <Tag className={cx("rounded-xl border border-border bg-card shadow-soft", className)}>{children}</Tag>;
}

export function CardHead({ title, subtitle, actions, className }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 sm:px-5", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Kpi({ label, value, sub, valueCls, hint }: {
  label: string; value: ReactNode; sub?: ReactNode; valueCls?: string; hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card px-3 py-2.5" title={hint}>
      <div className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cx("mt-0.5 truncate text-lg font-semibold tabular-nums leading-tight sm:text-xl", valueCls)}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

type Tone = "neutral" | "good" | "bad" | "warn" | "info" | "solid";
const TONE: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  good: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/20",
  bad: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-400/20",
  warn: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-400/20",
  info: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-400/20",
  solid: "bg-foreground text-background",
};

export function Pill({ tone = "neutral", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium", TONE[tone], className)}>{children}</span>;
}

export function VerdictPill({ verdict, suffix, className }: { verdict?: Verdict | ""; suffix?: ReactNode; className?: string }) {
  if (!verdict) return <Pill className={className}>—</Pill>;
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold", verdictClass(verdict), className)}>{VERDICT_LABEL[verdict]}{suffix}</span>;
}

export function Segmented<T extends string>({ value, options, onChange, size = "md", className, ariaLabel }: {
  value: T; options: { id: NoInfer<T>; label: ReactNode; count?: number }[]; onChange: (v: NoInfer<T>) => void;
  size?: "sm" | "md"; className?: string; ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cx("stocks-scroll inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-0.5", className)}>
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
          className={cx("flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-medium transition",
            size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
            value === o.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
          {o.count !== undefined && <span className="rounded bg-muted px-1 text-[10px] tabular-nums text-muted-foreground">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** 0-100 horizontal meter. */
export function Meter({ value, className, marker }: { value: number | null | undefined; className?: string; marker?: number }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className={cx("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} aria-hidden>
      <div className={cx("h-full rounded-full", scoreFill(value))} style={{ width: `${v}%` }} />
      {marker !== undefined && <span className="absolute top-0 h-full w-px bg-foreground/60" style={{ left: `${marker}%` }} />}
    </div>
  );
}

/** Circular score badge. */
export function ScoreRing({ value, size = 44, label }: { value: number | null | undefined; size?: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  const stroke = value == null ? "hsl(var(--muted-foreground))" : v >= 65 ? "#10b981" : v >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <span className={cx("absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums", scoreClass(value))}>
        {value == null ? "—" : Math.round(v)}
      </span>
    </div>
  );
}

/** One method's vote: coloured dot, name, verdict, score. */
export function MethodVote({ id, view, compact }: { id: keyof typeof METHOD_META; view?: MethodView; compact?: boolean }) {
  const meta = METHOD_META[id];
  if (!view?.available) {
    return (
      <span className={cx(compact ? "inline-flex" : "flex", "items-center gap-1.5 text-[11px] text-muted-foreground")} title={view?.reason}>
        <span className={cx("h-1.5 w-1.5 rounded-full opacity-40", meta.dot)} /> {compact ? meta.short : meta.label} · off
      </span>
    );
  }
  return (
    <span className={cx(compact ? "inline-flex" : "flex", "items-center gap-1.5 text-[11px]")} title={view.detail}>
      <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
      <span className={cx("text-muted-foreground", !compact && "w-24 shrink-0")}>{compact ? meta.short : meta.label}</span>
      <VerdictPill verdict={view.verdict} />
      {!compact && <span className="ml-auto tabular-nums text-muted-foreground">{Math.round(view.probability ?? 0)}% win</span>}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
      {icon && <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <div className="mx-auto mt-1.5 max-w-xl text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium tabular-nums">{children}</dd>
    </div>
  );
}
