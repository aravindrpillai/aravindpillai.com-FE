import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { CaseListItem } from "@/pages/resolver/api/types";
import { Badge, RelativeTime } from "@/pages/resolver/components/ui";
import { strings } from "@/pages/resolver/i18n";
import { prefetchCase } from "./hooks";
import { rpath } from "@/pages/resolver/lib/paths";

export function CaseCard({ item }: { item: CaseListItem }) {
  const qc = useQueryClient();
  const prefetch = () => prefetchCase(qc, item.code);
  const needsMe = !["wait", "none"].includes(item.action_needed);
  return (
    <Link to={rpath(`/cases/${item.code}`)} className="card card--link stack" onMouseEnter={prefetch} onFocus={prefetch}>
      <div className="case-card__top">
        <span className="case-card__code">{item.code}</span>
        <Badge tone={needsMe ? "amber" : "blue"}>{strings.cases.caseStatus[item.case_status]}</Badge>
      </div>
      <p>{item.summary || strings.cases.noSummary}</p>
      <div className="row row--between small muted">
        <span>{strings.cases.role[item.my_role]}</span>
        <span>
          {strings.cases.updated.split("{time}")[0]}
          <RelativeTime value={item.updated_at} />
        </span>
      </div>
      {needsMe && <span className="case-card__cta">{strings.cases.action[item.action_needed]} →</span>}
    </Link>
  );
}
