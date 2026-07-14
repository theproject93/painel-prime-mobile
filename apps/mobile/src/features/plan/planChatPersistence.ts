export type PersistedPlanChatMessage = {
  id: string;
  role: 'bot' | 'user';
  text: string;
  ctaLabel?: string;
  ctaPath?: string;
};

export type PlanChatSnapshot = {
  version: 1;
  messages: PersistedPlanChatMessage[];
  draft: string;
};

const MAX_PERSISTED_MESSAGES = 30;

export function planChatStorageKey(userId: string) {
  return `painelprime.plan.chat.v1.${userId}`;
}

function normalizeMessage(value: unknown): PersistedPlanChatMessage | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  const text = typeof row.text === 'string' ? row.text.trim() : '';
  const role = row.role === 'bot' || row.role === 'user' ? row.role : null;
  if (!id || !text || !role) return null;
  return {
    id,
    role,
    text,
    ...(typeof row.ctaLabel === 'string' && row.ctaLabel.trim()
      ? { ctaLabel: row.ctaLabel.trim() }
      : {}),
    ...(typeof row.ctaPath === 'string' && row.ctaPath.trim()
      ? { ctaPath: row.ctaPath.trim() }
      : {}),
  };
}

export function createPlanChatSnapshot(input: {
  messages: PersistedPlanChatMessage[];
  draft: string;
}): PlanChatSnapshot {
  return {
    version: 1,
    messages: input.messages
      .map(normalizeMessage)
      .filter((message): message is PersistedPlanChatMessage => message !== null)
      .slice(-MAX_PERSISTED_MESSAGES),
    draft: input.draft.trim(),
  };
}

export function restorePlanChatSnapshot(
  raw: string | null,
  fallbackMessages: PersistedPlanChatMessage[],
): Pick<PlanChatSnapshot, 'messages' | 'draft'> {
  if (!raw) return { messages: fallbackMessages, draft: '' };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages
          .map(normalizeMessage)
          .filter((message): message is PersistedPlanChatMessage => message !== null)
          .slice(-MAX_PERSISTED_MESSAGES)
      : [];
    return {
      messages: messages.length > 0 ? messages : fallbackMessages,
      draft: typeof parsed.draft === 'string' ? parsed.draft.trim() : '',
    };
  } catch {
    return { messages: fallbackMessages, draft: '' };
  }
}
