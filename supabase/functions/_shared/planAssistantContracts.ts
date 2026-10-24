export type PlanAssistantRequest = {
  message?: unknown;
  current_path?: unknown;
  current_event_id?: unknown;
  context_type?: unknown;
  context_id?: unknown;
  attachments?: unknown;
  hints?: unknown;
  user_name?: unknown;
  message_history?: unknown;
  conversation_id?: unknown;
  request_id?: unknown;
  publicSalesJobId?: unknown;
  publicSalesJobToken?: unknown;
  sales_contact?: unknown;
  client_platform?: unknown;
  channel?: unknown;
};

export type TenantContext = {
  userId: string;
  tenantId: string;
};

export type FinancialSummary = {
  base_balance: number;
  confirmed_in: number;
  planned_in: number;
  confirmed_out: number;
  planned_out: number;
  cash_balance: number;
  entries_count: number;
  expenses_count: number;
};

export type RetrievedContext<TEvent = unknown, TEventPortfolio = unknown> = {
  event: TEvent | null;
  eventPortfolio: TEventPortfolio;
  finance: FinancialSummary | null;
};

export type PlanAssistantResponse = {
  answer: string;
  suggested_actions: Array<{ label: string; path: string }>;
  meta: Record<string, unknown>;
  context: Record<string, unknown>;
};
