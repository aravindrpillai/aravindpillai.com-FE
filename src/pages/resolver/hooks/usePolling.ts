import { useCallback, useRef } from "react";
import { useOnline } from "./useOnline";
import { useVisible } from "./useVisibility";

export const MAX_INTERVAL_MS = 60_000;
export const UNCHANGED_BEFORE_BACKOFF = 5;

export function nextInterval(baseMs: number, unchangedCount: number): number {
  return unchangedCount >= UNCHANGED_BEFORE_BACKOFF ? MAX_INTERVAL_MS : baseMs;
}

interface Tracker {
  data: unknown;
  at: number;
  unchanged: number;
}

/**
 * A react-query refetchInterval function: paused while offline or in a hidden tab, and backing off
 * to 60 s after 5 unchanged responses (ETag 304s return the same object, so identity means unchanged).
 */
export function useAdaptiveRefetch(baseMs: number) {
  const online = useOnline();
  const visible = useVisible();
  const tracker = useRef<Tracker>({ data: undefined, at: 0, unchanged: 0 });
  return useCallback(
    (query: { state: { data: unknown; dataUpdatedAt: number } }): number | false => {
      const t = tracker.current;
      const { data, dataUpdatedAt } = query.state;
      if (dataUpdatedAt !== t.at) {
        t.unchanged = t.at !== 0 && data === t.data ? t.unchanged + 1 : 0;
        t.data = data;
        t.at = dataUpdatedAt;
      }
      if (!online || !visible) return false;
      return nextInterval(baseMs, t.unchanged);
    },
    [baseMs, online, visible],
  );
}
