import type {
  PlanAssistantActionConfirmation,
  PlanAssistantActionProposal,
  PlanAssistantActionResult,
  PlanAssistantCitation,
  PlanAssistantRequest,
  PlanAssistantResponse as PlanAssistantApiResponse,
} from '@painel-prime/app';

export type PlanHint = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  ctaLabel: string;
  ctaPath: string;
};

export type ChatMessage = {
  id: string;
  role: 'bot' | 'user';
  text: string;
  audioUrl?: string;
  autoPlayAudio?: boolean;
  inputModality?: 'text' | 'audio';
  replyModality?: 'text' | 'audio';
  attachmentName?: string;
  ctaLabel?: string;
  ctaPath?: string;
  ctaAction?: 'route' | 'open-draft';
  draftId?: string;
  jobId?: string;
  jobStatus?: 'uploading' | 'queued' | 'processing' | 'done' | 'failed';
  citations?: PlanAssistantCitation[];
  actionProposal?: PlanAssistantActionProposal;
  isActionExecuted?: boolean;
  isActionCancelled?: boolean;
  actionExecutionMessage?: string;
};

export type MessageHistoryItem = {
  role: 'assistant' | 'user';
  content: string;
};

export type SuggestedAction = {
  label: string;
  path: string;
};

export type PlanIaQuotaInfo = {
  allowed: boolean;
  is_unlimited?: boolean;
  used: number;
  limit: number;
  remaining: number;
  plan_id: string;
  cycle_start?: string | null;
  cycle_end?: string | null;
  upgrade_recommended?: string | null;
};

export type PendingContractAttachment = {
  fileUri: string;
  name: string;
  mimeType?: string;
  size?: number;
  eventId?: string | null;
  eventName?: string | null;
};

export type {
  PlanAssistantActionConfirmation,
  PlanAssistantActionProposal,
  PlanAssistantActionResult,
  PlanAssistantCitation,
  PlanAssistantRequest,
  PlanAssistantResponse as PlanAssistantApiResponse,
} from '@painel-prime/app';

export type {
  PlanAiThread,
  PlanAiMessageRow,
  PlanThreadGroup,
} from './planAssistantThreads';

export type HintStateRow = {
  hint_id: string;
  last_action: 'shown' | 'opened' | 'dismissed';
  last_action_at: string;
  last_shown_at: string | null;
  last_opened_at: string | null;
  last_dismissed_at: string | null;
};

export type RouteContext = {
  currentPath: string;
  currentEventId: string | null;
};

export type Point = { x: number; y: number };
export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };
