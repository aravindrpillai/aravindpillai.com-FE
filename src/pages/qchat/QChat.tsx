import { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mail, Pause, Play, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import PasscodeModal from "@/components/chat/PasscodeModal";
import ImagePreviewModal from "@/components/chat/ImagePreviewModal";
import ChatMessage, { Message } from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import { toast } from "sonner";
import ApiClient from "@/lib/api";
import CryptoJS from "crypto-js";

type ApiMessage = {
  id: number;
  sender_name: string;
  sender: string; // me or other
  message: string; // encrypted
  time?: string; // backend time string
};

const QChat = () => {
  const { conversationName, personName } = useParams();
  const navigate = useNavigate();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Keep state passcode only for UI; use ref for crypto to avoid stale state timing issues.
  const [passcode, setPasscode] = useState("");
  const passcodeRef = useRef<string>("");

  const [headers, setHeaders] = useState<Record<string, string>>({});

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");

  // Image upload ignored; preview modal kept for design compatibility
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const lastIdRef = useRef<number>(0);
  const [startPolling, setStartPolling] = useState(false);

  const convName = useMemo(() => (conversationName || "").trim(), [conversationName]);
  const senderName = useMemo(() => (personName || "").trim(), [personName]);

  // ---------------- helpers ----------------
  const formatConversationName = (name?: string) => {
    if (!name) return "Conversation";
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const parseTimestamp = (t?: string): Date => {
    if (!t) return new Date();

    const d1 = new Date(t);
    if (!isNaN(d1.getTime())) return d1;

    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) {
      const today = new Date();
      const parts = t.split(":").map((x) => parseInt(x, 10));
      const hh = parts[0] ?? 0;
      const mm = parts[1] ?? 0;
      const ss = parts[2] ?? 0;
      today.setHours(hh, mm, ss, 0);
      return today;
    }

    return new Date();
  };

  const decryptMessage = (ciphertext: string): string => {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, passcodeRef.current);
      const plain = bytes.toString(CryptoJS.enc.Utf8);
      return plain || "<Decryption Failed>";
    } catch (e) {
      console.error("Decryption failed:", e);
      return "<Decryption Failed>";
    }
  };

  /**
   * Encrypt code for header token. Backend decrypts.
   */
  const encryptCode = (code: string) => {
    const key = CryptoJS.SHA256(code);
    const encrypted = CryptoJS.AES.encrypt(code, key, {
      iv: CryptoJS.enc.Utf8.parse(import.meta.env.VITE_QCHAT_ENCRYPTION_ID),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return encrypted.toString();
  };

  const mergeMessages = (prev: Message[], incoming: Message[]) => {
    const map = new Map<string, Message>();
    [...prev, ...incoming].forEach((m) => map.set(m.id, m));
    return Array.from(map.values()).sort((a, b) => Number(a.id) - Number(b.id));
  };

  const resetToUnauthed = () => {
    setIsAuthenticated(false);
    setIsLoading(false);

    setPasscode("");
    passcodeRef.current = "";

    setHeaders({});
    setMessages([]);
    setInputValue("");

    lastIdRef.current = 0;
    setStartPolling(false);
  };

  // On refresh, ALWAYS ask passcode again: do not persist anything.
  useEffect(() => {
    resetToUnauthed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convName, senderName]);

  // ---------------- scroll (anchor-based, reliable with Radix ScrollArea) ----------------
  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  // Scroll when messages render (initial load + every new message)
  useLayoutEffect(() => {
    if (!isAuthenticated) return;
    if (isLoading) return; // wait until the message list is actually mounted

    const id = requestAnimationFrame(() => scrollToBottom("auto"));
    return () => cancelAnimationFrame(id);
  }, [messages, isAuthenticated, isLoading]);

  // ---------------- API ----------------
  const getConversations = async (
    hdrs: Record<string, string>,
    lastId = 0,
    showLoading = true
  ): Promise<ApiMessage[]> => {
    try {
      if (showLoading) setIsLoading(true);

      const url = ApiClient.buildFullUrl(
        `${import.meta.env.VITE_QUICK_CHAT_CONVERSATIONS}?lastid=${lastId}`
      );

      const resp = await fetch(url, { method: "GET", headers: hdrs });
      const data = await resp.json();

      if (resp.status === 403) {
        console.log("403 while getting conversations:", data?.detail);
        throw new Error(data?.detail || "Forbidden");
      }

      return (data?.data || []) as ApiMessage[];
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      throw err;
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const toUiMessages = (apiMsgs: ApiMessage[]): Message[] => {
    return apiMsgs.map((m) => ({
      id: String(m.id),
      content: decryptMessage(m.message),
      sender_name: m.sender,
      sender: m.sender === senderName ? "me" : "other",
      timestamp: parseTimestamp(m.time),
    }));
  };

  // ---------------- auth via passcode modal ----------------
  const handlePasscodeVerify = async (codeFromModal: string) => {
    if (!convName || !senderName) {
      toast.error("Invalid chat link. Missing conversation/person.");
      return;
    }

    if (codeFromModal.length !== 4) {
      toast.error("Passcode must be 4 digits.");
      return;
    }

    // IMPORTANT: set ref BEFORE any decrypt work
    passcodeRef.current = codeFromModal;
    setPasscode(codeFromModal);

    const newHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      name: convName,
      token: encryptCode(codeFromModal),
    };

    setHeaders(newHeaders);
    setIsLoading(true);

    try {
      const initial = await getConversations(newHeaders, 0, true);
      const uiMsgs = toUiMessages(initial);

      setMessages((prev) => mergeMessages(prev, uiMsgs));

      if (initial.length > 0) {
        const maxId = Math.max(...initial.map((m) => m.id));
        lastIdRef.current = Math.max(lastIdRef.current, maxId);
      } else {
        lastIdRef.current = 0;
      }

      setIsAuthenticated(true);
      setStartPolling(true);
    } catch (e) {
      toast.error("Wrong code or access denied.");
      resetToUnauthed();
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------- actions ----------------
  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;
    if (!isAuthenticated) return;

    try {
      const url = ApiClient.buildFullUrl(import.meta.env.VITE_QUICK_CHAT_CONVERSATIONS);

      const encryptedMsg = CryptoJS.AES.encrypt(content, passcodeRef.current).toString();

      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sender: senderName,
          message: encryptedMsg,
        }),
      });

      const data = await resp.json();

      if (resp.status === 403) {
        console.log("403 while sending:", data?.detail);
        toast.error("Access denied. Re-enter passcode.");
        resetToUnauthed();
        return;
      }

      const apiMsg = data?.data as ApiMessage;
      if (!apiMsg?.id) return;

      const uiMsg: Message = {
        id: String(apiMsg.id),
        content: decryptMessage(apiMsg.message),
        sender_name: apiMsg.sender,
        sender: apiMsg.sender === senderName ? "me" : "other",
        timestamp: parseTimestamp(apiMsg.time),
      };

      setMessages((prev) => mergeMessages(prev, [uiMsg]));
      lastIdRef.current = Math.max(lastIdRef.current, apiMsg.id);
      setInputValue("");
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send message.");
    }
  };

  const handlePushEmail = async () => {
    try {
      const url = ApiClient.buildFullUrl(import.meta.env.VITE_QUICK_CHAT_CONVERSATIONS);
      const resp = await fetch(url, { method: "PUT", headers });
      const data = await resp.json();

      if (resp.status < 300) {
        toast.success("Notified!");
      } else {
        toast.error(`Failed: ${data?.messages?.[0] || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Failed to push email:", err);
      toast.error("Failed to push email.");
    }
  };

  const handlePause = () => {
    setStartPolling((prev) => !prev);
    toast.info(startPolling ? "Polling paused" : "Polling resumed");
  };

  const handleDelete = async () => {
    if (!confirm("Confirm action.")) return;

    try {
      setIsLoading(true);

      const url = ApiClient.buildFullUrl(import.meta.env.VITE_QUICK_CHAT_CONVERSATIONS);
      const resp = await fetch(url, { method: "DELETE", headers });
      const data = await resp.json();

      if (resp.status === 403) {
        console.log("403 while deleting:", data?.detail);
        toast.error("Access denied. Re-enter passcode.");
        resetToUnauthed();
        return;
      }

      setMessages([]);
      lastIdRef.current = 0;

      if (!startPolling) setStartPolling(true);

      toast.success("Messages deleted.");
    } catch (err) {
      console.error("Failed to delete messages:", err);
      toast.error("Failed to delete messages.");
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------- polling ----------------
  useEffect(() => {
    if (!isAuthenticated || !startPolling) return;

    const interval = setInterval(async () => {
      try {
        const newApiMsgs = await getConversations(headers, lastIdRef.current, false);
        if (newApiMsgs && newApiMsgs.length > 0) {
          const uiMsgs = toUiMessages(newApiMsgs);
          setMessages((prev) => mergeMessages(prev, uiMsgs));

          const maxId = Math.max(...newApiMsgs.map((m) => m.id));
          lastIdRef.current = Math.max(lastIdRef.current, maxId);
        }
      } catch (err) {
        console.error("Polling failed:", err);
        setStartPolling(false);
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, startPolling, headers]);

  // if missing params, show basic error state (no prompts)
  const showInvalidRoute = !convName || !senderName;

  const isPasscodeModalOpen = !isAuthenticated && !showInvalidRoute;

  useEffect(() => {
    if (isPasscodeModalOpen) {
      setPasscode("");
      passcodeRef.current = "";
    }
  }, [isPasscodeModalOpen]);

  return (
    <>
      <PasscodeModal
        isOpen={!isAuthenticated && !showInvalidRoute}
        onVerify={handlePasscodeVerify}
      />

      <ImagePreviewModal
        isOpen={!!previewImage}
        imageUrl={previewImage || ""}
        onClose={() => setPreviewImage(null)}
      />

      {showInvalidRoute ? (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold">Invalid chat link</h1>
            <p className="text-muted-foreground">
              Missing conversation name or person name in the URL.
            </p>
            <Button onClick={() => navigate("/")}>Go Home</Button>
          </div>
        </div>
      ) : (
        <AnimatePresence>
          {isAuthenticated && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-h-screen bg-background flex flex-col overflow-x-hidden"
            >
              {/* Header */}
              <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
                <div className="flex items-center justify-between px-3 sm:px-6 py-3">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate("/")}
                      className="shrink-0"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>

                    <div>
                      <h1 className="text-lg sm:text-xl font-bold text-foreground">
                        {formatConversationName(convName)}
                      </h1>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePushEmail}
                      className="hidden sm:flex gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      Notify
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handlePushEmail}
                      className="sm:hidden"
                    >
                      <Mail className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePause}
                      className="hidden sm:flex gap-2"
                    >
                      {startPolling ? (
                        <>
                          <Pause className="w-4 h-4" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Resume
                        </>
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handlePause}
                      className="sm:hidden"
                    >
                      {startPolling ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDelete}
                      className="hidden sm:flex gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDelete}
                      className="sm:hidden text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </header>

              {/* Messages Area */}
              <ScrollArea ref={scrollAreaRef} className="flex-1 px-3 sm:px-6 overflow-x-hidden">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="w-10 h-10 text-primary" />
                    </motion.div>
                    <p className="text-muted-foreground">Loading conversation...</p>
                  </div>
                ) : (
                  <div className="py-4 space-y-3">
                    {messages.map((message) => (
                      <ChatMessage
                        key={message.id}
                        msg_sender={message.sender_name}
                        message={message}
                        onReply={(content) => {
                          if (content) setInputValue(content + "\n--\n");
                        }}
                        onImageClick={setPreviewImage}
                      />
                    ))}

                    {/* Scroll anchor */}
                    <div ref={bottomRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input Area (image ignored) */}
              <ChatInput
                value={inputValue}
                onChange={setInputValue}
                onSend={(content) => handleSendMessage(content)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </>
  );
};

export default QChat;
