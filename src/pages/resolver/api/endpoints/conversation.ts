import { newId, request } from "../client";
import type { ConversationPage, PartyDraft, SendMessageResponse } from "../types";

const c = (code: string) => `/cases/${encodeURIComponent(code)}`;

export const conversationApi = {
  page: (code: string, before?: string | null) =>
    request<ConversationPage>(
      before ? `${c(code)}/conversation/?before=${encodeURIComponent(before)}` : `${c(code)}/conversation/`,
    ),
  send: (code: string, content: string, clientMessageId: string) =>
    request<SendMessageResponse>(`${c(code)}/conversation/messages/`, {
      method: "POST",
      body: { content, client_message_id: clientMessageId },
    }),
  complete: (code: string) =>
    request<ConversationPage>(`${c(code)}/conversation/complete/`, { method: "POST", body: {}, idempotencyKey: newId() }),
  open: (code: string) =>
    request<ConversationPage>(`${c(code)}/conversation/open/`, { method: "POST", body: {}, idempotencyKey: newId() }),
  consent: (code: string, consent: boolean) =>
    request<ConversationPage>(`${c(code)}/consent/`, { method: "POST", body: { consent }, idempotencyKey: newId() }),
  parties: (code: string, parties: PartyDraft[]) =>
    request<ConversationPage>(`${c(code)}/parties/`, {
      method: "PUT",
      body: { parties: parties.map((p) => ({ ...p, apparent_minor: false })) },
      idempotencyKey: newId(),
    }),
  approveSummary: (code: string, summary: string) =>
    request<ConversationPage>(`${c(code)}/invite-summary/`, { method: "PUT", body: { summary }, idempotencyKey: newId() }),
};
