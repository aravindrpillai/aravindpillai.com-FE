import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { reportsApi } from "@/pages/resolver/api/endpoints/reports";
import { queryKeys } from "@/pages/resolver/api/queryKeys";
import type { PrivateReport, SharedReport } from "@/pages/resolver/api/types";
import { Button, Card, Skeleton } from "@/pages/resolver/components/ui";
import { strings } from "@/pages/resolver/i18n";
import { errorMessage } from "@/pages/resolver/lib/errors";
import { rpath } from "@/pages/resolver/lib/paths";
import { Bullets, Resources } from "./NextSteps";
import { OptionCard } from "./OptionCard";

function Private({ report }: { report: PrivateReport }) {
  const r = strings.report;
  return (
    <section className="stack" aria-labelledby="private-title">
      <div>
        <span className="eyebrow">{r.privateIntro}</span>
        <h2 id="private-title">{r.private}</h2>
      </div>
      {report.personal_note && (
        <Card className="report-section">
          <p className="report-note">{report.personal_note}</p>
        </Card>
      )}
      <Card className="report-section stack-sm">
        <p>{report.situation_summary}</p>
      </Card>
      {report.your_options.length > 0 && (
        <div className="stack">
          <h2>{r.options}</h2>
          {report.your_options.map((o) => (
            <OptionCard key={o.title} option={o} />
          ))}
        </div>
      )}
      <Card className="report-section stack-sm">
        <h2>{r.legal}</h2>
        <p style={{ whiteSpace: "pre-line" }}>{report.legal_position}</p>
      </Card>
      {report.your_actions_and_consequences.length > 0 && (
        <div className="stack">
          <h2>{r.consequences}</h2>
          {report.your_actions_and_consequences.map((a) => (
            <Card key={a.what_you_did} className="consequence stack-sm">
              <h3>{a.what_you_did}</h3>
              <p>{a.possible_consequences}</p>
              <div className="consequence__fix">
                <strong>{r.makeItRight}: </strong>
                {a.how_to_make_it_right}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Bullets title={r.wellbeing} items={report.emotional_wellbeing} />
      <Bullets title={r.nextSteps} items={report.recommended_next_steps} ordered />
      <Resources title={r.resources} items={report.support_resources} />
      <p className="disclaimer">{report.disclaimer}</p>
    </section>
  );
}

function Shared({ report }: { report: SharedReport }) {
  const r = strings.report;
  return (
    <section className="stack" aria-labelledby="shared-title">
      <div>
        <span className="eyebrow">{r.sharedIs}</span>
        <h2 id="shared-title">{r.shared}</h2>
      </div>
      <Card className="report-section">
        <p>{report.situation_summary}</p>
      </Card>
      <Bullets title={r.agreed} items={report.what_is_agreed} />
      <Bullets title={r.disputed} items={report.what_is_disputed} />
      <Bullets title={r.paths} items={report.paths_to_resolution} />
      <Bullets title={r.missing} items={report.missing_perspectives} />
    </section>
  );
}

export default function ReportPage() {
  const { code = "" } = useParams();
  const query = useQuery({ queryKey: queryKeys.reports(code), queryFn: () => reportsApi.get(code) });

  if (query.isPending) return <Skeleton count={5} height={80} />;
  if (query.isError) return <p className="alert alert--error">{errorMessage(query.error)}</p>;
  const d = query.data;
  if (!d.ready) {
    return (
      <Card className="stack">
        <h1 tabIndex={-1}>{strings.report.title}</h1>
        <p className="muted">{strings.report.notReady}</p>
        <Link className="btn btn--secondary" to={rpath(`/cases/${code}`)}>
          {strings.cases.action.wait}
        </Link>
      </Card>
    );
  }
  return (
    <article className="stack">
      <div className="page-head">
        <div>
          <span className="case-card__code">{code}</span>
          <h1 tabIndex={-1}>{strings.report.title}</h1>
        </div>
        <Button variant="secondary" className="no-print" onClick={() => window.print()}>
          {strings.report.print}
        </Button>
      </div>
      {d.mine && <Private report={d.mine} />}
      {d.shared && <Shared report={d.shared} />}
    </article>
  );
}
