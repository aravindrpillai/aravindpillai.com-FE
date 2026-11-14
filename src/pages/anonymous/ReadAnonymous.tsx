import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownUp,
  ArrowLeft,
  Check,
  ChevronDown,
  Clock,
  Monitor,
  ShieldAlert,
  Copy,
  Globe,
  Inbox,
  Lock,
  LogOut,
  MapPin,
  MessageSquareText,
  RefreshCw,
  Search,
  Trash2,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ApiClient from "@/lib/api";

type Message = {
  id: number;
  message: string;
  time?: string;
  location?: string | null;
  cordinates?: string | null;
  ip?: string | null;
  isp?: string | null;
  visitor_id?: string | null;
  user_agent?: string | null;
  client_info?: Record<string, unknown> | null;
  network_info?: Record<string, unknown> | null;
};

function describeDevice(ua?: string | null): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
    ? "Opera"
    : /SamsungBrowser/.test(ua)
    ? "Samsung Internet"
    : /Chrome\//.test(ua)
    ? "Chrome"
    : /Firefox\//.test(ua)
    ? "Firefox"
    : /Safari\//.test(ua)
    ? "Safari"
    : "Browser";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
    ? "iPad"
    : /Android/.test(ua)
    ? "Android"
    : /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(ua)
    ? "macOS"
    : /Linux/.test(ua)
    ? "Linux"
    : "Unknown OS";
  return `${browser} on ${os}`;
}

const SENDER_COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
];

function senderColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SENDER_COLORS[h % SENDER_COLORS.length];
}

function flatten(obj: unknown, prefix = ""): [string, string][] {
  if (obj === null || obj === undefined || obj === "") return [];
  if (typeof obj !== "object") return [[prefix, String(obj)]];
  if (Array.isArray(obj)) return [[prefix, obj.join(", ")]];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k)
  );
}

const TOKEN_KEY = "anon_read_token";

function readStoredToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function storeToken(token: string) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

function relativeTime(iso?: string): string {
  if (!iso) return "Unknown time";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return "just now";
  const units: [number, string][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [604800, "week"],
    [2629800, "month"],
    [31557600, "year"],
  ];
  let label = "";
  for (let i = units.length - 1; i >= 0; i--) {
    const [secs, name] = units[i];
    if (diff >= secs) {
      const n = Math.floor(diff / secs);
      label = `${n} ${name}${n > 1 ? "s" : ""} ago`;
      break;
    }
  }
  return label;
}

function fullTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function dayLabel(iso?: string): string {
  if (!iso) return "Undated";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Undated";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

export default function ReadAnonymous() {
  const navigate = useNavigate();

  const [token, setToken] = useState<string>(readStoredToken);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [data, setData] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [senderFilter, setSenderFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const senderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of data) if (m.visitor_id) counts[m.visitor_id] = (counts[m.visitor_id] || 0) + 1;
    return counts;
  }, [data]);

  useEffect(() => {
    if (token) getMessages(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function getMessages(code: string) {
    const headers = { "Content-Type": "application/json", token: code };
    try {
      setLoading(true);
      const url = ApiClient.buildFullUrl(import.meta.env.VITE_ANONYMOUS);
      const resp = await fetch(url, { method: "GET", headers });
      const respData = await resp.json().catch(() => null);
      if (resp.status < 300) {
        setData(respData?.data || []);
        setLoaded(true);
        setAuthError("");
        storeToken(code);
      } else {
        setAuthError("Incorrect password. Try again.");
        logout();
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      setAuthError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    storeToken("");
    setToken("");
    setData([]);
    setLoaded(false);
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this message permanently?")) return;
    setDeletingId(id);
    try {
      const headers = { "Content-Type": "application/json", token };
      const url = ApiClient.buildFullUrl(
        import.meta.env.VITE_ANONYMOUS + "?id=" + id
      );
      const resp = await fetch(url, { method: "DELETE", headers });
      if (resp.status < 300) {
        setData((prev) => prev.filter((item) => item.id !== id));
      } else {
        window.alert("Failed to delete the message.");
      }
    } catch (e) {
      console.error(e);
      window.alert("Failed to delete the message.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCopy(item: Message) {
    try {
      await navigator.clipboard.writeText(item.message);
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = data.filter(
      (m) =>
        (!senderFilter || m.visitor_id === senderFilter) &&
        (!q ||
          [m.message, m.location, m.isp, m.ip, m.visitor_id, m.user_agent]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)))
    );
    filtered.sort((a, b) => {
      const ta = a.time ? new Date(a.time).getTime() : 0;
      const tb = b.time ? new Date(b.time).getTime() : 0;
      return newestFirst ? tb - ta : ta - tb;
    });
    const groups: { label: string; items: Message[] }[] = [];
    for (const m of filtered) {
      const label = dayLabel(m.time);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(m);
      else groups.push({ label, items: [m] });
    }
    return { groups, count: filtered.length };
  }, [data, query, newestFirst, senderFilter]);

  const background = (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl"
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 10, repeat: Infinity }}
      />
    </div>
  );

  /* ---------- Password gate ---------- */
  if (!token || (!loaded && !loading && authError)) {
    return (
      <main className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center px-4">
        {background}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          onSubmit={(e) => {
            e.preventDefault();
            const p = passwordInput.trim();
            if (!p) return;
            setPasswordInput("");
            setToken(p);
          }}
          className="relative z-10 w-full max-w-sm bg-card border-2 border-border rounded-2xl p-6 sm:p-8 shadow-soft"
        >
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-warm flex items-center justify-center shadow-glow">
            <Lock className="text-primary-foreground" size={24} />
          </div>
          <h1 className="text-2xl font-display font-bold text-center mb-1">
            Private <span className="text-gradient">Inbox</span>
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Enter the password to read anonymous messages.
          </p>
          <Input
            type="password"
            autoFocus
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Password"
            className="h-12 rounded-xl border-2"
          />
          {authError && (
            <p className="mt-3 text-sm text-red-600 text-center">{authError}</p>
          )}
          <Button
            type="submit"
            disabled={!passwordInput.trim()}
            className="w-full h-12 mt-4 rounded-xl bg-gradient-warm text-primary-foreground hover:opacity-90"
          >
            Unlock
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/")}
            className="w-full mt-2 rounded-xl"
          >
            <ArrowLeft size={16} className="mr-2" /> Back to home
          </Button>
        </motion.form>
      </main>
    );
  }

  /* ---------- Inbox ---------- */
  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {background}

      <div className="relative z-10 px-4 sm:px-6 py-8 sm:py-12 max-w-3xl mx-auto">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-display font-bold">
                Anonymous <span className="text-gradient">Inbox</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                {loading && !loaded
                  ? "Loading messages…"
                  : `${data.length} message${data.length === 1 ? "" : "s"} received`}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl"
                title="Refresh"
                onClick={() => getMessages(token)}
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl"
                title="Lock"
                onClick={logout}
              >
                <LogOut size={16} />
              </Button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search message, location, ISP…"
                className="pl-9 h-11 rounded-xl border-2 bg-card"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setNewestFirst((v) => !v)}
              className="h-11 rounded-xl border-2"
            >
              <ArrowDownUp size={16} className="mr-2" />
              {newestFirst ? "Newest first" : "Oldest first"}
            </Button>
          </div>

          {senderFilter && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Showing messages from</span>
              <span className={`px-2.5 py-1 rounded-full font-mono text-xs ${senderColor(senderFilter)}`}>
                Sender {senderFilter.slice(0, 6).toUpperCase()}
              </span>
              <button
                onClick={() => setSenderFilter(null)}
                className="text-primary hover:underline"
              >
                Show all
              </button>
            </div>
          )}
        </motion.header>

        {/* Loading skeleton */}
        {loading && !loaded && (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-36 rounded-2xl bg-card border-2 border-border animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty states */}
        {loaded && grouped.count === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-card border-2 border-dashed border-border rounded-2xl"
          >
            <Inbox className="mx-auto mb-3 text-muted-foreground" size={40} />
            <p className="font-medium">
              {query ? "No messages match your search" : "No messages yet"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {query
                ? "Try a different keyword."
                : "New anonymous messages will show up here."}
            </p>
          </motion.div>
        )}

        {/* Message list */}
        <div className="space-y-8">
          {grouped.groups.map((group) => (
            <section key={group.label}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                {group.label}
                <span className="h-px flex-1 bg-border" />
                <span className="font-normal normal-case tracking-normal">
                  {group.items.length}
                </span>
              </h2>

              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {group.items.map((item) => (
                    <motion.article
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -40, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.25 }}
                      className="group relative bg-card border-2 border-border rounded-2xl p-5 sm:p-6 shadow-soft hover:border-primary/40 hover:shadow-lg transition-all"
                    >
                      {/* Top row */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-warm flex items-center justify-center shrink-0">
                            <MessageSquareText
                              size={15}
                              className="text-primary-foreground"
                            />
                          </div>
                          <span
                            className="flex items-center gap-1 truncate"
                            title={fullTime(item.time)}
                          >
                            <Clock size={13} />
                            {relativeTime(item.time)}
                          </span>
                          <span className="hidden sm:inline text-xs opacity-70">
                            · {fullTime(item.time)}
                          </span>
                          {item.visitor_id && (
                            <button
                              onClick={() => setSenderFilter(item.visitor_id!)}
                              title={`Browser id ${item.visitor_id} — click to see all messages from this sender`}
                              className={`ml-1 px-2 py-0.5 rounded-full font-mono text-xs shrink-0 hover:opacity-80 ${senderColor(item.visitor_id)}`}
                            >
                              {item.visitor_id.slice(0, 6).toUpperCase()}
                              {senderCounts[item.visitor_id] > 1 && ` · ${senderCounts[item.visitor_id]} msgs`}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleCopy(item)}
                            title="Copy message"
                            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            {copiedId === item.id ? (
                              <Check size={16} className="text-green-600" />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingId === item.id}
                            title="Delete message"
                            className="p-2 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            {deletingId === item.id ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Message */}
                      <p className="text-base sm:text-lg leading-relaxed whitespace-pre-wrap break-words">
                        {item.message}
                      </p>

                      {/* Meta chips */}
                      {(item.location || item.cordinates || item.isp || item.ip) && (
                        <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2 text-xs">
                          {(item.location || item.cordinates) &&
                            (item.cordinates ? (
                              <a
                                href={`https://www.google.com/maps?q=${encodeURIComponent(item.cordinates)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={item.cordinates}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                              >
                                <MapPin size={12} />
                                {item.location || item.cordinates}
                              </a>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted">
                                <MapPin size={12} />
                                {item.location}
                              </span>
                            ))}
                          {item.isp && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted">
                              <Wifi size={12} />
                              {item.isp}
                            </span>
                          )}
                          {item.ip && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted font-mono">
                              <Globe size={12} />
                              {item.ip}
                            </span>
                          )}
                          {describeDevice(item.user_agent) && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted">
                              <Monitor size={12} />
                              {describeDevice(item.user_agent)}
                            </span>
                          )}
                          {item.network_info?.proxy_or_vpn === true && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700">
                              <ShieldAlert size={12} />
                              VPN / proxy
                            </span>
                          )}
                          {(item.client_info || item.network_info) && (
                            <button
                              onClick={() =>
                                setExpandedId((v) => (v === item.id ? null : item.id))
                              }
                              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-primary hover:bg-primary/10"
                            >
                              Details
                              <ChevronDown
                                size={12}
                                className={`transition-transform ${expandedId === item.id ? "rotate-180" : ""}`}
                              />
                            </button>
                          )}
                        </div>
                      )}

                      <AnimatePresence initial={false}>
                        {expandedId === item.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 grid sm:grid-cols-2 gap-4 text-xs">
                              {[
                                { title: "Browser & device", rows: flatten(item.client_info) },
                                { title: "Network", rows: flatten(item.network_info) },
                              ].map((section) => (
                                <div key={section.title} className="rounded-xl bg-muted/60 p-3">
                                  <p className="font-semibold mb-2">{section.title}</p>
                                  {section.rows.length === 0 ? (
                                    <p className="text-muted-foreground">Not recorded</p>
                                  ) : (
                                    <dl className="space-y-1">
                                      {section.rows.map(([k, v]) => (
                                        <div key={k} className="flex gap-2">
                                          <dt className="text-muted-foreground shrink-0 w-32 truncate" title={k}>
                                            {k}
                                          </dt>
                                          <dd className="font-mono break-all">{v}</dd>
                                        </div>
                                      ))}
                                    </dl>
                                  )}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.article>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
