import { useQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useRef } from "react";
import { Link, Navigate, Outlet, useLocation, useMatch } from "react-router-dom";
import { authApi } from "@/pages/resolver/api/endpoints/auth";
import { queryKeys } from "@/pages/resolver/api/queryKeys";
import { Button, Skeleton } from "@/pages/resolver/components/ui";
import { useAuth } from "@/pages/resolver/features/auth/useAuth";
import { useOnline } from "@/pages/resolver/hooks/useOnline";
import { strings } from "@/pages/resolver/i18n";
import { ErrorBoundary } from "./ErrorBoundary";
import { rpath } from "@/pages/resolver/lib/paths";

function Banners() {
  const online = useOnline();
  const config = useQuery({ queryKey: queryKeys.authConfig, queryFn: authApi.config, staleTime: Infinity });
  return (
    <>
      {config.data?.development_mode && <div className="banner banner--dev">{strings.app.devBanner}</div>}
      {!online && (
        <div className="banner banner--offline" role="status">
          {strings.app.offline}
        </div>
      )}
    </>
  );
}

/** After navigation, move focus to the page heading (or main) so screen readers announce the new page. */
function useRouteFocus() {
  const location = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>("main h1") ?? document.getElementById("main");
      target?.focus({ preventScroll: false });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);
}

export function Layout() {
  const { token, signOut } = useAuth();
  const isChat = useMatch(rpath("/cases/:code/chat")) !== null;
  useRouteFocus();
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {strings.app.skipToContent}
      </a>
      <Banners />
      <header className="topbar">
        <Link to={rpath("/")} className="topbar__brand">
          <span className="topbar__logo" aria-hidden="true">
            R
          </span>
          {strings.app.name}
        </Link>
        {token && (
          <nav className="topbar__nav" aria-label="Main">
            <Link className="btn btn--ghost btn--small" to={rpath("/")}>
              {strings.app.myCases}
            </Link>
            <Link className="btn btn--ghost btn--small" to={rpath("/profile")}>
              {strings.app.profile}
            </Link>
            <Button variant="ghost" size="small" onClick={() => void signOut(false)}>
              {strings.app.signOut}
            </Button>
          </nav>
        )}
      </header>
      <main id="main" tabIndex={-1} className={isChat ? "main main--chat" : "main"}>
        <ErrorBoundary>
          <Suspense fallback={<Skeleton count={3} height={48} />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}

export function RequireAuth() {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) {
    return <Navigate to={`${rpath("/login")}?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <Outlet />;
}
