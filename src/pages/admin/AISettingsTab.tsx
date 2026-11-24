import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Dices, Eye, EyeOff, KeyRound, Loader2, Lock, Plus, Save, Star, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate, panelApi, type AIProvider, type AIProviderUpdate } from "@/lib/panelApi";
import { usePanel } from "./context";
import AIUsersCard from "./AIUsersCard";

const USED_BY: Record<string, string> = {
  claude: "Used by the /ai page and the stocks pipeline (news extraction, classification, review).",
  openai: "Used by the /ai page.",
};

interface Draft {
  enabled: boolean;
  newKey: string;
  base_url: string;
  organization: string;
  models: string[];
  max_tokens: string;
  temperature: string;
  top_p: string;
  system_prompt: string;
}

const toDraft = (p: AIProvider): Draft => ({
  enabled: p.enabled,
  newKey: "",
  base_url: p.base_url,
  organization: p.organization,
  models: p.models,
  max_tokens: String(p.max_tokens),
  temperature: p.temperature === null ? "" : String(p.temperature),
  top_p: p.top_p === null ? "" : String(p.top_p),
  system_prompt: p.system_prompt,
});

function ModelsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const items = draft.split(",").map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    onChange([...value, ...items.filter((m) => !value.includes(m))]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((m, i) => (
          <span
            key={m}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-mono ${
              i === 0 ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/50"
            }`}
          >
            {i === 0 && <Star size={11} className="fill-current" />}
            {m}
            {i !== 0 && (
              <button type="button" title="Make default" className="ml-0.5 opacity-60 hover:opacity-100" onClick={() => onChange([m, ...value.filter((x) => x !== m)])}>
                <Star size={11} />
              </button>
            )}
            <button type="button" title="Remove" className="opacity-60 hover:opacity-100" onClick={() => onChange(value.filter((x) => x !== m))}>
              <X size={12} />
            </button>
          </span>
        ))}
        {value.length === 0 && <span className="text-xs text-red-600">Add at least one model</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add model id…"
          className="h-9 rounded-xl font-mono text-sm"
        />
        <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl" onClick={add}>
          <Plus size={14} />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">The starred model is the default on the /ai page.</p>
    </div>
  );
}

function ProviderCard({ provider, onSaved }: { provider: AIProvider; onSaved: (p: AIProvider) => void }) {
  const { token, fail } = usePanel();
  const [d, setD] = useState<Draft>(() => toDraft(provider));
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testedModels, setTestedModels] = useState<string[] | null>(null);

  useEffect(() => setD(toDraft(provider)), [provider]);

  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const base = toDraft(provider);
  const dirty = JSON.stringify({ ...d, newKey: "" }) !== JSON.stringify(base) || !!d.newKey.trim();

  const save = async (extra: AIProviderUpdate = {}) => {
    if (!d.models.length) return toast.error("Add at least one model");
    setSaving(true);
    try {
      const body: AIProviderUpdate = {
        enabled: d.enabled,
        base_url: d.base_url,
        organization: d.organization,
        models: d.models,
        max_tokens: Number(d.max_tokens),
        temperature: d.temperature,
        top_p: d.top_p,
        system_prompt: d.system_prompt,
        ...extra,
      };
      if (d.newKey.trim() && !extra.clear_api_key) body.api_key = d.newKey.trim();
      const saved = await panelApi.updateAIProvider(token, provider.provider, body);
      onSaved(saved);
      toast.success(`${provider.label} saved`);
    } catch (e) {
      fail(e, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestedModels(null);
    try {
      const r = await panelApi.testAIProvider(token, provider.provider, { api_key: d.newKey.trim() || undefined, base_url: d.base_url || undefined });
      setTestedModels(r.models);
      toast.success(`${provider.label} key works`);
    } catch (e) {
      fail(e, "Key test failed");
    } finally {
      setTesting(false);
    }
  };

  const setDefault = async () => {
    try {
      onSaved(await panelApi.updateAIProvider(token, provider.provider, { is_default: true }));
      toast.success(`${provider.label} is now the default on /ai`);
    } catch (e) {
      fail(e);
    }
  };

  return (
    <section className="rounded-2xl border-2 border-border bg-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold">{provider.label}</h2>
            {provider.ready ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 size={12} /> Ready
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Not ready</span>
            )}
            {provider.is_default && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Star size={11} className="fill-current" /> Default
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{USED_BY[provider.provider]}</p>
        </div>
        {!provider.is_default && (
          <Button variant="outline" size="sm" className="rounded-xl" onClick={setDefault}>
            Make default
          </Button>
        )}
        <label className="flex items-center gap-2 text-sm">
          Enabled <Switch checked={d.enabled} onCheckedChange={(v) => set({ enabled: v })} />
        </label>
      </header>

      <div className="grid gap-6 p-5 lg:grid-cols-2">
        {/* Key */}
        <div className="space-y-2 lg:col-span-2">
          <Label className="flex items-center gap-2">
            <KeyRound size={14} /> API key
          </Label>
          <div className="text-sm">
            {provider.api_key_unreadable ? (
              <span className="text-red-600">The stored key can't be decrypted (SECRET_KEY changed?). Enter it again.</span>
            ) : provider.api_key_set ? (
              <span className="text-muted-foreground">
                Saved: <code className="font-mono text-foreground">{provider.api_key_hint}</code>
                {provider.updated_at && <> · updated {fmtDate(provider.updated_at)}</>}
              </span>
            ) : (
              <span className="text-amber-700">No key saved.</span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={d.newKey}
                onChange={(e) => set({ newKey: e.target.value })}
                placeholder={provider.api_key_set ? "Paste a new key to replace it" : "Paste the API key"}
                autoComplete="off"
                className="h-10 rounded-xl pr-10 font-mono"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowKey((v) => !v)}
                title={showKey ? "Hide" : "Show"}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <Button variant="outline" className="h-10 rounded-xl gap-2" onClick={test} disabled={testing || (!d.newKey.trim() && !provider.api_key_set)}>
              {testing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} Test
            </Button>
            {provider.api_key_set && (
              <Button
                variant="ghost"
                className="h-10 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => {
                  if (window.confirm(`Remove the ${provider.label} API key? Apps using it stop working until a new key is saved.`)) {
                    save({ clear_api_key: true });
                  }
                }}
              >
                Remove key
              </Button>
            )}
          </div>
          {testedModels && (
            <p className="text-xs text-emerald-700">
              Key works · {testedModels.length} models available
              {testedModels.length > 0 && (
                <span className="text-muted-foreground"> ({testedModels.slice(0, 6).join(", ")}{testedModels.length > 6 ? ", …" : ""})</span>
              )}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Models</Label>
          <ModelsEditor value={d.models} onChange={(models) => set({ models })} />
        </div>

        <div className="grid grid-cols-3 gap-3 content-start">
          <div className="space-y-2">
            <Label>Max tokens</Label>
            <Input inputMode="numeric" value={d.max_tokens} onChange={(e) => set({ max_tokens: e.target.value.replace(/\D/g, "") })} className="h-10 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Temperature</Label>
            <Input value={d.temperature} onChange={(e) => set({ temperature: e.target.value })} placeholder="default" className="h-10 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Top P</Label>
            <Input value={d.top_p} onChange={(e) => set({ top_p: e.target.value })} placeholder="default" className="h-10 rounded-xl" />
          </div>
          <p className="col-span-3 text-xs text-muted-foreground">
            Leave temperature / top P blank to use the model default. Current Claude models reject them, so keep them blank for Claude.
          </p>
          <div className="space-y-2 col-span-3">
            <Label>Base URL (optional)</Label>
            <Input value={d.base_url} onChange={(e) => set({ base_url: e.target.value })} placeholder="Provider default" className="h-10 rounded-xl font-mono text-sm" />
          </div>
          {provider.provider === "openai" && (
            <div className="space-y-2 col-span-3">
              <Label>Organization id (optional)</Label>
              <Input value={d.organization} onChange={(e) => set({ organization: e.target.value })} className="h-10 rounded-xl font-mono text-sm" />
            </div>
          )}
        </div>

        <div className="space-y-2 lg:col-span-2">
          <Label>System prompt for the /ai page (optional)</Label>
          <Textarea value={d.system_prompt} onChange={(e) => set({ system_prompt: e.target.value })} rows={3} className="rounded-xl" />
        </div>
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
        {dirty && (
          <Button variant="ghost" onClick={() => setD(toDraft(provider))} disabled={saving}>
            Discard
          </Button>
        )}
        <Button onClick={() => save()} disabled={!dirty || saving} className="rounded-xl gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save {provider.label}
        </Button>
      </footer>
    </section>
  );
}

export default function AISettingsTab() {
  const { token, fail } = usePanel();
  const [providers, setProviders] = useState<AIProvider[] | null>(null);

  const load = useCallback(async () => {
    try {
      setProviders(await panelApi.aiProviders(token));
    } catch (e) {
      fail(e, "Failed to load AI settings");
    }
  }, [token, fail]);

  useEffect(() => {
    load();
  }, [load]);

  if (!providers) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const onSaved = (p: AIProvider) =>
    setProviders((list) =>
      (list || []).map((x) => (x.provider === p.provider ? p : p.is_default ? { ...x, is_default: false } : x))
    );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        These settings live in the database and every app reads them from here — not from the env file. API keys are
        stored encrypted and never sent back to the browser. Changes apply to the next request (stocks: the next run).
      </p>
      <AIUsersCard />
      {providers.map((p) => (
        <ProviderCard key={p.provider} provider={p} onSaved={onSaved} />
      ))}
    </div>
  );
}
