/**
 * Client for the backend `stocks` app (arp/stocks/...). Every call sends the `token` header: a session
 * token from `login` for a user created in the admin panel (/admin/stocks), which can expire. There is no
 * owner password — the owner is a user with "Owner" ticked.
 */
const BASE: string = import.meta.env.VITE_API_BASE_URL; // e.g. http://localhost:8000/arp/
const TOKEN_KEY = "stocks_token";

export type Horizon = "intraday" | "swing" | "long_term";
export type Market = "US" | "CA" | "IN";
export type RunKind = "scan" | "single";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type StockStage =
  | "queued" | "fetching_data" | "technical_analysis" | "ai_review" | "scored" | "selected" | "rejected" | "failed";

export const HORIZONS: { id: Horizon; label: string; blurb: string }[] = [
  { id: "intraday", label: "Intraday", blurb: "Same-day moves · 5-minute bars" },
  { id: "swing", label: "Swing", blurb: "Days to weeks · daily bars, 1 year" },
  { id: "long_term", label: "Long-term", blurb: "Months+ · daily bars, 5 years + fundamentals" },
];
export const HORIZON_LABEL: Record<Horizon, string> = { intraday: "Intraday", swing: "Swing", long_term: "Long-term" };

export const STAGE_ORDER: StockStage[] = ["queued", "fetching_data", "technical_analysis", "ai_review", "scored"];
export const STAGE_LABEL: Record<StockStage, string> = {
  queued: "Queued", fetching_data: "Fetching data", technical_analysis: "Technical analysis", ai_review: "AI review",
  scored: "Scored", selected: "Selected", rejected: "Rejected", failed: "Failed",
};

export interface SourceStat {
  name: string;
  market: string;
  status: "pending" | "ok" | "error" | "blocked" | "disabled";
  articles: number;
  errors: string[];
}

export interface RunStats {
  stage: string;
  stages: { name: string; label: string; started_at: string; finished_at: string | null }[];
  sources: Record<string, SourceStat>;
  articles: { fetched: number; unique: number; with_tickers: number };
  stocks_extracted: number;
  extracted_tickers: { ticker: string; market: Market; mentions: number; sources: number; sentiment: number; news_score: number }[];
  candidates: Record<Horizon, number>;
  queue: { pending: number; in_progress: number; completed: number; failed: number; retried: number; published: number };
  stock_stages: Partial<Record<StockStage, number>>;
  ai: { enabled: boolean; reason: string; model?: string; calls: number; input_tokens: number; output_tokens: number };
  openai?: { enabled: boolean; reason: string; model?: string; calls: number; input_tokens: number; output_tokens: number };
  learning?: Partial<Record<Horizon, Learning>>;
  picks: number;
  errors: { at: string; message: string; ticker: string }[];
  warnings: { at: string; message: string; ticker: string }[];
}

export interface Run {
  id: number;
  market: Market;
  kind: RunKind;
  symbol: string;
  status: RunStatus;
  stage: string;
  trigger: string;
  error: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  heartbeat_at: string | null;
  cancel_requested: boolean;
  position?: Position;
  stats?: RunStats;
}

export interface RunSummary extends Run {
  articles: number;
  stocks_extracted: number;
  candidates: number;
  picks: { ticker: string; market: Market; horizon: Horizon; rank: number }[];
}

export interface PipelineEvent {
  id: number;
  at: string;
  level: "info" | "warning" | "error";
  kind: string;
  stage: string;
  ticker: string;
  horizon: string;
  message: string;
  data: Record<string, unknown>;
}

export interface CandidateStage {
  id: number;
  ticker: string;
  market: Market;
  horizon: Horizon;
  stage: StockStage;
  status: string;
  final_score: number | null;
  attempts: number;
  error: string;
}

export interface Signal {
  group: string;
  indicator?: string;
  text: string;
  value?: number;
  effect: -1 | 0 | 1;
}

export interface ScorecardRow {
  indicator: string;
  group: string;
  score: number;
  signal: "bullish" | "bearish" | "neutral";
  detail: string;
}

export interface Scorecard {
  total: number;
  bullish: number;
  bearish: number;
  neutral: number;
  rows: ScorecardRow[];
}

export interface Level {
  price: number;
  touches: number;
}

