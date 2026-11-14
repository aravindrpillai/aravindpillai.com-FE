import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, KeyRound, Loader2, Lock, LockOpen, LogOut, RefreshCw, Search, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { adminDelete, adminGet, adminPost } from "@/lib/adminAuth";
import AdminGate from "./AdminGate";

type Row = {
  id: number;
  code: string | null;
  box_hash: string;
  locked: boolean;
  blocked: boolean;
  version: number;
  size: number;
  empty: boolean;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function TextboxTable({ token, logout }: { token: string; logout: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "locked" | "open" | "blocked">("all");

  async function load() {
    setLoading(true);
    const { status, data } = await adminGet<Row[]>(import.meta.env.VITE_TEXTBOX_LIST, token);
    setLoading(false);
    if (status === 401 || status === 403) return logout();
    if (status >= 200 && status < 300) {
      setRows(data || []);
      setError("");
    } else {
      setError(status === 0 ? "Could not reach the server." : "Failed to load textboxes.");
    }
  }

  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const base = import.meta.env.VITE_TEXTBOX_LIST.replace(/\/?$/, "/");
    const { status } = await adminDelete(`${base}${pendingDelete.id}/`, token);
    setDeleting(false);
    if (status === 401 || status === 403) return logout();
    if ((status >= 200 && status < 300) || status === 404) {
      const id = pendingDelete.id;
      setRows((rs) => rs.filter((r) => r.id !== id));
      setPendingDelete(null);
      setError("");
    } else {
      setPendingDelete(null);
      setError(status === 0 ? "Could not reach the server." : "Failed to delete textbox.");
    }
  }

  const [pendingRemovePin, setPendingRemovePin] = useState<Row | null>(null);
  const [removingPin, setRemovingPin] = useState(false);

  async function confirmRemovePin() {
    if (!pendingRemovePin) return;
    setRemovingPin(true);
    const base = import.meta.env.VITE_TEXTBOX_LIST.replace(/\/?$/, "/");
    const { status } = await adminPost(`${base}${pendingRemovePin.id}/remove-pin/`, token);
    setRemovingPin(false);
    if (status === 401 || status === 403) return logout();
    if (status >= 200 && status < 300) {
      const id = pendingRemovePin.id;
      setRows((rs) =>
        rs.map((x) =>
          x.id === id
            ? { ...x, locked: false, blocked: false, failed_attempts: 0, locked_until: null, empty: true, size: 0 }
            : x
        )
      );
      setPendingRemovePin(null);
      setError("");
    } else {
      setPendingRemovePin(null);
      setError(status === 0 ? "Could not reach the server." : "Failed to remove PIN.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "all" || (filter === "blocked" ? r.blocked : (filter === "locked") === r.locked)) &&
        (!q || (r.code || "").includes(q) || r.box_hash.includes(q) || String(r.id) === q)
    );
  }, [rows, query, filter]);

  const lockedCount = rows.filter((r) => r.locked).length;
  const blockedCount = rows.filter((r) => r.blocked).length;

  return (
    <main className="min-h-screen bg-background">
      <div className="px-4 sm:px-6 py-8 sm:py-12 max-w-7xl mx-auto">
        <header className="flex items-start justify-between gap-4 mb-6">
          <div>
            <Link
              to="/links"
              className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-2 hover:underline"
            >
              <ArrowLeft size={14} /> Links
            </Link>
            <h1 className="text-3xl sm:text-4xl font-display font-bold">
              All <span className="text-gradient">Textboxes</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {rows.length} total · {lockedCount} PIN-locked · {blockedCount} blocked. Names of older textboxes appear once someone opens
              them again.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="icon" className="rounded-xl" title="Refresh" onClick={load} disabled={loading}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </Button>
            <Button variant="outline" size="icon" className="rounded-xl" title="Lock" onClick={logout}>
              <LogOut size={16} />
            </Button>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, id or hash…"
              className="pl-9 h-11 rounded-xl border-2 bg-card"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "locked", "open", "blocked"] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                className="rounded-xl h-11 capitalize"
                onClick={() => setFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {!loading && shown.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">No textboxes found.</p>
        ) : (
          <div className="bg-card border-2 border-border rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Link</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Size</th>
                  <th className="px-4 py-3 text-right">Version</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 text-muted-foreground">{r.id}</td>
                    <td className="px-4 py-3 font-medium break-all">
                      {r.code ?? (
                        <span className="font-normal text-muted-foreground" title={`Hash ${r.box_hash}…`}>
                          unknown
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.code ? (
                        <Link
                          to={`/textbox/${encodeURIComponent(r.code)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          /textbox/{r.code} <ExternalLink size={12} />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.blocked ? (
                        <span
                          className="inline-flex items-center gap-1 font-medium text-red-600"
                          title="Too many wrong PINs. Remove the PIN to reopen it (the content is cleared)."
                        >
                          <ShieldAlert size={14} /> Blocked
                        </span>
                      ) : r.locked ? (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <Lock size={14} /> PIN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <LockOpen size={14} /> Open
                        </span>
                      )}
                      {!r.blocked && r.failed_attempts > 0 && (
                        <span className="ml-2 text-xs text-red-600">{r.failed_attempts} bad PIN</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{r.empty ? "empty" : bytes(r.size)}</td>
                    <td className="px-4 py-3 text-right">{r.version}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmt(r.updated_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmt(r.created_at)}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      {r.locked && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-1 rounded-xl gap-1"
                          title="Remove the PIN lock (the note's content is cleared)"
                          onClick={() => setPendingRemovePin(r)}
                        >
                          <KeyRound size={14} />
                          Remove PIN
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-50"
                        title="Delete textbox"
                        onClick={() => setPendingDelete(r)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && !deleting && setPendingDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this textbox?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.code ? (
                <>
                  <span className="font-medium text-foreground break-all">/textbox/{pendingDelete.code}</span> and
                  its contents will be permanently deleted.
                </>
              ) : (
                <>Textbox #{pendingDelete?.id} and its contents will be permanently deleted.</>
              )}{" "}
              This cannot be undone.
            </AlertDialogDescription>
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

      <AlertDialog open={!!pendingRemovePin} onOpenChange={(o) => !o && !removingPin && setPendingRemovePin(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the PIN from this textbox?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemovePin?.code ? (
                <>
                  <span className="font-medium text-foreground break-all">/textbox/{pendingRemovePin.code}</span>{" "}
                </>
              ) : (
                <>Textbox #{pendingRemovePin?.id} </>
              )}
              will be unlocked so anyone with the link can open it. The content was encrypted with the PIN, which
              the server doesn't have, so it <span className="font-medium text-foreground">can't be kept</span> and
              the note will be emptied. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingPin}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removingPin}
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                confirmRemovePin();
              }}
            >
              {removingPin && <Loader2 size={16} className="mr-2 animate-spin" />}
              Remove PIN
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

export default function TextboxList() {
  return (
    <AdminGate title="All Textboxes">
      {(token, logout) => <TextboxTable token={token} logout={logout} />}
    </AdminGate>
  );
}
