import { createContext, useContext } from "react";

export interface PanelSession {
  token: string;
  logout: () => void;
  /** Shows the error; signs out on 401 (session expired / password changed). */
  fail: (err: unknown, fallback?: string) => void;
}

export const PanelContext = createContext<PanelSession | null>(null);

export function usePanel(): PanelSession {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error("usePanel outside AdminPage");
  return ctx;
}
