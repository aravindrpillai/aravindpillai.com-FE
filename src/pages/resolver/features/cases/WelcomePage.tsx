import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { casesApi } from "@/pages/resolver/api/endpoints/cases";
import { queryKeys } from "@/pages/resolver/api/queryKeys";
import { Button, Card, Dialog, Skeleton, Textarea } from "@/pages/resolver/components/ui";
import { fmt, strings } from "@/pages/resolver/i18n";
import { errorMessage } from "@/pages/resolver/lib/errors";
import { absoluteTime, shortDate } from "@/pages/resolver/lib/time";
import { rpath } from "@/pages/resolver/lib/paths";

export default function WelcomePage() {
  const { code = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const info = useQuery({ queryKey: queryKeys.welcome(code), queryFn: () => casesApi.welcome(code) });
  const [declineOpen, setDeclineOpen] = useState(params.get("decline") === "1");
  const [reason, setReason] = useState("");
  const [doNotContact, setDoNotContact] = useState(false);

  const join = useMutation({
    mutationFn: () => casesApi.join(code),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.conversation(code) });
      void qc.invalidateQueries({ queryKey: queryKeys.cases });
      navigate(rpath(`/cases/${code}/chat`));
    },
  });
  const decline = useMutation({
    mutationFn: () => casesApi.decline(code, reason, doNotContact),
    onSuccess: () => {
      setDeclineOpen(false);
      void info.refetch();
      void qc.invalidateQueries({ queryKey: queryKeys.cases });
    },
  });

  if (info.isPending) return <Skeleton count={4} height={48} />;
  if (info.isError) return <p className="alert alert--error">{errorMessage(info.error)}</p>;
  const d = info.data;
  const declined = d.my_status === "declined";
  const error = join.error ?? decline.error;

  return (
    <div className="stack" style={{ maxWidth: "40rem", margin: "0 auto" }}>
      <h1 tabIndex={-1}>{strings.welcome.title}</h1>
      <ul className="points">
        <li className="card">
          <h2>{strings.welcome.point1Title}</h2>
          <p>{strings.welcome.point1}</p>
        </li>
        <li className="card">
          <h2>{strings.welcome.point2Title}</h2>
          <p>{strings.welcome.point2}</p>
        </li>
        <li className="card">
          <h2>{strings.welcome.point3Title}</h2>
          <p>{strings.welcome.point3}</p>
        </li>
      </ul>
      {d.summary && (
        <Card>
          <h2>{strings.welcome.summaryHeading}</h2>
          <p>{d.summary}</p>
          {d.deadline_at && (
            <p className="small muted">
              <time dateTime={d.deadline_at} title={absoluteTime(d.deadline_at)}>
                {fmt(strings.welcome.deadline, { date: shortDate(d.deadline_at) })}
              </time>
            </p>
          )}
        </Card>
      )}
      {declined && (
        <p className="alert alert--info" role="status">
          {strings.welcome.declined} {d.can_join && strings.welcome.changeMind}
        </p>
      )}
      {error && (
        <p className="alert alert--error" role="alert">
          {errorMessage(error)}
        </p>
      )}
      <div className="row">
        {d.can_join && (
          <Button onClick={() => join.mutate()} busy={join.isPending}>
            {strings.welcome.join}
          </Button>
        )}
        {d.can_decline && !declined && (
          <Button variant="secondary" onClick={() => setDeclineOpen(true)}>
            {strings.welcome.decline}
          </Button>
        )}
        {!d.can_join && !d.can_decline && (
          <Button variant="secondary" onClick={() => navigate(rpath(`/cases/${code}`))}>
            {strings.cases.action.wait}
          </Button>
        )}
      </div>
      <Dialog
        open={declineOpen && d.can_decline}
        title={strings.welcome.declineTitle}
        confirmLabel={strings.welcome.declineConfirm}
        danger
        busy={decline.isPending}
        onClose={() => setDeclineOpen(false)}
        onConfirm={() => decline.mutate()}
      >
        <div className="stack">
          <Textarea label={strings.welcome.declineReason} value={reason} rows={3} onChange={(e) => setReason(e.target.value)} />
          <label className="row">
            <input type="checkbox" checked={doNotContact} onChange={(e) => setDoNotContact(e.target.checked)} />
            {strings.welcome.doNotContact}
          </label>
        </div>
      </Dialog>
    </div>
  );
}
