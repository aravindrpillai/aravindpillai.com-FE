import { Providers } from "./providers";
import { ResolverRoutes } from "./router";
import "@/pages/resolver/styles/global.css";
import "@/pages/resolver/styles/print.css";

/**
 * Resolver (AI-assisted conflict resolution), mounted at /resolver/* in the site's router.
 * Its styles are scoped under .resolver so they never affect the rest of the site.
 * Backend: the Django `resolver` app at VITE_API_BASE_URL + "resolver/api/v1/".
 */
export default function ResolverApp() {
  return (
    <div className="resolver">
      <Providers>
        <ResolverRoutes />
      </Providers>
    </div>
  );
}
