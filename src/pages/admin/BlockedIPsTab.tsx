/**
 * Blocked IPs: every IP the /stocks login blocked for wrong passwords (and the ones still counting),
 * with an IP lookup (location, ISP, ASN, proxy / VPN / hosting), every username and browser it tried,
 * and any anonymous messages sent from the same address.
 */
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, Building2, Clock, Globe, Loader2, MapPin, MessageSquare, Monitor, Network, RefreshCw, Search,
  ShieldBan, ShieldCheck, Unlock, UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fmtDate, panelApi, relative, type BlockedIP, type BlockedIPDetail, type IPIntel, type LoginBlocks } from "@/lib/panelApi";
import { usePanel } from "./context";

const flag = (cc?: string) =>
  cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐";

function place(i?: IPIntel | null) {
  const d = i?.data;
  if (!d || !d.country) return null;
  return [d.city, d.region, d.country].filter(Boolean).join(", ");
}

function Flags({ intel }: { intel?: IPIntel | null }) {
  const d = intel?.data;
  if (!d) return null;
  const tags: [boolean | undefined, string, string][] = [
    [d.proxy, "Proxy / VPN / Tor", "bg-red-100 text-red-700"],
    [d.hosting, "Hosting / data centre", "bg-amber-100 text-amber-800"],
    [d.mobile, "Mobile network", "bg-sky-100 text-sky-700"],
  ];
  const on = tags.filter(([v]) => v);
  if (!on.length && d.country) return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Residential / business</span>;
  return (
    <>
      {on.map(([, label, cls]) => (
        <span key={label} className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
      ))}
    </>
  );
}

function Status({ b }: { b: { blocked: boolean } }) {
  return b.blocked ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
      <ShieldBan size={12} /> Blocked
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      Counting
    </span>
  );
}

