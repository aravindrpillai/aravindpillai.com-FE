import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Check, ChevronDown, CloudOff, Copy, Eraser, KeyRound, Loader2, Lock, LockOpen, LogOut,
  RefreshCw, ShieldCheck, TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  decryptContent, deriveBoxKeys, derivePinKeys, encryptContent, normalizeCode, type BoxKeys, type PinKeys,
} from "@/lib/textboxCrypto";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import LockDialog, { type LockMode, type LockSubmit } from "./LockDialog";
import PinInput from "./PinInput";
import { imageFilesFrom, imageToDataUrl } from "./images";

// ----- Protocol (see aravindrpillai.com-BE/textbox/consumers.py) -----
type ServerMsg =
  | { type: "content"; content: string | null; version: number; locked: boolean; remote?: boolean }
  | { type: "conflict"; content: string | null; version: number; locked: boolean }
  | { type: "locked"; retry_after: number; blocked?: boolean }
  | { type: "pin_failed"; remaining: number; retry_after: number; blocked?: boolean }
  | { type: "saved"; version: number }
  | { type: "lock_updated"; locked: boolean; version: number }
  | { type: "error"; code: string; detail: string }
  | { type: "pong" };

type Phase = "deriving" | "connecting" | "locked" | "ready" | "error";
type SaveState = "saved" | "dirty" | "saving" | "error";

const AUTOSAVE_MS = 700;
const WS_PING_MS = 25_000;
const WS_MAX_RETRY_MS = 30_000;
const RELOCK_AFTER_HIDDEN_MS = 5 * 60_000; // locked boxes ask for the PIN again after 5 min in background
const MAX_CONTENT_CHARS = 10 * 1024 * 1024; // must match TEXTBOX_MAX_CONTENT_CHARS on the server

/** wss://<api host>/ws/textbox/ (override with VITE_TEXTBOX_WS_URL if needed). */
function buildWsUrl() {
  const override = import.meta.env.VITE_TEXTBOX_WS_URL;
  if (override) return override;
  const api = new URL(import.meta.env.VITE_API_BASE_URL, window.location.href);
  return `${api.protocol === "https:" ? "wss:" : "ws:"}//${api.host}/ws/textbox/`;
}

const formatWait = (s: number) => (s >= 90 ? `${Math.ceil(s / 60)} min` : `${s}s`);

const BLOCKED_TEXT =
  "Too many wrong PIN attempts, so this textbox is locked. Ask the admin to remove the PIN (this clears the note).";

const pinFailureText = (m: { remaining: number; retry_after: number; blocked?: boolean }) =>
  m.blocked
    ? BLOCKED_TEXT
    : m.retry_after > 0
      ? `Too many wrong attempts. Try again in ${formatWait(m.retry_after)}.`
      : `Incorrect PIN. ${m.remaining} attempt${m.remaining === 1 ? "" : "s"} left before the textbox is locked.`;

