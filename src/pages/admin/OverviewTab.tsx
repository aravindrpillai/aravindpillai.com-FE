import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Bot, Loader2, MessageSquare, NotebookPen, Settings2Icon, TrendingUp, UserRound } from "lucide-react";
import { panelApi, relative, type Overview } from "@/lib/panelApi";
import { usePanel } from "./context";

function Card({
  to, icon: Icon, title, value, lines,
}: {
  to: string;
  icon: typeof UserRound;
  title: string;
  value: string | number;
  lines: React.ReactNode[];
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-4 rounded-2xl border-2 border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon size={16} /> {title}
        </span>
        <ArrowUpRight size={18} className="text-muted-foreground group-hover:text-primary" />
      </div>
      <div className="text-4xl font-display font-bold tabular-nums">{value}</div>
      <div className="space-y-0.5 text-sm text-muted-foreground">
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </Link>
  );
}

export default function OverviewTab() {
  const { token, fail } = usePanel();
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    panelApi.overview(token).then(setData).catch((e) => fail(e, "Failed to load overview"));
  }, [token, fail]);

  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const readyAI = data.ai.providers.filter((p) => p.ready);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <Card
        to="/admin/anonymous"
        icon={UserRound}
        title="Anonymous"
        value={data.anonymous.total}
        lines={[
          `${data.anonymous.last_7_days} in the last 7 days`,
          data.anonymous.latest ? `Latest ${relative(data.anonymous.latest)}` : "No messages yet",
        ]}
      />
      <Card
        to="/admin/qchat"
        icon={Settings2Icon}
        title="Maintenance"
        value={data.qchat.chats}
        lines={["server settings", "Needs password"]}
      />
      <Card
        to="/admin/notepad"
        icon={NotebookPen}
        title="Notepad"
        value={data.notepad.total}
        lines={[`${data.notepad.locked} PIN-locked`]}
      />
      <Card
        to="/admin/stocks"
        icon={TrendingUp}
        title="Stocks users"
        value={data.stocks.users}
        lines={[`${data.stocks.active} active · ${data.stocks.expired} expired`, `${data.stocks.runs} runs stored`]}
      />
      <Card
        to="/admin/ai"
        icon={Bot}
        title="AI providers"
        value={`${readyAI.length}/${data.ai.providers.length}`}
        lines={
          data.ai.providers.length
            ? data.ai.providers.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${p.ready ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                  {p.label} {p.ready ? "ready" : "not configured"}
                </span>
              ))
            : ["Not configured yet"]
        }
      />
    </div>
  );
}
