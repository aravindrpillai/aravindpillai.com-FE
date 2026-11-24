/**
 * Who may use /ai. Each user gets their own page (/ai/<username>/<chat>) and their own 4-digit code,
 * and only ever sees their own conversations.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Copy, Dices, ExternalLink, Eye, EyeOff, Inbox, Loader2, LogOut, Pencil, Plus, Trash2, UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { panelApi, relative, type AIUser } from "@/lib/panelApi";
import { usePanel } from "./context";

const USER_RE = /^[a-z0-9][a-z0-9_-]{1,29}$/;
const randomCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, "0");
const linkFor = (u: string) => `${window.location.origin}/ai/${u}`;

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
        autoComplete="off"
        placeholder="0000"
        className="h-10 w-28 rounded-xl text-center font-mono text-lg tracking-[0.3em]"
      />
      <Button type="button" variant="outline" className="h-10 rounded-xl" title="Random code" onClick={() => onChange(randomCode())}>
        <Dices size={16} />
      </Button>
    </div>
  );
}

function CodeCell({ code }: { code: string | null }) {
  const [show, setShow] = useState(false);
  if (!code) return <span className="text-xs text-red-600">unreadable, set a new code</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <code className="font-mono tracking-[0.3em]">{show ? code : "••••"}</code>
      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setShow((v) => !v)} title={show ? "Hide" : "Show"}>
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </span>
  );
}

async function copyLogin(u: AIUser, code?: string | null) {
  try {
    await navigator.clipboard.writeText(`${linkFor(u.username)}\nCode: ${code ?? u.code ?? ""}`);
    toast.success("Link and code copied");
  } catch {
    toast.error("Copy failed");
  }
}

// ---------------------------------------------------------------- edit dialog
function EditDialog({ user, onClose, onSaved }: { user: AIUser | null; onClose: () => void; onSaved: (u: AIUser) => void }) {
  const { token, fail } = usePanel();
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setCode("");
    setNote(user.note);
    setActive(user.is_active);
  }, [user]);

  const save = async () => {
    if (!user) return;
    if (code && !/^\d{4}$/.test(code)) return toast.error("The code must be exactly 4 digits");
    setBusy(true);
    try {
      const saved = await panelApi.updateAIUser(token, user.id, { note, is_active: active, ...(code ? { code } : {}) });
      toast.success(code ? "Saved. The new code signed them out." : "Saved");
      onSaved(saved);
    } catch (e) {
      fail(e, "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {user?.username}</DialogTitle>
          <DialogDescription>
            Their page is <span className="font-mono">/ai/{user?.username}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>New code (optional, signs them out)</Label>
            <CodeInput value={code} onChange={setCode} />
          </div>
          <div className="space-y-2">
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <label className="flex items-center justify-between rounded-xl border p-3">
            <span>
              <span className="font-medium">Enabled</span>
              <span className="block text-xs text-muted-foreground">Disabled users can't open /ai and are signed out at once.</span>
            </span>
            <Switch checked={active} onCheckedChange={setActive} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="gap-2">
            {busy && <Loader2 size={16} className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- card
export default function AIUsersCard() {
  const { token, fail } = usePanel();
  const [users, setUsers] = useState<AIUser[] | null>(null);
  const [unassigned, setUnassigned] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState(randomCode);
  const [newNote, setNewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<AIUser | null>(null);
  const [deleting, setDeleting] = useState<AIUser | null>(null);
  const [claimFor, setClaimFor] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const r = await panelApi.aiUsers(token);
      setUsers(r.users);
      setUnassigned(r.unassigned_conversations);
    } catch (e) {
      fail(e, "Failed to load AI users");
    }
  }, [token, fail]);

  useEffect(() => {
    load();
  }, [load]);

  const replace = (u: AIUser) =>
    setUsers((l) => [...(l || []).filter((x) => x.id !== u.id), u].sort((a, b) => a.username.localeCompare(b.username)));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim().toLowerCase();
    if (!USER_RE.test(name)) return toast.error("Username: 2-30 characters, a-z 0-9 _ - (it goes in the URL)");
    if (!/^\d{4}$/.test(newCode)) return toast.error("The code must be exactly 4 digits");
    setBusy(true);
    try {
      const u = await panelApi.createAIUser(token, { username: name, code: newCode, note: newNote });
      replace(u);
      toast.success(`${u.username} can now use /ai/${u.username}`);
      copyLogin(u, newCode);
      setCreating(false);
      setNewName("");
      setNewNote("");
      setNewCode(randomCode());
    } catch (err) {
      fail(err, "Failed to create user");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async (u: AIUser) => {
    try {
      replace(await panelApi.updateAIUser(token, u.id, { sign_out: true }));
      toast.success(`${u.username} signed out everywhere`);
    } catch (e) {
      fail(e);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await panelApi.deleteAIUser(token, deleting.id);
      setUsers((l) => (l || []).filter((x) => x.id !== deleting.id));
      toast.success("User and their conversations deleted");
      setDeleting(null);
    } catch (e) {
      fail(e, "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    const id = Number(claimFor);
    if (!id) return;
    try {
      const r = await panelApi.claimUnassignedAI(token, id);
      toast.success(`Moved ${r.moved} conversations`);
      load();
    } catch (e) {
      fail(e, "Move failed");
    }
  };

  return (
    <section className="rounded-2xl border-2 border-border bg-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl font-bold">/ai users</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Only these people can use /ai. Each one gets their own page, <span className="font-mono">/ai/&lt;username&gt;/&lt;chat&gt;</span>,
            unlocked with their own 4-digit code, and sees only their own conversations.
          </p>
        </div>
        {!creating && (
          <Button className="rounded-xl gap-2" onClick={() => setCreating(true)}>
            <Plus size={16} /> New user
          </Button>
        )}
      </header>

      {creating && (
        <form onSubmit={create} className="grid gap-4 border-b border-border p-5 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. anna" autoFocus className="h-10 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <CodeInput value={newCode} onChange={setNewCode} />
          </div>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Input value={newNote} onChange={(e) => setNewNote(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy} className="rounded-xl gap-2">
              {busy && <Loader2 size={16} className="animate-spin" />} Create
            </Button>
          </div>
        </form>
      )}

      {unassigned > 0 && users && users.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-amber-50 px-5 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <Inbox size={16} />
          <span className="flex-1 min-w-0">
            {unassigned} conversation{unassigned === 1 ? "" : "s"} from before /ai was per-user belong to nobody, so nobody can open them.
          </span>
          <select
            value={claimFor}
            onChange={(e) => setClaimFor(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
          >
            <option value="">Give them to…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.username}</option>
            ))}
          </select>
          <Button size="sm" variant="outline" className="rounded-lg" disabled={!claimFor} onClick={claim}>Move</Button>
        </div>
      )}

      {!users ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-sm text-muted-foreground">
          <UserRound className="mb-2 h-10 w-10 opacity-40" />
          No users yet. Nobody can use /ai until you add one.
          {unassigned > 0 && <span className="mt-1">{unassigned} older conversations are waiting for an owner.</span>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Chats</th>
                <th className="px-4 py-3">Last used</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/40">
                  <td className="px-5 py-3">
                    <a href={`/ai/${u.username}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium hover:text-primary">
                      {u.username} <ExternalLink size={12} />
                    </a>
                    {u.note && <div className="text-xs text-muted-foreground">{u.note}</div>}
                  </td>
                  <td className="px-4 py-3"><CodeCell code={u.code} /></td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {u.is_active ? "active" : "disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.conversations}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{u.last_used_at ? relative(u.last_used_at) : "—"}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" className="rounded-xl" title="Copy link + code" onClick={() => copyLogin(u)}>
                      <Copy size={16} />
                    </Button>
                    <Button variant="outline" size="sm" className="mx-1 rounded-xl gap-1" onClick={() => setEditing(u)}>
                      <Pencil size={14} /> Edit
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-xl" title="Sign out everywhere" onClick={() => signOut(u)}>
                      <LogOut size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-50"
                      title="Delete user"
                      onClick={() => setDeleting(u)}
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

      <EditDialog user={editing} onClose={() => setEditing(null)} onSaved={(u) => { replace(u); setEditing(null); }} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && !busy && setDeleting(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their {deleting?.conversations ?? 0} conversation{deleting?.conversations === 1 ? "" : "s"} and uploaded files are
              deleted too. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {busy && <Loader2 size={16} className="mr-2 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