export interface ChartRow {
  t: string;
  open: number; high: number; low: number; close: number; volume: number;
  sma20?: number | null; sma50?: number | null; sma200?: number | null; ema20?: number | null;
  bb_upper?: number | null; bb_lower?: number | null; kc_upper?: number | null; kc_lower?: number | null;
  supertrend?: number | null; psar?: number | null; vwap?: number | null;
  rsi?: number | null; macd?: number | null; macd_signal?: number | null; macd_hist?: number | null;
}

export interface Technical {
  provider: string;
  interval: string;
  period: string;
  bars: number;
  last_bar_at: string | null;
  indicators: Record<string, number | boolean | string | null>;
  signals: Signal[];
  scorecard?: Scorecard;
  sub_scores: Record<string, number>;
  technical_score: number;
  fundamentals: Record<string, unknown>;
  fundamental_score: number | null;
  levels: {
    supports: Level[]; resistances: Level[]; week52_high: number | null; week52_low: number | null;
    pivots?: Partial<Record<"pivot" | "r1" | "s1" | "r2" | "s2", number | null>>;
  };
  entry_low: number | null;
  entry_high: number | null;
  stop_loss: number | null;
  targets: number[];
  risk_reward: number | null;
  context?: MarketContext;
  backtest?: Backtest;
  chart?: { intraday: boolean; rows: ChartRow[] };
}

export interface MarketContext {
  regime?: { state: "bull" | "neutral" | "bear" | "unknown"; label: string; roc20?: number; above_sma50?: boolean; above_sma200?: boolean | null };
  relative?: Partial<Record<"rs_short" | "rs_mid" | "rs_long" | "mansfield_rs" | "beta", number | null>>;
  uptrend?: boolean;
  weights?: Record<string, number>;
}

export interface BacktestStats {
  trades: number;
  wins?: number;
  win_rate?: number;
  avg_return?: number;
  median_return?: number;
  avg_win?: number | null;
  avg_loss?: number | null;
  profit_factor?: number | null;
  target_hits?: number;
  stop_hits?: number;
  timeouts?: number;
}

export interface Backtest extends Partial<BacktestStats> {
  enabled: boolean;
  composite_now?: number;
  tolerance?: number;
  hold_bars?: number;
  stop_atr?: number;
  target_r?: number;
  cost_pct?: number;
  baseline?: BacktestStats;
  edge?: number | null;
  win_probability?: number;
  reliable?: boolean;
  same_side_of_sma200?: boolean | null;
  note?: string;
}

export type MethodId = "native" | "claude" | "openai";
export type Verdict = "strong_buy" | "buy" | "hold" | "avoid";

export interface MethodView {
  label: string;
  available: boolean;
  status?: string;
  reason?: string;
  score?: number;
  probability?: number;
  verdict?: Verdict;
  confidence?: number;
  vote?: boolean;
  weight?: number;
  detail?: string;
  expected_return?: number;
  factor_scores?: Record<string, number>;
  regime?: string;
  backtest_probability?: number | null;
}

