import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, Loader2, Lock, PanelLeftOpen, SquarePen } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  aiApi,
  isValidSlug,
  isValidUsername,
  readAIToken,
  storeAIToken,
  streamChat,
  toSlug,
  type AIAttachment,
  type AIConfig,
  type AIConversationSummary,
  type AIMessage,
  type ChatRequest,
} from "@/lib/aiApi";
import PinInput from "@/pages/textbox/PinInput";
import { Composer, type ComposerHandle } from "./Composer";
import { MessageView } from "./MessageView";
import type { ModelChoice } from "./ModelPicker";
import { Sidebar } from "./Sidebar";

/** A message as the UI holds it; `resend` is set when the request never reached the server. */
type UiMessage = AIMessage & { resend?: ChatRequest };

interface ChatState {
  title: string;
  exists: boolean; // saved on the server
  loading: boolean;
  notFound?: boolean;
  messages: UiMessage[];
}

const NEW_KEY = "__new__";
const CHOICE_KEY = "ai_model_choice";
const SIDEBAR_KEY = "ai_sidebar_open";

const readChoice = (): ModelChoice | null => {
  try {
    return JSON.parse(localStorage.getItem(CHOICE_KEY) || "null");
  } catch {
    return null;
  }
};

const nowIso = () => new Date().toISOString();
const tmpId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ======================================================================= no username in the URL
function PickUser() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const clean = name.trim().toLowerCase();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isValidUsername(clean)) navigate(`/ai/${clean}`);
        }}
        className="w-full max-w-sm rounded-2xl border-2 border-border bg-card p-6 shadow-soft sm:p-8"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-warm shadow-glow">
          <Lock className="text-primary-foreground" size={24} />
        </div>
        <h1 className="mb-1 text-center font-display text-2xl font-bold">AI</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Open your own link (<span className="font-mono">/ai/your-name</span>) or enter your username.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Username"
          autoCapitalize="none"
          autoComplete="username"
          className="h-12 w-full rounded-xl border-2 border-input bg-background px-3 outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!isValidUsername(clean)}
          className="mt-4 h-12 w-full rounded-xl bg-gradient-warm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Continue
        </button>
      </form>
    </main>
  );
}

// ======================================================================= access-code gate
function Gate({ user, onUnlock }: { user: string; onUnlock: (token: string, cfg: AIConfig) => void }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async (value: string) => {
    if (!/^\d{4}$/.test(value) || checking) return;
    setChecking(true);
    setError("");
    try {
      const { token } = await aiApi.unlock(user, value);
      const cfg = await aiApi.config(token);
      storeAIToken(user, token);
      onUnlock(token, cfg);
    } catch (err) {
      const e = err as { status?: number; message?: string };
      setError(
        e.status === 0 ? "Could not reach the server." : e.status === 401 ? "Incorrect username or code." : e.message || "Unlock failed."
      );
      setCode("");
    }
    setChecking(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(code);
        }}
        className="w-full max-w-sm rounded-2xl border-2 border-border bg-card p-6 shadow-soft sm:p-8"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-warm shadow-glow">
          <Lock className="text-primary-foreground" size={24} />
        </div>
        <h1 className="mb-1 text-center font-display text-2xl font-bold">AI</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Hi <span className="font-semibold text-foreground">{user}</span>, enter your 4-digit code.
        </p>
        <PinInput
          label="Access code"
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error) setError("");
          }}
          onComplete={submit}
          disabled={checking}
          invalid={!!error}
        />
        {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={code.length !== 4 || checking}
          className="mt-6 h-12 w-full rounded-xl bg-gradient-warm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {checking ? "Checking…" : "Unlock"}
        </button>
        <button type="button" onClick={() => navigate("/ai")} className="mt-2 w-full text-center text-sm text-muted-foreground hover:underline">
          Not {user}?
        </button>
      </form>
    </main>
  );
}

// ======================================================================= page
export default function AIChat() {
  const { user: rawUser } = useParams<{ user?: string }>();
  const user = (rawUser || "").toLowerCase();
  if (!isValidUsername(user)) return <PickUser />;
  // Remount per user so nothing (chats, streams, token) leaks between two users' pages.
  return <UserChat key={user} user={user} />;
}

