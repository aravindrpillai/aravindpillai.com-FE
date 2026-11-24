/**
 * Client for the prediction tracker (arp/stocks/tracker/...). Same `token` header as stocksApi.
 */
import { StocksHttpError, type Horizon, type Market } from "@/lib/stocksApi";

const BASE: string = import.meta.env.VITE_API_BASE_URL;

export type PredictionStatus = "pending" | "open" | "closed" | "error";
export type Outcome = "profit" | "loss" | "breakeven" | "";

export interface Checkpoint {
  key: string;
  label: string;
  kind: "interim" | "final" | "hard_cap" | "extended";
  due_at: string;
  session: string | null;
  day: number | null;
  status: "pending" | "done" | "skipped";
  price: number | null;
  index_price?: number | null;
  return: number | null;
  index_return: number | null;
  alpha: number | null;
  evaluated_at: string | null;
}

export interface Prediction {
  id: number;
  run_id: number;
  candidate_id: number | null;
  source: "scan" | "single";
  ticker: string;
  name: string;
  market: Market;
  horizon: Horizon;
  currency: string;
  benchmark: string;
  suggested_at: string;
  suggested_price: number | null;
  entry_low: number | null;
  entry_high: number | null;
  stop_loss: number | null;
  target: number | null;
  final_score: number | null;
  ai_verdict: string;
  ai_confidence: number | null;
  entry_mode: "at_suggestion" | "next_open";
  entry_at: string;
  entry_price: number | null;
  index_entry: number | null;
  calendar_approximate: boolean;
  status: PredictionStatus;
  last_price: number | null;
  last_return: number | null;
  last_index_return: number | null;
  last_alpha: number | null;
  last_evaluated_at: string | null;
  progress_done: number;
  progress_total: number;
  progress_unit: "min" | "day";
  max_runup: number | null;
  max_drawdown: number | null;
  exit_reason: "" | "target" | "stop" | "final" | "hard_cap";
  exit_at: string | null;
  exit_price: number | null;
  exit_return: number | null;
  exit_index_return: number | null;
  exit_alpha: number | null;
  hold_at: string | null;
  hold_price: number | null;
  hold_return: number | null;
  hold_index_return: number | null;
  hold_alpha: number | null;
  hold_complete: boolean;
  outcome_basis: "exit" | "hold";
  final_return: number | null;
  final_alpha: number | null;
  outcome: Outcome;
  beat_market: boolean | null;
  closed_at: string | null;
  analysis_status: "none" | "pending" | "done" | "error";
  extended_due_at: string | null;
  extended_return: number | null;
  extended_index_return: number | null;
  extended_alpha: number | null;
  extended_note: string;
  error: string;
  checkpoints: Checkpoint[];
  loss_analysis?: LossAnalysis | null;
  lessons?: Lesson[];
  suggestions?: Suggestion[];
}

export interface LossAnalysis {
  trigger: "loss" | "underperformed" | "both";
  method: "claude" | "rules";
  cause: string;
  explanation: string;
  what_was_missed: string;
  model: string;
  error: string;
  revisit_note: string;
  created_at: string;
}

export interface Lesson {
  id: number;
  market: Market;
  horizon: Horizon;
  text: string;
  cause: string;
  tags: string[];
  prediction_id: number | null;
  active: boolean;
  priority: number;
  times_used: number;
  note: string;
  created_at: string;
}

export interface Suggestion {
  id: number;
  path: string;
  current_value: number | null;
  suggested_value: number | null;
  reason: string;
  prediction_id: number | null;
  status: "pending" | "applied" | "dismissed" | "reverted";
  created_at: string;
  decided_at: string | null;
}

export interface Override {
  id: number;
  path: string;
  value: number;
  suggestion_id: number | null;
  created_at: string;
}

export interface HorizonRecord {
  horizon: Horizon;
  total: number;
  open: number;
  closed: number;
  profit: number;
  loss: number;
  breakeven: number;
  win_rate: number | null;
  beat_market_rate: number | null;
  avg_return: number | null;
  avg_alpha: number | null;
}

export interface TrackerSummary {
  horizons: HorizonRecord[];
  pass_running: boolean;
  scheduler: string;
  every_minutes: number;
  last_evaluated_at: string | null;
  pending_suggestions: number;
  active_lessons: number;
  benchmarks: Partial<Record<Market, string>>;
  breakeven_pct: Partial<Record<Horizon, number>>;
  underperformance_margin_pct: Partial<Record<Horizon, number>>;
}

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

export const trackerApi = {
  summary: (token: string, market: Market) => request<TrackerSummary>("GET", `stocks/tracker/summary/?market=${market}`, token),
  predictions: (token: string, market: Market, status: "open" | "closed" | "all", horizon?: Horizon | "") =>
    request<Prediction[]>("GET", `stocks/tracker/predictions/?market=${market}&status=${status}${horizon ? `&horizon=${horizon}` : ""}`, token),
  prediction: (token: string, id: number) => request<Prediction>("GET", `stocks/tracker/predictions/${id}/`, token),
  evaluate: (token: string) => request<{ started: boolean }>("POST", "stocks/tracker/evaluate/", token),
  lessons: (token: string, market: Market) => request<Lesson[]>("GET", `stocks/tracker/lessons/?market=${market}`, token),
  setLesson: (token: string, id: number, active: boolean) => request<Lesson>("PATCH", `stocks/tracker/lessons/${id}/`, token, { active }),
  suggestions: (token: string) => request<{ suggestions: Suggestion[]; overrides: Override[] }>("GET", "stocks/tracker/suggestions/", token),
  decide: (token: string, id: number, decision: "approve" | "dismiss") =>
    request<Suggestion>("POST", `stocks/tracker/suggestions/${id}/${decision}/`, token),
  revert: (token: string, id: number) => request<null>("POST", `stocks/tracker/overrides/${id}/revert/`, token),
};
