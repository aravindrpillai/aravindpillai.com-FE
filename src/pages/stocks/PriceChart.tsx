import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ChartRow, Technical } from "@/lib/stocksApi";

/**
 * Price with overlays + volume, RSI and MACD as separate panels (one y-axis each, crosshair synced).
 * Series colours are the validated categorical slots 1-4 in fixed order (light + dark steps);
 * aqua/yellow sit below 3:1 on the light surface, so names stay visible in the legend, values in
 * the tooltip, and a table view is one click away.
 */
const PALETTE = {
  light: { close: "#2a78d6", sma20: "#eb6834", sma50: "#1baf7a", sma200: "#eda100", grid: "#e7e5e0", band: "#a8a7a2", axis: "#52514e" },
  dark: { close: "#3987e5", sma20: "#d95926", sma50: "#199e70", sma200: "#c98500", grid: "#2e2e2c", band: "#6b6a66", axis: "#c3c2b7" },
};
const STATUS = { stop: "#d03b3b", target: "#0ca30c" };

type Overlay = "sma20" | "sma50" | "sma200" | "bb" | "kc" | "psar" | "vwap";
const OVERLAYS: { id: Overlay; label: string }[] = [
  { id: "sma20", label: "SMA 20" },
  { id: "sma50", label: "SMA 50" },
  { id: "sma200", label: "SMA 200" },
  { id: "bb", label: "Bollinger" },
  { id: "kc", label: "Keltner" },
  { id: "psar", label: "Parabolic SAR" },
  { id: "vwap", label: "VWAP" },
];

function useDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const fmtNum = (v: unknown, d = 2) => (typeof v === "number" ? v.toFixed(d) : "—");

