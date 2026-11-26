import { newId, request } from "../client";
import type { CaseDetail, CaseList, CreatedCase, WelcomeInfo } from "../types";

const c = (code: string) => `/cases/${encodeURIComponent(code)}`;

export const casesApi = {
  list: (cursor?: string | null) =>
    request<CaseList>(cursor ? `/cases/?cursor=${encodeURIComponent(cursor)}` : "/cases/", { etag: !cursor }),
  create: (idempotencyKey: string = newId()) =>
    request<CreatedCase>("/cases/", { method: "POST", body: {}, idempotencyKey }),
  detail: (code: string) => request<CaseDetail>(`${c(code)}/`, { etag: true }),
  proceed: (code: string) => request<CaseDetail>(`${c(code)}/proceed/`, { method: "POST", body: {}, idempotencyKey: newId() }),
  close: (code: string) => request<CaseDetail>(`${c(code)}/close/`, { method: "POST", body: {}, idempotencyKey: newId() }),
  withdrawParty: (code: string, partyId: string) =>
    request<CaseDetail>(`${c(code)}/parties/${partyId}/withdraw/`, { method: "POST", body: {}, idempotencyKey: newId() }),
  fixEmail: (code: string, partyId: string, email: string) =>
    request<CaseDetail>(`${c(code)}/parties/${partyId}/email/`, { method: "POST", body: { email }, idempotencyKey: newId() }),
  welcome: (code: string) => request<WelcomeInfo>(`${c(code)}/welcome/`),
  join: (code: string) => request<{ ok: true }>(`${c(code)}/join/`, { method: "POST", body: {}, idempotencyKey: newId() }),
  decline: (code: string, reason: string, doNotContact: boolean) =>
    request<{ ok: true }>(`${c(code)}/decline/`, {
      method: "POST",
      body: { reason, do_not_contact: doNotContact },
      idempotencyKey: newId(),
    }),
};
