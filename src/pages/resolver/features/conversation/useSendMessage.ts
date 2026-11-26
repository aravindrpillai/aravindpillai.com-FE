import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, newId } from "@/pages/resolver/api/client";
import { conversationApi } from "@/pages/resolver/api/endpoints/conversation";
import type { ChatMessage, SendMessageResponse } from "@/pages/resolver/api/types";
import { readLocal, writeLocal } from "@/pages/resolver/lib/storage";

export type PendingStatus = "sending" | "failed" | "ai_failed";

export interface PendingMessage {
  clientId: string;
  content: string;
  status: PendingStatus;
  createdAt: string;
  errorCode?: string;
}

interface Options {
  code: string;
  onDelivered: (messages: ChatMessage[], response: SendMessageResponse) => void;
  onClosed: () => void;
}

const BUSY_RETRY_MS = 1500;

/**
 * Optimistic sending: the message appears at once as "sending"; on failure it stays as "Not sent"
 * with Retry, so the text is never lost. Retries reuse the client_message_id, so the server never
 * stores it twice; a saved message whose AI reply failed is retried the same way (AI only).
 */
export function useSendMessage({ code, onDelivered, onClosed }: Options) {
  const storageKey = `resolver.pending.${code}`;
  // Unsent messages survive a reload: they come back as "Not sent" with Retry.
  const [pending, setPending] = useState<PendingMessage[]>(() => restore(readLocal(storageKey)));
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    const unsent = pending.filter((p) => p.status !== "sending");
    writeLocal(storageKey, unsent.length ? JSON.stringify(unsent) : null);
  }, [storageKey, pending]);

  const update = (clientId: string, patch: Partial<PendingMessage> | null) =>
    setPending((all) =>
      patch === null ? all.filter((p) => p.clientId !== clientId) : all.map((p) => (p.clientId === clientId ? { ...p, ...patch } : p)),
    );

  const deliver = useCallback(
    async (clientId: string, content: string, attempt = 0): Promise<void> => {
      if (inFlight.current.has(clientId) && attempt === 0) return;
      inFlight.current.add(clientId);
      update(clientId, { status: "sending", errorCode: undefined });
      try {
        const res = await conversationApi.send(code, content, clientId);
        if (res.ai_message) {
          update(clientId, null);
          onDelivered([res.user_message, res.ai_message], res);
        } else {
          update(clientId, { status: "ai_failed", errorCode: res.ai_error ?? "ai_unavailable" });
        }
      } catch (err) {
        if (err instanceof ApiError && err.code === "busy" && attempt < 5) {
          await new Promise((r) => window.setTimeout(r, BUSY_RETRY_MS));
          return deliver(clientId, content, attempt + 1);
        }
        const code_ = err instanceof ApiError ? err.code : "network";
        update(clientId, { status: "failed", errorCode: code_ });
        if (code_ === "input_closed") onClosed();
      } finally {
        inFlight.current.delete(clientId);
      }
    },
    [code, onDelivered, onClosed],
  );

  const send = useCallback(
    (content: string) => {
      const clientId = newId();
      setPending((all) => [...all, { clientId, content, status: "sending", createdAt: new Date().toISOString() }]);
      void deliver(clientId, content);
    },
    [deliver],
  );

  const retry = useCallback(
    (clientId: string) => {
      const item = pending.find((p) => p.clientId === clientId);
      if (item) void deliver(item.clientId, item.content);
    },
    [pending, deliver],
  );

  /** Drop items the server has fully answered (e.g. restored after a reload but delivered meanwhile). */
  const forget = useCallback((clientIds: string[]) => {
    if (!clientIds.length) return;
    setPending((all) => (all.some((p) => clientIds.includes(p.clientId)) ? all.filter((p) => !clientIds.includes(p.clientId)) : all));
  }, []);

  const busy = pending.some((p) => p.status === "sending");
  return { pending, send, retry, busy, forget };
}

function restore(raw: string | null): PendingMessage[] {
  if (!raw) return [];
  try {
    const items = JSON.parse(raw) as PendingMessage[];
    return Array.isArray(items)
      ? items
          .filter((i) => typeof i.clientId === "string" && typeof i.content === "string")
          .map((i) => ({ ...i, status: i.status === "ai_failed" ? "ai_failed" : "failed" }))
      : [];
  } catch {
    return [];
  }
}
