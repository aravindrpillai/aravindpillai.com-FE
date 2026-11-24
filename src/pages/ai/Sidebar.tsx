import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, MoreHorizontal, PanelLeftClose, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AIConversationSummary } from "@/lib/aiApi";

function groupOf(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) return "Today";
  if (t >= startOfToday - 86400000) return "Yesterday";
  if (t >= startOfToday - 7 * 86400000) return "Previous 7 days";
  if (t >= startOfToday - 30 * 86400000) return "Previous 30 days";
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

export function Sidebar({
  conversations,
  activeSlug,
  onNew,
  onRename,
  onDelete,
  onClose,
  onLogout,
  onNavigate,
  user,
}: {
  conversations: AIConversationSummary[];
  user: string;
  activeSlug: string | null;
  onNew: () => void;
  onRename: (slug: string, title: string) => void;
  onDelete: (slug: string) => void;
  onClose: () => void;
  onLogout: () => void;
  onNavigate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AIConversationSummary | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? conversations.filter((c) => c.title.toLowerCase().includes(q) || c.slug.includes(q))
      : conversations;
    const out: { label: string; items: AIConversationSummary[] }[] = [];
    for (const c of filtered) {
      const label = groupOf(c.updated_at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(c);
      else out.push({ label, items: [c] });
    }
    return out;
  }, [conversations, query]);

  const commitRename = (slug: string) => {
    const title = draft.trim();
    setEditing(null);
    if (title) onRename(slug, title);
  };

  return (
    <aside className="flex h-full w-72 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between px-3 pt-3">
        <Link to="/" className="px-2 font-display text-lg font-semibold">
          AI <span className="text-sm font-normal text-muted-foreground">· {user}</span>
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close sidebar"
          title="Close sidebar"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      <div className="space-y-2 px-3 pt-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plus size={15} strokeWidth={2.5} />
          </span>
          New chat
        </button>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <nav className="mt-3 flex-1 overflow-y-auto px-2 pb-3">
        {groups.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {query ? "No chats match." : "No conversations yet."}
          </p>
        )}
        {groups.map((g) => (
          <div key={g.label} className="mb-3">
            <div className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">{g.label}</div>
            {g.items.map((c) => {
              const active = c.slug === activeSlug;
              if (editing === c.slug) {
                return (
                  <input
                    key={c.slug}
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commitRename(c.slug)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(c.slug);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="w-full rounded-lg border border-primary bg-background px-3 py-1.5 text-sm outline-none"
                  />
                );
              }
              return (
                <div
                  key={c.slug}
                  className={`group relative flex items-center rounded-lg transition-colors ${
                    active ? "bg-muted" : "hover:bg-muted/60"
                  }`}
                >
                  <Link
                    to={`/ai/${user}/${c.slug}`}
                    onClick={onNavigate}
                    title={c.title}
                    className="min-w-0 flex-1 truncate px-3 py-1.5 text-sm"
                  >
                    {c.title}
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={`mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground outline-none ${
                        active ? "opacity-100" : "opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                      }`}
                      aria-label="Chat options"
                    >
                      <MoreHorizontal size={15} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem
                        onSelect={() => {
                          setDraft(c.title);
                          setEditing(c.slug);
                        }}
                        className="cursor-pointer"
                      >
                        <Pencil size={14} className="mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setConfirmDelete(c)}
                        className="cursor-pointer text-red-600 focus:text-red-600"
                      >
                        <Trash2 size={14} className="mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut size={15} /> Lock
        </button>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              “{confirmDelete?.title}” and its files will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => confirmDelete && onDelete(confirmDelete.slug)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
