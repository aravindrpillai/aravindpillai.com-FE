import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowUp, FileText, Loader2, Paperclip, Square, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { aiApi, type AIAttachment, type AIProvider } from "@/lib/aiApi";
import { heicFileToJpeg, isHeicFile } from "@/lib/heic";
import { ModelPicker, type ModelChoice } from "./ModelPicker";

export const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const fileExt = (name: string) => (name.includes(".") ? name.split(".").pop()!.toUpperCase().slice(0, 5) : "FILE");

interface Pending {
  key: string;
  name: string;
  size: number;
  mime: string;
  preview?: string; // object URL for images
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
  att?: AIAttachment;
  abort: AbortController;
}

export interface ComposerHandle {
  addFiles: (files: File[]) => void;
  focus: () => void;
}

interface Props {
  token: string;
  providers: AIProvider[];
  choice: ModelChoice | null;
  onChoice: (c: ModelChoice) => void;
  streaming: boolean;
  maxFileBytes: number;
  placeholder?: string;
  onSend: (text: string, attachments: AIAttachment[]) => boolean | Promise<boolean>;
  onStop: () => void;
}

const MAX_FILES = 20;

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { token, providers, choice, onChoice, streaming, maxFileBytes, placeholder, onSend, onStop },
  ref
) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  // Auto-grow the textarea up to ~12 lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
  }, [text]);

  // Release object URLs on unmount.
  useEffect(() => () => filesRef.current.forEach((f) => f.preview && URL.revokeObjectURL(f.preview)), []);

  const update = (key: string, patch: Partial<Pending>) =>
    setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));

  const addFiles = useCallback(
    async (list: File[]) => {
      const room = MAX_FILES - filesRef.current.length;
      if (list.length > room) toast.error(`You can attach up to ${MAX_FILES} files per message.`);
      for (let file of list.slice(0, Math.max(room, 0))) {
        if (await isHeicFile(file)) {
          try {
            file = await heicFileToJpeg(file);
          } catch {
            /* send the original; the model will be told it can't read it */
          }
        }
        if (file.size > maxFileBytes) {
          toast.error(`${file.name} is larger than ${formatSize(maxFileBytes)}.`);
          continue;
        }
        const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const isImage = /^image\/(png|jpe?g|gif|webp)$/i.test(file.type);
        const pending: Pending = {
          key,
          name: file.name || "pasted-image.png",
          size: file.size,
          mime: file.type,
          preview: isImage ? URL.createObjectURL(file) : undefined,
          progress: 0,
          status: "uploading",
          abort: new AbortController(),
        };
        setFiles((prev) => [...prev, pending]);
        aiApi
          .upload(token, file, (pct) => update(key, { progress: pct }), pending.abort.signal)
          .then((att) => update(key, { status: "done", att, progress: 100 }))
          .catch((e) => {
            if (e?.status === -1) return;
            update(key, { status: "error", error: e?.message || "Upload failed" });
          });
      }
    },
    [token, maxFileBytes]
  );

  useImperativeHandle(ref, () => ({ addFiles, focus: () => textareaRef.current?.focus() }), [addFiles]);

  const removeFile = (p: Pending) => {
    p.abort.abort();
    if (p.preview) URL.revokeObjectURL(p.preview);
    if (p.att) aiApi.removeFile(token, p.att.id).catch(() => undefined);
    setFiles((prev) => prev.filter((f) => f.key !== p.key));
  };

  const uploading = files.some((f) => f.status === "uploading");
  const ready = files.filter((f) => f.status === "done" && f.att);
  const canSend = !streaming && !uploading && !!choice && (text.trim().length > 0 || ready.length > 0);

  const send = async () => {
    if (!canSend) return;
    const ok = await onSend(text, ready.map((f) => f.att!));
    if (ok) {
      files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
      setFiles([]);
      setText("");
    }
  };

  return (
    <div
      className="rounded-2xl border border-border bg-background shadow-[0_2px_16px_-4px_rgba(0,0,0,0.08)] focus-within:border-foreground/25 transition-colors"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {files.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-3 pt-3 pb-1">
          {files.map((f) => (
            <div key={f.key} className="group relative shrink-0">
              {f.preview ? (
                <img src={f.preview} alt={f.name} className="h-16 w-16 rounded-lg border border-border object-cover" />
              ) : (
                <div className="flex h-16 w-44 items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{f.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {fileExt(f.name)} · {formatSize(f.size)}
                    </div>
                  </div>
                </div>
              )}
              {f.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70 text-xs font-medium">
                  <Loader2 size={14} className="mr-1 animate-spin" /> {f.progress}%
                </div>
              )}
              {f.status === "error" && (
                <div
                  title={f.error}
                  className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg bg-red-50/90 px-1 text-center text-[11px] text-red-600 dark:bg-red-950/80"
                >
                  <AlertCircle size={13} /> Failed
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(f)}
                aria-label={`Remove ${f.name}`}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        onPaste={(e) => {
          const pasted = Array.from(e.clipboardData.files || []);
          if (pasted.length) {
            e.preventDefault();
            addFiles(pasted);
          }
        }}
        placeholder={placeholder || "Message…"}
        className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] leading-6 outline-none placeholder:text-muted-foreground/70"
      />

      <div className="flex items-center justify-between px-2 pb-2 pt-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Attach files"
          title="Attach files"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
        <div className="flex items-center gap-1">
          <ModelPicker providers={providers} value={choice} onChange={onChoice} />
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              title="Stop"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background hover:opacity-85"
            >
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              aria-label="Send"
              title={uploading ? "Waiting for uploads…" : "Send"}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-35"
            >
              <ArrowUp size={17} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
