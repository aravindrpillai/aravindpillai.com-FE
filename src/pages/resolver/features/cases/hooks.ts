import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { newId } from "@/pages/resolver/api/client";
import { casesApi } from "@/pages/resolver/api/endpoints/cases";
import { queryKeys } from "@/pages/resolver/api/queryKeys";
import type { CaseDetail } from "@/pages/resolver/api/types";
import { useAdaptiveRefetch } from "@/pages/resolver/hooks/usePolling";

export const POLL_MS = 15_000;

export function useCases() {
  return useInfiniteQuery({
    queryKey: queryKeys.cases,
    queryFn: ({ pageParam }) => casesApi.list(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });
}

export function useCase(code: string) {
  const refetchInterval = useAdaptiveRefetch(POLL_MS);
  return useQuery<CaseDetail>({ queryKey: queryKeys.case(code), queryFn: () => casesApi.detail(code), refetchInterval });
}

export function prefetchCase(qc: QueryClient, code: string): void {
  void qc.prefetchQuery({ queryKey: queryKeys.case(code), queryFn: () => casesApi.detail(code), staleTime: 10_000 });
}

export function useCreateCase() {
  // One idempotency key per attempt: a double click or network retry creates one case.
  const [key, setKey] = useState(newId);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => casesApi.create(key),
    onSuccess: () => {
      setKey(newId());
      void qc.invalidateQueries({ queryKey: queryKeys.cases });
    },
  });
}

export function useCaseAction<V = void>(code: string, fn: (variables: V) => Promise<CaseDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.case(code), data);
      void qc.invalidateQueries({ queryKey: queryKeys.cases });
    },
    onError: () => void qc.invalidateQueries({ queryKey: queryKeys.case(code) }),
  });
}
