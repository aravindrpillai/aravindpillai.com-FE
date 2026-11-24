import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp, Check, ChevronDown, Copy, Globe, Loader2, MapPin, Monitor, RefreshCw, Search, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fmtDate, panelApi, relative, type AnonymousMessage } from "@/lib/panelApi";
import { usePanel } from "./context";

function describeDevice(ua?: string | null): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /SamsungBrowser/.test(ua)
    ? "Samsung Internet" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return `${browser} on ${os}`;
}

const SENDER_COLORS = [
  "bg-rose-100 text-rose-700", "bg-amber-100 text-amber-800", "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700", "bg-fuchsia-100 text-fuchsia-700",
  "bg-teal-100 text-teal-700", "bg-orange-100 text-orange-700",
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
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}

function Details({ m }: { m: AnonymousMessage }) {
  const rows: [string, string][] = [
    ["Time", fmtDate(m.time)],
    ["Location", m.location || ""],
    ["Coordinates", m.cordinates || ""],
    ["IP", m.ip || ""],
    ["ISP", m.isp || ""],
    ["Visitor id", m.visitor_id || ""],
    ["User agent", m.user_agent || ""],
    ...flatten(m.client_info, "client"),
    ...flatten(m.network_info, "network"),
  ].filter(([, v]) => v) as [string, string][];
  return (
    <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 rounded-xl bg-muted/50 p-3 text-xs sm:grid-cols-[180px_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-medium text-muted-foreground break-all">{k}</dt>
          <dd className="break-all font-mono">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AnonymousTab() {
  const { token, fail } = usePanel();
  const [rows, setRows] = useState<AnonymousMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [sender, setSender] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<number[] | null>(null); // ids awaiting delete confirmation
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await panelApi.anonymous(token));
    } catch (e) {
      fail(e, "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [token, fail]);

  useEffect(() => {
    load();
  }, [load]);

  const senderCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of rows) if (m.visitor_id) c[m.visitor_id] = (c[m.visitor_id] || 0) + 1;
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter(
      (m) =>
        (!sender || m.visitor_id === sender) &&
        (!q ||
          m.message.toLowerCase().includes(q) ||
          (m.location || "").toLowerCase().includes(q) ||
          (m.ip || "").includes(q) ||
          (m.isp || "").toLowerCase().includes(q))
    );
    return list.sort((a, b) => {
      const d = new Date(a.time).getTime() - new Date(b.time).getTime();
      return newestFirst ? -d : d;
    });
  }, [rows, query, sender, newestFirst]);

  const allShownSelected = shown.length > 0 && shown.every((m) => selected.has(m.id));
  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    try {
      if (pending.length === 1) await panelApi.deleteAnonymous(token, pending[0]);
      else await panelApi.deleteAnonymousMany(token, pending);
      const gone = new Set(pending);
      setRows((r) => r.filter((m) => !gone.has(m.id)));
      setSelected((s) => new Set([...s].filter((id) => !gone.has(id))));
      toast.success(pending.length === 1 ? "Message deleted" : `${pending.length} messages deleted`);
      setPending(null);
    } catch (e) {
      fail(e, "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function copy(m: AnonymousMessage) {
    try {
      await navigator.clipboard.writeText(m.message);
      setCopied(m.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages, location, IP, ISP…"
            className="pl-9 h-11 rounded-xl border-2 bg-card"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 rounded-xl gap-2" onClick={() => setNewestFirst((v) => !v)}>
            <ArrowDownUp size={16} /> {newestFirst ? "Newest first" : "Oldest first"}
          </Button>
          <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl" title="Refresh" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
          {selected.size > 0 && (
            <Button
              className="h-11 rounded-xl gap-2 bg-red-600 text-white hover:bg-red-700"
              onClick={() => setPending([...selected])}
            >
              <Trash2 size={16} /> Delete {selected.size}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-muted-foreground">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox
            checked={allShownSelected}
            onCheckedChange={(v) =>
              setSelected((s) => {
                const n = new Set(s);
                for (const m of shown) {
                  if (v) n.add(m.id);
                  else n.delete(m.id);
                }
                return n;
              })
            }
          />
          Select all shown
        </label>
        <span>·</span>
        <span>
          {shown.length} of {rows.length} messages · {Object.keys(senderCounts).length} senders
        </span>
        {sender && (
          <button
            onClick={() => setSender(null)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${senderColor(sender)}`}
          >
            Sender {sender.slice(0, 8)} <X size={12} />
          </button>
        )}
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : shown.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">No messages found.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((m) => {
            const device = describeDevice(m.user_agent);
            const open = expanded === m.id;
            return (
              <li
                key={m.id}
                className={`rounded-2xl border-2 bg-card p-4 transition-colors ${
                  selected.has(m.id) ? "border-primary/60" : "border-border"
                }`}
              >
                <div className="flex gap-3">
                  <Checkbox className="mt-1" checked={selected.has(m.id)} onCheckedChange={() => toggle(m.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.message}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span title={fmtDate(m.time)}>{relative(m.time)}</span>
                      {m.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} /> {m.location}
                        </span>
                      )}
                      {m.ip && (
                        <span className="inline-flex items-center gap-1">
                          <Globe size={12} /> {m.ip}
                          {m.isp ? ` · ${m.isp}` : ""}
                        </span>
                      )}
                      {device && (
                        <span className="inline-flex items-center gap-1">
                          <Monitor size={12} /> {device}
                        </span>
                      )}
                      {m.visitor_id && (
                        <button
                          onClick={() => setSender(sender === m.visitor_id ? null : m.visitor_id)}
                          className={`rounded-full px-2 py-0.5 font-medium ${senderColor(m.visitor_id)}`}
                          title="Show only this sender"
                        >
                          {m.visitor_id.slice(0, 8)} · {senderCounts[m.visitor_id]}
                        </button>
                      )}
                    </div>
                    {open && <Details m={m} />}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                    <Button variant="ghost" size="icon" className="rounded-xl" title="Copy" onClick={() => copy(m)}>
                      {copied === m.id ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl"
                      title={open ? "Hide details" : "Details"}
                      onClick={() => setExpanded(open ? null : m.id)}
                    >
                      <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-50"
                      title="Delete"
                      onClick={() => setPending([m.id])}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && !deleting && setPending(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.length === 1 ? "Delete this message?" : `Delete ${pending?.length} messages?`}
            </AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deleting && <Loader2 size={16} className="mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
