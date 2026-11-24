/**
 * Client for the backend `playground` app (arp/playground/...): ExamPrep, File Analyser and FinanceAI.
 *
 * Each app is opened with its own 4-digit code (admin panel -> Playground) or a free trial: 30 minutes per IP,
 * then a 24-hour wait. Both return a session token for that app only; it is kept in localStorage per app and
 * sent in the `token` header. A 401 means the session ended (trial over, code changed) -> show the gate again.
 */
const BASE: string = import.meta.env.VITE_API_BASE_URL; // e.g. http://localhost:8000/arp/

export type PlaygroundAppId = "examprep" | "file-analyser" | "finance";
export type SessionMode = "code" | "trial";
export type TrialState = "available" | "active" | "cooldown" | "disabled";

export interface AppStatus {
  app: PlaygroundAppId;
  label: string;
  code_set: boolean;
  trial: {
    enabled: boolean;
    minutes: number;
    cooldown_hours: number;
    state: TrialState;
    expires_at: string | null;
    next_available_at: string | null;
  };
}

export interface Session {
  token: string;
  mode: SessionMode;
  expires_at: string | null; // trial end; null for code sessions
}

export class PlaygroundHttpError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// ---------------------------------------------------------------- token storage
const tokenKey = (app: PlaygroundAppId) => `pg_token_${app}`;

export function readToken(app: PlaygroundAppId): string {
  try {
    return localStorage.getItem(tokenKey(app)) || "";
  } catch {
    return "";
  }
}

export function storeToken(app: PlaygroundAppId, token: string) {
  try {
    if (token) localStorage.setItem(tokenKey(app), token);
    else localStorage.removeItem(tokenKey(app));
  } catch {
    /* storage unavailable */
  }
}

// ---------------------------------------------------------------- transport
async function parse<T>(resp: Response): Promise<T> {
  const json = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = json?.messages?.[0] ?? json?.detail ?? `Request failed (${resp.status})`;
    throw new PlaygroundHttpError(resp.status, String(msg), json?.data);
  }
  return (json?.data ?? null) as T;
}

