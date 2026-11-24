import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bot, FileSearch, FileText, Loader2, Plus, Send, User } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fileApi, type FileReference, type FileSession } from "@/lib/playgroundApi";
import { errorText, usePlayground } from "../PlaygroundGate";

interface ChatMessage {
  id: string | number;
  role: "user" | "assistant";
  content: string;
  references?: FileReference[];
  timestamp: Date;
  failed?: boolean;
}

const FileAnalyserChat = () => {
  const navigate = useNavigate();
  const session = usePlayground();
  const { sessionId } = useParams();
  const [info, setInfo] = useState<FileSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    fileApi
      .session(session.token, sessionId)
      .then((s) => {
        setInfo(s);
        const history = (s.messages || []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          references: m.references ?? [],
          timestamp: m.created_at ? new Date(m.created_at) : new Date(),
        }));
        setMessages(
          history.length
            ? history
            : [{ id: "welcome", role: "assistant", content: "Your files are ready. Ask me anything about their content.", timestamp: new Date() }]
        );
      })
      .catch((err) => {
        if (session.handleAuthError(err)) return;
        setNotFound(true);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session.token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || typing || !sessionId) return;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text, timestamp: new Date() }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setTyping(true);
    try {
      const data = await fileApi.ask(session.token, sessionId, text);
      setMessages((prev) => [
        ...prev,
        { id: data.message.id, role: "assistant", content: data.answer, references: data.references ?? [], timestamp: new Date() },
      ]);
    } catch (err) {
      const msg = errorText(session, err, "Something went wrong. Please try again.");
      if (msg) {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: msg, timestamp: new Date(), failed: true }]);
      }
    } finally {
      setTyping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Loading conversation…</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <p className="text-sm text-muted-foreground">This document session doesn't exist.</p>
        <button onClick={() => navigate("/file-analyser")} className="text-sm font-medium text-primary hover:underline">
          Upload files
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate("/file-analyser")} className="text-muted-foreground transition-colors hover:text-foreground" title="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-warm">
          <FileSearch className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-sm font-bold">File Analyser</h2>
          <p className="truncate text-[11px] text-muted-foreground">
            {info?.docs.map((d) => d.name).join(" · ") || "Ask questions about your documents"}
          </p>
        </div>
        <button
          onClick={() => navigate("/file-analyser")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : msg.failed
                    ? "rounded-bl-md border border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200"
                    : "rounded-bl-md border border-border bg-card shadow-card"
              }`}
            >
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
              ) : (
                <div className="prose prose-sm max-w-none text-sm leading-relaxed dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              )}

              {msg.references && msg.references.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-border/60 pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">References</p>
                  {msg.references.map((ref, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span>
                        {ref.file && <span className="font-medium">{ref.file}</span>}
                        {ref.chunk !== undefined && <span> — section {ref.chunk + 1}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <span className={`mt-1 block text-[10px] ${msg.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </motion.div>
        ))}

        {typing && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 shadow-card">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="h-2 w-2 rounded-full bg-muted-foreground/40"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-card p-3 md:p-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            maxLength={4000}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask a question about your documents…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || typing}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            title="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileAnalyserChat;
