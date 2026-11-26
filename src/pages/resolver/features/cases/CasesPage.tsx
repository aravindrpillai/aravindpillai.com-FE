import { useNavigate } from "react-router-dom";
import { Button, EmptyState, Skeleton } from "@/pages/resolver/components/ui";
import { strings } from "@/pages/resolver/i18n";
import { errorMessage } from "@/pages/resolver/lib/errors";
import { CaseCard } from "./CaseCard";
import { useCases, useCreateCase } from "./hooks";
import { rpath } from "@/pages/resolver/lib/paths";

export default function CasesPage() {
  const cases = useCases();
  const create = useCreateCase();
  const navigate = useNavigate();

  const start = () =>
    create.mutate(undefined, { onSuccess: (res) => navigate(rpath(`/cases/${res.case.code}/chat`)) });

  const startButton = (
    <Button onClick={start} busy={create.isPending}>
      {create.isPending ? strings.cases.creating : strings.cases.newCase}
    </Button>
  );

  const items = cases.data?.pages.flatMap((p) => p.results) ?? [];

  return (
    <div className="stack">
      <div className="page-head">
        <h1 tabIndex={-1}>{strings.cases.title}</h1>
        {items.length > 0 && startButton}
      </div>
      {create.error && <p className="alert alert--error">{errorMessage(create.error)}</p>}
      {cases.isPending ? (
        <Skeleton count={3} height={110} />
      ) : cases.isError ? (
        <div className="alert alert--error row row--between" role="alert">
          <span>{errorMessage(cases.error)}</span>
          <Button variant="secondary" size="small" onClick={() => void cases.refetch()}>
            {strings.errors.retry}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={strings.cases.emptyTitle} body={strings.cases.emptyBody} action={startButton} />
      ) : (
        <ul className="case-list">
          {items.map((item) => (
            <li key={item.code}>
              <CaseCard item={item} />
            </li>
          ))}
        </ul>
      )}
      {cases.hasNextPage && (
        <Button variant="secondary" onClick={() => void cases.fetchNextPage()} busy={cases.isFetchingNextPage}>
          {strings.cases.loadMore}
        </Button>
      )}
    </div>
  );
}
