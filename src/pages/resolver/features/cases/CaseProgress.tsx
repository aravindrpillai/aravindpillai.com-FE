import type { ProgressStep } from "@/pages/resolver/api/types";
import { strings } from "@/pages/resolver/i18n";

const STEPS: ProgressStep[] = ["story", "others", "analysis", "report"];

export function CaseProgress({ step }: { step: ProgressStep }) {
  const current = STEPS.indexOf(step);
  return (
    <ol className="progress" aria-label="Progress">
      {STEPS.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li
            key={s}
            className={`progress__step progress__step--${state}`}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="progress__dot" aria-hidden="true">
              {state === "done" ? "✓" : i + 1}
            </span>
            <span>
              <span className="visually-hidden">
                {state === "done" ? "Completed: " : state === "current" ? "Current: " : "Upcoming: "}
              </span>
              {strings.dashboard.steps[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
