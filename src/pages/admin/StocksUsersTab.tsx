import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Clock, Copy, Dices, ExternalLink, Loader2, LogOut, Pencil, Plus, RefreshCw, ShieldAlert, ShieldCheck, Trash2, UserRound,
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
import { fmtDate, panelApi, relative, type Expiry, type LoginBlock, type LoginBlocks, type StocksUser } from "@/lib/panelApi";
import { usePanel } from "./context";

const USERNAME_RE = /^[a-z0-9._-]{2,40}$/;
const MIN_PASSWORD = 6;

// ---------------------------------------------------------------- expiry picker
type Mode = "keep" | "never" | "minutes" | "at";
const QUICK: { label: string; minutes: number }[] = [
  { label: "15 min", minutes: 15 },
  { label: "1 hour", minutes: 60 },
  { label: "1 day", minutes: 1440 },
  { label: "7 days", minutes: 10080 },
  { label: "30 days", minutes: 43200 },
];

interface ExpiryState {
  mode: Mode;
  minutes: string;
  at: string; // datetime-local value
}

function toExpiry(s: ExpiryState): Expiry | null | "invalid" {
  if (s.mode === "keep") return null;
  if (s.mode === "never") return { mode: "never" };
  if (s.mode === "minutes") {
    const n = Number(s.minutes);
    if (!/^\d+$/.test(s.minutes.trim()) || n < 1) return "invalid";
    return { mode: "minutes", minutes: n };
  }
  const d = new Date(s.at);
  if (!s.at || Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) return "invalid";
  return { mode: "at", at: d.toISOString() };
}

