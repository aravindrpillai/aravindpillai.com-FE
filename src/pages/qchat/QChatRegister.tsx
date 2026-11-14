/**
 * /quickchat/register — admin page for QChat.
 *
 * - Protected by the QChat admin password (kept in memory only, never persisted).
 * - Create chats, register users, set/reset the shared chat password.
 * - Each user can have ONE optional notification email (users can also change it from inside the chat).
 * - The chat password never leaves this browser: it is stretched with PBKDF2
 *   (qchatCrypto.deriveKeys) and only the derived auth token is sent. The other
 *   half of the derived key is the AES-256-GCM key every member uses to
 *   encrypt messages, so the server can never read conversations.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Bell, Check, Copy, Loader2, Lock, LogOut, Mail, MessageSquare, Pencil, Plus, RefreshCw,
  ShieldCheck, Trash2, Unlock, UserPlus, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import ApiClient from "@/lib/api";
import { deriveKeys } from "@/lib/qchatCrypto";

const ADMIN_PATH = import.meta.env.VITE_QUICK_CHAT_ADMIN || "qchat/admin/";
const PIN_RE = /^[0-9]{4}$/; // chat password: exactly 4 digits
const NAME_RE = /^[a-z0-9_-]{1,10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_NOTIFY_SUBJECT = "Grab your free coupons before they run out";
const IDLE_LOCK_MS = 15 * 60 * 1000;

interface AdminChat {
  name: string;
  notify_subject: string;
  locked: boolean;
  incorrect_pw_count: number;
  message_count: number;
  users: string[];
  user_emails?: Record<string, string>; // username -> notification email (one per user, optional)
}

type NewUser = { username: string; email?: string };

type ApiResult<T> = { ok: boolean; status: number; data?: T; message?: string };

const chatLink = (chat: string, user: string) =>
  `${window.location.origin}/qchat/${encodeURIComponent(chat)}/${encodeURIComponent(user)}`;

const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 4);

const QChatRegister = () => {
  const navigate = useNavigate();

  // ----- Admin session (memory only) -----
  const [adminPw, setAdminPw] = useState<string | null>(null);
  const [pwDraft, setPwDraft] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [chats, setChats] = useState<AdminChat[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "new">("view");
  const [busy, setBusy] = useState(false);

  const api = useCallback(
    async <T,>(method: string, path: string, body?: unknown, pw = adminPw): Promise<ApiResult<T>> => {
      try {
        const resp = await fetch(ApiClient.buildFullUrl(ADMIN_PATH + path), {
          method,
          headers: { "Content-Type": "application/json", token: pw ?? "" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const json = await resp.json().catch(() => ({}));
        const message = json?.messages?.[0] ?? json?.detail;
        if (resp.status === 403) {
          if (pw !== adminPw) return { ok: false, status: 403, message: "Wrong password" }; // sign-in attempt
          setAdminPw(null); // session no longer valid (admin password changed server-side)
          toast.error("Session expired, sign in again");
        }
        return { ok: resp.status < 300, status: resp.status, data: json?.data, message };
      } catch {
        return { ok: false, status: 0, message: "Network error" };
      }
    },
    [adminPw]
  );

  const logout = useCallback(() => {
    setAdminPw(null);
    setChats([]);
    setSelected(null);
    setMode("view");
  }, []);

  // Auto sign-out after inactivity.
  const idleTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!adminPw) return;
    const reset = () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => {
        logout();
        toast.info("Signed out after inactivity");
      }, IDLE_LOCK_MS);
    };
    const events = ["mousemove", "keydown", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [adminPw, logout]);

  const refresh = useCallback(async () => {
    const r = await api<AdminChat[]>("GET", "");
    if (r.ok && r.data) setChats(r.data);
    else if (r.status !== 403) toast.error(r.message || "Failed to load chats");
  }, [api]);

  const login = async () => {
    const pw = pwDraft;
    if (!pw || loggingIn) return;
    setLoggingIn(true);
    const r = await api<AdminChat[]>("GET", "", undefined, pw);
    setLoggingIn(false);
    if (r.ok && r.data) {
      setAdminPw(pw);
      setPwDraft("");
      setChats(r.data);
    } else {
      toast.error(r.message || "Login failed");
    }
  };

  const replaceChat = (chat?: AdminChat) => {
    if (!chat) return;
    setChats((prev) => {
      const others = prev.filter((c) => c.name !== chat.name);
      return [...others, chat].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const current = useMemo(() => chats.find((c) => c.name === selected) ?? null, [chats, selected]);

  // ---------------------------------------------------------------- login screen
  if (!adminPw) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <form
          className="w-full max-w-sm p-8 rounded-2xl bg-card border shadow-xl space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            login();
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">QuickChat Admin</h1>
            <p className="text-sm text-muted-foreground text-center">Enter the admin password to manage chats.</p>
          </div>
          <Input
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="Admin password"
            value={pwDraft}
            onChange={(e) => setPwDraft(e.target.value)}
          />
          <Button type="submit" className="w-full" disabled={!pwDraft || loggingIn}>
            {loggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>
      </div>
    );
  }

  // ---------------------------------------------------------------- main screen
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg sm:text-xl font-bold flex-1">QuickChat · Register</h1>
          <Button variant="ghost" size="icon" title="Refresh" onClick={refresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={logout}>
            <LogOut className="w-4 h-4" /> Sign out
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Chat list */}
        <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r bg-muted/30">
          <div className="p-3">
            <Button
              className="w-full gap-2"
              onClick={() => {
                setMode("new");
                setSelected(null);
              }}
            >
              <Plus className="w-4 h-4" /> New chat
            </Button>
          </div>
          <div className="p-2 space-y-1 max-h-60 md:max-h-[calc(100vh-130px)] overflow-y-auto">
            {chats.map((c) => (
              <button
                key={c.name}
                onClick={() => {
                  setSelected(c.name);
                  setMode("view");
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  selected === c.name && mode === "view" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="font-medium truncate flex-1">{c.name}</span>
                {c.locked && <Lock className="w-3.5 h-3.5 shrink-0" />}
                <span className="text-xs opacity-70">{c.users.length}</span>
              </button>
            ))}
            {chats.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No chats yet.</p>}
          </div>
        </aside>

        {/* Detail */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {mode === "new" ? (
            <NewChatForm
              busy={busy}
              existing={chats.map((c) => c.name)}
              onCancel={() => setMode("view")}
              onCreate={async (name, code, users, notify_subject) => {
                setBusy(true);
                try {
                  const { token } = await deriveKeys(code, name);
                  const r = await api<AdminChat>("POST", "", { name, token, users, notify_subject });
                  if (r.ok) {
                    replaceChat(r.data);
                    setSelected(name);
                    setMode("view");
                    toast.success("Chat created");
                  } else toast.error(r.message || "Failed to create chat");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed to create chat");
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : current ? (
            <ChatDetail
              key={current.name}
              chat={current}
              busy={busy}
              setBusy={setBusy}
              api={api}
              onUpdated={replaceChat}
              onDeleted={() => {
                setChats((prev) => prev.filter((c) => c.name !== current.name));
                setSelected(null);
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground">
              <ShieldCheck className="w-14 h-14 mb-4 opacity-50" />
              <p>Select a chat or create a new one</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ New chat

const PinInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <Input
    type="password"
    inputMode="numeric"
    pattern="[0-9]*"
    maxLength={4}
    autoComplete="new-password"
    placeholder="••••"
    className="tracking-[0.5em] text-center text-lg font-mono"
    value={value}
    onChange={(e) => onChange(digitsOnly(e.target.value))}
  />
);

const PasswordFields = ({
  code, setCode, confirm, setConfirm, label = "Chat password (4 digits)",
}: {
  code: string; setCode: (v: string) => void; confirm: string; setConfirm: (v: string) => void; label?: string;
}) => (
  <div className="grid gap-3 grid-cols-2">
    <div className="space-y-2">
      <Label>{label}</Label>
      <PinInput value={code} onChange={setCode} />
    </div>
    <div className="space-y-2">
      <Label>Confirm</Label>
      <PinInput value={confirm} onChange={setConfirm} />
    </div>
  </div>
);

const passwordError = (code: string, confirm: string) => {
  if (!PIN_RE.test(code)) return "Password must be exactly 4 digits";
  if (code !== confirm) return "Passwords don't match";
  return null;
};


const NewChatForm = ({
  busy, existing, onCancel, onCreate,
}: {
  busy: boolean;
  existing: string[];
  onCancel: () => void;
  onCreate: (name: string, code: string, users: NewUser[], notifySubject: string) => void;
}) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [rows, setRows] = useState<{ username: string; email: string }[]>([{ username: "", email: "" }]);
  const [subject, setSubject] = useState("");

  const setRow = (i: number, patch: Partial<{ username: string; email: string }>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = () => {
    const n = name.trim().toLowerCase();
    if (!NAME_RE.test(n)) return toast.error("Chat name: 1-10 chars, a-z 0-9 _ -");
    if (existing.includes(n)) return toast.error("A chat with this name already exists");
    const pwErr = passwordError(code, confirm);
    if (pwErr) return toast.error(pwErr);
    const users: NewUser[] = [];
    for (const r of rows) {
      const u = r.username.trim().toLowerCase();
      const e = r.email.trim().toLowerCase();
      if (!u && !e) continue; // empty row
      if (!NAME_RE.test(u)) return toast.error(`Invalid username "${u}" (1-10 chars, a-z 0-9 _ -)`);
      if (users.some((x) => x.username === u)) return toast.error(`"${u}" is listed twice`);
      if (e && !EMAIL_RE.test(e)) return toast.error(`${u}: invalid email "${e}"`);
      users.push(e ? { username: u, email: e } : { username: u });
    }
    if (users.length === 0) return toast.error("Register at least one user");
    onCreate(n, code, users, subject.trim());
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <h2 className="text-xl font-semibold">Create chat</h2>
      <div className="space-y-2">
        <Label>Chat name</Label>
        <Input placeholder="e.g. family" value={name} maxLength={10} onChange={(e) => setName(e.target.value.toLowerCase())} />
      </div>
      <PasswordFields code={code} setCode={setCode} confirm={confirm} setConfirm={setConfirm} />
      <p className="text-xs text-muted-foreground -mt-2">
        4 digits, shared by every user in this chat. It encrypts all messages in the browser and is never sent to
        the server. Share it with members yourself — it can't be recovered.
      </p>
      <div className="space-y-2">
        <Label>Users</Label>
        <p className="text-xs text-muted-foreground">
          Only these users can open the chat. Email is optional (one per user) and gets the bell notifications.
        </p>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2">
              <Input
                className="w-32 shrink-0"
                placeholder="username"
                maxLength={10}
                value={r.username}
                onChange={(e) => setRow(i, { username: e.target.value.toLowerCase() })}
              />
              <Input
                type="email"
                placeholder="email (optional)"
                value={r.email}
                onChange={(e) => setRow(i, { email: e.target.value })}
              />
              <Button
                type="button" variant="ghost" size="icon" title="Remove row"
                disabled={rows.length === 1}
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button" variant="outline" size="sm" className="gap-2"
          onClick={() => setRows((prev) => [...prev, { username: "", email: "" }])}
        >
          <Plus className="w-4 h-4" /> Add user
        </Button>
      </div>
      <div className="space-y-2">
        <Label>Notify email subject (optional)</Label>
        <Input placeholder={DEFAULT_NOTIFY_SUBJECT} maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className="flex gap-3 pt-2">
        <Button className="flex-1" onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create chat"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ Chat detail

type Api = <T>(method: string, path: string, body?: unknown) => Promise<ApiResult<T>>;

const ChatDetail = ({
  chat, busy, setBusy, api, onUpdated, onDeleted,
}: {
  chat: AdminChat;
  busy: boolean;
  setBusy: (b: boolean) => void;
  api: Api;
  onUpdated: (c?: AdminChat) => void;
  onDeleted: () => void;
}) => {
  const [newUser, setNewUser] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [editing, setEditing] = useState<string | null>(null); // username whose email is being edited
  const [emailDraft, setEmailDraft] = useState("");
  const [subject, setSubject] = useState(chat.notify_subject);
  const base = encodeURIComponent(chat.name) + "/";

  const run = async <T,>(fn: () => Promise<ApiResult<T>>, success: string) => {
    setBusy(true);
    try {
      const r = await fn();
      if (r.ok) {
        onUpdated(r.data as AdminChat | undefined);
        toast.success(success);
      } else toast.error(r.message || "Request failed");
      return r.ok;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addUser = async () => {
    const u = newUser.trim().toLowerCase();
    if (!NAME_RE.test(u)) return toast.error("Username: 1-10 chars, a-z 0-9 _ -");
    const e = newUserEmail.trim().toLowerCase();
    if (e && !EMAIL_RE.test(e)) return toast.error("Enter a valid email (or leave it empty)");
    if (await run(() => api("POST", base + "users/", { username: u, ...(e ? { email: e } : {}) }), `Registered ${u}`)) {
      setNewUser("");
      setNewUserEmail("");
    }
  };

  const removeUser = (u: string) => {
    if (!window.confirm(`Remove ${u} from ${chat.name}?`)) return;
    run(() => api("DELETE", base + "users/" + encodeURIComponent(u) + "/"), `Removed ${u}`);
  };

  const changePassword = async () => {
    const err = passwordError(code, confirm);
    if (err) return toast.error(err);
    if (!window.confirm(
      `Change the password for "${chat.name}"?\n\nAll ${chat.message_count} existing messages will be deleted ` +
      `(they were encrypted with the old password) and everyone will be signed out.`
    )) return;
    setBusy(true);
    let token: string;
    try {
      token = (await deriveKeys(code, chat.name)).token;
    } catch (e) {
      setBusy(false);
      return toast.error(e instanceof Error ? e.message : "Key derivation failed");
    }
    if (await run(() => api("PUT", "", { name: chat.name, token }), "Password changed")) {
      setCode("");
      setConfirm("");
    }
  };

  // One optional email per user. "" removes it.
  const saveUserEmail = async (u: string, value: string) => {
    const e = value.trim().toLowerCase();
    if (e && !EMAIL_RE.test(e)) return toast.error("Enter a valid email");
    if (!e && !window.confirm(`Remove ${u}'s notification email?`)) return;
    const path = base + "users/" + encodeURIComponent(u) + "/";
    if (await run(() => api("PUT", path, { email: e }), e ? `Email saved for ${u}` : `Email removed for ${u}`)) {
      setEditing(null);
    }
  };

  const startEdit = (u: string) => {
    setEditing(u);
    setEmailDraft(chat.user_emails?.[u] ?? "");
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold">{chat.name}</h2>
        <Badge variant="secondary">{chat.message_count} messages</Badge>
        {chat.locked ? (
          <Badge variant="destructive">Locked</Badge>
        ) : chat.incorrect_pw_count > 0 ? (
          <Badge variant="outline">{chat.incorrect_pw_count} failed logins</Badge>
        ) : null}
        <div className="flex-1" />
        {(chat.locked || chat.incorrect_pw_count > 0) && (
          <Button
            variant="outline" size="sm" className="gap-2" disabled={busy}
            onClick={() => run(() => api("PUT", "", { name: chat.name, unlock: true }), "Unlocked")}
          >
            <Unlock className="w-4 h-4" /> Unlock
          </Button>
        )}
      </div>

      {/* Users */}
      <section className="space-y-3">
        <h3 className="font-semibold">Users</h3>
        {chat.users.length === 0 ? (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            No users registered — nobody can open this chat until you add one.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Only these users can open this chat, each with their own link.</p>
        )}
        <ul className="divide-y rounded-lg border">
          {chat.users.map((u) => {
            const email = chat.user_emails?.[u];
            return (
              <li key={u} className="px-3 py-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium w-24 truncate">{u}</span>
                  <code className="flex-1 min-w-0 truncate text-xs text-muted-foreground">{chatLink(chat.name, u)}</code>
                  <Button variant="ghost" size="icon" title="Copy link" onClick={() => copy(chatLink(chat.name, u))}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Remove user" disabled={busy} onClick={() => removeUser(u)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {editing === u ? (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveUserEmail(u, emailDraft);
                    }}
                  >
                    <Input
                      type="email"
                      autoFocus
                      placeholder="name@example.com"
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                    />
                    <Button type="submit" size="icon" title="Save" disabled={busy || !emailDraft.trim()}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" title="Cancel" onClick={() => setEditing(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{email || "No notification email"}</span>
                    <Button
                      variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={busy}
                      onClick={() => startEdit(u)}
                    >
                      <Pencil className="w-3 h-3" /> {email ? "Change" : "Add email"}
                    </Button>
                    {email && (
                      <Button
                        variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                        disabled={busy} onClick={() => saveUserEmail(u, "")}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addUser();
          }}
        >
          <Input
            className="w-32 shrink-0" placeholder="username" maxLength={10} value={newUser}
            onChange={(e) => setNewUser(e.target.value.toLowerCase())}
          />
          <Input
            type="email" placeholder="email (optional)" value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
          />
          <Button type="submit" className="gap-2" disabled={busy || !newUser.trim()}>
            <UserPlus className="w-4 h-4" /> Add
          </Button>
        </form>
      </section>

      {/* Password */}
      <section className="space-y-3">
        <h3 className="font-semibold">Change chat password</h3>
        <PasswordFields code={code} setCode={setCode} confirm={confirm} setConfirm={setConfirm} label="New password" />
        <p className="text-xs text-muted-foreground">Deletes all existing messages and signs everyone out.</p>
        <Button variant="secondary" disabled={busy || code.length !== 4 || confirm.length !== 4} onClick={changePassword}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Change password"}
        </Button>
      </section>

      {/* Notify subject */}
      <section className="space-y-3">
        <h3 className="font-semibold">Notify email subject</h3>
        <p className="text-xs text-muted-foreground">
          Subject of the email sent to the other users' emails when someone presses{" "}
          <Bell className="inline w-3 h-3" /> in the chat. The email body is the fixed HTML template on the server.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api("PUT", "", { name: chat.name, notify_subject: subject.trim() }), "Subject saved");
          }}
        >
          <Input placeholder={DEFAULT_NOTIFY_SUBJECT} maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={busy || subject.trim() === chat.notify_subject}>
            Save
          </Button>
        </form>
      </section>

      {/* Danger zone */}
      <section className="pt-4 border-t">
        <Button
          variant="destructive" className="gap-2" disabled={busy}
          onClick={async () => {
            if (!window.confirm(`Delete chat "${chat.name}", all its users and messages? This can't be undone.`)) return;
            setBusy(true);
            const r = await api("DELETE", base);
            setBusy(false);
            if (r.ok) {
              onDeleted();
              toast.success("Chat deleted");
            } else toast.error(r.message || "Delete failed");
          }}
        >
          <Trash2 className="w-4 h-4" /> Delete chat
        </Button>
      </section>
    </div>
  );
};

export default QChatRegister;
