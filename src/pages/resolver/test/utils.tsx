import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation, type Location } from "react-router-dom";
import { tokenStore } from "@/pages/resolver/api/client";
import { makeQueryClient, Providers } from "@/pages/resolver/app/providers";
import { ResolverRoutes } from "@/pages/resolver/app/router";
import { rpath } from "@/pages/resolver/lib/paths";

function LocationSpy({ onChange }: { onChange: (l: Location) => void }) {
  onChange(useLocation());
  return null;
}

/** Render the real Resolver routes at `path` (relative to /resolver), as mounted in the site. */
export function renderApp(path: string, { signedIn = true }: { signedIn?: boolean } = {}) {
  if (signedIn) tokenStore.set("test-token");
  const client = makeQueryClient();
  client.setDefaultOptions({ queries: { retry: false, staleTime: 0 } });
  const current: { location: Location | null } = { location: null };
  const utils = render(
    <Providers client={client}>
      <MemoryRouter initialEntries={[rpath(path)]}>
        <LocationSpy onChange={(l) => (current.location = l)} />
        <div className="resolver">
          <Routes>
            <Route path="/resolver/*" element={<ResolverRoutes />} />
          </Routes>
        </div>
      </MemoryRouter>
    </Providers>,
  );
  return { ...utils, client, location: () => current.location! };
}

export function renderWithProviders(ui: ReactElement) {
  const client = makeQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(<Providers client={client}>{ui}</Providers>);
}
