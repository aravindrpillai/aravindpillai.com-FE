import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { conversationApi } from "@/pages/resolver/api/endpoints/conversation";
import { queryKeys } from "@/pages/resolver/api/queryKeys";
import type { ChatMessage, ConversationPage } from "@/pages/resolver/api/types";

type Data = InfiniteData<ConversationPage, string | null>;

/** The conversation: page 0 is the newest; older pages load on scroll up via `before` cursors. */
export function useConversation(code: string) {
  const qc = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: queryKeys.conversation(code),
    queryFn: ({ pageParam }) => conversationApi.page(code, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.older_cursor,
    staleTime: 30_000,
  });

  const latest = query.data?.pages[0];
  const messages = useMemo<ChatMessage[]>(() => {
    const pages = query.data?.pages ?? [];
    const seen = new Set<string>();
    const out: ChatMessage[] = [];
    for (const page of [...pages].reverse()) {
      for (const m of page.messages) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          out.push(m);
        }
      }
    }
    return out;
  }, [query.data]);

  /** Replace page 0 with a fresh first page (after actions that return one), keeping older pages. */
  const setLatest = useCallback(
    (page: ConversationPage) => {
      qc.setQueryData<Data>(queryKeys.conversation(code), (old) =>
        old ? { ...old, pages: [page, ...old.pages.slice(1)] } : { pages: [page], pageParams: [null] },
      );
    },
    [qc, code],
  );

  /** Append confirmed messages to page 0 without a refetch. */
  const appendMessages = useCallback(
    (items: ChatMessage[]) => {
      qc.setQueryData<Data>(queryKeys.conversation(code), (old) => {
        if (!old || !old.pages[0]) return old;
        const first = old.pages[0];
        const known = new Set(first.messages.map((m) => m.id));
        const merged = [...first.messages, ...items.filter((m) => !known.has(m.id))];
        return { ...old, pages: [{ ...first, messages: merged }, ...old.pages.slice(1)] };
      });
    },
    [qc, code],
  );

  const refresh = useCallback(
    () => qc.invalidateQueries({ queryKey: queryKeys.conversation(code), refetchType: "active" }),
    [qc, code],
  );

  return { query, latest, messages, setLatest, appendMessages, refresh };
}
