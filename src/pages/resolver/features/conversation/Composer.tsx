import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/pages/resolver/components/ui";
import { fmt, strings } from "@/pages/resolver/i18n";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  maxChars: number;
  busy: boolean;
}

const COUNTER_FROM = 0.8;

export function Composer({ value, onChange, onSend, maxChars, busy }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-grow up to the CSS max-height.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text) {
      setError(strings.chat.empty);
      return;
    }
    if (text.length > maxChars) {
      setError(fmt(strings.chat.tooLong, { max: maxChars }));
      return;
    }
    if (busy) return;
    setError(null);
    onSend(text);
    ref.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const showCounter = value.length >= maxChars * COUNTER_FROM;
  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="composer__row">
        <label htmlFor="composer-input" className="visually-hidden">
          {strings.chat.composerLabel}
        </label>
        <textarea
          id="composer-input"
          ref={ref}
          className="textarea composer__input"
          rows={1}
          placeholder={strings.chat.placeholder}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "composer-error" : showCounter ? "composer-count" : undefined}
          onChange={(e) => {
            onChange(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
        />
        <Button type="submit" disabled={busy} aria-label={busy ? strings.chat.sending : strings.chat.send}>
          {busy ? strings.chat.sending : strings.chat.send}
        </Button>
      </div>
      <div className="composer__footer">
        <span id="composer-error" className="field__error" role={error ? "alert" : undefined}>
          {error}
        </span>
        {showCounter && (
          <span id="composer-count" className={value.length > maxChars ? "field__error" : "muted"}>
            {fmt(strings.chat.charCount, { count: value.length, max: maxChars })}
          </span>
        )}
      </div>
    </form>
  );
}
