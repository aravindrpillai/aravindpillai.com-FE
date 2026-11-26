import { useCallback, useEffect, useRef, useState } from "react";
import { readLocal, writeLocal } from "@/pages/resolver/lib/storage";

/** A per-conversation draft kept in localStorage, so a reload or expired session never loses text. */
export function useDraft(key: string): [string, (value: string) => void, () => void] {
  const storageKey = `resolver.draft.${key}`;
  const [value, setValue] = useState(() => readLocal(storageKey) ?? "");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => writeLocal(storageKey, value), 250);
    return () => window.clearTimeout(timer.current);
  }, [storageKey, value]);

  // Flush on unload so the last keystrokes survive.
  useEffect(() => {
    const flush = () => writeLocal(storageKey, value);
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [storageKey, value]);

  const clear = useCallback(() => {
    window.clearTimeout(timer.current);
    writeLocal(storageKey, null);
    setValue("");
  }, [storageKey]);

  return [value, setValue, clear];
}
