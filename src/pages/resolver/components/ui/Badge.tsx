import type { ReactNode } from "react";

export type BadgeTone = "grey" | "blue" | "amber" | "green" | "red";

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={`badge badge--${tone}`} data-tone={tone}>
      <span className="badge__dot" aria-hidden="true" />
      {children}
    </span>
  );
}
