import type { ReportOption } from "@/pages/resolver/api/types";
import { Badge, Card } from "@/pages/resolver/components/ui";
import { strings } from "@/pages/resolver/i18n";

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <dt>{title}</dt>
      <dd>
        <ul>
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

export function OptionCard({ option }: { option: ReportOption }) {
  return (
    <Card className="option stack-sm">
      <div className="row row--between">
        <h3 style={{ margin: 0 }}>{option.title}</h3>
        <Badge tone="blue">{strings.report.optionType[option.type]}</Badge>
      </div>
      {option.steps.length > 0 && (
        <ol>
          {option.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
      <dl className="option__meta">
        <div>
          <dt>{strings.report.timeframe}</dt>
          <dd>{option.timeframe}</dd>
        </div>
        <div>
          <dt>{strings.report.cost}</dt>
          <dd>{option.cost}</dd>
        </div>
        <List title={strings.report.evidence} items={option.evidence_needed} />
        <List title={strings.report.pros} items={option.pros} />
        <List title={strings.report.cons} items={option.cons} />
      </dl>
    </Card>
  );
}
