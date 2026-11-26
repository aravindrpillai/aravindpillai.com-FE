import { Card } from "@/pages/resolver/components/ui";
import { strings } from "@/pages/resolver/i18n";

export function RoundCompleteCard() {
  return (
    <Card className="event-card" role="status">
      <h2>{strings.events.roundCompleteTitle}</h2>
      <p>{strings.events.roundCompleteBody}</p>
    </Card>
  );
}
