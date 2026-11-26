import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Trash2, Send, Reply, Copy, Loader2, Paperclip, X, Play, FileText, Download, Eye, Image as ImageIcon, Video, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import ApiClient from "@/lib/api";
import {
  deriveKeys,
  encryptMessage,
  decryptMessage,
  encryptFile,
  decryptFile,
  type QChatKeys,
} from "@/lib/qchatCrypto";
import { isHeicFile, isHeicMime, heicFileToJpeg, heicToJpeg } from "@/lib/heic";
import { resolveMime, playbackMime, MAX_INLINE_IMAGE_BYTES } from "@/lib/mediaTypes";

type SenderType = "me" | "other";

type FileKind = "image" | "video" | "file";

interface FileInfo {
  kind: FileKind;
  mime: string;
  name: string;
  size?: number;
}

interface UiMessage {
  id: string;
  content: string; // decrypted text (or "[File]" for uploads)
  file?: FileInfo; // set for upload messages (image / video / any other file)
  oneTime?: boolean; // "view once" upload
  openedBy?: string[]; // recipients that already opened a one-time upload
  replyTo?: string; // id of the message this one replies to
  sender: SenderType;
  senderName: string;
  timestamp: Date;
}

/**
 * Plaintext of a text message before encryption: {"v":1,"text":"...","reply":"<id>"}.
 * The reply link lives INSIDE the ciphertext, so the server can't see who answers what.
 * Older messages are just the raw text and still render.
 */
type TextEnvelope = { v: 1; text: string; reply?: string };

const parseTextEnvelope = (plain: string): { text: string; reply?: string } => {
  if (plain.startsWith("{")) {
    try {
      const o = JSON.parse(plain) as Partial<TextEnvelope>;
      if (o && o.v === 1 && typeof o.text === "string") {
        return { text: o.text, reply: typeof o.reply === "string" ? o.reply : undefined };
      }
    } catch {
      /* legacy plain text */
    }
  }
  return { text: plain };
};

const kindOf = (mime: string): FileKind =>
  mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "file";

const kindLabel = (k: FileKind) => (k === "image" ? "photo" : k === "video" ? "video" : "file");

const formatSize = (bytes?: number) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Keep only a harmless base name for the downloaded file. */
const safeFileName = (name: string) =>
  // eslint-disable-next-line no-control-regex
  (name || "file").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120) || "file";

const previewOf = (m: UiMessage) => {
  if (!m.file) return m.content;
  if (m.oneTime) return `👁 View once ${kindLabel(m.file.kind)}`;
  if (m.file.kind === "image") return "📷 Photo";
  if (m.file.kind === "video") return "🎥 Video";
  return `📄 ${m.file.name}`;
};

/** Media shown in the full-screen viewer (never downloadable from the UI). */
interface ViewerState {
  url: string;
  kind: "image" | "video";
  name: string; // used for the download fallback when the browser can't show the format
  oneTimeId?: string; // set when this is a view-once item: removed from the chat on close
}

