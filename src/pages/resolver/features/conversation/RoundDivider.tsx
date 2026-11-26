import type { RoundInfo } from "@/pages/resolver/api/types";
import { fmt, strings } from "@/pages/resolver/i18n";
import { shortDate } from "@/pages/resolver/lib/time";

export function RoundDivider({ round }: { round: RoundInfo }) {
  const date = round.requested_at ? shortDate(round.requested_at) : "";
  const template = round.reason === "follow_up" ? strings.chat.roundDivider : strings.chat.initialDivider;
  return (
    <div className="divider" role="separator">
      {fmt(template, { date })}
    </div>
  );
}
