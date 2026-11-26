// Types mirroring resolver/api/v1/serializers. Keep in sync with the backend.

export type ISODate = string;

export interface ApiErrorBody {
  error: { code: string; message: string; details: Record<string, unknown> };
}

export type AuthMode = "email_only" | "email_otp";

export interface AuthConfig {
  mode: AuthMode;
  development_mode: boolean;
  code_length: number;
}

export interface LoginResponse extends AuthConfig {
  code_sent: boolean;
  message: string;
  /** Local development only: the sign-in code, so the form can fill it in. */
  dev_code?: string;
  token?: string;
  expires_at?: ISODate;
}

export interface TokenResponse {
  token: string;
  expires_at: ISODate;
}

export interface MagicResponse extends AuthConfig {
  requires_code: boolean;
  email: string;
  case_code: string;
  purpose: "invite" | "follow_up" | "report" | "decline";
  redirect: string;
  dev_code?: string;
  token?: string;
  expires_at?: ISODate;
}

export interface Me {
  id: string;
  email: string;
  display_name: string;
  phone: string;
  timezone: string;
  language: string;
  notify_status_updates: boolean;
}

export type PartyRole = "reporter" | "respondent" | "witness" | "other";

export type PartyStatus =
  | "not_invited"
  | "invited"
  | "viewed"
  | "in_progress"
  | "follow_up_requested"
  | "info_gathered"
  | "declined"
  | "expired"
  | "bounced"
  | "withdrawn";

export type CaseStatus =
  | "intake"
  | "awaiting_consent"
  | "awaiting_summary_approval"
  | "gathering"
  | "analysing"
  | "pending_review"
  | "reports_ready"
  | "analysis_failed"
  | "abandoned"
  | "closed";

export type ProgressStep = "story" | "others" | "analysis" | "report";

export type CaseAction =
  | "continue_story"
  | "give_consent"
  | "approve_summary"
  | "fix_email"
  | "answer_follow_up"
  | "respond_invite"
  | "continue_conversation"
  | "rejoin"
  | "read_report"
  | "wait"
  | "none";

export interface CaseListItem {
  code: string;
  summary: string;
  my_role: PartyRole;
  case_status: CaseStatus;
  my_status: PartyStatus;
  action_needed: CaseAction;
  updated_at: ISODate;
}

export interface CaseList {
  results: CaseListItem[];
  next_cursor: string | null;
}

export interface PartyView {
  id: string;
  display_name: string;
  role: PartyRole;
  status: PartyStatus;
  status_label: string;
  eta: ISODate | "in_progress" | null;
  is_me: boolean;
  can_fix_email: boolean;
  can_withdraw: boolean;
}

export interface CaseDetail {
  code: string;
  summary: string;
  status: CaseStatus;
  progress_step: ProgressStep;
  risk_high: boolean;
  parties: PartyView[];
  my_party: PartyView;
  my_action: CaseAction;
  can_proceed: boolean;
  proceed_available_at: ISODate | null;
  can_close: boolean;
  others_involved: boolean;
  single_perspective: boolean;
  updated_at: ISODate;
}

export interface CreatedCase {
  case: CaseListItem;
  conversation_id: string;
}

// ---- conversation ----------------------------------------------------------------------

export type Sender = "party" | "ai" | "system";

export interface EmergencyResource {
  name: string;
  contact: string;
}

export interface PartyDraft {
  name: string;
  email: string;
  phone: string;
  role: Exclude<PartyRole, "reporter">;
  relationship: string;
}

export type UiEvent =
  | { type: "consent_request" }
  | { type: "party_form"; parties: PartyDraft[] }
  | { type: "summary_approval"; summary: string; max_words: number }
  | { type: "emergency_resources"; resources: EmergencyResource[]; dismissible: boolean }
  | { type: "round_complete" }
  | { type: "ai_failed" };

export interface ChatMessage {
  id: string;
  sender: Sender;
  content: string;
  created_at: ISODate;
  round: number | null;
  client_message_id: string | null;
  ui_events: UiEvent[];
  awaiting_reply: boolean;
}

export interface RoundInfo {
  number: number;
  status: "requested" | "active" | "complete" | "expired";
  reason: "initial" | "follow_up";
  requested_at: ISODate | null;
  deadline_at: ISODate | null;
}

export type InputDisabledReason =
  | "round_complete"
  | "analysis"
  | "case_closed"
  | "declined"
  | "not_joined"
  | "expired"
  | "generic";

export interface ConversationPage {
  conversation_id: string;
  messages: ChatMessage[];
  rounds: RoundInfo[];
  round: RoundInfo | null;
  input_allowed: boolean;
  input_disabled_reason: InputDisabledReason | null;
  can_complete: boolean;
  max_message_chars: number;
  older_cursor: string | null;
  pending_events: UiEvent[];
}

export interface SendMessageResponse {
  user_message: ChatMessage;
  ai_message: ChatMessage | null;
  ui_events: UiEvent[];
  ai_error: string | null;
}

// ---- welcome / reports -----------------------------------------------------------------

export interface WelcomeInfo {
  code: string;
  summary: string;
  deadline_at: ISODate | null;
  my_status: PartyStatus;
  can_join: boolean;
  can_decline: boolean;
}

export interface ReportOption {
  title: string;
  type: "informal" | "mediation" | "legal_civil" | "police" | "regulator" | "medical" | "other";
  steps: string[];
  timeframe: string;
  cost: string;
  evidence_needed: string[];
  pros: string[];
  cons: string[];
}

export interface SharedReport {
  situation_summary: string;
  what_is_agreed: string[];
  what_is_disputed: string[];
  paths_to_resolution: string[];
  recommended_next_steps: string[];
  support_resources: EmergencyResource[];
  missing_perspectives: string[];
  disclaimer: string;
}

export interface ActionConsequence {
  what_you_did: string;
  possible_consequences: string;
  how_to_make_it_right: string;
}

export interface PrivateReport {
  personal_note: string;
  situation_summary: string;
  what_is_agreed: string[];
  what_is_disputed: string[];
  your_options: ReportOption[];
  legal_position: string;
  your_actions_and_consequences: ActionConsequence[];
  emotional_wellbeing: string[];
  recommended_next_steps: string[];
  support_resources: EmergencyResource[];
  missing_perspectives: string[];
  disclaimer: string;
}

export interface ReportsResponse {
  ready: boolean;
  status: CaseStatus;
  version: number | null;
  released_at: ISODate | null;
  shared: SharedReport | null;
  mine: PrivateReport | null;
}
