import { memo, useEffect, useState } from "react";
import { AlertCircle, Check, Copy, FileText, RotateCcw } from "lucide-react";
import { aiApi, type AIAttachment, type AIMessage } from "@/lib/aiApi";
import { Markdown } from "./Markdown";
import { ProviderDot, prettyModel } from "./ModelPicker";
import { fileExt, formatSize } from "./Composer";

const IMAGE_RE = /^image\/(png|jpe?g|gif|webp)$/i;

/** Attachments need the token header, so they're fetched as blobs (cached per id for the session). */
const blobCache = new Map<string, Promise<string>>();
function useAttachmentUrl(token: string, id: string, enabled: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    if (!blobCache.has(id)) {
      const p = aiApi.fileBlob(token, id).then((b) => URL.createObjectURL(b));
      p.catch(() => blobCache.delete(id));
      blobCache.set(id, p);
    }
    blobCache
      .get(id)!
      .then((u) => alive && setUrl(u))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [token, id, enabled]);
  return url;
}

function AttachmentView({ token, att }: { token: string; att: AIAttachment }) {
  const isImage = IMAGE_RE.test(att.mime);
  const url = useAttachmentUrl(token, att.id, isImage);

  const open = async () => {
    try {
      const u = url || (await aiApi.fileBlob(token, att.id).then((b) => URL.createObjectURL(b)));
      if (isImage) {
        window.open(u, "_blank", "noopener");
      } else {
        const a = document.createElement("a");
        a.href = u;
        a.download = att.name;
        a.click();
      }
    } catch {
      /* file gone */
    }
  };

  if (isImage) {
    return (
      <button type="button" onClick={open} className="block overflow-hidden rounded-xl border border-border">
        {url ? (
          <img src={url} alt={att.name} className="max-h-60 max-w-[240px] object-cover" />
        ) : (
          <div className="h-32 w-40 animate-pulse bg-muted" />
        )}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      title={`Download ${att.name}`}
      className="flex w-52 items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-2 text-left hover:bg-muted/50"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <FileText size={18} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium">{att.name}</div>
        <div className="text-[11px] text-muted-foreground">
          {fileExt(att.name)} · {formatSize(att.size)}
        </div>
      </div>
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      title="Copy"
      aria-label="Copy"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function MessageViewImpl({
  token,
  message,
  isLast,
  busy,
  onRetry,
}: {
  token: string;
  message: AIMessage;
  isLast: boolean;
  busy: boolean;
  onRetry: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="group flex flex-col items-end gap-2">
        {message.attachments.length > 0 && (
          <div className="flex max-w-[85%] flex-wrap justify-end gap-2">
            {message.attachments.map((a) => (
              <AttachmentView key={a.id} token={token} att={a} />
            ))}
          </div>
        )}
        {message.content && (
          <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-muted px-4 py-2.5 text-[15px] leading-7">
            {message.content}
          </div>
        )}
        <div className="opacity-0 transition-opacity group-hover:opacity-100">
          <CopyButton text={message.content} />
        </div>
      </div>
    );
  }

  const streaming = message.status === "streaming";
  return (
    <div className="group">
      {message.content ? (
        <div className={streaming ? "ai-streaming" : ""}>
          <Markdown text={message.content} />
        </div>
      ) : streaming ? (
        <div className="flex items-center gap-1.5 py-2" aria-label="Thinking">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-primary/70 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      ) : null}

      {message.status === "error" && (
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span className="break-words">{message.error || "Something went wrong."}</span>
        </div>
      )}
      {message.status === "stopped" && (
        <div className="mt-1 text-xs italic text-muted-foreground">Stopped</div>
      )}

      {!streaming && (
        <div
          className={`mt-1 flex items-center gap-0.5 text-muted-foreground transition-opacity ${
            isLast ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {message.content && <CopyButton text={message.content} />}
          {isLast && (
            <button
              type="button"
              onClick={onRetry}
              disabled={busy}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted hover:text-foreground disabled:opacity-40"
              title="Retry with the selected model"
              aria-label="Retry"
            >
              <RotateCcw size={14} />
            </button>
          )}
          {message.model && (
            <span className="ml-1.5 flex items-center gap-1.5 text-xs">
              <ProviderDot provider={message.provider} />
              {prettyModel(message.model)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export const MessageView = memo(MessageViewImpl);