// ---------------------------------------------------------------- detail view
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all">{children}</dd>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Globe; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-2 border-border bg-card">
      <h3 className="flex items-center gap-2 border-b border-border px-5 py-3 font-semibold">
        <Icon size={16} className="text-muted-foreground" /> {title}
      </h3>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Detail({ id, onBack, onUnblocked }: { id: number; onBack: () => void; onUnblocked: () => void }) {
  const { token, fail } = usePanel();
  const [d, setD] = useState<BlockedIPDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    panelApi.blockedIP(token, id).then(setD).catch((e) => fail(e, "Failed to load the IP"));
  }, [token, id, fail]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const intel = await panelApi.refreshBlockedIP(token, id);
      setD((x) => (x ? { ...x, intel } : x));
      toast.success("Looked up again");
    } catch (e) {
      fail(e, "Lookup failed");
    } finally {
      setRefreshing(false);
    }
  };

  const unblock = async () => {
    setBusy(true);
    try {
      await panelApi.unblockStocksLogin(token, id);
      toast.success(`${d?.ip} unblocked`);
      onUnblocked();
    } catch (e) {
      fail(e, "Unblock failed");
    } finally {
      setBusy(false);
    }
  };

  if (!d) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const i = d.intel?.data || {};
  const hasGeo = typeof i.lat === "number" && typeof i.lon === "number";
  const a = d.attempts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" className="rounded-xl gap-2" onClick={onBack}>
          <ArrowLeft size={16} /> All blocked IPs
        </Button>
        <div className="flex-1" />
        <Button variant="outline" className="rounded-xl gap-2" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Look up again
        </Button>
        <Button className="rounded-xl gap-2" onClick={() => setConfirm(true)}>
          <Unlock size={16} /> Unblock
        </Button>
      </div>

      <div className="rounded-2xl border-2 border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl" aria-hidden>{flag(i.country_code)}</span>
          <div className="min-w-0">
            <div className="font-mono text-2xl font-bold break-all">{d.ip}</div>
            <div className="text-sm text-muted-foreground">{place(d.intel) || d.intel?.error || "Not looked up yet"}</div>
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Status b={d} />
            <Flags intel={d.intel} />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Wrong passwords", a.wrong_password],
            ["Tries while blocked", a.while_blocked],
            ["Usernames tried", a.usernames.length],
            ["Anonymous messages", d.anonymous_messages.length],
          ].map(([label, n]) => (
            <div key={label as string} className="rounded-xl bg-muted/50 p-3">
              <div className="text-2xl font-display font-bold tabular-nums">{n}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Location" icon={MapPin}>
          {d.intel?.error && !i.country ? (
            <p className="text-sm text-muted-foreground">{d.intel.error}</p>
          ) : (
            <dl className="grid grid-cols-[130px_1fr] gap-x-4 gap-y-1.5 text-sm">
              <Row label="Country">{i.country && `${flag(i.country_code)} ${i.country} (${i.country_code})`}</Row>
              <Row label="Continent">{i.continent}</Row>
              <Row label="Region">{i.region}</Row>
              <Row label="City">{i.city}</Row>
              <Row label="District">{i.district}</Row>
              <Row label="Postcode">{i.zip}</Row>
              <Row label="Coordinates">
                {hasGeo && (
                  <a
                    className="text-primary hover:underline"
                    href={`https://www.openstreetmap.org/?mlat=${i.lat}&mlon=${i.lon}#map=11/${i.lat}/${i.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {i.lat}, {i.lon} (map)
                  </a>
                )}
              </Row>
              <Row label="Time zone">{i.timezone}</Row>
              <Row label="Currency">{i.currency}</Row>
            </dl>
          )}
          {hasGeo && <p className="mt-3 text-xs text-muted-foreground">IP locations are approximate, usually city-level or the ISP's location.</p>}
        </Section>

        <Section title="Network" icon={Network}>
          <dl className="grid grid-cols-[130px_1fr] gap-x-4 gap-y-1.5 text-sm">
            <Row label="ISP">{i.isp}</Row>
            <Row label="Organisation">{i.org}</Row>
            <Row label="AS">{i.as}</Row>
            <Row label="AS name">{i.as_name}</Row>
            <Row label="Reverse DNS">{i.reverse_dns && <span className="font-mono">{i.reverse_dns}</span>}</Row>
            <Row label="Proxy / VPN">{i.proxy === undefined ? null : i.proxy ? "Yes" : "No"}</Row>
            <Row label="Hosting">{i.hosting === undefined ? null : i.hosting ? "Yes (server / data centre)" : "No"}</Row>
            <Row label="Mobile">{i.mobile === undefined ? null : i.mobile ? "Yes" : "No"}</Row>
          </dl>
          {d.intel?.fetched_at && <p className="mt-3 text-xs text-muted-foreground">Looked up {relative(d.intel.fetched_at)} via ip-api.com</p>}
        </Section>

        <Section title="Block" icon={ShieldBan}>
          <dl className="grid grid-cols-[130px_1fr] gap-x-4 gap-y-1.5 text-sm">
            <Row label="Status">{d.blocked ? "Blocked from the /stocks login" : "Not blocked yet (still counting)"}</Row>
            <Row label="Blocked at">{d.blocked_at && `${fmtDate(d.blocked_at)} (${relative(d.blocked_at)})`}</Row>
            <Row label="Wrong passwords">{d.failures}</Row>
            <Row label="First seen">{fmtDate(a.first_at || d.first_failed_at)}</Row>
            <Row label="Last seen">{fmtDate(a.last_at || d.last_failed_at)}</Row>
          </dl>
        </Section>

        <Section title="Usernames tried" icon={UserRound}>
          {a.usernames.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {d.last_username ? <>Last tried <span className="font-mono">{d.last_username}</span>. (Older attempts were not logged.)</> : "None recorded."}
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {a.usernames.map((u) => (
                <li key={u.username} className="flex items-center gap-3">
                  <span className="font-mono font-medium">{u.username}</span>
                  <span className="text-muted-foreground">× {u.count}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{relative(u.last_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Browsers / tools used" icon={Monitor}>
        {a.user_agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">None recorded.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {a.user_agents.map((u) => (
              <li key={u.user_agent} className="flex gap-3">
                <span className="font-mono text-xs break-all flex-1">{u.user_agent}</span>
                <span className="shrink-0 text-muted-foreground">× {u.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Sign-in attempts (latest ${a.recent.length} of ${a.total})`} icon={Clock}>
        {a.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attempts logged. Attempt logging started with this update.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Result</th>
                  <th className="py-2 pr-4">Username</th>
                  <th className="py-2">Headers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {a.recent.map((r, k) => (
                  <tr key={k} className="align-top">
                    <td className="py-2 pr-4 whitespace-nowrap" title={fmtDate(r.at)}>{relative(r.at)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {r.outcome === "blocked" ? <span className="text-red-600">Refused (blocked)</span> : "Wrong password"}
                    </td>
                    <td className="py-2 pr-4 font-mono">{r.username || "—"}</td>
                    <td className="py-2 text-xs">
                      {Object.entries(r.headers || {}).map(([h, v]) => (
                        <div key={h} className="break-all">
                          <span className="text-muted-foreground">{h}:</span> <span className="font-mono">{v}</span>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {d.anonymous_messages.length > 0 && (
        <Section title="Anonymous messages from this IP" icon={MessageSquare}>
          <ul className="space-y-3">
            {d.anonymous_messages.map((m) => (
              <li key={m.id} className="rounded-xl bg-muted/50 p-3">
                <p className="whitespace-pre-wrap break-words text-sm">{m.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{fmtDate(m.time)}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <AlertDialog open={confirm} onOpenChange={(o) => !o && !busy && setConfirm(false)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock {d.ip}?</AlertDialogTitle>
            <AlertDialogDescription>
              It can try to sign in to /stocks again, and its wrong-password count starts from zero. The attempt history is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                unblock();
              }}
            >
              {busy && <Loader2 size={16} className="mr-2 animate-spin" />} Unblock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------- list
export default function BlockedIPsTab() {
  const { token, fail } = usePanel();
  const [rows, setRows] = useState<BlockedIP[] | null>(null);
  const [rules, setRules] = useState<LoginBlocks["rules"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await panelApi.blockedIPs(token);
      setRows(r.ips);
      setRules(r.rules);
    } catch (e) {
      fail(e, "Failed to load blocked IPs");
    } finally {
      setLoading(false);
    }
  }, [token, fail]);

  useEffect(() => {
    load();
  }, [load]);

  if (open !== null) {
    return (
      <Detail
        id={open}
        onBack={() => setOpen(null)}
        onUnblocked={() => {
          setOpen(null);
          load();
        }}
      />
    );
  }

  const q = query.trim().toLowerCase();
  const shown = (rows || []).filter((b) => {
    if (!q) return true;
    const d = b.intel?.data || {};
    return [b.ip, d.country, d.city, d.isp, d.org, d.as, ...b.usernames].some((v) => (v || "").toLowerCase().includes(q));
  });
  const blocked = (rows || []).filter((b) => b.blocked).length;

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <p className="flex-1 text-sm text-muted-foreground">
          {blocked} blocked · {(rows || []).length - blocked} still counting. The /stocks login blocks an IP after more than{" "}
          {rules?.max_failed_attempts ?? 3} wrong passwords
          {rules && rules.block_minutes > 0 ? ` for ${rules.block_minutes} minutes` : " until you unblock it"}. Lookups use ip-api.com and are cached
          for a week.
        </p>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="IP, country, ISP, username…"
              className="pl-9 h-10 w-64 rounded-xl border-2 bg-card"
            />
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" title="Refresh" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {!rows ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <ShieldCheck className="mb-3 h-12 w-12 opacity-40" />
          {rows.length ? "Nothing matches." : "No blocked IPs. Nobody has entered too many wrong passwords."}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((b) => {
            const d = b.intel?.data || {};
            return (
              <li key={b.id}>
                <button
                  onClick={() => setOpen(b.id)}
                  className="w-full rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none" aria-hidden>{flag(d.country_code)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold break-all">{b.ip}</span>
                        <Status b={b} />
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin size={13} className="shrink-0" />
                        <span className="truncate">{place(b.intel) || b.intel?.error || "Unknown location"}</span>
                      </div>
                      {(d.isp || d.org) && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Building2 size={13} className="shrink-0" />
                          <span className="truncate">{d.isp || d.org}{d.as ? ` · ${d.as.split(" ")[0]}` : ""}</span>
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Flags intel={b.intel} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>{b.failures} wrong password{b.failures === 1 ? "" : "s"}</span>
                    {b.blocked_at && <span>blocked {relative(b.blocked_at)}</span>}
                    {b.usernames.length > 0 && (
                      <span className="truncate">tried <span className="font-mono">{b.usernames.slice(0, 3).join(", ")}</span>{b.usernames.length > 3 ? "…" : ""}</span>
                    )}
                    {b.anonymous_messages > 0 && <span>{b.anonymous_messages} anonymous message{b.anonymous_messages === 1 ? "" : "s"}</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
