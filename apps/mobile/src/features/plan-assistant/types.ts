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
  ctaLabel?: string;
  ctaPath?: string;
};

export type MessageHistoryItem = {
  role: 'assistant' | 'user';
  content: string;
};

export type SuggestedAction = {
  label: string;
  path: string;
};

export type PlanAssistantApiResponse = {
  answer?: string;
  reply?: string;
  message?: string;
  assistant?: string;
  output_text?: string;
  text?: string;
  suggested_actions?: Array<{ label?: string; path?: string }>;
  meta?: {
    ai_used?: boolean;
    ai_error?: string | null;
    response_mode?: 'ai' | 'deterministic' | 'fallback';
  };
};

export type PlanAssistantRequest = {
  message: string;
  current_path: string;
  current_event_id: string | null;
  hints: Array<{ id: string; title: string; ctaLabel: string; ctaPath: string }>;
  message_history?: MessageHistoryItem[];
  user_name: string;
};

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
