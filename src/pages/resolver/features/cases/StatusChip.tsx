import type { PartyStatus } from "@/pages/resolver/api/types";
import { Badge, type BadgeTone } from "@/pages/resolver/components/ui";
import { strings } from "@/pages/resolver/i18n";

export const STATUS_TONE: Record<PartyStatus, BadgeTone> = {
  not_invited: "grey",
  expired: "grey",
  withdrawn: "grey",
  invited: "blue",
  viewed: "blue",
  in_progress: "blue",
  follow_up_requested: "amber",
  bounced: "amber",
  info_gathered: "green",
  declined: "red",
};

/** Colour plus a text label, always (colour alone never carries meaning). */
export function StatusChip({ status, label }: { status: PartyStatus; label?: string }) {
  return <Badge tone={STATUS_TONE[status]}>{label ?? strings.status[status]}</Badge>;
}
