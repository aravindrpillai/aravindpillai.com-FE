import type { ChatMessage } from "@/pages/resolver/api/types";
import { Button, RelativeTime } from "@/pages/resolver/components/ui";
import { strings } from "@/pages/resolver/i18n";
import type { PendingMessage } from "./useSendMessage";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const kind = message.sender === "party" ? "me" : message.sender === "ai" ? "ai" : "system";
  return (
    <div className={`msg msg--${kind}`}>
      <div className="msg__bubble">
        <span className="visually-hidden">{kind === "me" ? strings.chat.you : strings.chat.ai}: </span>
        {message.content}
        {kind !== "system" && (
          <div className="msg__meta">
            <RelativeTime value={message.created_at} />
          </div>
        )}
      </div>
    </div>
  );
}

export function PendingBubble({
  item,
  onRetry,
  saved,
}: {
  item: PendingMessage;
  onRetry: (id: string) => void;
  /** The server already has this message (its bubble is in the history): show only the retry notice. */
  saved: boolean;
}) {
  const label =
    item.status === "sending" ? strings.chat.sending : item.status === "failed" ? strings.chat.notSent : strings.chat.sent;
  return (
    <>
      {!saved && (
      <div className="msg msg--me" data-status={item.status}>
        <div className="msg__bubble">
          <span className="visually-hidden">{strings.chat.you}: </span>
          {item.content}
          <div className="msg__meta">
            <span>{label}</span>
            {item.status === "failed" && (
              <>
                {" – "}
                <button type="button" className="msg__retry" onClick={() => onRetry(item.clientId)}>
                  {strings.chat.retry}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      )}
      {item.status === "ai_failed" && (
        <div className="msg msg--ai" role="alert">
          <div className="msg__bubble">
            {strings.chat.aiTrouble}{" "}
            <Button size="small" variant="secondary" onClick={() => onRetry(item.clientId)}>
              {strings.chat.retryAi}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
