import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { authApi } from "@/pages/resolver/api/endpoints/auth";
import { conversationApi } from "@/pages/resolver/api/endpoints/conversation";
import { queryKeys } from "@/pages/resolver/api/queryKeys";
import type { ChatMessage, ConversationPage, PartyDraft, SendMessageResponse, UiEvent } from "@/pages/resolver/api/types";
import { Button, Dialog, Skeleton } from "@/pages/resolver/components/ui";
import { pick, strings } from "@/pages/resolver/i18n";
import { errorMessage } from "@/pages/resolver/lib/errors";
import { Composer } from "./Composer";
import { ConsentCard } from "./events/ConsentCard";
import { SafetyLine } from "./events/EmergencyCard";
import { PartyFormCard } from "./events/PartyFormCard";
import { SummaryApprovalCard } from "./events/SummaryApprovalCard";
import { MessageList } from "./MessageList";
import { useConversation } from "./useConversation";
import { useDraft } from "./useDraft";
import { useSendMessage } from "./useSendMessage";
import { rpath } from "@/pages/resolver/lib/paths";

const STATE_EVENTS = new Set<UiEvent["type"]>(["consent_request", "party_form", "summary_approval"]);

function ClosedNotice({ reason, code }: { reason: string | null; code: string }) {
  return (
    <div className="composer composer--closed" role="status">
      <p>{pick(strings.chat.closed, reason ?? "generic", strings.chat.closed.generic)}</p>
      {reason === "not_joined" || reason === "declined" ? (
        <Link to={rpath(`/cases/${code}/welcome`)} className="btn btn--secondary btn--small">
          {strings.welcome.join}
        </Link>
      ) : (
        <Link to={rpath(`/cases/${code}`)} className="btn btn--secondary btn--small">
          {strings.cases.action.wait}
        </Link>
      )}
    </div>
  );
}

