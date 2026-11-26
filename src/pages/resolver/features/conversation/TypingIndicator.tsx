import { strings } from "@/pages/resolver/i18n";

export function TypingIndicator() {
  return (
    <div className="msg msg--ai" role="status">
      <span className="typing" aria-label={strings.chat.typing}>
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
