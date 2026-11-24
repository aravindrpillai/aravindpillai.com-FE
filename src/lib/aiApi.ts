/**
 * Client for the backend `ai` app (arp/ai/...). The page is per user: /ai/<username>/<chat>.
 * Users are registered in the admin panel (-> AI) with their own 4-digit code; `unlock` swaps
 * username + code for a session token for that user, sent in the `token` header. The server only
 * ever returns that user's conversations and files. Tokens are stored per username.
 */
const BASE: string = import.meta.env.VITE_API_BASE_URL; // e.g. http://localhost:8000/arp/
const TOKEN_KEY = "ai_token:"; // + username

export type ProviderId = "claude" | "openai";

export interface AIProvider {
  id: ProviderId;
  label: string;
  models: string[];
  default_model: string;
}

export interface AIConfig {
  providers: AIProvider[];
  default_provider: ProviderId | null;
  max_file_bytes: number;
  username: string;
}

export interface AIAttachment {
  id: string;
  name: string;
  mime: string;
  size: number;
}

export type MessageStatus = "complete" | "streaming" | "stopped" | "error";

export interface AIMessage {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  provider: string;
  model: string;
  status: MessageStatus;
  error: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  created_at: string;
  attachments: AIAttachment[];
}

export interface AIConversationSummary {
  slug: string;
  title: string;
  provider: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface AIConversation extends AIConversationSummary {
  messages: AIMessage[];
}

export class AIHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------- token
export function readAIToken(username: string): string {
  try {
    return localStorage.getItem(TOKEN_KEY + username) || "";
  } catch {
    return "";
  }
}

export function storeAIToken(username: string, token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY + username, token);
    else localStorage.removeItem(TOKEN_KEY + username);
  } catch {
    /* storage unavailable */
  }
}

// ---------------------------------------------------------------- slugs
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isValidSlug = (s: string) => !!s && s.length <= 60 && SLUG_RE.test(s);
const USER_RE = /^[a-z0-9][a-z0-9_-]{1,29}$/;
export const isValidUsername = (s: string) => USER_RE.test(s);

/** "My Trip to Goa!" -> "my-trip-to-goa" */
export const toSlug = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

// ---------------------------------------------------------------- REST
async function request<T>(method: string, path: string, token: string, body?: unknown): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new AIHttpError(0, "Could not reach the server.");
  }
  const json = await resp.json().catch(() => null);
  if (!resp.ok) throw new AIHttpError(resp.status, json?.messages?.[0] || `Request failed (${resp.status})`);
  return (json?.data ?? null) as T;
}

export const aiApi = {
  unlock: (username: string, code: string) =>
    request<{ token: string; expires_at: string; username: string }>("POST", "ai/unlock/", "", { username, code }),
  config: (token: string) => request<AIConfig>("GET", "ai/config/", token),
  list: (token: string) => request<AIConversationSummary[]>("GET", "ai/conversations/", token),
  get: (token: string, slug: string) => request<AIConversation>("GET", `ai/conversations/${slug}/`, token),
  rename: (token: string, slug: string, title: string) =>
    request<AIConversationSummary>("PATCH", `ai/conversations/${slug}/`, token, { title }),
  remove: (token: string, slug: string) => request<null>("DELETE", `ai/conversations/${slug}/`, token),
  removeFile: (token: string, id: string) => request<null>("DELETE", `ai/files/${id}/`, token),

  /** Fetches an attachment as a Blob (the token cannot go in an <img src>). */
  async fileBlob(token: string, id: string): Promise<Blob> {
    const resp = await fetch(`${BASE}ai/files/${id}/`, { headers: { token } });
    if (!resp.ok) throw new AIHttpError(resp.status, "File not available");
    return resp.blob();
  },

  /** Upload with progress (fetch has no upload progress). */
  upload(token: string, file: File, onProgress: (pct: number) => void, signal?: AbortSignal) {
    return new Promise<AIAttachment>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE}ai/files/`);
      xhr.setRequestHeader("token", token);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        let json: { data?: AIAttachment; messages?: string[] } | null = null;
        try {
          json = JSON.parse(xhr.responseText);
        } catch {
          /* non-JSON error page */
        }
        if (xhr.status >= 200 && xhr.status < 300 && json?.data) resolve(json.data);
        else reject(new AIHttpError(xhr.status, json?.messages?.[0] || `Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new AIHttpError(0, "Upload failed: could not reach the server."));
      xhr.onabort = () => reject(new AIHttpError(-1, "Upload cancelled"));
      signal?.addEventListener("abort", () => xhr.abort());
      const form = new FormData();
      form.append("file", file);
      xhr.send(form);
    });
  },
};

// ---------------------------------------------------------------- chat stream
export interface ChatRequest {
  slug?: string;
  provider: ProviderId;
  model: string;
  content?: string;
  attachment_ids?: string[];
  regenerate?: boolean;
}

export interface StreamHandlers {
  onMeta: (meta: {
    conversation: AIConversationSummary;
    created: boolean;
    user_message: AIMessage;
    assistant_id: number;
  }) => void;
  onDelta: (text: string) => void;
  onDone: (message: AIMessage) => void;
  onError: (error: string, message?: AIMessage) => void;
}

/**
 * POSTs a message and reads the Server-Sent Events reply. (EventSource cannot POST or send headers.)
 * Aborting `signal` stops the reply; the backend keeps what was generated so far.
 */
export async function streamChat(token: string, body: ChatRequest, h: StreamHandlers, signal: AbortSignal) {
  let resp: Response;
  try {
    resp = await fetch(`${BASE}ai/chat/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (signal.aborted) return;
    throw new AIHttpError(0, "Could not reach the server.");
  }
  if (!resp.ok || !resp.body) {
    const json = await resp.json().catch(() => null);
    throw new AIHttpError(resp.status, json?.messages?.[0] || `Request failed (${resp.status})`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  const handle = (raw: string) => {
    let event = "message";
    const data: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (!data.length) return;
    const payload = JSON.parse(data.join("\n"));
    if (event === "meta") h.onMeta(payload);
    else if (event === "delta") h.onDelta(payload.text);
    else if (event === "done") {
      finished = true;
      h.onDone(payload.message);
    } else if (event === "error") {
      finished = true;
      h.onError(payload.error || "The model returned an error.", payload.message);
    }
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (chunk.trim()) handle(chunk);
      }
    }
  } catch (e) {
    if (signal.aborted) return;
    throw new AIHttpError(0, "The connection was interrupted.");
  }
  if (!finished && !signal.aborted) h.onError("The connection closed before the reply finished.");
}
