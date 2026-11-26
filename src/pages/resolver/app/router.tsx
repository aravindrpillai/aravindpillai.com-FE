import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout, RequireAuth } from "./App";

// Route-level code splitting: each page is its own chunk.
const LoginPage = lazy(() => import("@/pages/resolver/features/auth/LoginPage"));
const MagicLinkPage = lazy(() => import("@/pages/resolver/features/auth/MagicLinkPage"));
const ProfilePage = lazy(() => import("@/pages/resolver/features/auth/ProfilePage"));
const CasesPage = lazy(() => import("@/pages/resolver/features/cases/CasesPage"));
const NewCasePage = lazy(() => import("@/pages/resolver/features/cases/NewCasePage"));
const CaseDashboardPage = lazy(() => import("@/pages/resolver/features/cases/CaseDashboardPage"));
const WelcomePage = lazy(() => import("@/pages/resolver/features/cases/WelcomePage"));
const ChatPage = lazy(() => import("@/pages/resolver/features/conversation/ChatPage"));
const ReportPage = lazy(() => import("@/pages/resolver/features/reports/ReportPage"));

/** Routes relative to the /resolver/* mount point in the site's App.tsx. */
export function ResolverRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="m/:token" element={<MagicLinkPage />} />
        <Route element={<RequireAuth />}>
          <Route index element={<CasesPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="cases/new" element={<NewCasePage />} />
          <Route path="cases/:code" element={<CaseDashboardPage />} />
          <Route path="cases/:code/welcome" element={<WelcomePage />} />
          <Route path="cases/:code/chat" element={<ChatPage />} />
          <Route path="cases/:code/report" element={<ReportPage />} />
          <Route path="*" element={<CasesPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
