import { useState } from "react";
import type { EmergencyResource } from "@/pages/resolver/api/types";
import { strings } from "@/pages/resolver/i18n";

/**
 * One compact line, shown once at the top of the chat. Not dismissible when risk is high.
 * The full list of contacts is in the tooltip and read out to screen readers.
 */
export function SafetyLine({ resources, dismissible }: { resources: EmergencyResource[]; dismissible: boolean }) {
  const [hidden, setHidden] = useState(false);
  if (hidden || resources.length === 0) return null;
  const [first, ...rest] = resources;
  const all = resources.map((r) => `${r.name}: ${r.contact}`).join(" · ");
  return (
    <div className="safety-line" role="alert" title={all}>
      <span aria-hidden="true">{"⚠️"}</span>
      <span className="safety-line__text">
        <strong>{strings.events.safetyLead}</strong> {first!.name}: <strong>{first!.contact}</strong>
        {rest.length > 0 && <span> · {rest.map((r) => `${r.name}: ${r.contact}`).join(" · ")}</span>}
      </span>
      <span className="visually-hidden">{all}</span>
      {dismissible && (
        <button type="button" className="msg__retry" onClick={() => setHidden(true)} aria-label={strings.common.close}>
          {"✕"}
        </button>
      )}
    </div>
  );
}
