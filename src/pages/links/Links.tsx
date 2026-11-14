import { Link } from "react-router-dom";
import { ArrowUpRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminGate from "./AdminGate";

type Entry = { path: string; label: string; group: string; note?: string };

// Keep in sync with the routes in src/App.tsx.
const LINKS: Entry[] = [
  { path: "/anonymous/read", label: "Read anonymous messages", group: "Anonymous", note: "Password" },
  { path: "/listall/textbox", label: "All textboxes", group: "Textbox", note: "Admin" },
  { path: "/quickchat/register", label: "Register QC", group: "Quick Chat" },
];

export default function Links() {
  return (
    <AdminGate title="Links">
      {(_token, logout) => (
        <main className="min-h-screen bg-background">
          <div className="px-4 sm:px-6 py-8 sm:py-12 max-w-5xl mx-auto">
            <header className="flex items-start justify-between gap-4 mb-8">
              <div className="min-w-0">
                <h1 className="text-3xl sm:text-4xl font-display font-bold">
                  All <span className="text-gradient">Links</span>
                </h1>
                <p className="text-sm text-muted-foreground mt-2">Admin pages.</p>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl shrink-0"
                title="Lock"
                onClick={logout}
              >
                <LogOut size={16} />
              </Button>
            </header>

            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {LINKS.map((e) => (
                <li key={e.path}>
                  <Link
                    to={e.path}
                    className="group flex h-full flex-col justify-between gap-6 rounded-2xl border-2 border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {e.group}
                      </span>
                      <ArrowUpRight
                        size={18}
                        className="shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg font-semibold leading-snug">{e.label}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <code className="text-xs text-muted-foreground break-all">{e.path}</code>
                        {e.note && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {e.note}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </main>
      )}
    </AdminGate>
  );
}
