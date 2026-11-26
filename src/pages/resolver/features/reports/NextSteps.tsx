import type { EmergencyResource } from "@/pages/resolver/api/types";
import { Card } from "@/pages/resolver/components/ui";

export function Bullets({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  if (!items.length) return null;
  const List = ordered ? "ol" : "ul";
  return (
    <Card className="report-section stack-sm">
      <h2>{title}</h2>
      <List>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </List>
    </Card>
  );
}

export function Resources({ title, items }: { title: string; items: EmergencyResource[] }) {
  if (!items.length) return null;
  return (
    <Card className="report-section stack-sm">
      <h2>{title}</h2>
      <ul>
        {items.map((r) => (
          <li key={`${r.name}-${r.contact}`}>
            <strong>{r.name}</strong>: {r.contact}
          </li>
        ))}
      </ul>
    </Card>
  );
}
