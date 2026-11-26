import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/pages/resolver/components/ui";
import { strings } from "@/pages/resolver/i18n";
import { errorMessage } from "@/pages/resolver/lib/errors";
import { useCreateCase } from "./hooks";
import { rpath } from "@/pages/resolver/lib/paths";

/** /cases/new: creates a case once and opens its chat. */
export default function NewCasePage() {
  const create = useCreateCase();
  const navigate = useNavigate();
  const started = useRef(false);
  const { mutate } = create;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mutate(undefined, { onSuccess: (res) => navigate(rpath(`/cases/${res.case.code}/chat`), { replace: true }) });
  }, [mutate, navigate]);

  if (create.isError) {
    return (
      <div className="alert alert--error row row--between" role="alert">
        <span>{errorMessage(create.error)}</span>
        <Button variant="secondary" size="small" onClick={() => mutate()}>
          {strings.errors.retry}
        </Button>
      </div>
    );
  }
  return (
    <p role="status" className="muted">
      {strings.cases.creating}
    </p>
  );
}