async function request<T>(method: string, path: string, token = "", body?: unknown): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(`${BASE}playground/${path}`, {
      method,
      headers: { "Content-Type": "application/json", token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new PlaygroundHttpError(0, "Could not reach the server.");
  }
  return parse<T>(resp);
}

/** Multipart upload with progress (fetch has no upload progress). */
function upload<T>(path: string, token: string, form: FormData, onProgress?: (pct: number) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}playground/${path}`);
    xhr.setRequestHeader("token", token);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let json: { data?: T; messages?: string[]; detail?: string } | null = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error page (e.g. nginx 413) */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve((json?.data ?? null) as T);
      else {
        const msg = json?.messages?.[0] ?? json?.detail ?? (xhr.status === 413 ? "File too large" : `Upload failed (${xhr.status})`);
        reject(new PlaygroundHttpError(xhr.status, String(msg)));
      }
    };
    xhr.onerror = () => reject(new PlaygroundHttpError(0, "Upload failed: could not reach the server."));
    xhr.send(form);
  });
}

// ---------------------------------------------------------------- access
export const accessApi = {
  status: (app: PlaygroundAppId) => request<AppStatus>("GET", `${app}/status/`),
  unlock: (app: PlaygroundAppId, code: string) => request<Session>("POST", `${app}/unlock/`, "", { code }),
  trial: (app: PlaygroundAppId) => request<Session>("POST", `${app}/trial/`),
  session: (app: PlaygroundAppId, token: string) =>
    request<{ mode: SessionMode; expires_at: string | null }>("GET", `${app}/session/`, token),
};

// ---------------------------------------------------------------- ExamPrep
export interface QuizOption {
  id: string;
  option: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  attended: boolean;
  flagged: boolean;
  options: QuizOption[];
  answer: string[];
  userAnswer?: string[];
}

export const examprepApi = {
  convert: (token: string, file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append("file", file);
    return upload<{ questions: QuizQuestion[]; provider: string; model: string }>("examprep/convert/", token, form, onProgress);
  },
};

// ---------------------------------------------------------------- FinanceAI
export interface FinancePayload {
  name?: string;
  currency?: string;
  dependents?: number;
  age?: number;
  city?: string;
  employment_status?: string;
  primary_income?: number;
  secondary_income?: number;
  rent_mortgage?: number;
  insurance_premiums?: number;
  subscriptions?: number;
  loan_payments?: number;
  outstanding_loans?: number;
  variable_expenses?: number;
  savings_balance?: number;
  investments?: number;
  property_value?: number;
  emergency_fund?: number;
  goals?: string;
}

type BudgetStatus = "healthy" | "concerning" | "critical";

export interface FinanceReport {
  headline?: string;
  strengths?: string[];
  health_score: { score: number; grade: "A" | "B" | "C" | "D" | "F"; summary: string };
  income_expense_summary: {
    total_monthly_income: number;
    total_monthly_expenses: number;
    monthly_surplus: number;
    savings_rate_percent: number;
    verdict: string;
  };
  budget_breakdown: Record<string, { amount: number; status: BudgetStatus; note: string }>;
  savings_assets_assessment: {
    emergency_fund_months: number;
    emergency_fund_status: "sufficient" | "insufficient";
    emergency_fund_note: string;
    savings_balance: number;
    savings_vs_age_verdict: string;
    investments_status: "none" | "low" | "moderate" | "strong";
    investments_note: string;
  };
  debt_analysis: { total_debt: number; debt_to_income_ratio: number; status: BudgetStatus; repayment_strategy: string | null };
  goal_alignment: { stated_goals: string; alignment_score: number; analysis: string; gaps: string[] };
  recommendations: {
    priority: number;
    title: string;
    detail: string;
    rationale: string;
    impact?: string;
    timeframe?: string;
  }[];
  risk_flags: { severity: "high" | "medium" | "low"; flag: string; action: string }[];
}

/** Exact figures computed by the backend from the answers (playground/finance.py: compute_metrics). */
export interface FinancePillar {
  key: "saving" | "safety_net" | "debt" | "housing" | "growth";
  label: string;
  points: number;
  max: number;
  value: string;
  target: string;
  status: "strong" | "ok" | "weak";
}

export interface FinanceMetrics {
  currency: string;
  monthly_income: number;
  fixed_expenses: number;
  variable_expenses: number;
  monthly_expenses: number;
  monthly_surplus: number;
  annual_surplus: number;
  savings_rate_percent: number | null;
  housing_percent: number | null;
  debt_service_percent: number | null;
  emergency_fund_months: number | null;
  cash_cushion: number;
  cash_cushion_months: number | null;
  six_month_cushion_gap: number;
  total_debt: number;
  debt_to_annual_income: number | null;
  months_to_debt_free: number | null;
  investments_x_income: number | null;
  investments_target_x: number;
  total_assets: number;
  net_worth: number;
  spending: { key: string; amount: number; percent_of_income: number | null }[];
  pillars: FinancePillar[];
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
}

export interface FinanceRecord extends Required<FinancePayload> {
  id: string;
  ai_response: FinanceReport | null;
  metrics: FinanceMetrics;
  created_at: string;
}

export const financeApi = {
  create: (token: string, body: FinancePayload) => request<FinanceRecord>("POST", "finance/records/", token, body),
  update: (token: string, id: string, body: FinancePayload) =>
    request<FinanceRecord>("POST", `finance/records/${id}/`, token, body),
  get: (token: string, id: string) => request<FinanceRecord>("GET", `finance/records/${id}/`, token),
  report: (token: string, id: string, force = false) =>
    request<FinanceRecord>("POST", `finance/records/${id}/report/`, token, { force }),
};

// ---------------------------------------------------------------- File Analyser
export interface FileReference {
  file?: string;
  chunk?: number;
}

export interface FileChatMessage {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  references: FileReference[];
  created_at: string | null;
}

export interface FileSession {
  id: string;
  retrieval: "embedding" | "keyword";
  created_at: string;
  docs: { id: number; name: string; size: number; chars: number }[];
  messages?: FileChatMessage[];
}

export const fileApi = {
  upload: (token: string, files: File[], onProgress?: (pct: number) => void) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return upload<FileSession>("file-analyser/sessions/", token, form, onProgress);
  },
  session: (token: string, id: string) => request<FileSession>("GET", `file-analyser/sessions/${id}/`, token),
  ask: (token: string, id: string, message: string) =>
    request<{ answer: string; references: FileReference[]; message: FileChatMessage }>(
      "POST",
      `file-analyser/sessions/${id}/messages/`,
      token,
      { message }
    ),
};