export default function TextboxSession({ code }: { code: string }) {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("deriving");
  const [fatal, setFatal] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [conflict, setConflict] = useState<{ html: string; version: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [session, setSession] = useState(0); // bump to drop keys and reconnect ("Lock now")

  // Unlock screen
  const [pin, setPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [blocked, setBlocked] = useState(false); // too many wrong PINs: only an admin can clear it
  const [now, setNow] = useState(Date.now());

  // Lock dialog
  const [lockMode, setLockMode] = useState<LockMode | null>(null);
  const [lockBusy, setLockBusy] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const boxRef = useRef<BoxKeys | null>(null);
  const codeRef = useRef(""); // normalized code that boxRef was derived from
  const pinRef = useRef<PinKeys | null>(null); // proven PIN keys (memory only, never stored)
  const pendingPinRef = useRef<PinKeys | null>(null); // PIN being tried on the unlock screen
  const pendingLockRef = useRef<{ mode: LockMode; pin: PinKeys | null; html: string } | null>(null);
  const conflictRef = useRef(false);
  const phaseRef = useRef<Phase>("deriving");
  const versionRef = useRef(0);
  const lockedRef = useRef(false);
  const lastSavedRef = useRef("");
  const sentHtmlRef = useRef<string | null>(null); // html of the save in flight
  const dirtyRef = useRef(false);
  const stashRef = useRef<string | null>(null); // unsaved edits kept while the box is re-locked
  const autoUnlockRef = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const hiddenAt = useRef<number | null>(null);

  phaseRef.current = phase;
  conflictRef.current = conflict !== null;

  // ---------------------------------------------------------------- helpers

  const currentKey = () => (lockedRef.current ? pinRef.current?.lockKey : boxRef.current?.openKey) ?? null;
  const editorHtml = () => sanitizeHtml(editorRef.current?.innerHTML ?? "");
  const send = (msg: object) => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  };

  const updateEmpty = () => {
    const el = editorRef.current;
    setIsEmpty(!el || (!el.textContent?.trim() && !el.querySelector("img")));
  };

  const render = (html: string) => {
    if (editorRef.current) editorRef.current.innerHTML = sanitizeHtml(html);
    updateEmpty();
  };

  /** A lock/PIN operation failed: show why and make sure unsaved edits still get saved. */
  const abortLock = (text: string) => {
    pendingLockRef.current = null;
    setLockBusy(false);
    setLockError(text);
    if (editorHtml() !== lastSavedRef.current) {
      dirtyRef.current = true;
      setSaveState("dirty");
    }
  };

  const markSaved = (html: string, version: number) => {
    versionRef.current = version;
    lastSavedRef.current = html;
    dirtyRef.current = false;
    setSaveState("saved");
  };

  const wipeEditor = () => {
    if (editorRef.current) editorRef.current.innerHTML = "";
    setIsEmpty(true);
  };

  // ---------------------------------------------------------------- saving

  const flushSave = useCallback(async () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (sentHtmlRef.current !== null || pendingLockRef.current || conflictRef.current || !dirtyRef.current) return;
    if (!boxRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
    const key = currentKey();
    if (!key) return;

    const html = editorHtml();
    if (html === lastSavedRef.current) {
      dirtyRef.current = false;
      setSaveState("saved");
      return;
    }
    sentHtmlRef.current = html;
    dirtyRef.current = false;
    setSaveState("saving");
    try {
      const content = await encryptContent(key, boxRef.current.boxId, lockedRef.current, html);
      if (content.length > MAX_CONTENT_CHARS) throw new Error("too_large");
      if (!send({ type: "save", content, base_version: versionRef.current })) throw new Error("offline");
    } catch (e) {
      sentHtmlRef.current = null;
      dirtyRef.current = true;
      setSaveState("error");
      if ((e as Error).message === "too_large") {
        toast.error("Too large to save", { description: "Remove some images and try again." });
      }
    }
  }, []);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setSaveState("dirty");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flushSave, AUTOSAVE_MS);
  }, [flushSave]);

  /** Apply box content coming from the server without clobbering unsaved local edits. */
  const receiveContent = (html: string, version: number, remote: boolean) => {
    if (stashRef.current !== null) {
      // Edits made before the box was re-locked: put them back and let the user decide.
      const mine = stashRef.current;
      stashRef.current = null;
      render(mine);
      if (mine !== html) {
        dirtyRef.current = true;
        setSaveState("dirty");
        conflictRef.current = true;
        setConflict({ html, version });
        return;
      }
    }
    const mine = editorHtml();
    if (mine === html) {
      markSaved(html, version);
      if (sentHtmlRef.current === html) sentHtmlRef.current = null;
      return;
    }
    const busy = dirtyRef.current || sentHtmlRef.current !== null;
    if (!busy) {
      render(html);
      markSaved(html, version);
      return;
    }
    if (!remote && version === versionRef.current) {
      // Reconnected and nothing changed on the server: just send our edits.
      void flushSave();
      return;
    }
    conflictRef.current = true;
    setConflict({ html, version });
  };

  // ---------------------------------------------------------------- key derivation

  useEffect(() => {
    let cancelled = false;
    setPhase("deriving");
    deriveBoxKeys(code)
      .then((keys) => {
        if (cancelled) return;
        boxRef.current = keys;
        codeRef.current = normalizeCode(code);
        setPhase("connecting");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setFatal(e.message || "Couldn't set up encryption in this browser.");
        setPhase("error");
      });
    return () => {
      cancelled = true;
      boxRef.current = null;
      pinRef.current = null;
    };
  }, [code]);

  // ---------------------------------------------------------------- WebSocket

  const keysReady = phase !== "deriving" && phase !== "error";

  useEffect(() => {
    if (!keysReady || !boxRef.current) return;
    const box = boxRef.current;
    let ws: WebSocket | null = null;
    let stopped = false;
    let retry = 0;
    let retryTimer: number | null = null;
    let pingTimer: number | null = null;
    let queue: Promise<void> = Promise.resolve();

    const clearTimers = () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (pingTimer !== null) window.clearInterval(pingTimer);
      retryTimer = pingTimer = null;
    };

    const decrypt = async (payload: string | null, locked: boolean, key: CryptoKey | null | undefined) => {
      if (!payload) return "";
      if (!key) throw new Error("no key");
      return decryptContent(key, box.boxId, locked, payload);
    };

    const handle = async (msg: ServerMsg) => {
      switch (msg.type) {
        case "content":
        case "conflict": {
          if (msg.type === "conflict") sentHtmlRef.current = null;
          // Unlock attempt in progress: this content proves the PIN.
          const candidate = msg.locked ? pendingPinRef.current ?? pinRef.current : null;
          let html: string;
          try {
            html = await decrypt(msg.content, msg.locked, msg.locked ? candidate?.lockKey : box.openKey);
          } catch {
            pendingPinRef.current = null;
            setPinBusy(false);
            setFatal("This textbox couldn't be decrypted. It may have been tampered with.");
            setPhase("error");
            return;
          }
          if (msg.locked) pinRef.current = candidate;
          else pinRef.current = null;
          pendingPinRef.current = null;
          lockedRef.current = msg.locked;
          setIsLocked(msg.locked);
          setPin("");
          setPinBusy(false);
          setPinError(null);
          setBlocked(false);
          setPhase("ready");
          autoUnlockRef.current = false;
          if (msg.type === "conflict" && pendingLockRef.current) {
            abortLock("The textbox changed on another device. Review it and try again.");
          }
          receiveContent(html, msg.version, msg.type === "conflict" || !!msg.remote);
          break;
        }

        case "locked": {
          const wasReady = phaseRef.current === "ready";
          // Our unsaved edits survive the re-lock in memory only, never on screen.
          if (dirtyRef.current || sentHtmlRef.current !== null) stashRef.current = editorHtml();
          sentHtmlRef.current = null;
          wipeEditor();
          setConflict(null);
          lockedRef.current = true;
          setIsLocked(true);
          setRetryAt(msg.retry_after ? Date.now() + msg.retry_after * 1000 : 0);
          setBlocked(!!msg.blocked);
          // After a reconnect, silently retry the PIN we already proved (once).
          if (pinRef.current && autoUnlockRef.current && !msg.blocked) {
            autoUnlockRef.current = false;
            pendingPinRef.current = pinRef.current;
            send({ type: "unlock", pin: pinRef.current.pinToken });
            return;
          }
          if (pinRef.current && wasReady) {
            toast.info("The PIN was changed on another device", { description: "Enter the new PIN to continue." });
          }
          pinRef.current = null;
          pendingLockRef.current = null;
          setLockMode(null);
          setPinBusy(false);
          setPhase("locked");
          break;
        }

        case "pin_failed": {
          const text = pinFailureText(msg);
          if (pendingLockRef.current) {
            abortLock(text);
            return;
          }
          const wasAuto = pendingPinRef.current !== null && pendingPinRef.current === pinRef.current;
          pendingPinRef.current = null;
          pinRef.current = null;
          setPin("");
          setPinBusy(false);
          setBlocked(!!msg.blocked);
          setPinError(wasAuto || msg.blocked ? null : text);
          setRetryAt(msg.retry_after ? Date.now() + msg.retry_after * 1000 : 0);
          setPhase("locked");
          break;
        }

        case "saved": {
          const html = sentHtmlRef.current ?? lastSavedRef.current;
          sentHtmlRef.current = null;
          versionRef.current = msg.version;
          lastSavedRef.current = html;
          if (dirtyRef.current) void flushSave();
          else setSaveState("saved");
          break;
        }

        case "lock_updated": {
          const pending = pendingLockRef.current;
          pendingLockRef.current = null;
          pinRef.current = pending?.pin ?? null;
          lockedRef.current = msg.locked;
          setIsLocked(msg.locked);
          markSaved(pending?.html ?? lastSavedRef.current, msg.version);
          if (editorHtml() !== lastSavedRef.current) scheduleSave(); // typed while it was being locked
          setLockBusy(false);
          setLockMode(null);
          toast.success(
            msg.locked ? (pending?.mode === "change" ? "PIN changed" : "Textbox locked") : "Lock removed",
            { description: msg.locked ? "Other devices will need the PIN." : "Anyone with the code can open it." }
          );
          break;
        }

        case "error": {
          sentHtmlRef.current = null;
          if (pendingLockRef.current) {
            abortLock(msg.detail);
            return;
          }
          dirtyRef.current = true;
          setSaveState("error");
          toast.error("Couldn't save", { description: msg.detail });
          break;
        }
      }
    };

    const connect = () => {
      if (stopped) return;
      ws = new WebSocket(buildWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        retry = 0;
        setOnline(true);
        autoUnlockRef.current = true;
        // "code" lets the server list this textbox by name in the admin panel (/admin/notepad; stored in plain text).
        ws?.send(JSON.stringify({ type: "open", box: box.boxId, code: codeRef.current }));
        pingTimer = window.setInterval(
          () => ws?.readyState === WebSocket.OPEN && ws.send('{"type":"ping"}'),
          WS_PING_MS
        );
      };

      ws.onmessage = (ev) => {
        let msg: ServerMsg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        // Handlers await decryption; chain them so messages apply strictly in order.
        queue = queue.then(() => handle(msg)).catch(() => undefined);
      };

      ws.onclose = () => {
        setOnline(false);
        clearTimers();
        // Anything in flight is unconfirmed: resend after reconnecting.
        if (sentHtmlRef.current !== null) {
          sentHtmlRef.current = null;
          dirtyRef.current = true;
        }
        if (pendingLockRef.current) abortLock("Connection lost. Please try again.");
        if (pendingPinRef.current) {
          pendingPinRef.current = null;
          setPinBusy(false);
        }
        if (stopped) return;
        const delay = Math.min(WS_MAX_RETRY_MS, 1000 * 2 ** retry);
        retry += 1;
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    const onOnline = () => {
      if (ws && ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CONNECTING) {
        clearTimers();
        retry = 0;
        connect();
      }
    };
    window.addEventListener("online", onOnline);
    connect();

    return () => {
      stopped = true;
      clearTimers();
      window.removeEventListener("online", onOnline);
      ws?.close(1000);
      wsRef.current = null;
      setOnline(false);
    };
    // `session` is bumped by "Lock now" to start over with no PIN keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysReady, session]);

  // ---------------------------------------------------------------- lifecycle

  /** Forget the PIN keys and the decrypted content; the server will ask for the PIN again. */
  const lockNow = useCallback(() => {
    if (!lockedRef.current) return;
    if (dirtyRef.current) void flushSave();
    pinRef.current = null;
    pendingPinRef.current = null;
    stashRef.current = null;
    wipeEditor();
    setConflict(null);
    setPin("");
    setPinError(null);
    setPhase("locked");
    // Give a pending save a moment to go out, then reconnect without keys.
    window.setTimeout(() => setSession((s) => s + 1), 150);
  }, [flushSave]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
        void flushSave();
      } else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_HIDDEN_MS && pinRef.current) {
        lockNow();
      }
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current || sentHtmlRef.current !== null) {
        void flushSave();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", beforeUnload);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [flushSave, lockNow]);

  // Countdown for PIN throttling.
  useEffect(() => {
    if (retryAt <= Date.now()) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [retryAt]);
  const waitSeconds = Math.max(0, Math.ceil((retryAt - now) / 1000));

  // ---------------------------------------------------------------- unlock

  const submitPin = async (value: string) => {
    if (value.length !== 4 || pinBusy || blocked || waitSeconds > 0 || !boxRef.current) return;
    setPinBusy(true);
    setPinError(null);
    try {
      const keys = await derivePinKeys(boxRef.current, value);
      pendingPinRef.current = keys;
      if (!send({ type: "unlock", pin: keys.pinToken })) {
        pendingPinRef.current = null;
        setPinBusy(false);
        setPinError("Not connected. Retrying…");
      }
    } catch (e) {
      setPinBusy(false);
      setPinError((e as Error).message);
    }
  };

  // ---------------------------------------------------------------- lock / change / remove

  const submitLock = async (mode: LockMode, pins: LockSubmit) => {
    const box = boxRef.current;
    if (!box) return;
    setLockBusy(true);
    setLockError(null);
    try {
      // Let an in-flight autosave finish so the version is current.
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      for (let i = 0; i < 50 && sentHtmlRef.current !== null; i++) await new Promise((r) => setTimeout(r, 100));
      if (sentHtmlRef.current !== null) throw new Error("Still saving. Please try again.");

      const [current, next] = await Promise.all([
        pins.current ? derivePinKeys(box, pins.current) : null,
        pins.next ? derivePinKeys(box, pins.next) : null,
      ]);
      const html = editorHtml();
      const content = next
        ? await encryptContent(next.lockKey, box.boxId, true, html)
        : await encryptContent(box.openKey, box.boxId, false, html);
      if (content.length > MAX_CONTENT_CHARS) throw new Error("Content is too large.");

      pendingLockRef.current = { mode, pin: next, html };
      dirtyRef.current = false;
      const ok = send({
        type: "set_lock",
        pin: current?.pinToken ?? null,
        new_pin: next?.pinToken ?? null,
        content,
        base_version: versionRef.current,
      });
      if (!ok) {
        pendingLockRef.current = null;
        throw new Error("Not connected. Please try again.");
      }
    } catch (e) {
      abortLock((e as Error).message);
      if (dirtyRef.current) scheduleSave();
    }
  };

  // ---------------------------------------------------------------- editor events

  const insertImages = async (files: File[]) => {
    for (const f of files) {
      try {
        const src = await imageToDataUrl(f);
        editorRef.current?.focus();
        document.execCommand("insertHTML", false, sanitizeHtml(`<img src="${src}" alt="">`));
      } catch {
        toast.error("Couldn't add that image");
      }
    }
    setIsEmpty(false);
    scheduleSave();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const images = imageFilesFrom(e.clipboardData.items);
    if (images.length) {
      e.preventDefault();
      void insertImages(images);
      return;
    }
    const html = e.clipboardData.getData("text/html");
    if (html) {
      // Never let raw pasted HTML (remote images, scripts, styles) into the page.
      e.preventDefault();
      document.execCommand("insertHTML", false, sanitizeHtml(html));
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const images = imageFilesFrom(e.dataTransfer.files);
    if (images.length) {
      e.preventDefault();
      void insertImages(images);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void flushSave();
    }
  };

  const onInput = () => {
    updateEmpty();
    scheduleSave();
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(editorRef.current?.innerText ?? "");
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Clipboard not available");
    }
  };

  const clearAll = () => {
    wipeEditor();
    setConfirmClear(false);
    scheduleSave();
  };

  const resolveConflict = (keep: "mine" | "theirs") => {
    if (!conflict) return;
    if (keep === "theirs") {
      render(conflict.html);
      markSaved(conflict.html, conflict.version);
    } else {
      versionRef.current = conflict.version;
      dirtyRef.current = true;
      lastSavedRef.current = conflict.html;
      setSaveState("dirty");
    }
    conflictRef.current = false;
    setConflict(null);
    if (keep === "mine") void flushSave();
  };

  // ---------------------------------------------------------------- UI

  const statusChip = (() => {
    if (!online) return { icon: CloudOff, text: "Offline · reconnecting", cls: "text-amber-600 dark:text-amber-400" };
    if (saveState === "saving") return { icon: Loader2, text: "Encrypting & saving", cls: "text-muted-foreground", spin: true };
    if (saveState === "dirty") return { icon: RefreshCw, text: "Unsaved changes", cls: "text-muted-foreground" };
    if (saveState === "error") return { icon: TriangleAlert, text: "Not saved", cls: "text-destructive" };
    return { icon: Check, text: "Saved · synced live", cls: "text-emerald-600 dark:text-emerald-400" };
  })();
  const StatusIcon = statusChip.icon;

  if (phase === "error") {
    return (
      <CenteredCard>
        <TriangleAlert className="h-10 w-10 text-destructive" />
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">{fatal}</p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </CenteredCard>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-muted/40">
      {/* Toolbar */}
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              {isLocked ? <Lock className="h-4 w-4 text-primary" /> : <ShieldCheck className="h-4 w-4 text-primary" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold" title={code}>{code}</span>
                {isLocked && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">PIN locked</span>
                )}
              </div>
              {phase === "ready" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`flex cursor-default items-center gap-1 text-xs ${statusChip.cls}`}>
                      <StatusIcon className={`h-3 w-3 ${statusChip.spin ? "animate-spin" : ""}`} />
                      {statusChip.text}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    End-to-end encrypted: content is encrypted in this browser with AES-256-GCM before it is sent.
                    The server only stores ciphertext and can't read it.
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {phase === "ready" && (
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={copyText} className="gap-1.5" aria-label="Copy text">
                <Copy className="h-4 w-4" /><span className="hidden sm:inline">Copy</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)} disabled={isEmpty} className="gap-1.5" aria-label="Clear">
                <Eraser className="h-4 w-4" /><span className="hidden sm:inline">Clear</span>
              </Button>
              {isLocked ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Lock className="h-4 w-4" />Locked<ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">PIN protection</DropdownMenuLabel>
                    <DropdownMenuItem onClick={lockNow}><Lock className="mr-2 h-4 w-4" />Lock now</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setLockError(null); setLockMode("change"); }}>
                      <KeyRound className="mr-2 h-4 w-4" />Change PIN
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setLockError(null); setLockMode("remove"); }}>
                      <LockOpen className="mr-2 h-4 w-4" />Remove lock
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setLockError(null); setLockMode("set"); }}>
                  <LockOpen className="h-4 w-4" />Lock
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate("/textbox")} aria-label="Open another textbox">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Conflict banner */}
      {conflict && phase === "ready" && (
        <div className="border-b border-amber-500/30 bg-amber-500/10">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
            <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <span className="flex-1">This textbox was changed on another device while you were editing.</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => resolveConflict("theirs")}>Load latest</Button>
              <Button size="sm" onClick={() => resolveConflict("mine")}>Keep mine</Button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-4">
        {/* The editor stays mounted (keeps its DOM node); it's emptied whenever the box is locked. */}
        <div className={phase === "ready" ? "relative flex flex-1 flex-col" : "hidden"}>
          {isEmpty && (
            <p className="pointer-events-none absolute left-5 top-4 select-none text-muted-foreground/70">
              Type, paste text or images…
            </p>
          )}
          <div
            ref={editorRef}
            contentEditable={phase === "ready"}
            suppressContentEditableWarning
            spellCheck
            role="textbox"
            aria-multiline="true"
            aria-label="Textbox content"
            onInput={onInput}
            onPaste={onPaste}
            onDrop={onDrop}
            onKeyDown={onKeyDown}
            onBlur={() => void flushSave()}
            className="min-h-[60vh] flex-1 whitespace-pre-wrap break-words rounded-xl border bg-background px-5 py-4 text-[15px] leading-relaxed shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 [&_a]:text-primary [&_a]:underline [&_img]:my-2 [&_img]:max-h-[420px] [&_img]:max-w-full [&_img]:rounded-lg"
          />
        </div>

        {(phase === "deriving" || phase === "connecting") && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {phase === "deriving" ? "Deriving encryption keys on this device…" : "Connecting securely…"}
            </p>
          </div>
        )}

        {phase === "locked" && (
          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-sm rounded-2xl border bg-background p-8 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Lock className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-xl font-semibold">This textbox is locked</h1>
              <p className="mb-6 mt-1 text-sm text-muted-foreground">
                {blocked ? "PIN entry is disabled." : "Enter the 4-digit PIN to decrypt it."}
              </p>
              <PinInput
                label="PIN"
                value={pin}
                onChange={(v) => { setPin(v); if (pinError) setPinError(null); }}
                onComplete={submitPin}
                disabled={pinBusy || blocked || waitSeconds > 0 || !online}
                invalid={!!pinError || blocked}
              />
              <p role="alert" className="mt-4 min-h-[1.25rem] text-sm text-destructive">
                {blocked
                  ? BLOCKED_TEXT
                  : waitSeconds > 0
                    ? `Too many wrong attempts. Try again in ${formatWait(waitSeconds)}.`
                    : pinError}
              </p>
              <Button
                className="mt-2 w-full gap-2"
                onClick={() => submitPin(pin)}
                disabled={pin.length !== 4 || pinBusy || blocked || waitSeconds > 0 || !online}
              >
                {pinBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />}
                {online ? "Unlock" : "Reconnecting…"}
              </Button>
              <p className="mt-5 text-xs text-muted-foreground">
                The PIN never leaves this device in readable form. A forgotten PIN can't be reset.
              </p>
            </div>
          </div>
        )}
      </main>

      <LockDialog
        mode={lockMode}
        busy={lockBusy}
        error={lockError}
        onSubmit={submitLock}
        onClose={() => { setLockMode(null); setLockError(null); }}
      />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this textbox?</AlertDialogTitle>
            <AlertDialogDescription>
              Everything in it will be removed on all devices. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/40 px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border bg-background p-8 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}
