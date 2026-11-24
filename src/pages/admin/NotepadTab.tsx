import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, KeyRound, Loader2, Lock, LockOpen, RefreshCw, Search, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { bytes, fmtDate, panelApi, type NotepadRow } from "@/lib/panelApi";
import { usePanel } from "./context";

type Filter = "all" | "locked" | "open" | "blocked";
type Pending = { kind: "delete" | "pin"; row: NotepadRow };

export default function NotepadTab() {
  const { token, fail } = usePanel();
  const [rows, setRows] = useState<NotepadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState<Pending | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await panelApi.notepads(token));
    } catch (e) {
      fail(e, "Failed to load notepads");
    } finally {
      setLoading(false);
    }
  }, [token, fail]);

  useEffect(() => {
    load();
  }, [load]);

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

  async function confirm() {
    if (!pending) return;
    const { kind, row } = pending;
    setWorking(true);
    try {
      if (kind === "delete") {
        await panelApi.deleteNotepad(token, row.id);
        setRows((rs) => rs.filter((r) => r.id !== row.id));
        toast.success("Notepad deleted");
      } else {
        await panelApi.removeNotepadPin(token, row.id);
        setRows((rs) =>
          rs.map((x) =>
            x.id === row.id
              ? { ...x, locked: false, blocked: false, failed_attempts: 0, locked_until: null, empty: true, size: 0 }
              : x
          )
        );
        toast.success("PIN removed");
      }
      setPending(null);
    } catch (e) {
      fail(e, kind === "delete" ? "Delete failed" : "Failed to remove PIN");
    } finally {
      setWorking(false);
    }
  }

  const name = (r?: NotepadRow) =>
    r?.code ? <span className="font-medium text-foreground break-all">/textbox/{r.code}</span> : <>Notepad #{r?.id}</>;

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        {rows.length} total · {lockedCount} PIN-locked · {blockedCount} blocked. Content is end-to-end encrypted and
        never shown here. Names of older notepads appear once someone opens them again.
      </p>

      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, id or hash…"
            className="pl-9 h-11 rounded-xl border-2 bg-card"
          />
        </div>
        <div className="flex flex-wrap gap-2">
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
          <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl" title="Refresh" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : shown.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">No notepads found.</p>
      ) : (
        <div className="bg-card border-2 border-border rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Size</th>
                <th className="px-4 py-3 text-right">Version</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 text-muted-foreground">{r.id}</td>
                  <td className="px-4 py-3 font-medium break-all">
                    {r.code ? (
                      <Link
                        to={`/textbox/${encodeURIComponent(r.code)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {r.code} <ExternalLink size={12} />
                      </Link>
                    ) : (
                      <span className="font-normal text-muted-foreground" title={`Hash ${r.box_hash}…`}>unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.blocked ? (
                      <span className="inline-flex items-center gap-1 font-medium text-red-600" title="Too many wrong PINs">
                        <ShieldAlert size={14} /> Blocked
                      </span>
                    ) : r.locked ? (
                      <span className="inline-flex items-center gap-1 text-amber-700"><Lock size={14} /> PIN</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><LockOpen size={14} /> Open</span>
                    )}
                    {!r.blocked && r.failed_attempts > 0 && (
                      <span className="ml-2 text-xs text-red-600">{r.failed_attempts} bad PIN</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{r.empty ? "empty" : bytes(r.size)}</td>
                  <td className="px-4 py-3 text-right">{r.version}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.updated_at)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(r.created_at)}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    {r.locked && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mr-1 rounded-xl gap-1"
                        title="Remove the PIN lock (the note's content is cleared)"
                        onClick={() => setPending({ kind: "pin", row: r })}
                      >
                        <KeyRound size={14} /> Remove PIN
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-50"
                      title="Delete notepad"
                      onClick={() => setPending({ kind: "delete", row: r })}
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

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && !working && setPending(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.kind === "pin" ? "Remove the PIN?" : "Delete this notepad?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "pin" ? (
                <>
                  {name(pending?.row)} will be unlocked so anyone with the link can open it. The content was encrypted
                  with the PIN, which the server doesn't have, so the note{" "}
                  <span className="font-medium text-foreground">will be emptied</span>. This cannot be undone.
                </>
              ) : (
                <>
                  {name(pending?.row)} and its contents will be permanently deleted. This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                confirm();
              }}
            >
              {working && <Loader2 size={16} className="mr-2 animate-spin" />}
              {pending?.kind === "pin" ? "Remove PIN" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