export default function PriceChart({ technical }: { technical: Technical }) {
  const dark = useDark();
  const c = dark ? PALETTE.dark : PALETTE.light;
  const rows = useMemo(() => technical.chart?.rows ?? [], [technical]);
  const intraday = technical.chart?.intraday ?? false;
  const [on, setOn] = useState<Record<Overlay, boolean>>({ sma20: true, sma50: true, sma200: !intraday, bb: false, kc: false, psar: false, vwap: intraday });
  const [view, setView] = useState<"chart" | "table">("chart");

  const data = useMemo(
    () => rows.map((r) => ({ ...r, label: fmtTime(r.t, intraday) })),
    [rows, intraday],
  );
  const [lo, hi] = useMemo(() => {
    const vals: number[] = [];
    for (const r of rows) {
      vals.push(r.low, r.high);
      if (on.bb && r.bb_lower) vals.push(r.bb_lower);
      if (on.bb && r.bb_upper) vals.push(r.bb_upper);
    }
    for (const v of [technical.stop_loss, technical.targets?.[0]]) if (typeof v === "number") vals.push(v);
    if (!vals.length) return [0, 1];
    const min = Math.min(...vals), max = Math.max(...vals), pad = (max - min) * 0.05;
    return [min - pad, max + pad];
  }, [rows, on.bb, technical.stop_loss, technical.targets]);

  if (!rows.length) return <p className="text-sm text-muted-foreground">No chart data.</p>;

  const axisProps = { stroke: c.axis, fontSize: 11, tickLine: false, axisLine: false } as const;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
          <span className="h-0.5 w-4 rounded" style={{ background: c.close }} /> Close
        </span>
        {OVERLAYS.map((o) => (
          <button
            key={o.id}
            onClick={() => setOn((s) => ({ ...s, [o.id]: !s[o.id] }))}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition ${
              on[o.id] ? "border-foreground/40 bg-muted" : "border-border text-muted-foreground"
            }`}
            aria-pressed={on[o.id]}
          >
            <span
              className="h-0.5 w-4 rounded"
              style={{ background: o.id.startsWith("sma") ? c[o.id as "sma20"] : c.band, opacity: on[o.id] ? 1 : 0.4 }}
            />
            {o.label}
          </button>
        ))}
        <span className="ml-auto inline-flex overflow-hidden rounded-lg border border-border">
          {(["chart", "table"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-2.5 py-1 capitalize ${view === v ? "bg-muted font-medium" : "text-muted-foreground"}`}>
              {v}
            </button>
          ))}
        </span>
      </div>

      {view === "table" ? (
        <BarsTable rows={rows} intraday={intraday} />
      ) : (
        <>
          <Panel title={`Price · ${technical.interval} bars`} height={280}>
            <ComposedChart data={data} syncId="stock" margin={{ top: 8, right: 56, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={48} />
              <YAxis domain={[lo, hi]} {...axisProps} width={56} tickFormatter={(v) => fmtNum(v, v > 1000 ? 0 : 1)} orientation="right" />
              <Tooltip content={<PriceTip />} cursor={{ stroke: c.axis, strokeDasharray: "3 3" }} />
              {on.bb && <Line dataKey="bb_upper" name="BB upper" stroke={c.band} strokeWidth={1} strokeDasharray="4 3" dot={false} isAnimationActive={false} />}
              {on.bb && <Line dataKey="bb_lower" name="BB lower" stroke={c.band} strokeWidth={1} strokeDasharray="4 3" dot={false} isAnimationActive={false} />}
              {on.kc && <Line dataKey="kc_upper" name="Keltner upper" stroke={c.band} strokeWidth={1} strokeDasharray="1 3" dot={false} isAnimationActive={false} />}
              {on.kc && <Line dataKey="kc_lower" name="Keltner lower" stroke={c.band} strokeWidth={1} strokeDasharray="1 3" dot={false} isAnimationActive={false} />}
              {on.psar && <Line dataKey="psar" name="Parabolic SAR" stroke="none" dot={{ r: 1.5, fill: c.axis, stroke: "none" }} activeDot={false} isAnimationActive={false} />}
              {on.vwap && <Line dataKey="vwap" name="VWAP" stroke={c.band} strokeWidth={1.5} dot={false} isAnimationActive={false} />}
              {on.sma200 && <Line dataKey="sma200" name="SMA 200" stroke={c.sma200} strokeWidth={1.5} dot={false} isAnimationActive={false} />}
              {on.sma50 && <Line dataKey="sma50" name="SMA 50" stroke={c.sma50} strokeWidth={1.5} dot={false} isAnimationActive={false} />}
              {on.sma20 && <Line dataKey="sma20" name="SMA 20" stroke={c.sma20} strokeWidth={1.5} dot={false} isAnimationActive={false} />}
              <Line dataKey="close" name="Close" stroke={c.close} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              {technical.entry_low != null && (
                <ReferenceLine y={technical.entry_low} stroke={c.axis} strokeDasharray="2 4" label={{ value: "entry", position: "left", fontSize: 10, fill: c.axis }} />
              )}
              {technical.entry_high != null && <ReferenceLine y={technical.entry_high} stroke={c.axis} strokeDasharray="2 4" />}
              {technical.stop_loss != null && (
                <ReferenceLine y={technical.stop_loss} stroke={STATUS.stop} strokeDasharray="5 3" label={{ value: "stop", position: "left", fontSize: 10, fill: STATUS.stop }} />
              )}
              {technical.targets?.map((t, i) => (
                <ReferenceLine key={i} y={t} stroke={STATUS.target} strokeDasharray="5 3" label={{ value: `T${i + 1}`, position: "left", fontSize: 10, fill: STATUS.target }} />
              ))}
            </ComposedChart>
          </Panel>

          <Panel title="Volume" height={80}>
            <BarChart data={data} syncId="stock" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" hide />
              <YAxis hide />
              <Tooltip content={<ValueTip field="volume" label="Volume" digits={0} />} cursor={{ fill: c.grid }} />
              <Bar dataKey="volume" fill={c.close} fillOpacity={0.45} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </Panel>

          <Panel title="RSI (14)" height={100}>
            <LineChart data={data} syncId="stock" margin={{ top: 4, right: 56, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="label" hide />
              <YAxis domain={[0, 100]} ticks={[30, 50, 70]} {...axisProps} width={56} orientation="right" />
              <ReferenceLine y={70} stroke={c.band} strokeDasharray="3 3" />
              <ReferenceLine y={30} stroke={c.band} strokeDasharray="3 3" />
              <Tooltip content={<ValueTip field="rsi" label="RSI" digits={1} />} cursor={{ stroke: c.axis, strokeDasharray: "3 3" }} />
              <Line dataKey="rsi" stroke={c.close} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </Panel>

          <Panel title="MACD (12, 26, 9)" height={110}>
            <ComposedChart data={data} syncId="stock" margin={{ top: 4, right: 56, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="label" hide />
              <YAxis {...axisProps} width={56} orientation="right" tickFormatter={(v) => fmtNum(v, 1)} />
              <ReferenceLine y={0} stroke={c.band} />
              <Tooltip content={<MacdTip />} cursor={{ stroke: c.axis, strokeDasharray: "3 3" }} />
              <Bar dataKey="macd_hist" fill={c.band} fillOpacity={0.6} isAnimationActive={false} />
              <Line dataKey="macd" stroke={c.close} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="macd_signal" stroke={c.sma20} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </Panel>
          <p className="text-xs text-muted-foreground">
            MACD line in blue, signal in orange, histogram in grey. Dashed lines on the price panel: entry zone (grey),
            stop-loss (red), targets T1/T2 (green).
          </p>
        </>
      )}
    </div>
  );
}

function Panel({ title, height, children }: { title: string; height: number; children: React.ReactElement }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{title}</div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

type TipProps = { active?: boolean; payload?: { payload: ChartRow & { label: string } }[] };

function TipBox({ title, lines }: { title: string; lines: [string, string][] }) {
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium text-foreground">{title}</div>
      {lines.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 text-muted-foreground">
          <span>{k}</span>
          <span className="tabular-nums text-foreground">{v}</span>
        </div>
      ))}
    </div>
  );
}

function PriceTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const lines: [string, string][] = [
    ["Open", fmtNum(r.open)], ["High", fmtNum(r.high)], ["Low", fmtNum(r.low)], ["Close", fmtNum(r.close)],
  ];
  if (r.sma20 != null) lines.push(["SMA 20", fmtNum(r.sma20)]);
  if (r.sma50 != null) lines.push(["SMA 50", fmtNum(r.sma50)]);
  if (r.sma200 != null) lines.push(["SMA 200", fmtNum(r.sma200)]);
  return <TipBox title={r.label} lines={lines} />;
}

function ValueTip({ active, payload, field, label, digits }: TipProps & { field: keyof ChartRow; label: string; digits: number }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const v = r[field] as number | null | undefined;
  return <TipBox title={r.label} lines={[[label, field === "volume" && typeof v === "number" ? v.toLocaleString() : fmtNum(v, digits)]]} />;
}

function MacdTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return <TipBox title={r.label} lines={[["MACD", fmtNum(r.macd, 3)], ["Signal", fmtNum(r.macd_signal, 3)], ["Histogram", fmtNum(r.macd_hist, 3)]]} />;
}

