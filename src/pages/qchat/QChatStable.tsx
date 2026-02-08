import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Pause, Play, Trash2, Send, Reply, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import ApiClient from "@/lib/api";
import CryptoJS from "crypto-js";

type SenderType = "me" | "other";

interface UiMessage {
  id: string;
  content: string; // decrypted
  sender: SenderType;
  senderName: string;
  timestamp: Date;
}

type ApiMsg = {
  id: number;
  sender: string;
  message: string; // encrypted
  time?: string; // backend time string
};

const QChatStable = () => {
  const { name, sender } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ----- Code gating (no persistence) -----
  const [code, setCode] = useState("");
  const [codePromptOpen, setCodePromptOpen] = useState(false);
  const [codeDraft, setCodeDraft] = useState("");
  const codeInputRef = useRef<HTMLInputElement>(null);

  // ----- API + polling state -----
  const [loading, setLoading] = useState(false);
  const [startPolling, setStartPolling] = useState(false);
  const lastIdRef = useRef(0);

  // Polling control refs
  const pollDelayRef = useRef<number>(1000); // current delay in ms
  const noChangeCountRef = useRef<number>(0); // consecutive polls with no lastId change
  const pollTimerRef = useRef<number | null>(null);
  const pollTickRef = useRef<null | (() => void)>(null); // allow external "kick"

  // Polling constants (single source of truth)
  const FAST_POLLING_DELAY = 1000; // Polls in every 1 sec
  const SLOW_POLLING_DELAY = 60000; // Polls in every 60 seconds
  const CHANGE_TO_SOLW_POLLING_AFTER = 120; // After 120 fast polls, when there is no new msg, it changes to slow polling

  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue, adjustTextareaHeight]);

  // ---------------------------
  // Helpers: encryption/decryption
  // ---------------------------

  /**
   * Encrypts conversation code for header token.
   * Backend decrypts token. Keep identical to old behavior.
   */
  const encryptCodeForHeader = useCallback((plainCode: string) => {
    const key = CryptoJS.SHA256(plainCode);
    const encrypted = CryptoJS.AES.encrypt(plainCode, key, {
      iv: CryptoJS.enc.Utf8.parse(import.meta.env.VITE_QCHAT_ENCRYPTION_ID),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return encrypted.toString();
  }, []);

  const decryptMessage = useCallback(
    (ciphertext: string) => {
      try {
        if (!code.trim()) return "<Locked>";
        const bytes = CryptoJS.AES.decrypt(ciphertext, code);
        const plain = bytes.toString(CryptoJS.enc.Utf8);
        return plain || "<Decryption Failed>";
      } catch {
        return "<Decryption Failed>";
      }
    },
    [code]
  );

  // ---------------------------
  // Headers (same API contract)
  // ---------------------------
  const headers = useMemo(() => {
    if (!name || !code.trim()) return null;
    return {
      "Content-Type": "application/json",
      name: name,
      token: encryptCodeForHeader(code.trim()),
    } as Record<string, string>;
  }, [name, code, encryptCodeForHeader]);

  // ---------------------------
  // Initial setup prompts
  // ---------------------------
  useEffect(() => {
    if (!name) {
      const convName = prompt("Enter Conversation Name");
      setStartPolling(false);
      if (convName) navigate("/qchatv3/" + convName);
      return;
    }

    if (!sender) {
      const senderName = prompt("Enter Your Name");
      setStartPolling(false);
      if (senderName) navigate("/qchatv3/" + name + "/" + senderName);
      return;
    }

    if (!code.trim()) {
      setCodePromptOpen(true);
      setStartPolling(false);
    }
  }, [name, sender, code, navigate]);

  // Focus code input when opened
  useEffect(() => {
    if (codePromptOpen) {
      requestAnimationFrame(() => codeInputRef.current?.focus());
    }
  }, [codePromptOpen]);

  // ---------------------------
  // Scroll behavior
  // ---------------------------
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 60;
    setAutoScroll(isAtBottom);
  }, []);

  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, autoScroll]);

  // ---------------------------
  // Message merge (dedupe + sort)
  // ---------------------------
  const mergeMessages = useCallback((prev: UiMessage[], incoming: UiMessage[]) => {
    const map = new Map<string, UiMessage>();
    [...prev, ...incoming].forEach((m) => map.set(m.id, m));
    return Array.from(map.values()).sort((a, b) => Number(a.id) - Number(b.id));
  }, []);

  // Convert API messages -> UI messages (decrypt for display)
  const apiToUi = useCallback(
    (apiMsgs: ApiMsg[]): UiMessage[] => {
      return apiMsgs.map((m) => {
        const isMe = m.sender === sender;
        const decrypted = decryptMessage(m.message);
        const ts = m.time && !Number.isNaN(Date.parse(m.time)) ? new Date(m.time) : new Date();

        return {
          id: String(m.id),
          content: decrypted,
          sender: isMe ? "me" : "other",
          senderName: m.sender,
          timestamp: ts,
        };
      });
    },
    [decryptMessage, sender]
  );

  // ---------------------------
  // API calls
  // ---------------------------
  const getConversations = useCallback(
    async (lastId = 0, showLoading = true) => {
      if (!headers) return [] as ApiMsg[];

      setLoading(showLoading);
      try {
        const url = ApiClient.buildFullUrl(
          import.meta.env.VITE_QUICK_CHAT_CONVERSATIONS + "?lastid=" + lastId
        );
        const resp = await fetch(url, { method: "GET", headers });
        const data = await resp.json();

        if (resp.status === 403) {
          console.log("Error While Getting Conversations: " + data?.detail);
          setStartPolling(false);
          setCode("");
          setMessages([]);
          throw new Error(data?.detail || "Forbidden");
        }

        return (data?.data || []) as ApiMsg[];
      } finally {
        setLoading(false);
      }
    },
    [headers]
  );

  const loadConversations = useCallback(async () => {
    const apiMsgs = await getConversations(0, true);
    if (apiMsgs.length > 0) {
      const uiMsgs = apiToUi(apiMsgs);
      setMessages((prev) => mergeMessages(prev, uiMsgs));
      const maxId = Math.max(...apiMsgs.map((x) => x.id));
      lastIdRef.current = Math.max(lastIdRef.current, maxId);
    }
  }, [getConversations, apiToUi, mergeMessages]);

  const pushEmail = useCallback(async () => {
    if (!headers) return;
    try {
      setLoading(true);
      const url = ApiClient.buildFullUrl(import.meta.env.VITE_QUICK_CHAT_CONVERSATIONS);
      const resp = await fetch(url, { method: "PUT", headers });
      const data = await resp.json();
      if (resp.status < 300) alert("Notified.!");
      else alert("Failed : " + (data?.messages?.[0] || "Unknown error"));
    } catch (e) {
      console.error("Failed to send email:", e);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // Delete ALL messages (existing behavior)
  const deleteMsgs = useCallback(async () => {
    if (!headers) return;
    if (!confirm("Confirm action.")) return;

    try {
      setLoading(true);
      const url = ApiClient.buildFullUrl(import.meta.env.VITE_QUICK_CHAT_CONVERSATIONS);
      const resp = await fetch(url, { method: "DELETE", headers });
      const data = await resp.json().catch(() => ({}));

      if (resp.status === 403) {
        console.log("Error while deleting messages : " + data?.detail);
        setStartPolling(false);
        setCode("");
        setMessages([]);
        return;
      }

      if (!resp.ok) {
        console.error("Delete all failed:", resp.status, data);
        alert(data?.detail || "Failed to delete messages");
        return;
      }

      setMessages([]);
      lastIdRef.current = 0;

      // If you delete, treat as "activity" and go fast
      pollDelayRef.current = FAST_POLLING_DELAY;
      noChangeCountRef.current = 0;
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
      pollTickRef.current?.();
    } catch (e) {
      console.error("Failed to delete messages:", e);
      alert("Failed to delete messages");
    } finally {
      setLoading(false);
    }
  }, [headers, FAST_POLLING_DELAY]);

  // Handle Message Reply
  const handleMessageReply = useCallback((msg: string) => {
    setInputValue(msg + "\n----------------------------------- \n");

    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
    });
  }, []);

  // Delete single message by id
  const handleMessageDelete = useCallback(
    async (id: string) => {
      if (!headers) {
        setCodePromptOpen(true);
        return;
      }

      if (!confirm("Delete this message?")) return;

      try {
        setLoading(true);

        const url = ApiClient.buildFullUrl(
          `${import.meta.env.VITE_QUICK_CHAT_CONVERSATIONS}delete/${id}/`
        );

        const resp = await fetch(url, { method: "DELETE", headers });
        const data = await resp.json().catch(() => ({}));

        if (resp.status === 403) {
          console.log("Error while deleting message : " + (data?.detail || ""));
          setStartPolling(false);
          setCode("");
          setMessages([]);
          return;
        }

        if (!resp.ok) {
          console.error("Delete failed:", resp.status, data);
          alert(data?.detail || "Failed to delete message");
          return;
        }

        setMessages((prev) => prev.filter((m) => m.id !== id));
      } catch (e) {
        console.error("Failed to delete message:", e);
        alert("Failed to delete message");
      } finally {
        setLoading(false);
      }
    },
    [headers]
  );

  // Force polling back to FAST immediately (works even if currently in SLOW)
  const kickPollingFast = useCallback(() => {
    pollDelayRef.current = FAST_POLLING_DELAY;
    noChangeCountRef.current = 0;

    if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);

    // Run a tick immediately; tick will schedule next using pollDelayRef.current
    pollTickRef.current?.();
  }, [FAST_POLLING_DELAY]);

  const handleSend = useCallback(async () => {
    if (!headers) {
      setCodePromptOpen(true);
      return;
    }

    const trimmed = inputValue.trim();
    if (!trimmed) return;

    try {
      setLoading(true);
      const url = ApiClient.buildFullUrl(import.meta.env.VITE_QUICK_CHAT_CONVERSATIONS);

      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sender,
          message: CryptoJS.AES.encrypt(trimmed, code).toString(),
        }),
      });

      const data = await resp.json().catch(() => ({}));

      if (resp.status === 403) {
        console.log("Error While handling Send: " + data?.detail);
        setStartPolling(false);
        setCode("");
        setMessages([]);
        return;
      }

      if (!resp.ok) {
        console.error("Send failed:", resp.status, data);
        alert(data?.detail || "Failed to send message");
        return;
      }

      const apiMsg = data?.data as ApiMsg;
      if (apiMsg?.id) {
        const uiMsg = apiToUi([apiMsg]);
        setMessages((prev) => mergeMessages(prev, uiMsg));
        lastIdRef.current = Math.max(lastIdRef.current, apiMsg.id);

        // KEY FIX: if you're in slow mode, your own send forces FAST immediately
        kickPollingFast();
      }

      setInputValue("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch (e) {
      console.error("Failed to send message:", e);
      alert("Failed to send message");
    } finally {
      setLoading(false);
    }
  }, [headers, inputValue, sender, code, apiToUi, mergeMessages, kickPollingFast]);

  // ---------------------------
  // Polling
  // ---------------------------
  useEffect(() => {
    if (!startPolling || !headers) return;

    let cancelled = false;

    const scheduleNext = (delay: number) => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = window.setTimeout(tick, delay);
    };

    const tick = async () => {
      if (cancelled) return;

      const before = lastIdRef.current;

      try {
        const apiMsgs = await getConversations(before, false);

        if (apiMsgs.length > 0) {
          const uiMsgs = apiToUi(apiMsgs);
          setMessages((prev) => mergeMessages(prev, uiMsgs));

          const maxId = Math.max(...apiMsgs.map((x) => x.id));
          lastIdRef.current = Math.max(lastIdRef.current, maxId);
        }

        const after = lastIdRef.current;

        if (after !== before) {
          // Activity -> go FAST and reset idle counter
          pollDelayRef.current = FAST_POLLING_DELAY;
          noChangeCountRef.current = 0;
        } else {
          // No change
          noChangeCountRef.current += 1;

          // Only switch to SLOW when currently FAST and idle for ~2 mins
          if (
            pollDelayRef.current === FAST_POLLING_DELAY &&
            noChangeCountRef.current >= CHANGE_TO_SOLW_POLLING_AFTER
          ) {
            pollDelayRef.current = SLOW_POLLING_DELAY;
            noChangeCountRef.current = 0;
          }
        }
      } catch (e) {
        console.error("Polling failed:", e);
        setStartPolling(false);
        return;
      }

      scheduleNext(pollDelayRef.current);
    };

    // Expose tick so other code (like handleSend) can kick immediately
    pollTickRef.current = () => {
      tick();
    };

    // Start immediately (fast)
    pollDelayRef.current = FAST_POLLING_DELAY;
    noChangeCountRef.current = 0;
    scheduleNext(pollDelayRef.current);

    return () => {
      cancelled = true;
      pollTickRef.current = null;
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    };
  }, [
    startPolling,
    headers,
    getConversations,
    apiToUi,
    mergeMessages,
    FAST_POLLING_DELAY,
    SLOW_POLLING_DELAY,
    CHANGE_TO_SOLW_POLLING_AFTER,
  ]);

  // When headers become available (code entered), do initial load + start polling
  useEffect(() => {
    if (!headers) return;
    loadConversations();
    setStartPolling(true);
  }, [headers, loadConversations]);

  // ---------------------------
  // Code prompt confirm (no persistence)
  // ---------------------------
  const confirmCode = useCallback(() => {
    const v = codeDraft.trim();
    if (!v) return;
    setCode(v);
    setCodeDraft("");
    setCodePromptOpen(false);
  }, [codeDraft]);

  // ---------------------------
  // Input keyboard behavior
  // ---------------------------
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;

    if (isMobile) return; // mobile: newline
    if (e.shiftKey) return; // desktop: newline

    e.preventDefault();
    handleSend();
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatName = (str?: string) => {
    if (!str) return "Chat";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const togglePolling = () => setStartPolling((p) => !p);

  return (
    <div className="h-dvh bg-muted/30 flex flex-col overflow-hidden">
      {/* Loading overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Loader2 className="h-10 w-10 animate-spin text-white" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Code prompt overlay */}
      <AnimatePresence>
        {codePromptOpen && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl bg-background border shadow-xl p-4"
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 8 }}
            >
              <div className="space-y-2">
                <h2 className="text-base font-semibold">Enter Code</h2>
              </div>

              <div className="mt-3 space-y-3">
                <input
                  ref={codeInputRef}
                  value={codeDraft}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, "");
                    setCodeDraft(digitsOnly);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmCode();
                    if (e.key === "Escape") navigate(-1);
                  }}
                  placeholder="Code"
                  className="w-full h-11 px-3 rounded-xl bg-muted/40 border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />

                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => navigate(-1)}>
                    Cancel
                  </Button>
                  <Button onClick={confirmCode} disabled={!codeDraft.trim()}>
                    Continue
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full md:my-4 md:rounded-xl md:border md:shadow-lg bg-background overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b bg-background/95 backdrop-blur-sm z-40 md:rounded-t-xl">
          <div className="flex items-center justify-between px-4 py-3 max-w-3xl mx-auto w-full">
            <h1 className="text-lg font-semibold text-foreground truncate">{formatName(name)}</h1>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={pushEmail}
                disabled={!headers}
                title="Notify"
              >
                <Bell className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={togglePolling}
                disabled={!headers}
                title={startPolling ? "Pause" : "Resume"}
              >
                {startPolling ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-destructive hover:text-destructive"
                onClick={deleteMsgs}
                disabled={!headers}
                title="Delete all"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Messages */}
        <main
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 bg-background"
        >
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  formatTime={formatTime}
                  onDelete={handleMessageDelete}
                  onReply={handleMessageReply}
                />
              ))}
            </AnimatePresence>
          </div>
        </main>

        {/* Input */}
        <footer className="shrink-0 border-t bg-background md:rounded-b-xl">
          <div className="p-3">
            <div className="flex items-end">
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  rows={1}
                  className="w-full min-h-[44px] max-h-[150px] pr-14 pl-4 py-3 rounded-2xl bg-muted/50 border-0 resize-none text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />

                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || !headers}
                  size="icon"
                  className="absolute right-2 bottom-2 h-10 w-10 rounded-xl"
                  type="button"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

// Bubble
interface MessageBubbleProps {
  message: UiMessage;
  formatTime: (date: Date) => string;
  onDelete: (id: string) => void;
  onReply: (msg: string) => void;
}

const MessageBubble = ({ message, formatTime, onDelete, onReply }: MessageBubbleProps) => {
  const isMe = message.sender === "me";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex ${isMe ? "justify-end" : "justify-start"} group`}
    >
      <div className="relative max-w-[80%] sm:max-w-[70%]">
        <div
          className={`px-4 py-2.5 rounded-2xl ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"
            }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

          <span
            className={`text-[10px] mt-1 block ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}
          >
            {message.senderName} · {formatTime(message.timestamp)}
          </span>
        </div>

        {/* Hover Actions */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? "-left-16" : "-right-16"
            }`}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            type="button"
            onClick={() => {
              onReply(message.content);
            }}
          >
            <Reply className="w-3.5 h-3.5" />
          </Button>

          {isMe && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(message.id)}
              type="button"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default QChatStable;
