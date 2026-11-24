/**
 * Access gate for the playground apps (ExamPrep, File Analyser, FinanceAI). Used as a layout route:
 *
 *   <Route path="/finance-advisor" element={<PlaygroundGate app="finance" />}> ...child routes... </Route>
 *
 * Shows the 4-digit code entry (code set in admin panel -> Playground) and, below it, a "try it free" button.
 * The free trial is 30 minutes per IP per day (24 h from the trial's start, enforced by the backend). A saved trial
 * never skips the code entry when the app has a code. While a trial runs, a countdown pill is shown and the app
 * locks itself when the time is up.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { ArrowLeft, Clock, Hourglass, Loader2, Lock, LogOut, Sparkles, type LucideIcon } from "lucide-react";
import PinInput from "@/pages/textbox/PinInput";
import {
  PlaygroundHttpError,
  accessApi,
  readToken,
  storeToken,
  type AppStatus,
  type PlaygroundAppId,
  type SessionMode,
} from "@/lib/playgroundApi";

export interface AppMeta {
  title: string;
  tagline: string;
  icon: LucideIcon;
}

interface PlaygroundSession {
  app: PlaygroundAppId;
  token: string;
  mode: SessionMode;
  expiresAt: string | null;
  /** Call from a catch block: returns true (and shows the gate) when the session has ended. */
  handleAuthError: (err: unknown) => boolean;
  lock: () => void;
}

const Ctx = createContext<PlaygroundSession | null>(null);

export function usePlayground(): PlaygroundSession {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayground must be used inside <PlaygroundGate>");
  return v;
}

/** Error text for a failed call, or "" when the gate took over (session ended). */
export function errorText(session: PlaygroundSession, err: unknown, fallback = "Something went wrong"): string {
  if (session.handleAuthError(err)) return "";
  return err instanceof Error && err.message ? err.message : fallback;
}

// ---------------------------------------------------------------- helpers
function useNow(intervalMs: number, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}

function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function when(iso: string) {
  const d = new Date(iso);
  const ms = d.getTime() - Date.now();
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.max(1, Math.ceil((ms % 3600000) / 60000));
  const rel = hours > 0 ? `in ${hours} h ${minutes} min` : `in ${minutes} min`;
  return `${rel} (${d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })})`;
}

