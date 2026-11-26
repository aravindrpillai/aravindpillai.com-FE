import { Button, Card } from "@/pages/resolver/components/ui";
import { strings } from "@/pages/resolver/i18n";

export function ConsentCard({ busy, onAnswer }: { busy: boolean; onAnswer: (consent: boolean) => void }) {
  return (
    <Card className="event-card stack" aria-labelledby="consent-title">
      <h2 id="consent-title">{strings.events.consentTitle}</h2>
      <p>{strings.events.consentBody}</p>
      <p className="small muted">{strings.welcome.point2}</p>
      <div className="row">
        <Button onClick={() => onAnswer(true)} busy={busy}>
          {strings.events.consentYes}
        </Button>
        <Button variant="secondary" onClick={() => onAnswer(false)} disabled={busy}>
          {strings.events.consentNo}
        </Button>
      </div>
    </Card>
  );
}
