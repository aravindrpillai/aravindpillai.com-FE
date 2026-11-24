import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AIProvider, ProviderId } from "@/lib/aiApi";

export interface ModelChoice {
  provider: ProviderId;
  model: string;
}

/** "claude-opus-5-5" -> "Opus 5.5", "gpt-5-mini" -> "GPT-5 mini". Unknown ids are shown as-is. */
export function prettyModel(model: string): string {
  const claude = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/.exec(model);
  if (claude) {
    const family = claude[1][0].toUpperCase() + claude[1].slice(1);
    return `${family} ${claude[2]}${claude[3] ? "." + claude[3] : ""}`;
  }
  const gpt = /^gpt-([\w.]+?)(?:-(mini|nano|pro|turbo))?$/.exec(model);
  if (gpt) return `GPT-${gpt[1]}${gpt[2] ? " " + gpt[2] : ""}`;
  return model;
}

export function ProviderDot({ provider, className = "" }: { provider: string; className?: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${provider === "openai" ? "bg-emerald-500" : "bg-[#d97757]"} ${className}`}
    />
  );
}

export function ModelPicker({
  providers,
  value,
  onChange,
  disabled,
}: {
  providers: AIProvider[];
  value: ModelChoice | null;
  onChange: (v: ModelChoice) => void;
  disabled?: boolean;
}) {
  const label = value ? prettyModel(value.model) : "Select model";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || !providers.length}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 outline-none"
      >
        {value && <ProviderDot provider={value.provider} />}
        <span className="font-medium">{label}</span>
        <ChevronDown size={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {providers.map((p, i) => (
          <div key={p.id}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <ProviderDot provider={p.id} /> {p.label}
            </DropdownMenuLabel>
            {p.models.map((m) => {
              const active = value?.provider === p.id && value.model === m;
              return (
                <DropdownMenuItem
                  key={m}
                  onSelect={() => onChange({ provider: p.id, model: m })}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="flex flex-col">
                    <span>{prettyModel(m)}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{m}</span>
                  </span>
                  {active && <Check size={15} className="text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
