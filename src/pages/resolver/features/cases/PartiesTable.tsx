import { useState } from "react";
import type { PartyView } from "@/pages/resolver/api/types";
import { Button, Dialog, Input } from "@/pages/resolver/components/ui";
import { fmt, strings } from "@/pages/resolver/i18n";
import { isValidEmail } from "@/pages/resolver/lib/validation";
import { absoluteTime, shortDate } from "@/pages/resolver/lib/time";
import { StatusChip } from "./StatusChip";

interface Props {
  parties: PartyView[];
  onWithdraw?: (partyId: string) => void;
  onFixEmail?: (partyId: string, email: string) => void;
  busy?: boolean;
}

function Eta({ eta }: { eta: PartyView["eta"] }) {
  if (eta === null) return <span aria-label="none">–</span>;
  if (eta === "in_progress") return <span>{strings.dashboard.inProgress}</span>;
  return (
    <time dateTime={eta} title={absoluteTime(eta)}>
      {fmt(strings.dashboard.by, { date: shortDate(eta) })}
    </time>
  );
}

export function PartiesTable({ parties, onWithdraw, onFixEmail, busy }: Props) {
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const emailError = email && !isValidEmail(email) ? strings.events.invalidEmail : null;

  return (
    <>
      <table className="parties">
        <caption className="visually-hidden">{strings.dashboard.parties}</caption>
        <thead>
          <tr>
            <th scope="col">{strings.dashboard.nameCol}</th>
            <th scope="col">{strings.dashboard.roleCol}</th>
            <th scope="col">{strings.dashboard.statusCol}</th>
            <th scope="col">{strings.dashboard.etaCol}</th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {parties.map((p) => (
            <tr key={p.id}>
              <td data-label={strings.dashboard.nameCol} className="parties__name">
                {p.display_name}
                {p.is_me && <span className="muted"> ({strings.dashboard.you})</span>}
              </td>
              <td data-label={strings.dashboard.roleCol}>{strings.cases.role[p.role]}</td>
              <td data-label={strings.dashboard.statusCol}>
                <StatusChip status={p.status} label={p.status_label} />
              </td>
              <td data-label={strings.dashboard.etaCol}>
                <Eta eta={p.eta} />
              </td>
              <td>
                <div className="row">
                  {p.can_fix_email && onFixEmail && (
                    <Button size="small" variant="secondary" onClick={() => setFixing(p.id)}>
                      {strings.dashboard.fixEmail}
                    </Button>
                  )}
                  {p.can_withdraw && onWithdraw && (
                    <Button size="small" variant="ghost" onClick={() => setWithdrawing(p.id)}>
                      {strings.dashboard.withdraw}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Dialog
        open={withdrawing !== null}
        title={strings.dashboard.withdrawConfirmTitle}
        danger
        busy={busy}
        confirmLabel={strings.dashboard.withdraw}
        onClose={() => setWithdrawing(null)}
        onConfirm={() => {
          if (withdrawing && onWithdraw) onWithdraw(withdrawing);
          setWithdrawing(null);
        }}
      >
        <p>{strings.dashboard.withdrawConfirmBody}</p>
      </Dialog>
      <Dialog
        open={fixing !== null}
        title={strings.dashboard.fixEmail}
        busy={busy}
        confirmLabel={strings.common.save}
        onClose={() => setFixing(null)}
        onConfirm={() => {
          if (fixing && onFixEmail && isValidEmail(email)) {
            onFixEmail(fixing, email.trim());
            setFixing(null);
            setEmail("");
          }
        }}
      >
        <Input
          label={strings.dashboard.fixEmailLabel}
          type="email"
          value={email}
          error={emailError}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Dialog>
    </>
  );
}
