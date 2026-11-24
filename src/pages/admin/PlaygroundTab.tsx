/**
 * Admin panel -> Playground: ExamPrep, File Analyser and FinanceAI.
 * Each app has its own 4-digit access code and a free-trial switch. Without the code, a visitor's IP may try an
 * app for 30 minutes once a day (24 h from the trial start) (backend env: PLAYGROUND_TRIAL_MINUTES / _COOLDOWN_HOURS).
 * Resetting a trial lets that IP try again straight away.
 */
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Dices, ExternalLink, Eye, EyeOff, Loader2, Lock, RefreshCw, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fmtDate, panelRequest, relative } from "@/lib/panelApi";
import { usePanel } from "./context";
import FinanceSubmissionsCard from "./FinanceSubmissionsCard";

interface PlaygroundApp {
  app: "examprep" | "file-analyser" | "finance";
  label: string;
  code: string | null;
  trial_enabled: boolean;
  updated_at: string | null;
  trials_active: number;
  trials_last_7_days: number;
}

interface PlaygroundTrial {
  id: number;
  app: string;
  label: string;
  ip: string;
  user_agent: string;
  started_at: string;
  expires_at: string;
  next_available_at: string;
  status: "active" | "cooldown" | "done";
}

interface Overview {
  rules: { trial_minutes: number; cooldown_hours: number };
  apps: PlaygroundApp[];
}

const PATHS: Record<PlaygroundApp["app"], string> = {
  examprep: "/examprep",
  "file-analyser": "/file-analyser",
  finance: "/finance-advisor",
};

const api = {
  overview: (t: string) => panelRequest<Overview>("GET", "playground/", t),
  update: (t: string, app: string, body: { code?: string; clear_code?: boolean; trial_enabled?: boolean }) =>
    panelRequest<PlaygroundApp>("PUT", `playground/apps/${app}/`, t, body),
  trials: (t: string) => panelRequest<PlaygroundTrial[]>("GET", "playground/trials/", t),
  resetTrial: (t: string, id: number) => panelRequest<null>("DELETE", `playground/trials/${id}/`, t),
};