export interface Gate {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface Ensemble {
  methods?: Record<MethodId, MethodView>;
  weights?: Record<MethodId, number>;
  weights_source?: "learned" | "prior";
  conviction?: number;
  probability_raw?: number;
  probability_bias?: number;
  win_probability?: number;
  final_score?: number;
  agreement?: number;
  votes?: number;
  available?: number;
  spread?: number;
  disagreement_cut?: number;
  expected_value?: number | null;
  gain_pct?: number | null;
  loss_pct?: number | null;
  cost_pct?: number;
  gates?: Gate[];
  passed?: boolean;
  rejection?: string;
  verdict?: Verdict;
  steps?: string[];
  regime?: string;
  ranks?: Partial<Record<MethodId | "final" | "pick", number>>;
  ranked_of?: number;
}

export interface MethodAccuracy {
  n: number;
  hit_rate: number;
  buy_calls: number;
  buy_win_rate: number | null;
  brier: number | null;
  avg_return_when_buy: number | null;
  multiplier: number;
}

export interface Learning {
  active: boolean;
  closed: number;
  shrink: number;
  wins?: number;
  win_rate?: number;
  avg_return?: number | null;
  avg_alpha?: number | null;
  weights: Record<MethodId, number>;
  multipliers: Partial<Record<MethodId, number>>;
  methods: Partial<Record<MethodId, MethodAccuracy>>;
  probability_bias: number;
  threshold_shift: number;
  group_tilt: Record<string, number>;
  extra_regime_penalty: number;
  notes: string[];
}

export interface AIReview {
  provider?: "claude" | "openai";
  status: "ok" | "skipped" | "error" | "refused";
  model: string;
  verdict: Verdict | "";
  confidence: number | null;
  win_probability?: number | null;
  expected_return?: number | null;
  factor_scores?: Record<string, number>;
  summary: string;
  suggested_entry: number | null;
  suggested_stop: number | null;
  suggested_target: number | null;
  agrees_with_quant: boolean | null;
  error: string;
  key_risks: string[];
  reasoning?: string;
  conflicting_signals?: string[];
  input_tokens?: number;
  output_tokens?: number;
}

export interface Article {
  id: number;
  source: string;
  source_name: string;
  market: string;
  title: string;
  summary: string;
  url: string;
  published_at: string | null;
  tickers: string[];
  ticker_method: string;
  sentiment: number;
  catalyst: string;
  credibility: number;
  cluster: number;
  is_duplicate: boolean;
}

export interface Candidate {
  id: number;
  run_id: number;
  ticker: string;
  name: string;
  market: Market;
  horizon: Horizon;
  origin: "news" | "watchlist" | "single";
  stage: StockStage;
  status: "pending" | "selected" | "rejected" | "failed";
  rejection_reason: string;
  error: string;
  attempts: number;
  news_score: number;
  sentiment: number;
  source_count: number;
  mention_count: number;
  sources: string[];
  catalysts: string[];
  horizon_fit: Partial<Record<Horizon, number>>;
  horizon_reason: string;
  news_summary: string;
  price: number | null;
  currency: string;
  technical_score: number | null;
  fundamental_score: number | null;
  quant_score: number | null;
  native_score?: number | null;
  win_probability?: number | null;
  expected_value?: number | null;
  final_score: number | null;
  rank: number | null;
  ensemble?: Ensemble;
  technical: Technical | null;
  reviews?: Partial<Record<"claude" | "openai", AIReview | null>>;
  ai_review: AIReview | null;
  pick: { rank: number; final_score: number; reason: string } | null;
  top_articles?: { id: number; title: string; url: string; source_name: string; published_at: string | null }[];
  articles?: Article[];
}

// ---------------------------------------------------------------- stock report (single-stock runs)
export type Action = "BUY" | "HOLD" | "SELL";

export interface Position {
  purchase_date?: string;
  purchase_price?: number;
  shares?: number;
}

export interface PositionResult {
  purchase_price: number;
  price_basis: "entered" | "close_on_date";
  purchase_date?: string | null;
  close_on_date?: number | null;
  close_on_date_day?: string;
  current_price: number;
  shares: number | null;
  return_pct: number;
  cost?: number;
  value?: number;
  pnl?: number;
}

export interface Scenario {
  probability: number;
  price: number;
  return_pct: number;
  vs_purchase_pct?: number;
  position_pnl?: number;
}

export interface OutlookHorizon {
  key: "days" | "months" | "year";
  label: string;
  sessions: number;
  range_likely: [number, number];
  range_wide: [number, number];
  median_price: number;
  scenarios: Record<"bear" | "base" | "bull", Scenario>;
  expected_return_pct: number;
  probability_of_gain: number;
  historical: { windows: number; p10: number; median: number; p90: number; share_positive: number } | null;
}

export interface Outlook {
  available: boolean;
  reason?: string;
  price?: number;
  annual_volatility_pct?: number;
  annual_drift_pct?: number;
  stock_trend_pct?: number;
  history_years?: number;
  horizons?: OutlookHorizon[];
}

export interface AIOutlook {
  key: "days" | "months" | "year";
  scenarios: Record<"bear" | "base" | "bull", Scenario>;
  expected_price: number;
  expected_return_pct: number;
  comments: Record<string, string>;
  sources: string[];
}

export interface Advice {
  action: Action;
  confidence: number;
  headline: string;
  justification: string;
  thesis_intact: boolean;
  fundamentals_assessment: string;
  valuation_assessment: string;
  growth_assessment: string;
  technical_assessment: string;
  position_guidance: string;
  key_metrics: { name: string; value: string; assessment: "positive" | "negative" | "neutral"; note: string }[];
  risks: string[];
  catalysts: string[];
  suggested_stop: number;
}

export interface Quality {
  score: number | null;
  pillars: Record<string, number | null>;
  coverage: number;
  pillars_total: number;
  signals: { pillar: string; indicator: string; text: string; effect: number }[];
  red_flags: { severity: "severe" | "moderate"; text: string }[];
  strengths: string[];
  severe_flags: number;
  event_risk: string | null;
  upside_to_target: number | null;
}

export interface NewsItem {
  title: string;
  url: string;
  source_name: string;
  published_at: string | null;
  abstract: string;
  impact: "positive" | "negative" | "neutral";
  materiality: number | null;
  category: string;
  curated_by: string;
}

export interface Research {
  coverage?: string[];
  analyst?: {
    rating_trend?: { period: string; strong_buy: number; buy: number; hold: number; sell: number; strong_sell: number }[];
    upgrades_90d?: number; downgrades_90d?: number; target_raises_90d?: number; target_cuts_90d?: number;
    recent_actions?: { date: string; firm: string; to: string; from: string; action: string; target: number | null; prior_target: number | null }[];
  };
  insiders?: { window_days: number; buys: number; sells: number; buy_value: number; sell_value: number; net_value: number;
    recent: { date: string; insider: string; position: string; text: string; value: number | null }[] };
  institutions?: { top: { holder: string; pct: number | null; pct_change: number | null; reported: string }[];
    avg_position_change: number | null; increasing: number; decreasing: number };
  calendar?: { next_earnings: string | null; days_to_earnings: number | null; eps_estimate: number | null; revenue_estimate: number | null; ex_dividend: string | null };
  estimates?: { eps_growth_this_q: number | null; eps_growth_next_q: number | null; eps_growth_this_year: number | null;
    eps_growth_next_year: number | null; index_growth_this_year: number | null };
  peers?: { industry: string; peers: { symbol: string; name: string; pe: number | null; forward_pe: number | null; revenue_growth: number | null;
    profit_margin: number | null; week52_change: number | null; rating: string; market_cap: number | null }[] };
  sector?: { sector: string; etf: string; m1_return: number | null; m3_return: number | null; m6_return: number | null;
    index_m1_return: number | null; index_m3_return: number | null; index_m6_return: number | null };
}

export interface ReportHorizon {
  candidate_id: number;
  passes: boolean;
  final_score: number | null;
  win_probability: number | null;
  expected_value: number | null;
  verdict: Verdict | null;
  votes: string;
  regime: string | null;
  entry: [number | null, number | null];
  stop: number | null;
  target: number | null;
  risk_reward: number | null;
  rejection: string;
}

export interface StockReport {
  symbol: string;
  name: string;
  market: Market;
  currency: string;
  price: number | null;
  as_of: string | null;
  decision: {
    action: Action; confidence: number; score: number; agreement: string; steps: string[];
    native: { action: Action; confidence: number; reasons: string[] };
    votes: Partial<Record<MethodId, { action: Action; confidence: number }>>;
  };
  advice: Partial<Record<"claude" | "openai", Advice>>;
  position: PositionResult | null;
  quality: Quality;
  fundamentals: Record<string, number | string | null>;
  research: Research;
  outlook: Outlook;
  ai_outlook: AIOutlook[];
  horizons: Partial<Record<Horizon, ReportHorizon>>;
  news: NewsItem[];
  disclaimer: string;
}

export interface RunDetail {
  report?: StockReport | null;
  run: Run;
  picks: Candidate[];
  candidates: Candidate[];
  article_count: number;
}

export interface MarketInfo {
  id: Market;
  label: string;
  currency: string;
  sources: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type?: string;
}

export interface StocksConfig {
  claude: { enabled: boolean; key_set: boolean; model: string };
  openai?: { enabled: boolean; key_set: boolean; model: string };
  ensemble?: { enabled: boolean; prior_weights: Record<MethodId, number>; min_win_probability: Record<Horizon, number>;
    min_expected_value: Record<Horizon, number>; min_agreement: number };
  markets: MarketInfo[];
  horizons: { id: Horizon; label: string }[];
  sources: { id: string; name: string; market: string; type: string; enabled: boolean }[];
  selection: { top_n?: number };
  queue: { backend: string; workers: number };
  executor: string;
  active_runs: Run[];
  session: StocksSession;
}

export interface StocksSession {
  kind: "user";
  username: string;
  is_owner: boolean;              // ticked in admin panel -> Stocks; unlocks deleting runs + learning decisions
  expires_at: string | null;
}

export class StocksHttpError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// ---------------------------------------------------------------- token
export function readStocksToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function storeStocksToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

// ---------------------------------------------------------------- REST
async function request<T>(method: string, path: string, token: string, body?: unknown): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new StocksHttpError(0, "Could not reach the server.");
  }
  const json = await resp.json().catch(() => null);
  if (!resp.ok) throw new StocksHttpError(resp.status, json?.messages?.[0] || `Request failed (${resp.status})`, json?.data);
  return (json?.data ?? null) as T;
}