function humanMinutes(m: number) {
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${+(m / 60).toFixed(1)} h`;
  return `${+(m / 1440).toFixed(1)} days`;
}

function ExpiryPicker({ value, onChange, allowKeep }: { value: ExpiryState; onChange: (v: ExpiryState) => void; allowKeep?: boolean }) {
  const modes: { id: Mode; label: string }[] = [
    ...(allowKeep ? [{ id: "keep" as Mode, label: "Keep" }] : []),
    { id: "minutes", label: "In minutes" },
    { id: "at", label: "On a date" },
    { id: "never", label: "Never" },
  ];
  const n = Number(value.minutes);
  return (
    <div className="space-y-3">
      <div className="inline-flex flex-wrap rounded-xl bg-muted p-1">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange({ ...value, mode: m.id })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              value.mode === m.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {value.mode === "minutes" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              inputMode="numeric"
              value={value.minutes}
              onChange={(e) => onChange({ ...value, minutes: e.target.value.replace(/\D/g, "") })}
              className="w-32 h-10 rounded-xl"
              placeholder="Minutes"
            />
            <span className="text-sm text-muted-foreground">
              minutes{n > 0 ? ` · ${humanMinutes(n)} · until ${fmtDate(new Date(Date.now() + n * 60000).toISOString())}` : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q.minutes}
                type="button"
                onClick={() => onChange({ ...value, minutes: String(q.minutes) })}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  value.minutes === String(q.minutes) ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {value.mode === "at" && (
        <Input
          type="datetime-local"
          value={value.at}
          onChange={(e) => onChange({ ...value, at: e.target.value })}
          className="w-64 h-10 rounded-xl"
        />
      )}
      {value.mode === "never" && <p className="text-sm text-muted-foreground">Access does not expire.</p>}
    </div>
  );
}

function randomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf, (x) => chars[x % chars.length]).join("");
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || `At least ${MIN_PASSWORD} characters`}
        autoComplete="new-password"
        className="h-10 rounded-xl font-mono"
      />
      <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl" title="Generate" onClick={() => onChange(randomPassword())}>
        <Dices size={16} />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 shrink-0 rounded-xl"
        title="Copy"
        disabled={!value}
        onClick={() => navigator.clipboard.writeText(value).then(() => toast.success("Copied"))}
      >
        <Copy size={16} />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- status badge
function StatusBadge({ u }: { u: StocksUser }) {
  const cls =
    u.status === "active" ? "bg-emerald-100 text-emerald-700" : u.status === "expired" ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>{u.status}</span>;
}

function OwnerSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border p-3">
      <span>
        <span className="font-medium">Owner</span>
        <span className="block text-xs text-muted-foreground">
          There is no separate owner password: tick this on your own user. Owners can delete runs and approve or revert the
          Prediction Tracker's learning changes.
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

// ---------------------------------------------------------------- new user form
function NewUserForm({ onCreated, onCancel }: { onCreated: (u: StocksUser) => void; onCancel: () => void }) {
  const { token, fail } = usePanel();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(randomPassword);
  const [note, setNote] = useState("");
  const [expiry, setExpiry] = useState<ExpiryState>({ mode: "minutes", minutes: "60", at: "" });
  const [owner, setOwner] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    if (!USERNAME_RE.test(u)) return toast.error("Username: 2-40 characters, a-z 0-9 . _ -");
    if (password.length < MIN_PASSWORD) return toast.error(`Password must be at least ${MIN_PASSWORD} characters`);
    const exp = toExpiry(expiry);
    if (exp === "invalid") return toast.error("Pick a valid expiry");
    setBusy(true);
    try {
      const created = await panelApi.createStocksUser(token, { username: u, password, note, expiry: exp ?? { mode: "never" }, is_owner: owner });
      toast.success(`User ${created.username} created`);
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/stocks\nUsername: ${created.username}\nPassword: ${password}`);
        toast.info("Login details copied to the clipboard");
      } catch {
        /* clipboard not available */
      }
      onCreated(created);
    } catch (err) {
      fail(err, "Failed to create user");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border-2 border-primary/40 bg-card p-5 sm:p-6 space-y-5 mb-6">
      <h2 className="font-semibold text-lg">New stocks user</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Username</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. john" autoFocus className="h-10 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>Password</Label>
          <PasswordInput value={password} onChange={setPassword} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Note (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who is this for?" className="h-10 rounded-xl" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Access expires</Label>
        <ExpiryPicker value={expiry} onChange={setExpiry} />
      </div>
      <OwnerSwitch checked={owner} onChange={setOwner} />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy} className="rounded-xl gap-2">
          {busy && <Loader2 size={16} className="animate-spin" />} Create user
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- edit dialog
function EditUserDialog({ user, onClose, onSaved }: { user: StocksUser | null; onClose: () => void; onSaved: (u: StocksUser) => void }) {
  const { token, fail } = usePanel();
  const [expiry, setExpiry] = useState<ExpiryState>({ mode: "keep", minutes: "60", at: "" });
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);
  const [owner, setOwner] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setExpiry({ mode: "keep", minutes: "60", at: "" });
    setPassword("");
    setNote(user.note);
    setActive(user.is_active);
    setOwner(user.is_owner);
  }, [user]);

  const save = async () => {
    if (!user) return;
    const exp = toExpiry(expiry);
    if (exp === "invalid") return toast.error("Pick a valid expiry");
    if (password && password.length < MIN_PASSWORD) return toast.error(`Password must be at least ${MIN_PASSWORD} characters`);
    setBusy(true);
    try {
      const body: Parameters<typeof panelApi.updateStocksUser>[2] = { note, is_active: active, is_owner: owner };
      if (exp) body.expiry = exp;
      if (password) body.password = password;
      const saved = await panelApi.updateStocksUser(token, user.id, body);
      toast.success("Saved");
      onSaved(saved);
    } catch (err) {
      fail(err, "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {user?.username}</DialogTitle>
          <DialogDescription>
            Currently {user?.expires_at ? `expires ${fmtDate(user.expires_at)} (${relative(user.expires_at)})` : "never expires"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Expiry</Label>
            <ExpiryPicker value={expiry} onChange={setExpiry} allowKeep />
          </div>
          <div className="space-y-2">
            <Label>New password (optional — signs the user out)</Label>
            <PasswordInput value={password} onChange={setPassword} placeholder="Leave blank to keep" />
          </div>
          <div className="space-y-2">
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <label className="flex items-center justify-between rounded-xl border p-3">
            <span>
              <span className="font-medium">Account enabled</span>
              <span className="block text-xs text-muted-foreground">Disabled users can't sign in and are signed out at once.</span>
            </span>
            <Switch checked={active} onCheckedChange={setActive} />
          </label>
          <OwnerSwitch checked={owner} onChange={setOwner} />
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

// ---------------------------------------------------------------- blocked IPs (wrong /stocks passwords)
function BlockedIPs() {
  const { token, fail } = usePanel();
  const [data, setData] = useState<LoginBlocks | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await panelApi.stocksLoginBlocks(token));
    } catch (e) {
      fail(e, "Failed to load blocked IPs");
    }
  }, [token, fail]);
  useEffect(() => {
    load();
  }, [load]);

  const unblock = async (b: LoginBlock) => {
    setBusy(b.id);
    try {
      await panelApi.unblockStocksLogin(token, b.id);
      toast.success(`${b.ip} can sign in again`);
      await load();
    } catch (e) {
      fail(e, "Unblock failed");
    } finally {
      setBusy(null);
    }
  };

  const blocked = data?.ips.filter((b) => b.blocked) ?? [];
  const counting = data?.ips.filter((b) => !b.blocked) ?? [];
  const r = data?.rules;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <ShieldAlert size={18} className="text-muted-foreground" />
        <h2 className="font-semibold">Blocked IPs</h2>
        <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 rounded-xl" title="Refresh" onClick={load}>
          <RefreshCw size={14} />
        </Button>
      </div>
      {r && (
        <p className="mb-3 text-sm text-muted-foreground">
          More than {r.max_failed_attempts} wrong passwords from one IP blocks it from signing in to /stocks{" "}
          {r.block_minutes > 0 ? `for ${r.block_minutes} minutes` : "until you unblock it here"}. A correct sign-in resets the count.
          (Settings: <code>app.login</code> in stocks.yaml.)
        </p>
      )}
      {blocked.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No IP is blocked.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Blocked</th>
                <th className="px-4 py-3 text-right">Wrong passwords</th>
                <th className="px-4 py-3">Last username tried</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {blocked.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3 font-mono">{b.ip}</td>
                  <td className="px-4 py-3 whitespace-nowrap" title={fmtDate(b.blocked_at)}>{relative(b.blocked_at)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{b.failures}</td>
                  <td className="px-4 py-3">{b.last_username || "—"}</td>
                  <td className="px-2 py-2 text-right">
                    <Button variant="outline" size="sm" className="rounded-xl gap-1" disabled={busy === b.id} onClick={() => unblock(b)}>
                      {busy === b.id ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Unblock
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {counting.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Counting, not blocked: {counting.map((b) => `${b.ip} (${b.failures} wrong)`).join(" · ")}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- tab
export default function StocksUsersTab() {
  const { token, fail } = usePanel();
  const [users, setUsers] = useState<StocksUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StocksUser | null>(null);
  const [deleting, setDeleting] = useState<StocksUser | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await panelApi.stocksUsers(token));
    } catch (e) {
      fail(e, "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [token, fail]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-render every 30 s so "expires in …" and expired status stay current.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  const replace = (u: StocksUser) =>
    setUsers((list) => [...list.filter((x) => x.id !== u.id), u].sort((a, b) => a.username.localeCompare(b.username)));

  // Recomputed on every render (and the 30 s tick) so expiry status is live.
  const now = Date.now();
  const view: StocksUser[] = users.map((u) => {
    const expired = !!u.expires_at && new Date(u.expires_at).getTime() <= now;
    return { ...u, expired, status: !u.is_active ? "disabled" : expired ? "expired" : "active" };
  });

  const signOut = async (u: StocksUser) => {
    try {
      replace(await panelApi.updateStocksUser(token, u.id, { sign_out: true }));
      toast.success(`${u.username} signed out everywhere`);
    } catch (e) {
      fail(e);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      await panelApi.deleteStocksUser(token, deleting.id);
      setUsers((l) => l.filter((x) => x.id !== deleting.id));
      toast.success("User deleted");
      setDeleting(null);
    } catch (e) {
      fail(e, "Delete failed");
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <p className="flex-1 text-sm text-muted-foreground">
          People sign in on{" "}
          <Link to="/stocks" target="_blank" className="inline-flex items-center gap-1 text-primary hover:underline">
            /stocks <ExternalLink size={12} />
          </Link>{" "}
          with a username and password — the owner too (create your own user and tick Owner). Access is checked on every
          request, so it stops the moment it expires.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" title="Refresh" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
          {!creating && (
            <Button className="h-10 rounded-xl gap-2" onClick={() => setCreating(true)}>
              <Plus size={16} /> New user
            </Button>
          )}
        </div>
      </div>

      {creating && (
        <NewUserForm
          onCancel={() => setCreating(false)}
          onCreated={(u) => {
            replace(u);
            setCreating(false);
          }}
        />
      )}

      {loading && users.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : view.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <UserRound className="w-12 h-12 mb-3 opacity-40" />
          No stocks users yet.
        </div>
      ) : (
        <div className="bg-card border-2 border-border rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Last sign-in</th>
                <th className="px-4 py-3 text-right">Sign-ins</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {view.map((u) => (
                <tr key={u.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {u.username}
                      {u.is_owner && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Owner</span>}
                    </div>
                    {u.note && <div className="text-xs text-muted-foreground">{u.note}</div>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge u={u} /></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {u.expires_at ? (
                      <span className="inline-flex items-center gap-1.5" title={fmtDate(u.expires_at)}>
                        <Clock size={14} className={u.expired ? "text-amber-600" : "text-muted-foreground"} />
                        {relative(u.expires_at)}
                        <span className="text-xs text-muted-foreground">· {fmtDate(u.expires_at)}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground" title={fmtDate(u.last_login_at)}>
                    {u.last_login_at ? relative(u.last_login_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.login_count}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <Button variant="outline" size="sm" className="mr-1 rounded-xl gap-1" onClick={() => setEditing(u)}>
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

      <BlockedIPs />

      <EditUserDialog
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={(u) => {
          replace(u);
          setEditing(null);
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && !busyDelete && setDeleting(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.username}?</AlertDialogTitle>
            <AlertDialogDescription>They lose access to /stocks immediately. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busyDelete}
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {busyDelete && <Loader2 size={16} className="mr-2 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