function AppCard({ app, onSaved }: { app: PlaygroundApp; onSaved: (a: PlaygroundApp) => void }) {
  const { token, fail } = usePanel();
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const valid = /^\d{4}$/.test(draft);

  const save = async (body: Parameters<typeof api.update>[2], message: string) => {
    setSaving(true);
    try {
      onSaved(await api.update(token, app.app, body));
      toast.success(message);
      return true;
    } catch (e) {
      fail(e, "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border-2 border-border bg-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-bold">{app.label}</h2>
            {app.code ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 size={12} /> Code set
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                No code — {app.trial_enabled ? "free trial only" : "closed"}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {app.trials_active} trial{app.trials_active === 1 ? "" : "s"} running · {app.trials_last_7_days} in the last 7 days
          </p>
        </div>
        <a
          href={PATHS[app.app]}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          {PATHS[app.app]} <ExternalLink size={13} />
        </a>
        <label className="flex items-center gap-2 text-sm">
          Free trial
          <Switch
            checked={app.trial_enabled}
            disabled={saving}
            onCheckedChange={(v) =>
              save({ trial_enabled: v }, v ? `Free trials of ${app.label} are on` : `Free trials of ${app.label} are off (running trials end now)`)
            }
          />
        </label>
      </header>

      <div className="flex flex-wrap items-end gap-6 p-5">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Lock size={14} /> Current code
          </Label>
          {app.code ? (
            <div className="flex items-center gap-2">
              <code className="font-mono text-2xl tracking-[0.4em]">{show ? app.code : "••••"}</code>
              <Button variant="ghost" size="sm" onClick={() => setShow((v) => !v)} title={show ? "Hide" : "Show"}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">None</span>
          )}
          {app.code && app.updated_at && <p className="text-xs text-muted-foreground">Changed {fmtDate(app.updated_at)}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`pg-code-${app.app}`}>{app.code ? "New code" : "Set a code"}</Label>
          <div className="flex gap-2">
            <Input
              id={`pg-code-${app.app}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && valid) save({ code: draft }, "Code saved").then((ok) => ok && setDraft(""));
              }}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0000"
              className="h-10 w-28 rounded-xl text-center font-mono text-lg tracking-[0.3em]"
            />
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              title="Random code"
              onClick={() => setDraft(String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, "0"))}
            >
              <Dices size={16} />
            </Button>
            <Button
              onClick={() => save({ code: draft }, `Code saved. Open ${app.label} code sessions were signed out.`).then((ok) => ok && setDraft(""))}
              disabled={!valid || saving}
              className="h-10 gap-2 rounded-xl"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save code
            </Button>
            {app.code && (
              <Button
                variant="ghost"
                className="h-10 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={saving}
                onClick={() => {
                  if (window.confirm(`Remove the ${app.label} code? Only free trials will work until a new code is set.`)) {
                    save({ clear_code: true }, "Code removed");
                  }
                }}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const STATUS_STYLE: Record<PlaygroundTrial["status"], string> = {
  active: "bg-emerald-100 text-emerald-700",
  cooldown: "bg-amber-100 text-amber-800",
  done: "bg-muted text-muted-foreground",
};

function TrialsTable() {
  const { token, fail } = usePanel();
  const [rows, setRows] = useState<PlaygroundTrial[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.trials(token));
    } catch (e) {
      fail(e, "Failed to load trials");
    } finally {
      setLoading(false);
    }
  }, [token, fail]);

  useEffect(() => {
    load();
  }, [load]);

  const reset = async (t: PlaygroundTrial) => {
    const what = t.status === "active" ? "This ends the running trial, and the" : "The";
    if (!window.confirm(`${what} IP ${t.ip} can start a new ${t.label} trial straight away. Reset?`)) return;
    try {
      await api.resetTrial(token, t.id);
      setRows((r) => (r || []).filter((x) => x.id !== t.id));
      toast.success("Trial reset");
    } catch (e) {
      fail(e, "Reset failed");
    }
  };

  return (
    <section className="rounded-2xl border-2 border-border bg-card">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex-1">
          <h2 className="font-display text-xl font-bold">Free trials</h2>
          <p className="mt-1 text-xs text-muted-foreground">Latest 300, newest first. Reset lets that IP try the app again now.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </header>
      {!rows ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No trials yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-2 font-medium">App</th>
                <th className="px-3 py-2 font-medium">IP</th>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Can try again</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-2.5 font-medium">{t.label}</td>
                  <td className="px-3 py-2.5 font-mono text-xs" title={t.user_agent}>
                    {t.ip}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{fmtDate(t.started_at)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[t.status]}`}>
                      {t.status === "active" ? `active · ends ${relative(t.expires_at)}` : t.status === "cooldown" ? "waiting" : "done"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                    {t.status === "done" ? "now" : fmtDate(t.next_available_at)}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {t.status !== "done" ? (
                      <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg" onClick={() => reset(t)}>
                        <RotateCcw size={14} /> Reset
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="rounded-lg text-muted-foreground" title="Delete record" onClick={() => reset(t)}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function PlaygroundTab() {
  const { token, fail } = usePanel();
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    api.overview(token).then(setData).catch((e) => fail(e, "Failed to load playground settings"));
  }, [token, fail]);

  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const onSaved = (a: PlaygroundApp) => setData((d) => d && { ...d, apps: d.apps.map((x) => (x.app === a.app ? a : x)) });

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Each app has its own 4-digit code. Visitors without the code can use an app free for{" "}
        <strong className="text-foreground">{data.rules.trial_minutes} minutes</strong> per IP, once every{" "}
        <strong className="text-foreground">{data.rules.cooldown_hours} hours</strong> (counted from when the trial started). When
        an app has a code, visitors are always asked for it first, with the free trial offered below. The apps use the
        provider, key and model from the AI tab.
      </p>
      {data.apps.map((a) => (
        <AppCard key={a.app} app={a} onSaved={onSaved} />
      ))}
      <FinanceSubmissionsCard />
      <TrialsTable />
    </div>
  );
}