function BarsTable({ rows, intraday }: { rows: ChartRow[]; intraday: boolean }) {
  const last = rows.slice(-40).reverse();
  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border border-border">
      <table className="w-full text-right text-xs tabular-nums">
        <thead className="sticky top-0 bg-muted text-muted-foreground">
          <tr>
            {["Time", "Open", "High", "Low", "Close", "Volume", "SMA 20", "SMA 50", "SMA 200", "RSI", "MACD"].map((h) => (
              <th key={h} className="px-2 py-1.5 font-medium first:text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {last.map((r) => (
            <tr key={r.t} className="border-t border-border">
              <td className="px-2 py-1 text-left">{fmtTime(r.t, intraday)}</td>
              <td className="px-2 py-1">{fmtNum(r.open)}</td>
              <td className="px-2 py-1">{fmtNum(r.high)}</td>
              <td className="px-2 py-1">{fmtNum(r.low)}</td>
              <td className="px-2 py-1 font-medium">{fmtNum(r.close)}</td>
              <td className="px-2 py-1">{r.volume?.toLocaleString()}</td>
              <td className="px-2 py-1">{fmtNum(r.sma20)}</td>
              <td className="px-2 py-1">{fmtNum(r.sma50)}</td>
              <td className="px-2 py-1">{fmtNum(r.sma200)}</td>
              <td className="px-2 py-1">{fmtNum(r.rsi, 1)}</td>
              <td className="px-2 py-1">{fmtNum(r.macd, 3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtTime(iso: string, intraday: boolean) {
  const d = new Date(iso);
  return intraday
    ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { year: "2-digit", month: "short", day: "numeric" });
}
