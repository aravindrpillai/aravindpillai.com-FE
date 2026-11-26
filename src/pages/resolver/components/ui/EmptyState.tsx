import { useId, type ReactNode } from "react";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  const id = useId();
  return (
    <section className="card empty" aria-labelledby={id}>
      <h2 id={id} className="empty__title">
        {title}
      </h2>
      <p className="muted">{body}</p>
      {action}
    </section>
  );
}
