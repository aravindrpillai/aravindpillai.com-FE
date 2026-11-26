import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clearEtagCache, tokenStore } from "@/pages/resolver/api/client";
import { authApi } from "@/pages/resolver/api/endpoints/auth";

interface AuthState {
  token: string | null;
  sessionExpired: boolean;
  signIn: (token: string) => void;
  signOut: (everywhere?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => tokenStore.get());
  const [sessionExpired, setSessionExpired] = useState(false);
  const queryClient = useQueryClient();

  useEffect(
    () =>
      tokenStore.onUnauthorized(() => {
        // RequireAuth redirects with ?next=<current path>, so the user returns to the same screen;
        // drafts live in localStorage and survive.
        setToken(null);
        setSessionExpired(true);
        clearEtagCache();
      }),
    [],
  );

  const signIn = useCallback((value: string) => {
    tokenStore.set(value);
    setToken(value);
    setSessionExpired(false);
  }, []);

  const signOut = useCallback(
    async (everywhere = false) => {
      try {
        await authApi.logout(everywhere);
      } finally {
        tokenStore.set(null);
        setToken(null);
        clearEtagCache();
        queryClient.clear();
      }
    },
    [queryClient],
  );

  const value = useMemo(() => ({ token, sessionExpired, signIn, signOut }), [token, sessionExpired, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