export const stocksApi = {
  login: (username: string, password: string) =>
    request<{ token: string; session: StocksSession }>("POST", "stocks/login/", "", { username, password }),
  config: (token: string) => request<StocksConfig>("GET", "stocks/config/", token),
  runs: (token: string, market?: Market) => request<RunSummary[]>("GET", `stocks/runs/${market ? `?market=${market}` : ""}`, token),
  start: (token: string, body: { market: Market; kind: RunKind; symbol?: string; position?: Position }) => request<Run>("POST", "stocks/runs/", token, body),
  priceOn: (token: string, symbol: string, market: Market, date: string) =>
    request<{ symbol: string; requested_date: string; date: string; close: number }>(
      "GET", `stocks/price/?symbol=${encodeURIComponent(symbol)}&market=${market}&date=${date}`, token),
  search: (token: string, q: string, market: Market) =>
    request<SearchResult[]>("GET", `stocks/search/?q=${encodeURIComponent(q)}&market=${market}`, token),
  run: (token: string, id: number) => request<RunDetail>("GET", `stocks/runs/${id}/`, token),
  cancel: (token: string, id: number) => request<null>("POST", `stocks/runs/${id}/cancel/`, token),
  remove: (token: string, id: number) => request<null>("DELETE", `stocks/runs/${id}/`, token),
  events: (token: string, id: number, after = 0) => request<PipelineEvent[]>("GET", `stocks/runs/${id}/events/?after=${after}`, token),
  candidate: (token: string, id: number) => request<Candidate>("GET", `stocks/candidates/${id}/`, token),
};

