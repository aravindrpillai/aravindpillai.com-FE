import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { casesApi } from "@/pages/resolver/api/endpoints/cases";
import type { CaseAction, CaseDetail } from "@/pages/resolver/api/types";
import { Button, Card, Dialog, Skeleton } from "@/pages/resolver/components/ui";
import { fmt, strings } from "@/pages/resolver/i18n";
import { errorMessage } from "@/pages/resolver/lib/errors";
import { shortDate } from "@/pages/resolver/lib/time";
import { CaseProgress } from "./CaseProgress";
import { PartiesTable } from "./PartiesTable";
import { useCase, useCaseAction } from "./hooks";
import { rpath } from "@/pages/resolver/lib/paths";

function actionTarget(code: string, action: CaseAction): string | null {
  switch (action) {
    case "continue_story":
    case "give_consent":
    case "approve_summary":
    case "continue_conversation":
    case "answer_follow_up":
      return rpath(`/cases/${code}/chat`);
    case "respond_invite":
    case "rejoin":
      return rpath(`/cases/${code}/welcome`);
    case "read_report":
      return rpath(`/cases/${code}/report`);
    default:
      return null;
  }
}

function PrimaryAction({ detail }: { detail: CaseDetail }) {
  const target = actionTarget(detail.code, detail.my_action);
  if (!target) return null;
  return (
    <Link className="btn btn--primary" to={target}>
      {strings.cases.action[detail.my_action]}
    </Link>
  );
}

export default function CaseDashboardPage() {
  const { code = "" } = useParams();
  const query = useCase(code);
  const [confirm, setConfirm] = useState<"proceed" | "close" | null>(null);
  const proceed = useCaseAction(code, () => casesApi.proceed(code));
  const close = useCaseAction(code, () => casesApi.close(code));
  const partyMutation = useCaseAction(code, (run: () => Promise<CaseDetail>) => run());

  if (query.isPending) return <Skeleton count={4} height={60} />;
  if (query.isError) {
    return (
      <div className="alert alert--error row row--between" role="alert">
        <span>{errorMessage(query.error)}</span>
        <Button variant="secondary" size="small" onClick={() => void query.refetch()}>
          {strings.errors.retry}
        </Button>
      </div>
    );
  }
  const d = query.data;
  const mutationError = proceed.error ?? close.error ?? partyMutation.error;

  const runPartyAction = (run: () => Promise<CaseDetail>) => partyMutation.mutate(run);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="case-card__code">{d.code}</span>
          <h1 tabIndex={-1}>{strings.cases.caseStatus[d.status]}</h1>
        </div>
        <PrimaryAction detail={d} />
      </div>
      <CaseProgress step={d.progress_step} />
      {d.risk_high && (
        <p className="alert alert--warn">
          {d.others_involved ? strings.dashboard.riskNoticeOthers : strings.dashboard.riskNotice}
        </p>
      )}
      {d.status === "analysis_failed" && <p className="alert alert--info">{strings.dashboard.analysisFailed}</p>}
      {d.single_perspective && <p className="alert alert--info">{strings.dashboard.singlePerspective}</p>}
      {d.summary && (
        <Card>
          <p>{d.summary}</p>
        </Card>
      )}
      <Card className="stack">
        <h2>{strings.dashboard.parties}</h2>
        <PartiesTable
          parties={d.parties}
          busy={partyMutation.isPending}
          onWithdraw={(id) => runPartyAction(() => casesApi.withdrawParty(code, id))}
          onFixEmail={(id, email) => runPartyAction(() => casesApi.fixEmail(code, id, email))}
        />
      </Card>
      <Card className="next-steps">
        <h2>{strings.dashboard.whatNext}</h2>
        <p>{strings.dashboard.next[d.status]}</p>
      </Card>
      {mutationError && (
        <p className="alert alert--error" role="alert">
          {errorMessage(mutationError)}
        </p>
      )}
      <div className="row">
        {d.can_proceed && (
          <Button variant="secondary" onClick={() => setConfirm("proceed")}>
            {strings.dashboard.proceed}
          </Button>
        )}
        {!d.can_proceed && d.proceed_available_at && d.status === "gathering" && (
          <p className="small muted">{fmt(strings.dashboard.proceedAvailable, { date: shortDate(d.proceed_available_at) })}</p>
        )}
        {d.can_close && (
          <Button variant="ghost" onClick={() => setConfirm("close")}>
            {strings.dashboard.close}
          </Button>
        )}
        {!d.can_close && d.my_party.role === "reporter" && d.others_involved && d.status !== "closed" && (
          <p className="small muted">{strings.dashboard.othersInvolved}</p>
        )}
      </div>
      <Dialog
        open={confirm === "proceed"}
        title={strings.dashboard.proceedConfirmTitle}
        confirmLabel={strings.dashboard.proceed}
        busy={proceed.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => proceed.mutate(undefined, { onSettled: () => setConfirm(null) })}
      >
        <p>{strings.dashboard.proceedConfirmBody}</p>
      </Dialog>
      <Dialog
        open={confirm === "close"}
        title={strings.dashboard.closeConfirmTitle}
        confirmLabel={strings.dashboard.close}
        danger
        busy={close.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => close.mutate(undefined, { onSettled: () => setConfirm(null) })}
      >
        <p>{strings.dashboard.closeConfirmBody}</p>
      </Dialog>
    </div>
  );
}