// ---------------------------------------------------------------- gate screen
function GateScreen({
  app,
  meta,
  notice,
  onOpen,
}: {
  app: PlaygroundAppId;
  meta: AppMeta;
  notice: string;
  onOpen: (token: string, mode: SessionMode, expiresAt: string | null) => void;
}) {
  const Icon = meta.icon;
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "code" | "trial">("");

  const loadStatus = useCallback(() => {
    setLoadError("");
    accessApi
      .status(app)
      .then(setStatus)
      .catch((e: PlaygroundHttpError) => setLoadError(e.status === 0 ? "Could not reach the server." : e.message));
  }, [app]);

  useEffect(loadStatus, [loadStatus]);

  const submitCode = async (value: string) => {
    if (!/^\d{4}$/.test(value) || busy) return;
    setBusy("code");
    setError("");
    try {
      const s = await accessApi.unlock(app, value);
      onOpen(s.token, s.mode, s.expires_at);
    } catch (err) {
      const e = err as PlaygroundHttpError;
      setError(e.status === 0 ? "Could not reach the server." : e.status === 401 ? "Incorrect code. Try again." : e.message);
      setCode("");
      setBusy("");
    }
  };

  const startTrial = async () => {
    if (busy) return;
    setBusy("trial");
    setError("");
    try {
      const s = await accessApi.trial(app);
      onOpen(s.token, s.mode, s.expires_at);
    } catch (err) {
      const e = err as PlaygroundHttpError;
      setError(e.status === 0 ? "Could not reach the server." : e.message);
      setBusy("");
      loadStatus();
    }
  };

  const trial = status?.trial;
  const canUseCode = !!status?.code_set;
  const closed = status && !canUseCode && trial?.state === "disabled";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Home
        </Link>
        <section className="rounded-2xl border-2 border-border bg-card p-6 shadow-soft sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-warm shadow-glow">
            <Icon className="text-primary-foreground" size={26} />
          </div>
          <h1 className="text-center font-display text-3xl font-bold">{meta.title}</h1>
          <p className="mx-auto mt-2 max-w-sm text-center text-sm text-muted-foreground">{meta.tagline}</p>

          {notice && (
            <p className="mt-5 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {notice}
            </p>
          )}

          {!status && !loadError && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {loadError && (
            <div className="mt-6 text-center">
              <p className="text-sm text-red-600">{loadError}</p>
              <button onClick={loadStatus} className="mt-2 text-sm font-medium text-primary hover:underline">
                Retry
              </button>
            </div>
          )}

          {closed && <p className="mt-6 text-center text-sm text-muted-foreground">This app isn't open to visitors yet.</p>}

          {status && canUseCode && (
            <form
              className="mt-6"
              onSubmit={(e) => {
                e.preventDefault();
                submitCode(code);
              }}
            >
              <p className="mb-3 flex items-center justify-center gap-1.5 text-sm font-medium">
                <Lock size={14} /> Enter the 4-digit access code
              </p>
              <PinInput
                label="Access code"
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (error) setError("");
                }}
                onComplete={submitCode}
                disabled={!!busy}
                invalid={!!error && busy === ""}
                autoFocus
              />
              <button
                type="submit"
                disabled={code.length !== 4 || !!busy}
                className="mt-5 h-12 w-full rounded-xl bg-gradient-warm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy === "code" ? "Checking…" : "Unlock"}
              </button>
            </form>
          )}

          {status && trial && trial.state !== "disabled" && (
            <div className="mt-6">
              {canUseCode && (
                <div className="mb-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                </div>
              )}
              {trial.state === "cooldown" && trial.next_available_at ? (
                <div className="rounded-xl border border-border bg-muted/50 p-4 text-center">
                  <Hourglass className="mx-auto mb-2 text-muted-foreground" size={20} />
                  <p className="text-sm font-medium">Your free trial has been used</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    You can try {meta.title} free again {when(trial.next_available_at)}.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    onClick={startTrial}
                    disabled={!!busy}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
                  >
                    {busy === "trial" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {trial.state === "active" ? "Resume your free trial" : `Try it free for ${trial.minutes} minutes`}
                  </button>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    {trial.state === "active" && trial.expires_at
                      ? `Your trial ends at ${new Date(trial.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
                      : trial.cooldown_hours === 24
                        ? `No code needed. Free for ${trial.minutes} minutes a day.`
                        : `No code needed. Free for ${trial.minutes} minutes every ${trial.cooldown_hours} hours.`}
                  </p>
                </>
              )}
            </div>
          )}

          {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
        </section>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- trial countdown
function TrialPill({ expiresAt, onExpire, onLock }: { expiresAt: string; onExpire: () => void; onLock: () => void }) {
  const end = new Date(expiresAt).getTime();
  const now = useNow(1000);
  const left = end - now;

  useEffect(() => {
    if (left <= 0) onExpire();
  }, [left, onExpire]);

  const low = left < 5 * 60 * 1000;
  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-soft backdrop-blur print:hidden ${
        low ? "border-red-300 bg-red-50/95 text-red-700 dark:bg-red-950/80 dark:text-red-200" : "border-border bg-card/95 text-foreground"
      }`}
    >
      <Clock size={13} />
      <span>
        Free trial · <span className="tabular-nums">{clock(left)}</span> left
      </span>
      <button onClick={onLock} title="Leave the trial" className="ml-1 opacity-60 hover:opacity-100">
        <LogOut size={13} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- layout route
export default function PlaygroundGate({ app, meta }: { app: PlaygroundAppId; meta: AppMeta }) {
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<SessionMode>("code");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    document.title = meta.title;
  }, [meta.title]);

  useEffect(() => {
    const saved = readToken(app);
    if (!saved) return setBooting(false);
    accessApi
      .session(app, saved)
      .then(async (s) => {
        // A saved free trial must not skip the code: when the app has a code, show the gate again
        // (code first, then "Resume your free trial" below it).
        if (s.mode === "trial") {
          const st = await accessApi.status(app).catch(() => null);
          if (!st || st.code_set) {
            storeToken(app, "");
            return;
          }
        }
        setToken(saved);
        setMode(s.mode);
        setExpiresAt(s.expires_at);
      })
      .catch((e: PlaygroundHttpError) => {
        if (e.status === 401) storeToken(app, "");
        else if (e.status === 0) setNotice("Could not reach the server.");
      })
      .finally(() => setBooting(false));
  }, [app]);

  const lock = useCallback(
    (message = "") => {
      storeToken(app, "");
      setToken("");
      setExpiresAt(null);
      setNotice(message);
    },
    [app]
  );

  const endedMessage = mode === "trial" ? "Your free trial has ended." : "Your session ended. Enter the code again.";

  const handleAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof PlaygroundHttpError && err.status === 401) {
        lock(endedMessage);
        return true;
      }
      return false;
    },
    [lock, endedMessage]
  );

  const session = useMemo<PlaygroundSession>(
    () => ({ app, token, mode, expiresAt, handleAuthError, lock: () => lock("") }),
    [app, token, mode, expiresAt, handleAuthError, lock]
  );

  const onTrialExpired = useCallback(() => lock("Your free trial has ended."), [lock]);

  if (booting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!token) {
    return (
      <GateScreen
        app={app}
        meta={meta}
        notice={notice}
        onOpen={(t, m, exp) => {
          storeToken(app, t);
          setToken(t);
          setMode(m);
          setExpiresAt(exp);
          setNotice("");
        }}
      />
    );
  }

  return (
    <Ctx.Provider value={session}>
      <Outlet />
      {mode === "trial" && expiresAt && <TrialPill expiresAt={expiresAt} onExpire={onTrialExpired} onLock={() => lock("")} />}
    </Ctx.Provider>
  );
}
