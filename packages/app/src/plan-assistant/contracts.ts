/**
 * Stable, transport-only contract for Plan IA clients.
 *
 * Authorization is deliberately absent here: tenant, role and permissions are
 * resolved by the server from the authenticated session.
 */
export const PLAN_ASSISTANT_CONTRACT_VERSION = '1.0.0' as const;

export type PlanAssistantContractVersion = typeof PLAN_ASSISTANT_CONTRACT_VERSION;

export type PlanAssistantHistoryMessage = {
  role: 'assistant' | 'user';
  content: string;
};

export type PlanAssistantHint = {
  id: string;
  title: string;
  ctaLabel: string;
  ctaPath: string;
};

export type PlanAssistantRequest = {
  contract_version?: PlanAssistantContractVersion;
  /** @deprecated compatibility alias; clients should send request_id. */
  requestId?: string;
  request_id?: string;
  message: string;
  current_path: string;
  current_event_id?: string | null;
  context_type?: string;
  context_id?: string | null;
  hints?: PlanAssistantHint[];
  message_history?: PlanAssistantHistoryMessage[];
  user_name?: string;
  attachments?: Array<{ stored_file_id: string; kind: 'contract_pdf' }>;
  client_platform?: 'web' | 'android' | 'ios' | string;
  channel?: string;
};

export type PlanAssistantCitation = {
  id: string;
  source_type: 'document' | 'system_data';
  source_id: string;
  title: string;
  version?: string | null;
  lifecycle_status?: string | null;
  occurred_at?: string | null;
};

export type PlanAssistantSecurityTrace = {
  security_trace_id: string;
  decision: 'allow' | 'observe' | 'sanitize' | 'block';
  inference_suppressed?: boolean;
};

export type PlanAssistantActionProposal = {
  proposal_id: string;
  tool_name: string;
  expires_at: string;
  requires_confirmation: true;
};

export type PlanAssistantActionConfirmation = {
  proposal_id: string;
  confirmation_token: string;
};

export type PlanAssistantErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_request'
  | 'scope_unavailable'
  | 'tool_not_authorized'
  | 'action_confirmation_required'
  | 'internal_error';

export type PlanAssistantResponseMeta = {
  ai_used?: boolean;
  ai_error?: string | null;
  response_mode?: 'ai' | 'deterministic' | 'fallback';
  contract_version: PlanAssistantContractVersion;
  security_trace?: PlanAssistantSecurityTrace;
};

export type PlanAssistantResponse = {
  answer?: string;
  reply?: string;
  message?: string;
  assistant?: string;
  output_text?: string;
  text?: string;
  jobId?: string;
  job_id?: string;
  quota?: Record<string, unknown>;
  suggested_actions?: Array<{ label: string; path: string }>;
  citations?: PlanAssistantCitation[];
  action_proposal?: PlanAssistantActionProposal;
  error?: PlanAssistantErrorCode;
  meta?: PlanAssistantResponseMeta;
};
