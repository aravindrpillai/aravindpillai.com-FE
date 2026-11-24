/**
 * /admin — one place to manage the whole site.
 *
 *   Overview · Anonymous · QuickChat · Notepad · Stocks · AI
 *
 * Protected by ADMIN_PANEL_PW (backend env file). QuickChat additionally asks for its own
 * admin password (QCHAT_ADMIN_PW) because chat management keeps its own endpoints.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Bot, Home, LayoutDashboard, Loader2, Lock, LogOut, MessageSquare, NotebookPen, SettingsIcon, ShieldCheck,
  Sparkles, TrendingUp, UserRound,
  ShieldBan,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelHttpError, panelApi, readPanelToken, storePanelToken } from "@/lib/panelApi";
import { PanelContext } from "./context";
import OverviewTab from "./OverviewTab";
import AnonymousTab from "./AnonymousTab";
import QChatTab from "./QChatTab";
import NotepadTab from "./NotepadTab";
import StocksUsersTab from "./StocksUsersTab";
import AISettingsTab from "./AISettingsTab";
import PlaygroundTab from "./PlaygroundTab";
import BlockedIPsTab from "./BlockedIPsTab";

// ---------------------------------------------------------------- tabs
const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, blurb: "Everything at a glance" },
  { id: "anonymous", label: "Anonymous", icon: UserRound, blurb: "Messages people sent you" },
  { id: "qchat", label: "Maintenance", icon: SettingsIcon, blurb: "Server Settings" },
  { id: "notepad", label: "Notepad", icon: NotebookPen, blurb: "All textboxes" },
  { id: "stocks", label: "Stocks", icon: TrendingUp, blurb: "Who can use /stocks, and until when" },
  { id: "ai", label: "AI", icon: Bot, blurb: "API keys and models for every app" },
  { id: "blocked", label: "Blocked IPs", icon: ShieldBan, blurb: "Who got blocked for wrong passwords, and everything known about them" },
  { id: "playground", label: "Playground", icon: Sparkles, blurb: "ExamPrep, File Analyser, FinanceAI: access codes and free trials" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// ---------------------------------------------------------------- login
function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true);
    setError("");
    try {
      const { token } = await panelApi.login(pw);
      setPw("");
      onLogin(token);
    } catch (err) {
      setError(err instanceof PanelHttpError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-card border-2 border-border rounded-2xl p-6 sm:p-8 shadow-soft">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-warm flex items-center justify-center shadow-glow">
          <ShieldCheck className="text-primary-foreground" size={26} />
        </div>
        <h1 className="text-2xl font-display font-bold text-center mb-1">Admin</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">Enter the admin password to continue.</p>
        <Input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          className="h-12 rounded-xl border-2"
        />
        {error && <p className="mt-3 text-sm text-red-600 text-center">{error}</p>}
        <Button
          type="submit"
          disabled={!pw || busy}
          className="w-full h-12 mt-4 rounded-xl bg-gradient-warm text-primary-foreground hover:opacity-90"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unlock"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => navigate("/")} className="w-full mt-2 rounded-xl">
          <ArrowLeft size={16} className="mr-2" /> Back to home
        </Button>
      </form>
    </main>
  );
}

// ---------------------------------------------------------------- page
export default function AdminPage() {
  const { tab } = useParams<{ tab?: string }>();
  const [token, setToken] = useState("");
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    document.title = "Admin";
    const saved = readPanelToken();
    if (!saved) return setBooting(false);
    panelApi
      .session(saved)
      .then(() => setToken(saved))
      .catch(() => storePanelToken(""))
      .finally(() => setBooting(false));
  }, []);

  const logout = useCallback(() => {
    storePanelToken("");
    setToken("");
  }, []);

  const fail = useCallback(
    (err: unknown, fallback = "Something went wrong") => {
      if (err instanceof PanelHttpError && err.status === 401) {
        toast.error("Admin session expired. Sign in again.");
        logout();
        return;
      }
      toast.error(err instanceof Error ? err.message : fallback);
    },
    [logout]
  );

  const session = useMemo(() => ({ token, logout, fail }), [token, logout, fail]);

  if (tab && !TABS.some((t) => t.id === tab)) return <Navigate to="/admin" replace />;
  if (booting) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (!token) {
    return (
      <LoginScreen
        onLogin={(t) => {
          storePanelToken(t);
          setToken(t);
        }}
      />
    );
  }

  const active = (tab as TabId) || "overview";
  const meta = TABS.find((t) => t.id === active)!;

  return (
    <PanelContext.Provider value={session}>
      <div className="min-h-screen bg-background md:flex">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex md:w-64 shrink-0 flex-col border-r border-border bg-card/60 md:sticky md:top-0 md:h-screen">
          <div className="flex items-center gap-3 px-5 py-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-warm flex items-center justify-center shadow-glow">
              <ShieldCheck className="text-primary-foreground" size={20} />
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-tight">Admin</div>
              <div className="text-xs text-muted-foreground">aravindpillai.com</div>
            </div>
          </div>
          <nav className="flex-1 px-3 space-y-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const on = t.id === active;
              return (
                <Link
                  key={t.id}
                  to={t.id === "overview" ? "/admin" : `/admin/${t.id}`}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    on ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  {t.label}
                  {t.id === "qchat" && <Lock size={12} className="ml-auto opacity-60" />}
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-border space-y-1">
            <Link
              to="/"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Home size={18} /> Back to site
            </Link>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={18} /> Sign out
            </button>
          </div>
        </aside>

        {/* Top bar (mobile) */}
        <div className="md:hidden sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2 px-4 pt-3">
            <ShieldCheck size={18} className="text-primary" />
            <span className="font-display font-bold flex-1">Admin</span>
            <Button variant="ghost" size="icon" onClick={logout} title="Sign out">
              <LogOut size={16} />
            </Button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 pt-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const on = t.id === active;
              return (
                <Link
                  key={t.id}
                  to={t.id === "overview" ? "/admin" : `/admin/${t.id}`}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${
                    on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon size={14} /> {t.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <main className="flex-1 min-w-0">
          <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-10 max-w-7xl mx-auto">
            <header className="mb-6 sm:mb-8">
              <h1 className="text-3xl sm:text-4xl font-display font-bold">{meta.label}</h1>
              <p className="text-sm text-muted-foreground mt-1">{meta.blurb}</p>
            </header>
            {active === "overview" && <OverviewTab />}
            {active === "anonymous" && <AnonymousTab />}
            {active === "qchat" && <QChatTab />}
            {active === "notepad" && <NotepadTab />}
            {active === "stocks" && <StocksUsersTab />}
            {active === "ai" && <AISettingsTab />}
            {active === "playground" && <PlaygroundTab />}
            {active === "blocked" && <BlockedIPsTab />}
          </div>
        </main>
      </div>
    </PanelContext.Provider>
  );
}