function UserChat({ user }: { user: string }) {
  const { convName } = useParams<{ convName?: string }>();
  const base = `/ai/${user}`;
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [token, setToken] = useState("");
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [booting, setBooting] = useState(true);

  const [conversations, setConversations] = useState<AIConversationSummary[]>([]);
  const [chats, setChats] = useState<Record<string, ChatState>>({});
  const [streams, setStreams] = useState<Record<string, AbortController>>({});
  const streamsRef = useRef(streams);
  streamsRef.current = streams;

  const [choice, setChoiceState] = useState<ModelChoice | null>(readChoice);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [atBottom, setAtBottom] = useState(true);

  const composerRef = useRef<ComposerHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeKeyRef = useRef<string>(NEW_KEY);

  const activeKey = convName && isValidSlug(convName) ? convName : NEW_KEY;
  activeKeyRef.current = activeKey;
  const chat = chats[activeKey];
  const streaming = !!streams[activeKey];

  // ---------------------------------------------------------------- boot / auth
  useEffect(() => {
    const stored = readAIToken(user);
    if (!stored) {
      setBooting(false);
      return;
    }
    aiApi
      .config(stored)
      .then((cfg) => {
        if (cfg.username !== user) throw Object.assign(new Error("wrong user"), { status: 401 });
        setToken(stored);
        setConfig(cfg);
      })
      .catch((e) => {
        if (e.status !== 0) storeAIToken(user, "");
        else toast.error("Could not reach the server.");
      })
      .finally(() => setBooting(false));
  }, [user]);

  const logout = () => {
    Object.values(streamsRef.current).forEach((c) => c.abort());
    storeAIToken(user, "");
    setToken("");
    setConfig(null);
    setChats({});
    setConversations([]);
  };

  const handleAuthError = useCallback((e: unknown) => {
    const status = (e as { status?: number }).status;
    if (status === 401 || status === 403) {
      storeAIToken(user, "");
      setToken("");
      setConfig(null);
      toast.error("Session expired. Enter the code again.");
      return true;
    }
    return false;
  }, [user]);

  // ---------------------------------------------------------------- model choice
  const providers = useMemo(() => config?.providers ?? [], [config]);
  const isAvailable = useCallback(
    (c: ModelChoice | null) => !!c && providers.some((p) => p.id === c.provider && p.models.includes(c.model)),
    [providers]
  );
  const setChoice = (c: ModelChoice) => {
    setChoiceState(c);
    try {
      localStorage.setItem(CHOICE_KEY, JSON.stringify(c));
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    if (!config || isAvailable(choice)) return;
    const p = providers.find((x) => x.id === config.default_provider) || providers[0];
    setChoiceState(p ? { provider: p.id, model: p.default_model } : null);
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- data
  const refreshList = useCallback(() => {
    if (!token) return;
    aiApi
      .list(token)
      .then(setConversations)
      .catch((e) => handleAuthError(e));
  }, [token, handleAuthError]);

  useEffect(refreshList, [refreshList]);

  const patchChat = useCallback((key: string, fn: (c: ChatState) => ChatState) => {
    setChats((prev) => (prev[key] ? { ...prev, [key]: fn(prev[key]) } : prev));
  }, []);

  // Route -> chat state.
  useEffect(() => {
    if (!token) return;
    if (convName && !isValidSlug(convName)) {
      const fixed = toSlug(convName);
      navigate(fixed ? `${base}/${fixed}` : base, { replace: true });
      return;
    }
    if (!convName) {
      setChats((prev) =>
        prev[NEW_KEY] && streamsRef.current[NEW_KEY]
          ? prev
          : { ...prev, [NEW_KEY]: { title: "New chat", exists: false, loading: false, messages: [] } }
      );
      return;
    }
    const slug = convName;
    if (streamsRef.current[slug]) return; // a reply is streaming into it; keep the live state
    setChats((prev) => ({
      ...prev,
      // Cached chats stay on screen while they refresh; unknown ones show a spinner.
      [slug]: prev[slug] ? { ...prev[slug], loading: !prev[slug].exists } : {
        title: slug.replace(/-/g, " "),
        exists: false,
        loading: true,
        messages: [],
      },
    }));
    let alive = true;
    aiApi
      .get(token, slug)
      .then((c) => {
        if (!alive) return;
        setChats((prev) => ({
          ...prev,
          [slug]: { title: c.title, exists: true, loading: false, messages: c.messages },
        }));
        const fromConv = { provider: c.provider, model: c.model } as ModelChoice;
        if (isAvailable(fromConv)) setChoiceState(fromConv);
      })
      .catch((e) => {
        if (!alive || handleAuthError(e)) return;
        // Unknown name: start a new chat that will be saved under this name.
        setChats((prev) => ({
          ...prev,
          [slug]: {
            title: slug.replace(/-/g, " "),
            exists: false,
            loading: false,
            notFound: e.status === 404,
            messages: prev[slug]?.messages ?? [],
          },
        }));
        if (e.status !== 404) toast.error(e.message);
      });
    return () => {
      alive = false;
    };
  }, [convName, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- layout helpers
  useEffect(() => {
    document.title = chat?.exists ? `${chat.title} · AI` : "AI";
  }, [chat?.title, chat?.exists]);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const toggleSidebar = (open: boolean) => {
    setSidebarOpen(open);
    if (!isMobile) {
      try {
        localStorage.setItem(SIDEBAR_KEY, open ? "1" : "0");
      } catch {
        /* ignore */
      }
    }
  };

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  // Follow the reply while the user is at the bottom.
  const lastContent = chat?.messages[chat.messages.length - 1]?.content;
  useEffect(() => {
    if (atBottom) scrollToBottom(false);
  }, [lastContent, chat?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Jump to the bottom when switching chats.
  useEffect(() => {
    setAtBottom(true);
    requestAnimationFrame(() => scrollToBottom(false));
    composerRef.current?.focus();
  }, [activeKey, chat?.loading]);

  // ---------------------------------------------------------------- send / stream
  const run = useCallback(
    async (startKey: string, req: ChatRequest, optimistic: UiMessage[]) => {
      let key = startKey;
      const controller = new AbortController();
      const assistantTmp = optimistic[optimistic.length - 1].id;
      let assistantId: string | number = assistantTmp;
      let buffer = "";
      let frame = 0;

      setStreams((s) => ({ ...s, [key]: controller }));

      const patchAssistant = (fn: (m: UiMessage) => UiMessage) =>
        patchChat(key, (c) => ({
          ...c,
          messages: c.messages.map((m) => (m.id === assistantId ? fn(m) : m)),
        }));

      const flush = () => {
        frame = 0;
        if (!buffer) return;
        const piece = buffer;
        buffer = "";
        patchAssistant((m) => ({ ...m, content: m.content + piece }));
      };

      const endStream = () => {
        if (frame) cancelAnimationFrame(frame);
        flush();
        setStreams((s) => {
          const n = { ...s };
          delete n[key];
          return n;
        });
      };

      try {
        await streamChat(
          token,
          req,
          {
            onMeta: (meta) => {
              const slug = meta.conversation.slug;
              assistantId = meta.assistant_id;
              setChats((prev) => {
                const cur = prev[key];
                if (!cur) return prev;
                const messages = cur.messages.map((m) => {
                  if (m.id === assistantTmp) return { ...m, id: meta.assistant_id };
                  if (!req.regenerate && optimistic[0] && m.id === optimistic[0].id) return meta.user_message;
                  return m;
                });
                const next = { ...prev };
                if (key !== slug) delete next[key];
                next[slug] = { ...cur, title: meta.conversation.title, exists: true, notFound: false, messages };
                return next;
              });
              if (key !== slug) {
                // Update the ref now so the route effect (after navigate) sees the live stream.
                streamsRef.current = { ...streamsRef.current, [slug]: controller };
                setStreams((s) => {
                  const n = { ...s, [slug]: controller };
                  delete n[key];
                  return n;
                });
                const wasActive = activeKeyRef.current === key;
                key = slug;
                if (wasActive) {
                  activeKeyRef.current = slug;
                  navigate(`${base}/${slug}`, { replace: true });
                }
              }
              if (meta.created) refreshList();
            },
            onDelta: (text) => {
              buffer += text;
              if (!frame) frame = requestAnimationFrame(flush);
            },
            onDone: (message) => {
              endStream();
              patchAssistant(() => message);
            },
            onError: (error, message) => {
              endStream();
              patchAssistant((m) => (message ? message : { ...m, status: "error", error }));
            },
          },
          controller.signal
        );
        if (controller.signal.aborted) {
          endStream();
          patchAssistant((m) => ({ ...m, status: "stopped" }));
        }
      } catch (e) {
        endStream();
        if (handleAuthError(e)) return;
        const err = (e as Error).message || "Something went wrong.";
        // Not saved on the server if we never got the meta event -> allow a clean resend.
        const neverSaved = assistantId === assistantTmp;
        patchAssistant((m) => ({ ...m, status: "error", error: err, resend: neverSaved ? req : undefined }));
      } finally {
        refreshList();
      }
    },
    [token, base, patchChat, navigate, refreshList, handleAuthError]
  );

  const send = (text: string, attachments: AIAttachment[]): boolean => {
    if (!choice || streaming) return false;
    const key = activeKey;
    const slug = key === NEW_KEY ? undefined : key;
    const req: ChatRequest = {
      slug,
      provider: choice.provider,
      model: choice.model,
      content: text,
      attachment_ids: attachments.map((a) => a.id),
    };
    const user: UiMessage = {
      id: tmpId("user"),
      role: "user",
      content: text,
      provider: "",
      model: "",
      status: "complete",
      error: "",
      created_at: nowIso(),
      attachments,
    };
    const assistant: UiMessage = {
      id: tmpId("asst"),
      role: "assistant",
      content: "",
      provider: choice.provider,
      model: choice.model,
      status: "streaming",
      error: "",
      created_at: nowIso(),
      attachments: [],
    };
    setChats((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? { title: "New chat", exists: false, loading: false }),
        loading: false,
        messages: [...(prev[key]?.messages ?? []), user, assistant],
      },
    }));
    setAtBottom(true);
    run(key, req, [user, assistant]);
    return true;
  };

  const retry = () => {
    if (!choice || streaming || !chat) return;
    const key = activeKey;
    const msgs = chat.messages;
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== "assistant") return;

    // The request never reached the server: drop the failed pair and send it again.
    if (last.resend) {
      const req = { ...last.resend, provider: choice.provider, model: choice.model };
      const prevUser = msgs[msgs.length - 2];
      const user: UiMessage = { ...prevUser, id: tmpId("user") };
      const assistant: UiMessage = {
        ...last,
        id: tmpId("asst"),
        content: "",
        status: "streaming",
        error: "",
        resend: undefined,
        provider: choice.provider,
        model: choice.model,
      };
      patchChat(key, (c) => ({ ...c, messages: [...c.messages.slice(0, -2), user, assistant] }));
      run(key, req, [user, assistant]);
      return;
    }

    if (key === NEW_KEY) return;
    const assistant: UiMessage = {
      id: tmpId("asst"),
      role: "assistant",
      content: "",
      provider: choice.provider,
      model: choice.model,
      status: "streaming",
      error: "",
      created_at: nowIso(),
      attachments: [],
    };
    patchChat(key, (c) => ({ ...c, messages: [...c.messages.slice(0, -1), assistant] }));
    run(key, { slug: key, provider: choice.provider, model: choice.model, regenerate: true }, [assistant]);
  };

  const stop = () => streams[activeKey]?.abort();

  const newChat = () => {
    navigate(base);
    if (isMobile) setSidebarOpen(false);
    setTimeout(() => composerRef.current?.focus(), 0);
  };

  const rename = async (slug: string, title: string) => {
    try {
      const updated = await aiApi.rename(token, slug, title);
      setConversations((prev) => prev.map((c) => (c.slug === slug ? { ...c, title: updated.title } : c)));
      patchChat(slug, (c) => ({ ...c, title: updated.title }));
    } catch (e) {
      if (!handleAuthError(e)) toast.error((e as Error).message);
    }
  };

  const remove = async (slug: string) => {
    try {
      streamsRef.current[slug]?.abort();
      await aiApi.remove(token, slug);
      setConversations((prev) => prev.filter((c) => c.slug !== slug));
      setChats((prev) => {
        const n = { ...prev };
        delete n[slug];
        return n;
      });
      if (activeKey === slug) navigate(base, { replace: true });
    } catch (e) {
      if (!handleAuthError(e)) toast.error((e as Error).message);
    }
  };

  // ---------------------------------------------------------------- render
  const messages = chat?.messages ?? [];
  const isEmpty = !chat?.loading && messages.length === 0;
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }, []);

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!token || !config) {
    return (
      <Gate
        user={user}
        onUnlock={(t, cfg) => {
          setToken(t);
          setConfig(cfg);
        }}
      />
    );
  }

  const composer = (
    <Composer
      ref={composerRef}
      token={token}
      providers={providers}
      choice={choice}
      onChoice={setChoice}
      streaming={streaming}
      maxFileBytes={config.max_file_bytes}
      placeholder={isEmpty ? "How can I help you today?" : "Reply…"}
      onSend={send}
      onStop={stop}
    />
  );

  return (
    <div
      className="flex h-[100dvh] overflow-hidden bg-background text-foreground"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length) composerRef.current?.addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {/* Sidebar: overlay on mobile, docked on desktop */}
      {sidebarOpen && isMobile && (
        <div className="fixed inset-0 z-30 bg-black/40" onClick={() => toggleSidebar(false)} aria-hidden />
      )}
      <div
        className={`${
          isMobile ? "fixed inset-y-0 left-0 z-40" : "relative"
        } shrink-0 transition-[margin,transform] duration-200 ${
          sidebarOpen ? "translate-x-0" : isMobile ? "-translate-x-full" : "-ml-72"
        }`}
      >
        <Sidebar
          conversations={conversations}
          user={user}
          activeSlug={activeKey === NEW_KEY ? null : activeKey}
          onNew={newChat}
          onRename={rename}
          onDelete={remove}
          onClose={() => toggleSidebar(false)}
          onLogout={logout}
          onNavigate={() => isMobile && toggleSidebar(false)}
        />
      </div>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 px-3">
          {!sidebarOpen && (
            <>
              <button
                type="button"
                onClick={() => toggleSidebar(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Open sidebar"
                title="Open sidebar"
              >
                <PanelLeftOpen size={18} />
              </button>
              <button
                type="button"
                onClick={newChat}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="New chat"
                title="New chat"
              >
                <SquarePen size={17} />
              </button>
            </>
          )}
          <div className="min-w-0 flex-1 px-2">
            {chat && (chat.exists || activeKey !== NEW_KEY) && (
              <div className="truncate text-sm font-medium" title={chat.title}>
                {chat.title}
                <span className="ml-2 hidden font-mono text-xs font-normal text-muted-foreground sm:inline">
                  {base}/{activeKey}
                </span>
              </div>
            )}
          </div>
        </header>

        {providers.length === 0 && (
          <div className="mx-auto mt-2 max-w-xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            No AI provider is configured yet. Ask the admin to add an API key (admin panel → AI).
          </div>
        )}

        {chat?.loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-[12vh]">
            <h1 className="mb-8 text-center font-display text-3xl font-medium sm:text-4xl">
              <span className="mr-2 text-primary">✻</span>
              {activeKey === NEW_KEY ? greeting : chat?.title}
            </h1>
            <div className="w-full max-w-2xl">{composer}</div>
            {activeKey !== NEW_KEY && chat?.notFound && (
              <p className="mt-3 text-xs text-muted-foreground">
                New conversation — it will be saved as <span className="font-mono">{base}/{activeKey}</span>
              </p>
            )}
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
              }}
              className="flex-1 overflow-y-auto"
            >
              <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-8 pt-4">
                {messages.map((m, i) => (
                  <MessageView
                    key={m.id}
                    token={token}
                    message={m}
                    isLast={i === messages.length - 1}
                    busy={streaming}
                    onRetry={retry}
                  />
                ))}
              </div>
            </div>
            {!atBottom && (
              <button
                type="button"
                onClick={() => scrollToBottom()}
                className="absolute bottom-36 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background shadow-md hover:bg-muted"
                aria-label="Scroll to bottom"
              >
                <ArrowDown size={16} />
              </button>
            )}
            <div className="mx-auto w-full max-w-3xl px-4 pb-4">
              {composer}
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                AI can make mistakes. Please double-check responses.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
