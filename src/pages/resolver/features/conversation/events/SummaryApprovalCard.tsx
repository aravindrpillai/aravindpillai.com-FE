import { useEffect, useState } from "react";
import { Button, Card, Textarea } from "@/pages/resolver/components/ui";
import { fmt, strings } from "@/pages/resolver/i18n";
import { wordCount } from "@/pages/resolver/lib/validation";

interface Props {
  summary: string;
  maxWords: number;
  busy: boolean;
  serverError?: string | null;
  onApprove: (summary: string) => void;
}

export function SummaryApprovalCard({ summary, maxWords, busy, serverError, onApprove }: Props) {
  const [text, setText] = useState(summary);
  const [editing, setEditing] = useState(false);
  useEffect(() => setText(summary), [summary]);
  const words = wordCount(text);
  const tooLong = words > maxWords;

  return (
    <Card className="event-card stack" aria-labelledby="summary-title">
      <h2 id="summary-title">{strings.events.summaryTitle}</h2>
      <p className="muted">{strings.events.summaryIntro}</p>
      {editing ? (
        <Textarea
          label={strings.events.summaryTitle}
          hideLabel
          value={text}
          rows={4}
          error={tooLong ? fmt(strings.events.summaryTooLong, { max: maxWords }) : null}
          onChange={(e) => setText(e.target.value)}
        />
      ) : (
        <blockquote className="card" style={{ margin: 0 }}>
          {text}
        </blockquote>
      )}
      <p className={tooLong ? "small field__error" : "small muted"} aria-live="polite">
        {fmt(strings.events.summaryWords, { count: words, max: maxWords })}
      </p>
      {serverError && (
        <p className="alert alert--error" role="alert">
          {serverError}
        </p>
      )}
      <div className="row">
        <Button onClick={() => onApprove(text)} disabled={tooLong || !text.trim()} busy={busy}>
          {strings.events.approveSummary}
        </Button>
        {!editing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {strings.events.edit}
          </Button>
        )}
      </div>
    </Card>
  );
}