/** "Today, 9:45 PM" / "Yesterday, 9:45 PM" / "13 Nov, 9:45 PM" / "13 Nov 2025, 9:45 PM" */
const formatStamp = (date: Date) => {
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const day = date.toLocaleDateString([], { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
  return `${day}, ${time}`;
};

const formatFull = (date: Date) =>
  date.toLocaleString([], { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

type ApiMsg = {
  id: number;
  sender: string;
  message: string; // encrypted
  time?: string; // backend time string
  file?: boolean; // true when the message carries an encrypted file
  one_time?: boolean; // view-once upload
  opened_by?: string[]; // recipients that opened a view-once upload
};

type WsEvent =
  | { type: "auth_ok" }
  | { type: "auth_failed"; detail?: string }
  | { type: "message"; data: ApiMsg }
  | { type: "deleted"; ids: number[] }
  | { type: "opened"; id: number; by: string }
  | { type: "cleared" }
  | { type: "pong" };

/** Response of GET qchat/sync/ (the HTTP fallback). */
type SyncData = {
  messages: ApiMsg[]; // visible messages newer than lastid
  ids: number[]; // every message id the viewer can still see
  opened: Record<string, string[]>; // one-time upload id -> users that opened it
};

// ----- Constants -----
const LOCK_AFTER_HIDDEN_MS = 0; // lock as soon as the tab/app goes to background
const WS_PING_MS = 25_000; // keep-alive so proxies don't drop an idle socket
const WS_PONG_TIMEOUT_MS = 10_000; // no pong within this -> socket is dead (half-open), reconnect
const WS_CONNECT_TIMEOUT_MS = 8_000; // no auth_ok within this -> give up on this attempt
const WS_MAX_RETRY_MS = 30_000;
// HTTP fallback: while the socket is not live, poll the sync endpoint so the chat keeps working.
const POLL_MS = 3_000;
const POLL_MAX_MS = 15_000; // back off up to this on repeated poll errors
const WS_CLOSE_AUTH_FAILED = 4001;
const WS_CLOSE_REVOKED = 4002;
// Max plaintext size. The server limit (QCHAT_MAX_FILE_BYTES) is on the ciphertext, which adds
// ~16 bytes per MiB, so the server allows 201 MiB.
const MAX_FILE_BYTES = 200 * 1024 * 1024;
const MAX_FILE_LABEL = "200 MB";

/** Upload / download progress shown in the overlay. */
interface Transfer {
  label: string; // "Encrypting", "Uploading", "Downloading", "Decrypting"
  fraction: number | null; // 0..1, null = unknown
  detail?: string;
  cancel?: () => void;
}

/** POST a multipart form with upload progress. Resolves with the status (0 = network error) and JSON body. */
const xhrUpload = (
  url: string,
  headers: Record<string, string>,
  body: FormData,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void
): Promise<{ status: number; data: any }> => // eslint-disable-line @typescript-eslint/no-explicit-any
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    // No Content-Type header: the browser sets the multipart boundary.
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => onProgress(e.loaded, e.lengthComputable ? e.total : 0);
    xhr.onload = () => {
      let data: unknown = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error page (e.g. proxy 413) */
      }
      resolve({ status: xhr.status, data });
    };
    xhr.onerror = () => resolve({ status: 0, data: {} });
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });

/** Read a fetch response body into a Blob, reporting progress from Content-Length. */
const readWithProgress = async (
  resp: Response,
  onProgress: (fraction: number | null, detail: string) => void
): Promise<Blob> => {
  const total = Number(resp.headers.get("Content-Length")) || 0;
  if (!resp.body) return resp.blob();
  const reader = resp.body.getReader();
  const parts: BlobPart[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    loaded += value.byteLength;
    onProgress(total ? loaded / total : null, total ? `${formatSize(loaded)} / ${formatSize(total)}` : formatSize(loaded));
  }
  return new Blob(parts);
};

/** wss://<api host>/ws/qchat/ (override with VITE_QCHAT_WS_URL if needed). */
const buildWsUrl = () => {
  const override = import.meta.env.VITE_QCHAT_WS_URL;
  if (override) return override as string;
  const api = new URL(import.meta.env.VITE_API_BASE_URL, window.location.href);
  return `${api.protocol === "https:" ? "wss:" : "ws:"}//${api.host}/ws/qchat/`;
};

const QChatV3 = () => {
  const { name, sender } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----- Code gating (memory only; never persisted) -----
  const [keys, setKeys] = useState<QChatKeys | null>(null);
  const [codePromptOpen, setCodePromptOpen] = useState(false);
  const [codeDraft, setCodeDraft] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef(0); // bumped on every lock

  // ----- API + realtime state -----
  const [loading, setLoading] = useState(false);
  // "live" = WebSocket, "polling" = HTTP fallback working, "offline" = neither reachable right now
  const [link, setLink] = useState<"live" | "polling" | "offline">("offline");
  const lastIdRef = useRef(0);

  // ----- Decrypted images (object URLs live only in memory) -----
  const imageCacheRef = useRef(new Map<string, Promise<string>>());
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  // Object URL of a view-once item currently on screen (never cached; revoked on close/lock).
  const oneTimeUrlRef = useRef<string | null>(null);

  // ----- My notification email (one per user) -----
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailCurrent, setEmailCurrent] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  // ----- File transfer progress (upload / download) -----
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const transferAbortRef = useRef<AbortController | null>(null);

  // ----- Attachment waiting to be sent -----
  const [pending, setPending] = useState<{ file: File; oneTime: boolean } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // ----- Replies -----
  const [replyingTo, setReplyingTo] = useState<UiMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<number | null>(null);

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
  // Image cache helpers
  // ---------------------------
  const forgetImage = useCallback((id: string) => {
    const p = imageCacheRef.current.get(id);
    if (p) {
      p.then((url) => URL.revokeObjectURL(url)).catch(() => {});
      imageCacheRef.current.delete(id);
    }
  }, []);

  const forgetAllImages = useCallback(() => {
    imageCacheRef.current.forEach((p) => p.then((url) => URL.revokeObjectURL(url)).catch(() => {}));
    imageCacheRef.current.clear();
    if (oneTimeUrlRef.current) URL.revokeObjectURL(oneTimeUrlRef.current);
    oneTimeUrlRef.current = null;
    setViewer(null);
  }, []);

  // ---------------------------
  // Lock: wipe keys + decrypted content from memory and ask for the code again.
  // Called when the user leaves the page/app, on auth failure, etc.
  // ---------------------------
  const lock = useCallback(() => {
    sessionRef.current += 1; // invalidates any in-flight request results
    transferAbortRef.current?.abort(); // stop any upload/download in progress
    transferAbortRef.current = null;
    setTransfer(null);
    setKeys(null); // also closes the WebSocket (effect cleanup)
    setMessages([]);
    setInputValue("");
    setReplyingTo(null);
    setPending(null);
    setEmailOpen(false);
    forgetAllImages();
    lastIdRef.current = 0;
    setCodePromptOpen(true);
  }, [forgetAllImages]);

  useEffect(() => {
    let hiddenTimer: number | null = null;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenTimer = window.setTimeout(lock, LOCK_AFTER_HIDDEN_MS);
      } else if (hiddenTimer !== null) {
        window.clearTimeout(hiddenTimer);
        hiddenTimer = null;
      }
    };
    // pagehide: tab closed, navigated away, or page put into back/forward cache.
    const onPageHide = () => lock();
    // If the browser restores the page from bfcache, force a fresh load (no stale state).
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      if (hiddenTimer !== null) window.clearTimeout(hiddenTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [lock]);

  // Free decrypted images when leaving the page.
  useEffect(() => () => forgetAllImages(), [forgetAllImages]);

  // ---------------------------
  // Headers. Token is the derived auth key, not the code.
  // ---------------------------
  const authHeaders = useMemo(() => {
    if (!name || !keys) return null;
    // sender is checked server-side when the chat has registered users.
    return { name: name, token: keys.token, sender: sender ?? "" } as Record<string, string>;
  }, [name, keys, sender]);

  const headers = useMemo(() => {
    if (!authHeaders) return null;
    return { "Content-Type": "application/json", ...authHeaders } as Record<string, string>;
  }, [authHeaders]);

  // ---------------------------
  // Initial setup prompts
  // ---------------------------
  useEffect(() => {
    if (!name) {
      const convName = prompt("Enter Conversation Name");
      if (convName) navigate("/qchat/" + convName);
      return;
    }

    if (!sender) {
      const senderName = prompt("Enter Your Name");
      if (senderName) navigate("/qchat/" + name + "/" + senderName);
      return;
    }

    if (!keys) {
      setCodePromptOpen(true);
    }
  }, [name, sender, keys, navigate]);

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
    async (apiMsgs: ApiMsg[]): Promise<UiMessage[]> => {
      if (!keys) return [];
      return Promise.all(
        apiMsgs.map(async (m) => {
          const isMe = m.sender === sender?.toLowerCase();
          const decrypted = await decryptMessage(keys, m.message);
          const ts = m.time && !Number.isNaN(Date.parse(m.time)) ? new Date(m.time) : new Date();

          let content: string;
          let file: FileInfo | undefined;
          let replyTo: string | undefined;
          if (m.file) {
            // Meta (encrypted): {"t":"file","mime","name","size","reply"}; older images: {"t":"img","mime"}.
            try {
              const meta = JSON.parse(decrypted);
              const fname = typeof meta?.name === "string" ? meta.name : "file";
              // Older uploads may have an empty/generic type: guess it from the file name.
              const mime = resolveMime(typeof meta?.mime === "string" ? meta.mime : "", meta?.t === "img" ? "" : fname);
              file = {
                kind: meta?.t === "img" ? "image" : kindOf(mime),
                mime,
                name: fname,
                size: typeof meta?.size === "number" ? meta.size : undefined,
              };
              replyTo = typeof meta?.reply === "string" ? meta.reply : undefined;
            } catch {
              file = { kind: "file", mime: "", name: "file" };
            }
            content = "[File]";
          } else {
            const env = parseTextEnvelope(decrypted);
            content = env.text;
            replyTo = env.reply;
          }

          return {
            id: String(m.id),
            content,
            file,
            oneTime: !!m.one_time,
            openedBy: m.opened_by ?? [],
            replyTo,
            sender: isMe ? "me" : "other",
            senderName: m.sender,
            timestamp: ts,
          } as UiMessage;
        })
      );
    },
    [keys, sender]
  );

  /** Decrypt + add messages, ignoring results that arrive after a lock. */
  const ingest = useCallback(
    async (apiMsgs: ApiMsg[]) => {
      if (apiMsgs.length === 0) return;
      const session = sessionRef.current;
      const uiMsgs = await apiToUi(apiMsgs);
      if (session !== sessionRef.current) return;
      setMessages((prev) => mergeMessages(prev, uiMsgs));
      const maxId = Math.max(...apiMsgs.map((x) => x.id));
      lastIdRef.current = Math.max(lastIdRef.current, maxId);
    },
    [apiToUi, mergeMessages]
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
          lock();
          throw new Error(data?.detail || "Forbidden");
        }

        return (data?.data || []) as ApiMsg[];
      } finally {
        setLoading(false);
      }
    },
    [headers, lock]
  );

  /**
   * Load the full conversation and REPLACE the list (initial load + after every
   * reconnect), so messages added *or deleted* while offline are reflected.
   */
  const resync = useCallback(
    async (showLoading: boolean) => {
      const session = sessionRef.current;
      try {
        const apiMsgs = await getConversations(0, showLoading);
        const uiMsgs = await apiToUi(apiMsgs);
        if (session !== sessionRef.current) return;
        const keep = new Set(uiMsgs.map((m) => m.id));
        Array.from(imageCacheRef.current.keys()).forEach((id) => !keep.has(id) && forgetImage(id));
        // Server list is authoritative up to fetchedMax; keep only newer ones pushed meanwhile.
        const fetchedMax = Math.max(0, ...apiMsgs.map((x) => x.id));
        setMessages((prev) => mergeMessages(prev.filter((m) => Number(m.id) > fetchedMax), uiMsgs));
        lastIdRef.current = Math.max(lastIdRef.current, fetchedMax);
      } catch (e) {
        console.error("Resync failed:", e);
      }
    },
    [getConversations, apiToUi, mergeMessages, forgetImage]
  );

  /**
   * Cheap catch-up over HTTP (qchat/sync/): new messages in full, plus the list of ids that still
   * exist, so deletes / clears / view-once opens are picked up too. Used as the polling fallback
   * while the WebSocket is down, and once after every (re)connect. Throws on failure.
   */
  const pollSync = useCallback(async () => {
    if (!headers) throw new Error("locked");
    const session = sessionRef.current;
    const sinceId = lastIdRef.current;
    const url = ApiClient.buildFullUrl(
      (import.meta.env.VITE_QUICK_CHAT_SYNC ?? "qchat/sync/") + "?lastid=" + sinceId
    );
    // Time out a hung request so the next poll can try again (AbortSignal.timeout isn't on older Safari).
    const abort = new AbortController();
    const timer = window.setTimeout(() => abort.abort(), 10_000);
    let resp: Response;
    try {
      resp = await fetch(url, { method: "GET", headers, cache: "no-store", signal: abort.signal });
    } finally {
      window.clearTimeout(timer);
    }
    if (resp.status === 403) {
      lock();
      throw new Error("403");
    }
    if (!resp.ok) throw new Error(String(resp.status));
    const sync = ((await resp.json())?.data ?? {}) as Partial<SyncData>;
    const ids = sync.ids ?? [];
    const opened = sync.opened ?? {};
    const uiMsgs = await apiToUi(sync.messages ?? []);
    if (session !== sessionRef.current) return;

    const keep = new Set(ids.map(String));
    // Anything at or below what the server has seen and not in `ids` was deleted / cleared / opened by me.
    const known = Math.max(sinceId, ...ids, 0);
    Array.from(imageCacheRef.current.keys()).forEach((id) => Number(id) <= known && !keep.has(id) && forgetImage(id));
    setMessages((prev) =>
      mergeMessages(
        prev
          .filter((m) => keep.has(m.id) || Number(m.id) > known)
          .map((m) => (m.oneTime && opened[m.id] ? { ...m, openedBy: opened[m.id] } : m)),
        uiMsgs
      )
    );
    lastIdRef.current = Math.max(0, ...ids);
  }, [headers, lock, apiToUi, mergeMessages, forgetImage]);

  // ---------------------------
  // Realtime: WebSocket first, HTTP polling as automatic failover.
  //  - Each socket attempt must reach auth_ok within WS_CONNECT_TIMEOUT_MS, and each ping must be
  //    answered within WS_PONG_TIMEOUT_MS, otherwise the socket is dropped. This catches half-open
  //    sockets that never fire onclose (mobile network switches, proxies silently dropping idle links).
  //  - While the socket is not live, qchat/sync/ is polled so the chat keeps working, and the socket
  //    keeps retrying in the background. Polling stops as soon as the socket is live again.
  //  - Auth/revoke closes (4001/4002) are confirmed over HTTP: only a 403 there locks the chat, so a
  //    socket-side glitch never kicks the user out.
  // ---------------------------
  const handlersRef = useRef({ ingest, resync, pollSync, lock, forgetImage, forgetAllImages });
  useEffect(() => {
    handlersRef.current = { ingest, resync, pollSync, lock, forgetImage, forgetAllImages };
  }, [ingest, resync, pollSync, lock, forgetImage, forgetAllImages]);

  useEffect(() => {
    if (!keys || !name) return;

    let ws: WebSocket | null = null;
    let live = false; // the current socket is authenticated and answering pings
    let stopped = false;
    let retry = 0;
    let retryTimer: number | null = null;
    let connectTimer: number | null = null;
    let pingTimer: number | null = null;
    let pongTimer: number | null = null;
    let pollTimer: number | null = null;
    let polling = false;
    let pollBusy = false;
    let pollFails = 0;

    const clear = (t: number | null) => {
      if (t !== null) window.clearTimeout(t);
    };
    const clearSocketTimers = () => {
      clear(connectTimer);
      clear(pongTimer);
      if (pingTimer !== null) window.clearInterval(pingTimer);
      connectTimer = pongTimer = pingTimer = null;
    };

    // ----- HTTP polling fallback -----
    const schedulePoll = (delay: number) => {
      clear(pollTimer);
      pollTimer = window.setTimeout(runPoll, delay);
    };
    const runPoll = async () => {
      pollTimer = null;
      if (!polling || stopped || live || pollBusy) return;
      pollBusy = true;
      try {
        await handlersRef.current.pollSync(); // a 403 locks the chat (and ends this effect)
        pollFails = 0;
        if (!stopped && !live) setLink("polling");
      } catch {
        pollFails += 1;
        if (!stopped && !live) setLink("offline");
      } finally {
        pollBusy = false;
      }
      if (polling && !stopped && !live) {
        schedulePoll(Math.min(POLL_MAX_MS, POLL_MS * 2 ** Math.max(0, pollFails - 1)));
      }
    };
    const startPolling = () => {
      if (stopped || live) return;
      if (!polling) {
        polling = true;
        pollFails = 0;
      }
      if (!pollBusy) schedulePoll(0);
    };
    const stopPolling = () => {
      polling = false;
      clear(pollTimer);
      pollTimer = null;
    };

    // ----- WebSocket -----
    const socketDown = () => {
      live = false;
      clearSocketTimers();
      if (stopped) return;
      startPolling();
      clear(retryTimer);
      const delay = Math.min(WS_MAX_RETRY_MS, 1000 * 2 ** retry);
      retry += 1;
      retryTimer = window.setTimeout(connect, delay);
    };

    /** Detach + close a socket without waiting for onclose (a dead socket may never fire it). */
    const drop = (sock: WebSocket, failover = true) => {
      sock.onopen = sock.onmessage = sock.onerror = sock.onclose = null;
      try {
        sock.close(1000);
      } catch {
        /* already closed */
      }
      if (sock === ws) {
        ws = null;
        if (failover) socketDown();
      }
    };

    const connect = () => {
      clear(retryTimer);
      retryTimer = null;
      if (stopped) return;
      if (ws) drop(ws, false);
      clearSocketTimers();
      live = false;

      let sock: WebSocket;
      try {
        sock = new WebSocket(buildWsUrl());
      } catch (e) {
        console.error("WebSocket could not be created:", e);
        socketDown();
        return;
      }
      ws = sock;
      connectTimer = window.setTimeout(() => drop(sock), WS_CONNECT_TIMEOUT_MS);

      sock.onopen = () => {
        // Token goes in the first message, never in the URL (keeps it out of logs).
        sock.send(JSON.stringify({ type: "auth", name, token: keys.token, sender: sender ?? "" }));
      };

      sock.onmessage = (ev) => {
        // Any frame proves the link is alive.
        clear(pongTimer);
        pongTimer = null;
        let msg: WsEvent;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        const h = handlersRef.current;
        switch (msg.type) {
          case "auth_ok":
            clear(connectTimer);
            connectTimer = null;
            live = true;
            retry = 0;
            stopPolling();
            setLink("live");
            pingTimer = window.setInterval(() => {
              if (sock.readyState !== WebSocket.OPEN) return drop(sock);
              sock.send('{"type":"ping"}');
              if (pongTimer === null) pongTimer = window.setTimeout(() => drop(sock), WS_PONG_TIMEOUT_MS);
            }, WS_PING_MS);
            // Catch up on anything that happened before this socket subscribed (or while it was down).
            h.pollSync().catch(() => h.resync(false));
            break;
          case "message":
            h.ingest([msg.data]);
            break;
          case "deleted": {
            const ids = new Set(msg.ids.map(String));
            ids.forEach((id) => h.forgetImage(id));
            setMessages((prev) => prev.filter((m) => !ids.has(m.id)));
            break;
          }
          case "opened": {
            // A view-once upload was opened. Gone for that user (all their devices);
            // everyone else just sees the updated "opened by" list.
            const id = String(msg.id);
            const me = (sender ?? "").toLowerCase();
            if (msg.by === me) {
              setMessages((prev) => prev.filter((m) => m.id !== id));
            } else {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === id ? { ...m, openedBy: Array.from(new Set([...(m.openedBy ?? []), msg.by])) } : m
                )
              );
            }
            break;
          }
          case "cleared":
            h.forgetAllImages();
            setMessages([]);
            lastIdRef.current = 0;
            break;
        }
      };

      sock.onclose = (ev) => {
        if (sock !== ws) return;
        ws = null;
        if (ev.code === WS_CLOSE_AUTH_FAILED || ev.code === WS_CLOSE_REVOKED) {
          console.warn("QChat socket closed with", ev.code, "- checking access over HTTP");
        }
        // Falls back to polling right away; the first poll locks the chat if access was really revoked.
        socketDown();
      };
    };

    // Network back: retry the socket and poll immediately instead of waiting for the backoff.
    const onOnline = () => {
      if (stopped) return;
      retry = 0;
      if (!live) connect();
      if (polling && !pollBusy) schedulePoll(0);
    };
    // Network gone: the socket is almost certainly dead; don't wait for it to time out.
    const onOffline = () => {
      if (ws) drop(ws);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Initial history over HTTP right away, so the chat shows even if the socket never connects.
    handlersRef.current.resync(true);
    connect();

    return () => {
      stopped = true;
      stopPolling();
      clear(retryTimer);
      clearSocketTimers();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (ws) drop(ws, false);
      setLink("offline");
    };
  }, [keys, name, sender]);

  // ---------------------------
  // File loading (download ciphertext -> decrypt in browser -> object URL)
  // ---------------------------
  /** Fetch + decrypt one upload. Throws an Error whose message is the HTTP status on failure. */
  const fetchDecrypted = useCallback(
    async (id: string, mime: string, onProgress?: (t: Transfer) => void): Promise<string> => {
      if (!authHeaders || !keys) throw new Error("locked");
      const session = sessionRef.current;
      const url = ApiClient.buildFullUrl(`${import.meta.env.VITE_QUICK_CHAT_CONVERSATIONS_FILES ?? "qchat/files/"}${id}/`);
      const resp = await fetch(url, { method: "GET", headers: authHeaders, cache: "no-store" });
      if (resp.status === 403) {
        lock();
        throw new Error("403");
      }
      if (!resp.ok) throw new Error(String(resp.status));
      if (session !== sessionRef.current) throw new Error("locked");
      const cipher = await readWithProgress(resp, (fraction, detail) =>
        onProgress?.({ label: "Downloading", fraction, detail })
      );
      if (session !== sessionRef.current) throw new Error("locked");
      const plain = await decryptFile(keys, cipher, (fraction) => onProgress?.({ label: "Decrypting", fraction }));
      if (session !== sessionRef.current) throw new Error("locked");
      // Only image/video types are rendered; everything else is an opaque download.
      const k = kindOf(mime);
      const safeMime = k === "file" ? "application/octet-stream" : playbackMime(mime);
      const blob = new Blob([plain], { type: safeMime });
      // HEIC/HEIF (Apple photos) only render in Safari: decode to JPEG for everyone else.
      if (isHeicMime(mime)) {
        try {
          const jpeg = await heicToJpeg(blob);
          if (session !== sessionRef.current) throw new Error("locked");
          return URL.createObjectURL(jpeg);
        } catch (e) {
          if (e instanceof Error && e.message === "locked") throw e;
          console.warn("HEIC decode failed, using original:", e);
        }
      }
      return URL.createObjectURL(blob);
    },
    [authHeaders, keys, lock]
  );

  /** Cached loader for normal (not view-once) uploads. */
  const loadImage = useCallback(
    (id: string, mime: string, onProgress?: (t: Transfer) => void): Promise<string> => {
      const cached = imageCacheRef.current.get(id);
      if (cached) return cached;
      const p = fetchDecrypted(id, mime, onProgress);
      imageCacheRef.current.set(id, p);
      p.catch(() => imageCacheRef.current.delete(id));
      return p;
    },
    [fetchDecrypted]
  );

  const triggerDownload = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = safeFileName(name);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const removeLocal = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  /**
   * Open an upload: images/videos play in the viewer modal (no download),
   * any other file is downloaded. View-once items are fetched without caching
   * and disappear from this user's chat once opened.
   */
  const openFile = useCallback(
    async (msg: UiMessage) => {
      if (!msg.file) return;
      const { kind, mime, name } = msg.file;
      const once = !!msg.oneTime;
      if (once && msg.sender === "me") return; // sender can't open their own view-once upload

      const session = sessionRef.current;
      const onProgress = (t: Transfer) => {
        if (session === sessionRef.current) setTransfer(t);
      };
      try {
        setTransfer({ label: "Downloading", fraction: null });
        const url = once ? await fetchDecrypted(msg.id, mime, onProgress) : await loadImage(msg.id, mime, onProgress);
        if (kind === "file") {
          triggerDownload(url, name);
          if (once) {
            removeLocal(msg.id);
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
          }
          return;
        }
        if (once) {
          if (oneTimeUrlRef.current) URL.revokeObjectURL(oneTimeUrlRef.current);
          oneTimeUrlRef.current = url;
        }
        setVideoFailed(false);
        setViewer({ url, kind, name, ...(once ? { oneTimeId: msg.id } : {}) });
      } catch (e) {
        const code = e instanceof Error ? e.message : "";
        if (code === "403" || code === "locked") return;
        if (once && (code === "410" || code === "404")) {
          removeLocal(msg.id);
          alert("This view-once item was already opened.");
          return;
        }
        console.error("Open file failed:", e);
        alert("Could not open the file.");
      } finally {
        if (session === sessionRef.current) setTransfer(null);
      }
    },
    [fetchDecrypted, loadImage, removeLocal]
  );

  const closeViewer = useCallback(() => {
    if (viewer?.oneTimeId) {
      removeLocal(viewer.oneTimeId);
      if (oneTimeUrlRef.current) URL.revokeObjectURL(oneTimeUrlRef.current);
      oneTimeUrlRef.current = null;
    }
    setViewer(null);
  }, [viewer, removeLocal]);

  // ---------------------------
  // Actions
  // ---------------------------
  const pushEmail = useCallback(async () => {
    if (!headers) return;
    try {
      setLoading(true);
      const url = ApiClient.buildFullUrl(import.meta.env.VITE_QUICK_CHAT_CONVERSATIONS);
      const resp = await fetch(url, { method: "PUT", headers });
      const data = await resp.json();
      if (resp.status < 300) alert("Notified.!");
      else if (resp.status === 429) alert(data?.messages?.[0] || "Chill Bae, it costs, please wait a bit to send again.");
      else alert("Failed : " + (data?.messages?.[0] || "Unknown error"));
    } catch (e) {
      console.error("Failed to send email:", e);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // ---------------------------
  // My notification email
  // ---------------------------
  const myEmailUrl = () => ApiClient.buildFullUrl(import.meta.env.VITE_QUICK_CHAT_MY_EMAIL ?? "qchat/me/email/");

  const openEmailDialog = useCallback(async () => {
    if (!headers) return;
    setEmailOpen(true);
    setEmailBusy(true);
    try {
      const resp = await fetch(myEmailUrl(), { method: "GET", headers, cache: "no-store" });
      if (resp.status === 403) {
        lock();
        return;
      }
      const data = await resp.json().catch(() => ({}));
      const current = (data?.data?.email as string | null) ?? null;
      setEmailCurrent(current);
      setEmailDraft(current ?? "");
    } catch (e) {
      console.error("Load email failed:", e);
    } finally {
      setEmailBusy(false);
    }
  }, [headers, lock]);

  const saveEmail = useCallback(
    async (value: string) => {
      if (!headers) return;
      const v = value.trim().toLowerCase();
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        alert("Enter a valid email");
        return;
      }
      setEmailBusy(true);
      try {
        const resp = await fetch(myEmailUrl(), { method: "PUT", headers, body: JSON.stringify({ email: v }) });
        if (resp.status === 403) {
          lock();
          return;
        }
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          alert(data?.messages?.[0] || "Failed to update email");
          return;
        }
        setEmailCurrent(data?.data?.email ?? null);
        setEmailOpen(false);
      } catch (e) {
        console.error("Save email failed:", e);
        alert("Failed to update email");
      } finally {
        setEmailBusy(false);
      }
    },
    [headers, lock]
  );

  // Delete ALL messages (and all their files, server side)
  const deleteMsgs = useCallback(async () => {
    if (!headers) return;
    if (!confirm("Delete all messages and files?")) return;

    try {
      setLoading(true);
      const url = ApiClient.buildFullUrl(import.meta.env.VITE_QUICK_CHAT_CONVERSATIONS);
      const resp = await fetch(url, { method: "DELETE", headers });
      const data = await resp.json().catch(() => ({}));

      if (resp.status === 403) {
        console.log("Error while deleting messages : " + data?.detail);
        lock();
        return;
      }

      if (!resp.ok) {
        console.error("Delete all failed:", resp.status, data);
        alert(data?.detail || "Failed to delete messages");
        return;
      }

      forgetAllImages();
      setMessages([]);
      lastIdRef.current = 0;
    } catch (e) {
      console.error("Failed to delete messages:", e);
      alert("Failed to delete messages");
    } finally {
      setLoading(false);
    }
  }, [headers, lock, forgetAllImages]);

  // Reply: remember which message we're answering and focus the input.
  const handleMessageReply = useCallback((msg: UiMessage) => {
    setReplyingTo(msg);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  // Tap a quoted message -> scroll to the original and flash it.
  const jumpToMessage = useCallback((id: string) => {
    const el = document.getElementById(`qmsg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightId(null), 1600);
  }, []);

  useEffect(() => () => {
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
  }, []);

  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  // Delete single message by id (server also deletes its file)
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
          lock();
          return;
        }

        if (!resp.ok) {
          console.error("Delete failed:", resp.status, data);
          alert(data?.detail || "Failed to delete message");
          return;
        }

        forgetImage(id);
        setMessages((prev) => prev.filter((m) => m.id !== id));
      } catch (e) {
        console.error("Failed to delete message:", e);
        alert("Failed to delete message");
      } finally {
        setLoading(false);
      }
    },
    [headers, lock, forgetImage]
  );

  // Encrypt the file in the browser, then upload only the ciphertext. Returns true on success.
  // Uses XMLHttpRequest (not fetch) because only XHR reports upload progress.
  const uploadFile = useCallback(
    async (file: File, oneTime: boolean, replyId?: string): Promise<boolean> => {
      if (!authHeaders || !keys) return false;
      const session = sessionRef.current;
      const abort = new AbortController();
      transferAbortRef.current = abort;
      const cancel = () => abort.abort();
      const show = (t: Transfer) => {
        if (session === sessionRef.current && !abort.signal.aborted) setTransfer({ ...t, cancel });
      };

      try {
        show({ label: "Encrypting", fraction: 0 });
        const cipher = await encryptFile(keys, file, (f) => show({ label: "Encrypting", fraction: f }), abort.signal);
        const meta = await encryptMessage(
        keys,
        JSON.stringify({
          t: "file",
          mime: file.type || "application/octet-stream",
          name: file.name,
          size: file.size,
          ...(replyId ? { reply: replyId } : {}),
        })
      );

        // Text fields first so the server sees sender/message before the big file part.
        const form = new FormData();
        form.append("sender", sender ?? "");
        form.append("message", meta);
        if (oneTime) form.append("one_time", "true");
        form.append("file", cipher, "blob");

        const url = ApiClient.buildFullUrl(import.meta.env.VITE_QUICK_CHAT_CONVERSATIONS_FILES ?? "qchat/files/");
        show({ label: "Uploading", fraction: 0, detail: `0 / ${formatSize(cipher.size)}` });
        const { status, data } = await xhrUpload(url, authHeaders, form, abort.signal, (loaded, total) =>
          show({ label: "Uploading", fraction: total ? loaded / total : null, detail: `${formatSize(loaded)} / ${formatSize(total)}` })
        );
        if (session !== sessionRef.current) return false;

        if (status === 403) {
          lock();
          return false;
        }
        if (status === 413) {
          alert(`File is too large (max ${MAX_FILE_LABEL}).`);
          return false;
        }
        if (status < 200 || status >= 300) {
          alert("Failed to send file: " + (data?.messages?.[0] || status || "network error"));
          return false;
        }
        const apiMsg = data?.data as ApiMsg;
        if (apiMsg?.id) await ingest([apiMsg]);
        return true;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return false; // cancelled / locked
        throw e;
      } finally {
        if (transferAbortRef.current === abort) transferAbortRef.current = null;
        if (session === sessionRef.current) setTransfer(null);
      }
    },
    [authHeaders, keys, sender, ingest, lock]
  );

  const handleSend = useCallback(async () => {
    if (!headers || !keys) {
      setCodePromptOpen(true);
      return;
    }

    const trimmed = inputValue.trim();
    if (!trimmed && !pending) return;

    try {
      setLoading(true);

      // Attachment first (carries the reply link), then the text as its own message.
      if (pending) {
        const ok = await uploadFile(pending.file, pending.oneTime, replyingTo?.id);
        if (!ok) return;
        setPending(null);
        if (!trimmed) {
          setReplyingTo(null);
          return;
        }
      }

      const url = ApiClient.buildFullUrl(import.meta.env.VITE_QUICK_CHAT_CONVERSATIONS);
      const replyId = pending ? undefined : replyingTo?.id;
      const envelope: TextEnvelope = { v: 1, text: trimmed, ...(replyId ? { reply: replyId } : {}) };

      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sender,
          message: await encryptMessage(keys, JSON.stringify(envelope)),
        }),
      });

      const data = await resp.json().catch(() => ({}));

      if (resp.status === 403) {
        console.log("Error While handling Send: " + data?.detail);
        lock();
        return;
      }

      if (!resp.ok) {
        console.error("Send failed:", resp.status, data);
        alert(data?.detail || "Failed to send message");
        return;
      }

      const apiMsg = data?.data as ApiMsg;
      if (apiMsg?.id) await ingest([apiMsg]);

      setInputValue("");
      setReplyingTo(null);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch (e) {
      console.error("Failed to send message:", e);
      alert("Failed to send message");
    } finally {
      setLoading(false);
    }
  }, [headers, keys, inputValue, sender, ingest, lock, replyingTo, pending, uploadFile]);

  // Pick a file: it waits in the composer (with the "View once" toggle) until Send.
  const handleFileSelected = useCallback(async (picked: File | undefined) => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!picked) return;
    if (!authHeaders || !keys) {
      setCodePromptOpen(true);
      return;
    }
    // Browsers often give an empty/generic type (HEIC, MKV, AVI, 3GP...): fill it in from the extension.
    const mime = resolveMime(picked.type, picked.name);
    let file = mime === picked.type ? picked : new File([picked], picked.name, { type: mime, lastModified: picked.lastModified });
    // Apple HEIC/HEIF photos: convert to JPEG so every browser can preview them.
    if (await isHeicFile(file)) {
      try {
        setLoading(true);
        file = await heicFileToJpeg(file);
      } catch (e) {
        console.warn("HEIC to JPEG conversion failed, sending original:", e);
        // Keep it tagged as an image so recipients still try to decode it on display.
        if (!isHeicMime(picked.type)) {
          file = new File([picked], picked.name, { type: "image/heic", lastModified: picked.lastModified });
        }
      } finally {
        setLoading(false);
      }
    }
    if (file.size > MAX_FILE_BYTES) {
      alert(`File is too large (max ${MAX_FILE_LABEL}).`);
      return;
    }
    setPending({ file, oneTime: false });
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [authHeaders, keys]);

  // ---------------------------
  // Code prompt confirm (no persistence)
  // ---------------------------
  const confirmCode = useCallback(async (value?: string) => {
    const v = (value ?? codeDraft).trim();
    if (!/^[0-9]{4}$/.test(v) || !name || unlocking) return; // chat code is exactly 4 digits
    setUnlocking(true);
    try {
      const session = sessionRef.current;
      const derived = await deriveKeys(v, name);
      if (session !== sessionRef.current) return;
      setKeys(derived);
      setCodeDraft("");
      setCodePromptOpen(false);
    } catch (e) {
      console.error("Unlock failed:", e);
      alert("Could not unlock: " + (e instanceof Error ? e.message : "unknown error"));
    } finally {
      setUnlocking(false);
    }
  }, [codeDraft, name, unlocking]);

  // Close the viewer with Escape
  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeViewer();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer, closeViewer]);

  // ---------------------------
  // Input keyboard behavior
  // ---------------------------
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape" && replyingTo) {
      setReplyingTo(null);
      return;
    }
    if (e.key !== "Enter") return;

    if (isMobile) return; // mobile: newline
    if (e.shiftKey) return; // desktop: newline

    e.preventDefault();
    handleSend();
  };

  const formatName = (str?: string) => {
    if (!str) return "Chat";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  return (
    <div className="h-dvh bg-muted/30 flex flex-col overflow-hidden">
      {/* Loading overlay */}
      <AnimatePresence>
        {(loading || transfer) && (
          <motion.div
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {transfer ? (
              <div className="w-full max-w-xs rounded-2xl bg-background p-4 shadow-xl" role="progressbar"
                aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={transfer.fraction == null ? undefined : Math.round(transfer.fraction * 100)}>
                <div className="flex items-center justify-between gap-2 text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> {transfer.label}…
                  </span>
                  {transfer.fraction != null && <span className="tabular-nums">{Math.round(transfer.fraction * 100)}%</span>}
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full bg-primary transition-[width] duration-150 ${transfer.fraction == null ? "w-1/3 animate-pulse" : ""}`}
                    style={transfer.fraction == null ? undefined : { width: `${Math.max(2, transfer.fraction * 100)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="tabular-nums truncate">{transfer.detail ?? "End-to-end encrypted"}</span>
                  {transfer.cancel && (
                    <button type="button" onClick={transfer.cancel} className="shrink-0 font-medium text-foreground hover:underline">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen media viewer (images + videos). No download option on purpose. */}
      <AnimatePresence>
        {viewer && (
          <motion.div
            className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/90 p-2 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeViewer}
            onContextMenu={(e) => e.preventDefault()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="absolute top-3 right-3 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              onClick={closeViewer}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            {viewer.oneTimeId && (
              <span className="absolute top-4 left-4 z-10 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
                <Eye className="w-3.5 h-3.5" /> View once · disappears when closed
              </span>
            )}
            {videoFailed ? (
              <div className="flex flex-col items-center gap-3 text-center px-6" onClick={(e) => e.stopPropagation()}>
                <p className="text-white/80 text-sm">
                  This {viewer.kind === "image" ? "image" : "video"} format can't be shown in this browser.
                </p>
                {!viewer.oneTimeId && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => triggerDownload(viewer.url, viewer.name)}>
                    <Download className="w-4 h-4 mr-1.5" /> Download to open it
                  </Button>
                )}
              </div>
            ) : viewer.kind === "image" ? (
              <motion.img
                src={viewer.url}
                alt=""
                className="max-w-full max-h-full object-contain rounded-lg select-none"
                initial={{ scale: 0.96 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.98 }}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
                onError={() => setVideoFailed(true)}
                draggable={false}
              />
            ) : (
              <video
                src={viewer.url}
                className="max-w-full max-h-full rounded-lg bg-black"
                controls
                autoPlay
                playsInline
                disablePictureInPicture
                controlsList="nodownload noremoteplayback noplaybackrate"
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
                onError={() => setVideoFailed(true)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* My notification email */}
      <AnimatePresence>
        {emailOpen && (
          <motion.div
            className="fixed inset-0 z-[9996] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !emailBusy && setEmailOpen(false)}
          >
            <motion.form
              className="w-full max-w-sm rounded-2xl bg-background border shadow-xl p-4 space-y-3"
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                saveEmail(emailDraft);
              }}
            >
              <div className="space-y-1">
                <h2 className="text-base font-semibold">Set Notification Email</h2>
              </div>
              <input
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setEmailOpen(false)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={emailBusy}
                autoFocus
                className="w-full h-11 px-3 rounded-xl bg-muted/40 border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex gap-2 justify-end">
                {emailCurrent && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mr-auto text-destructive hover:text-destructive"
                    disabled={emailBusy}
                    onClick={() => confirm("Stop sending notifications to " + emailCurrent + "?") && saveEmail("")}
                  >
                    Remove
                  </Button>
                )}
                <Button type="button" variant="ghost" disabled={emailBusy} onClick={() => setEmailOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={emailBusy || !emailDraft.trim() || emailDraft.trim().toLowerCase() === emailCurrent}
                >
                  {emailBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </motion.form>
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
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={unlocking}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setCodeDraft(v);
                    if (v.length === 4) confirmCode(v); // unlock as soon as the 4th digit is typed
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmCode();
                    if (e.key === "Escape") navigate(-1);
                  }}
                  placeholder="••••"
                  className="w-full h-12 px-3 rounded-xl bg-muted/40 border text-center text-xl tracking-[0.6em] font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                />

                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => navigate(-1)}>
                    Cancel
                  </Button>
                  <Button onClick={() => confirmCode()} disabled={codeDraft.length !== 4 || unlocking}>
                    {unlocking ? "Unlocking..." : "Continue"}
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
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-lg font-semibold text-foreground truncate">{formatName(name)}</h1>
              {keys && (
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    link === "live" ? "bg-emerald-500" : link === "polling" ? "bg-sky-500" : "bg-amber-500 animate-pulse"
                  }`}
                  title={link === "live" ? "Live" : link === "polling" ? "Connected (backup mode)" : "Reconnecting..."}
                />
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={openEmailDialog}
                disabled={!headers}
                title="My notification email"
              >
                <Mail className="w-4 h-4" />
              </Button>

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
              {messages.map((message) => {
                const quotedMsg = message.replyTo ? messagesById.get(message.replyTo) : undefined;
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    quoted={
                      message.replyTo
                        ? quotedMsg
                          ? {
                              id: quotedMsg.id,
                              senderName: quotedMsg.sender === "me" ? "You" : quotedMsg.senderName,
                              preview: previewOf(quotedMsg),
                            }
                          : { id: message.replyTo, senderName: "", preview: "Message deleted", missing: true }
                        : undefined
                    }
                    highlighted={highlightId === message.id}
                    onDelete={handleMessageDelete}
                    onReply={handleMessageReply}
                    onJump={jumpToMessage}
                    loadImage={loadImage}
                    onOpenFile={openFile}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </main>

        {/* Input */}
        <footer className="shrink-0 border-t bg-background md:rounded-b-xl">
          <AnimatePresence initial={false}>
            {replyingTo && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 px-3 pt-3">
                  <button
                    type="button"
                    onClick={() => jumpToMessage(replyingTo.id)}
                    className="flex-1 min-w-0 text-left border-l-4 border-primary bg-muted/60 rounded-r-lg px-3 py-1.5"
                    title="Go to message"
                  >
                    <span className="block text-xs font-semibold text-primary">
                      Replying to {replyingTo.sender === "me" ? "yourself" : replyingTo.senderName}
                    </span>
                    <span className="block text-xs text-muted-foreground truncate">{previewOf(replyingTo)}</span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    title="Cancel reply"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {pending && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 px-3 pt-3">
                  <div className="flex-1 min-w-0 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5">
                    <FileKindIcon kind={kindOf(pending.file.type)} className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <span className="text-xs truncate">{pending.file.name}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{formatSize(pending.file.size)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPending((p) => (p ? { ...p, oneTime: !p.oneTime } : p))}
                    aria-pressed={pending.oneTime}
                    title={pending.oneTime ? "View once: ON (each person can open it once)" : "View once: OFF"}
                    className={`shrink-0 flex items-center gap-1 h-8 px-2.5 rounded-full border text-xs font-medium transition-colors ${pending.oneTime
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <Eye className="w-3.5 h-3.5" /> View once
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    type="button"
                    onClick={() => setPending(null)}
                    title="Remove attachment"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="p-3">
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!headers}
                title="Attach photo, video or file"
              >
                <Paperclip className="w-5 h-5" />
              </Button>

              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={pending ? "Add a message (optional)..." : "Type a message..."}
                  rows={1}
                  className="w-full min-h-[44px] max-h-[150px] pr-14 pl-4 py-3 rounded-2xl bg-muted/50 border-0 resize-none text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />

                <Button
                  onClick={handleSend}
                  disabled={(!inputValue.trim() && !pending) || !headers}
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

// Encrypted image thumbnail: downloads + decrypts on demand, click to open full screen.
const ImageThumb = ({
  id,
  mime,
  loadImage,
  onOpen,
}: {
  id: string;
  mime: string;
  loadImage: (id: string, mime: string) => Promise<string>;
  onOpen: () => void;
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [undecodable, setUndecodable] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setUndecodable(false);
    loadImage(id, mime)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [id, mime, loadImage]);

  if (failed) return <p className="text-sm italic opacity-70 px-2.5 py-1">&lt;Image unavailable&gt;</p>;
  if (undecodable)
    return (
      <button type="button" onClick={onOpen} className="flex items-center gap-2 px-2.5 py-2 text-sm text-left" title="Open">
        <ImageIcon className="w-5 h-5 shrink-0 opacity-70" />
        <span className="opacity-80">Preview not supported · tap to open</span>
      </button>
    );
  if (!url)
    return (
      <div className="h-40 w-56 max-w-full rounded-lg bg-black/10 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin opacity-60" />
      </div>
    );
  return (
    <button type="button" onClick={onOpen} className="block" title="Open image">
      <img
        src={url}
        alt=""
        className="max-h-64 max-w-full rounded-lg object-cover cursor-zoom-in"
        onError={() => setUndecodable(true)}
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
      />
    </button>
  );
};

const FileKindIcon = ({ kind, className }: { kind: FileKind; className?: string }) =>
  kind === "image" ? <ImageIcon className={className} /> : kind === "video" ? <Video className={className} /> : <FileText className={className} />;

/** Tile for videos, other files and every view-once upload. */
const FileTile = ({ message, isMe, onOpen }: { message: UiMessage; isMe: boolean; onOpen: () => void }) => {
  const file = message.file!;
  const once = !!message.oneTime;
  const opened = message.openedBy ?? [];
  // The sender can't open their own view-once upload.
  const clickable = !(once && isMe);

  let title: string;
  let subtitle: string;
  let icon: JSX.Element;
  let action: JSX.Element | null;
  if (once) {
    title = `View once ${kindLabel(file.kind)}`;
    subtitle = isMe ? (opened.length ? `Opened by ${opened.join(", ")}` : "Not opened yet") : "Tap to open · can be opened once";
    icon = <Eye className="w-5 h-5" />;
    action = null;
  } else if (file.kind === "image") {
    title = file.name;
    subtitle = ["Photo", formatSize(file.size)].filter(Boolean).join(" · ");
    icon = <ImageIcon className="w-5 h-5" />;
    action = null;
  } else if (file.kind === "video") {
    title = file.name;
    subtitle = ["Video", formatSize(file.size)].filter(Boolean).join(" · ");
    icon = <Play className="w-5 h-5" />;
    action = null;
  } else {
    title = file.name;
    subtitle = formatSize(file.size) || "File";
    icon = <FileText className="w-5 h-5" />;
    action = <Download className="w-4 h-4 shrink-0 opacity-70" />;
  }

  return (
    <button
      type="button"
      onClick={clickable ? onOpen : undefined}
      disabled={!clickable}
      title={clickable ? (file.kind === "file" ? "Download" : "Open") : undefined}
      className={`flex items-center gap-3 w-64 max-w-full text-left rounded-xl px-3 py-2.5 ${isMe ? "bg-primary-foreground/15" : "bg-background/70"
        } ${clickable ? "hover:opacity-90 cursor-pointer" : "cursor-default"}`}
    >
      <span
        className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${isMe ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"
          }`}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium truncate">{title}</span>
        <span className={`block text-[11px] truncate ${isMe ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
          {subtitle}
        </span>
      </span>
      {action}
    </button>
  );
};

// Bubble
interface QuotedInfo {
  id: string;
  senderName: string;
  preview: string;
  missing?: boolean; // original was deleted
}

interface MessageBubbleProps {
  message: UiMessage;
  quoted?: QuotedInfo;
  highlighted: boolean;
  onDelete: (id: string) => void;
  onReply: (msg: UiMessage) => void;
  onJump: (id: string) => void;
  loadImage: (id: string, mime: string) => Promise<string>;
  onOpenFile: (msg: UiMessage) => void;
}

const MessageBubble = ({
  message,
  quoted,
  highlighted,
  onDelete,
  onReply,
  onJump,
  loadImage,
  onOpenFile,
}: MessageBubbleProps) => {
  const isMe = message.sender === "me";
  const hasFile = !!message.file;
  // Normal images show inline; videos, other files and view-once items use a tile.
  // Big images are not auto-downloaded for everyone: they get a tile and load on tap.
  const inlineImage =
    message.file?.kind === "image" && !message.oneTime && (message.file.size ?? 0) <= MAX_INLINE_IMAGE_BYTES;

  // ---- Touch gestures: swipe toward the centre to reply, long-press for a menu ----
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const touchRef = useRef<{ x: number; y: number; axis: "x" | "y" | null } | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  useEffect(() => clearLongPress, []);

  const buzz = () => {
    try { navigator.vibrate?.(15); } catch { /* not supported */ }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, axis: null };
    longPressFired.current = false;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      longPressFired.current = true;
      touchRef.current = null;
      setDragX(0);
      buzz();
      setMenuOpen(true);
    }, 500);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const s = touchRef.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearLongPress();
    if (!s.axis) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        s.axis = "x";
        setDragging(true);
      } else if (Math.abs(dy) > 10) {
        s.axis = "y";
      }
    }
    if (s.axis !== "x") return;
    // My messages sit on the right -> swipe left; theirs sit on the left -> swipe right.
    const offset = isMe ? Math.max(-SWIPE_MAX, Math.min(0, dx)) : Math.min(SWIPE_MAX, Math.max(0, dx));
    setDragX((prev) => {
      if (Math.abs(prev) < SWIPE_TRIGGER && Math.abs(offset) >= SWIPE_TRIGGER) buzz();
      return offset;
    });
  };

  const onTouchEnd = () => {
    clearLongPress();
    if (touchRef.current?.axis === "x" && Math.abs(dragX) >= SWIPE_TRIGGER) onReply(message);
    touchRef.current = null;
    setDragging(false);
    setDragX(0);
  };

  // Swallow the click that follows a long-press (e.g. so an image doesn't open).
  const onClickCapture = (e: React.MouseEvent) => {
    if (longPressFired.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressFired.current = false;
    }
  };

  const swipeProgress = Math.min(1, Math.abs(dragX) / SWIPE_TRIGGER);

  return (
    <motion.div
      id={`qmsg-${message.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`relative flex ${isMe ? "justify-end" : "justify-start"} group scroll-mt-4`}
    >
      {/* Reply icon revealed behind the bubble while swiping */}
      {dragX !== 0 && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 ${isMe ? "right-1" : "left-1"} flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground pointer-events-none`}
          style={{ opacity: swipeProgress, transform: `translateY(-50%) scale(${0.6 + 0.4 * swipeProgress})` }}
        >
          <Reply className="w-4 h-4" />
        </div>
      )}

      <div
        className="relative max-w-[80%] sm:max-w-[70%] [@media(hover:none)]:select-none [@media(hover:none)]:[-webkit-touch-callout:none]"
        style={{
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          transition: dragging ? "none" : "transform 200ms ease-out",
          touchAction: "pan-y",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClickCapture={onClickCapture}
        onContextMenu={(e) => {
          // Touch long-press is handled above; keep the native menu from popping up.
          if (window.matchMedia("(hover: none)").matches) e.preventDefault();
        }}
      >
        <div
          className={`${inlineImage ? "p-1.5" : hasFile ? "p-2" : "px-4 py-2.5"} rounded-2xl transition-shadow duration-300 ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"
            } ${highlighted ? "ring-4 ring-amber-400/80 shadow-lg" : ""}`}
        >
          {quoted && (
            <button
              type="button"
              disabled={quoted.missing}
              onClick={() => onJump(quoted.id)}
              title={quoted.missing ? undefined : "Go to message"}
              className={`block w-full text-left mb-1.5 rounded-lg border-l-4 px-2.5 py-1.5 ${hasFile ? "mx-0.5 mt-0.5 w-[calc(100%-4px)]" : ""} ${isMe
                ? "bg-primary-foreground/15 border-primary-foreground/60"
                : "bg-background/70 border-primary"
                } ${quoted.missing ? "cursor-default opacity-70" : "cursor-pointer hover:opacity-90"}`}
            >
              {!quoted.missing && (
                <span className={`block text-[11px] font-semibold ${isMe ? "text-primary-foreground" : "text-primary"}`}>
                  {quoted.senderName}
                </span>
              )}
              <span className={`block text-xs line-clamp-2 break-words ${quoted.missing ? "italic" : ""} ${isMe ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {quoted.preview}
              </span>
            </button>
          )}

          {inlineImage ? (
            <ImageThumb id={message.id} mime={message.file!.mime} loadImage={loadImage} onOpen={() => onOpenFile(message)} />
          ) : hasFile ? (
            <FileTile message={message} isMe={isMe} onOpen={() => onOpenFile(message)} />
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}

          <span
            title={formatFull(message.timestamp)}
            className={`text-[10px] mt-1 block ${hasFile ? "px-2 pb-0.5" : ""} ${isMe ? "text-primary-foreground/70 text-right" : "text-muted-foreground"
              }`}
          >
            {message.senderName} · {formatStamp(message.timestamp)}
          </span>
        </div>

        {/* Actions: on hover (desktop). Touch screens use swipe-to-reply / long-press instead. */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 [@media(hover:none)]:hidden transition-opacity ${isMe ? "-left-16" : "-right-16"
            }`}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            type="button"
            title="Reply"
            onClick={() => onReply(message)}
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
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Long-press action sheet (touch screens) */}
      {menuOpen && (
        <MessageActionSheet
          canDelete={isMe}
          canCopy={!hasFile && !!message.content}
          onClose={() => setMenuOpen(false)}
          onReply={() => {
            setMenuOpen(false);
            onReply(message);
          }}
          onCopy={() => {
            setMenuOpen(false);
            navigator.clipboard?.writeText(message.content).catch(() => { /* ignore */ });
          }}
          onDelete={() => {
            setMenuOpen(false);
            onDelete(message.id);
          }}
        />
      )}
    </motion.div>
  );
};

const SWIPE_TRIGGER = 60; // px of horizontal travel that triggers a reply
const SWIPE_MAX = 80; // the bubble won't travel further than this

interface MessageActionSheetProps {
  canDelete: boolean;
  canCopy: boolean;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

const MessageActionSheet = ({ canDelete, canCopy, onClose, onReply, onCopy, onDelete }: MessageActionSheetProps) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const item = "flex w-full items-center gap-3 px-5 py-3.5 text-sm text-left active:bg-muted";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose} onContextMenu={(e) => e.preventDefault()}>
      <div className="absolute inset-0 bg-black/40" />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "tween", duration: 0.18 }}
        className="relative w-full max-w-md rounded-t-2xl bg-background border-t shadow-xl pb-[env(safe-area-inset-bottom)] select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-muted" />
        <button type="button" className={item} onClick={onReply}>
          <Reply className="w-4 h-4" /> Reply
        </button>
        {canCopy && (
          <button type="button" className={item} onClick={onCopy}>
            <Copy className="w-4 h-4" /> Copy
          </button>
        )}
        {canDelete && (
          <button type="button" className={`${item} text-destructive`} onClick={onDelete}>
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        )}
        <button type="button" className={`${item} justify-center border-t text-muted-foreground`} onClick={onClose}>
          Cancel
        </button>
      </motion.div>
    </div>,
    document.body
  );
};

export default QChatV3;