export default function ChatPage() {
  const { code = "" } = useParams();
  const qc = useQueryClient();
  const convo = useConversation(code);
  const me = useQuery({ queryKey: queryKeys.me, queryFn: authApi.me, staleTime: 60_000 });
  const [draft, setDraft, clearDraft] = useDraft(code);
  const [confirmDone, setConfirmDone] = useState(false);
  const opened = useRef(false);
  const { latest, setLatest, appendMessages, refresh } = convo;

  const onDelivered = useCallback(
    (items: ChatMessage[], res: SendMessageResponse) => {
      appendMessages(items);
      if (res.ui_events.some((e) => STATE_EVENTS.has(e.type) || e.type === "round_complete")) void refresh();
      void qc.invalidateQueries({ queryKey: queryKeys.case(code) });
    },
    [appendMessages, refresh, qc, code],
  );
  const sender = useSendMessage({ code, onDelivered, onClosed: () => void refresh() });
  const { messages } = convo;
  const { forget } = sender;

  // Messages the server already has (by client id), and those it has fully answered.
  const savedIds = useMemo(
    () => new Set(messages.map((m) => m.client_message_id).filter((id): id is string => Boolean(id))),
    [messages],
  );
  useEffect(() => {
    forget(messages.filter((m) => m.client_message_id && !m.awaiting_reply).map((m) => m.client_message_id!));
  }, [messages, forget]);

  // The safety notice is shown once: the current state if risk is high, else the latest message that raised it.
  const safety = useMemo(() => {
    const fromState = latest?.pending_events.find((e) => e.type === "emergency_resources");
    if (fromState?.type === "emergency_resources") return fromState;
    for (let i = messages.length - 1; i >= 0; i--) {
      const hit = messages[i]!.ui_events.find((e) => e.type === "emergency_resources");
      if (hit?.type === "emergency_resources") return hit;
    }
    return null;
  }, [latest, messages]);

  const action = useMutation({
    mutationFn: (fn: () => Promise<ConversationPage>) => fn(),
    onSuccess: (page) => {
      setLatest(page);
      void qc.invalidateQueries({ queryKey: queryKeys.case(code) });
      void qc.invalidateQueries({ queryKey: queryKeys.cases });
    },
  });

  // A follow-up round waiting for this person: open it so the conversation resumes with a welcome back.
  useEffect(() => {
    if (!latest || opened.current) return;
    if (latest.round?.status === "requested" && latest.input_allowed) {
      opened.current = true;
      action.mutate(() => conversationApi.open(code));
    }
  }, [latest, action, code]);

  if (convo.query.isPending) {
    return (
      <div className="chat">
        <div className="chat__scroll">
          <Skeleton count={4} height={56} />
        </div>
      </div>
    );
  }
  if (convo.query.isError || !latest) {
    return (
      <div className="alert alert--error row row--between" role="alert" style={{ margin: "1rem" }}>
        <span>{errorMessage(convo.query.error)}</span>
        <Button variant="secondary" size="small" onClick={() => void convo.query.refetch()}>
          {strings.errors.retry}
        </Button>
      </div>
    );
  }

  const send = (text: string) => {
    sender.send(text);
    clearDraft();
  };
  const actionError = action.error ? errorMessage(action.error) : null;

  const stateCards = latest.pending_events.map((e, i) => {
    switch (e.type) {
      case "consent_request":
        return <ConsentCard key={i} busy={action.isPending} onAnswer={(c) => action.mutate(() => conversationApi.consent(code, c))} />;
      case "party_form":
        return (
          <PartyFormCard
            key={i}
            initial={e.parties}
            ownEmail={me.data?.email ?? ""}
            busy={action.isPending}
            serverError={actionError}
            onConfirm={(parties: PartyDraft[]) => action.mutate(() => conversationApi.parties(code, parties))}
          />
        );
      case "summary_approval":
        return (
          <SummaryApprovalCard
            key={i}
            summary={e.summary}
            maxWords={e.max_words}
            busy={action.isPending}
            serverError={actionError}
            onApprove={(s) => action.mutate(() => conversationApi.approveSummary(code, s))}
          />
        );
      default:
        return null;
    }
  });

  return (
    <div className="chat">
      <div className="chat__header row row--between">
        <div>
          <h1 className="chat__title" tabIndex={-1}>
            {strings.chat.title}
          </h1>
          <span className="case-card__code">{code}</span>
        </div>
        <div className="row">
          {latest.can_complete && (
            <Button size="small" variant="secondary" onClick={() => setConfirmDone(true)}>
              {strings.chat.shareEverything}
            </Button>
          )}
          <Link className="btn btn--ghost btn--small" to={rpath(`/cases/${code}`)}>
            {strings.cases.action.wait}
          </Link>
        </div>
      </div>
      {safety && <SafetyLine resources={safety.resources} dismissible={safety.dismissible} />}
      <MessageList
        messages={messages}
        savedIds={savedIds}
        rounds={latest.rounds}
        pending={sender.pending}
        typing={sender.busy}
        hasOlder={Boolean(convo.query.hasNextPage)}
        loadingOlder={convo.query.isFetchingNextPage}
        onLoadOlder={() => void convo.query.fetchNextPage()}
        onRetry={sender.retry}
        footer={stateCards}
      />
      {latest.input_allowed ? (
        <Composer value={draft} onChange={setDraft} onSend={send} maxChars={latest.max_message_chars} busy={sender.busy} />
      ) : (
        <ClosedNotice reason={latest.input_disabled_reason} code={code} />
      )}
      <Dialog
        open={confirmDone}
        title={strings.chat.shareEverything}
        confirmLabel={strings.common.confirm}
        busy={action.isPending}
        onClose={() => setConfirmDone(false)}
        onConfirm={() => action.mutate(() => conversationApi.complete(code), { onSettled: () => setConfirmDone(false) })}
      >
        <p>{strings.chat.shareEverythingConfirm}</p>
      </Dialog>
    </div>
  );
}
