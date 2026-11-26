import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ChatMessage, RoundInfo } from "@/pages/resolver/api/types";
import { Button } from "@/pages/resolver/components/ui";
import { strings } from "@/pages/resolver/i18n";
import { RoundCompleteCard } from "./events/RoundCompleteCard";
import { MessageBubble, PendingBubble } from "./MessageBubble";
import { RoundDivider } from "./RoundDivider";
import { TypingIndicator } from "./TypingIndicator";
import type { PendingMessage } from "./useSendMessage";

const NEAR_BOTTOM_PX = 120;

interface Props {
  messages: ChatMessage[];
  rounds: RoundInfo[];
  pending: PendingMessage[];
  typing: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onRetry: (clientId: string) => void;
  /** client_message_ids the server already has: their bubbles come from the server, not from `pending`. */
  savedIds: Set<string>;
  footer?: ReactNode;
}

export function MessageList({
  messages,
  rounds,
  pending,
  typing,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  onRetry,
  savedIds,
  footer,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const [showPill, setShowPill] = useState(false);
  const prevHeight = useRef<number | null>(null);
  const firstId = messages[0]?.id;
  const count = messages.length + pending.length + (typing ? 1 : 0);

  const scrollToBottom = useCallback(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
    setShowPill(false);
  }, []);

  // Keep the reading position when older messages are prepended.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && prevHeight.current !== null) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    }
  }, [firstId]);

  // Auto-scroll only when the reader is near the bottom; otherwise offer a "New message" pill.
  useEffect(() => {
    if (nearBottom.current) scrollToBottom();
    else setShowPill(true);
  }, [count, scrollToBottom]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (nearBottom.current) setShowPill(false);
    if (el.scrollTop < 80 && hasOlder && !loadingOlder) {
      prevHeight.current = el.scrollHeight;
      onLoadOlder();
    }
  };

  const roundByNumber = new Map(rounds.map((r) => [r.number, r]));
  let lastRound: number | null = null;

  return (
    <div className="chat__scroll" ref={scroller} onScroll={onScroll}>
      {loadingOlder && <p className="small muted" role="status">{strings.chat.loadingOlder}</p>}
      {hasOlder && !loadingOlder && (
        <Button variant="ghost" size="small" onClick={() => { prevHeight.current = scroller.current?.scrollHeight ?? null; onLoadOlder(); }}>
          {strings.chat.loadingOlder.replace("…", "")}
        </Button>
      )}
      <div role="log" aria-live="polite" aria-relevant="additions" aria-label={strings.chat.title}>
        {messages.map((m) => {
          const divider = m.round !== null && m.round !== lastRound && lastRound !== null ? roundByNumber.get(m.round) : undefined;
          if (m.round !== null) lastRound = m.round;
          return (
            <Fragment key={m.id}>
              {divider && <RoundDivider round={divider} />}
              <MessageBubble message={m} />
              {m.ui_events.some((e) => e.type === "round_complete") && <RoundCompleteCard />}
            </Fragment>
          );
        })}
        {pending.map((p) => (
          <PendingBubble key={p.clientId} item={p} onRetry={onRetry} saved={savedIds.has(p.clientId)} />
        ))}
        {typing && <TypingIndicator />}
      </div>
      {footer}
      {showPill && (
        <Button className="new-pill" size="small" onClick={scrollToBottom}>
          {strings.chat.newMessage} ↓
        </Button>
      )}
    </div>
  );
}