// ---------------------------------------------------------------- live progress (SSE over fetch: EventSource cannot send headers)
export interface Tick {
  run: Run;
  events: PipelineEvent[];
  candidates: CandidateStage[];
}

/**
 * Follows a run's progress stream until the run finishes or `signal` aborts.
 * Reconnects (resuming after the last event id) if the connection drops.
 */
export async function followRun(
  token: string,
  runId: number,
  onTick: (t: Tick) => void,
  signal: AbortSignal,
  onReconnect?: () => void,
): Promise<RunStatus | null> {
  let lastId = 0;
  for (let attempt = 0; attempt < 30 && !signal.aborted; attempt++) {
    try {
      const resp = await fetch(`${BASE}stocks/runs/${runId}/stream/?after=${lastId}`, { headers: { token }, signal });
      if (resp.status === 401) throw new StocksHttpError(401, "Wrong password");
      if (!resp.ok || !resp.body) throw new Error(`stream failed (${resp.status})`);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let cut: number;
        while ((cut = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, cut);
          buf = buf.slice(cut + 2);
          let event = "message";
          let data = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
            else if (line.startsWith("id:")) lastId = Number(line.slice(3).trim()) || lastId;
          }
          if (event === "tick" && data) onTick(JSON.parse(data) as Tick);
          else if (event === "done") return (JSON.parse(data || "{}").status as RunStatus) ?? null;
          else if (event === "error") throw new StocksHttpError(404, JSON.parse(data || "{}").message || "stream error");
        }
      }
    } catch (e) {
      if (signal.aborted) return null;
      if (e instanceof StocksHttpError) throw e;
    }
    onReconnect?.();
    await new Promise((r) => setTimeout(r, Math.min(1000 * (attempt + 1), 5000)));
  }
  return null;
}
