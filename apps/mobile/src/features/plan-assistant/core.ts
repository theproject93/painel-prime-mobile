import { getVisibleSegments, normalizeSingleParam } from '../../lib/router';
import type { EventDetailsInitialTab } from '../../navigation/eventRouteTypes';
import type {
  Bounds,
  ChatMessage,
  HintStateRow,
  MessageHistoryItem,
  PlanHint,
  Point,
  RouteContext,
  SuggestedAction,
} from './types';

export const HINT_COOLDOWN_MS = 1000 * 60 * 45;
export const OPENED_COOLDOWN_MS = 1000 * 60 * 60 * 2;
export const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 6;
export const PROACTIVE_BUBBLE_MS = 1000 * 12;
export const HINT_REFRESH_TTL_MS = 1000 * 60 * 15;
export const MESSAGE_HISTORY_LIMIT = 8;

export const DEFAULT_PLAN_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'bot',
    text: 'Olá! Eu sou a Plan. Posso responder dúvidas da plataforma e ajudar com prioridades.',
  },
];

export function normalizeText(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getNearestFabCorner(position: Point, bounds: Bounds) {
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.minX, y: bounds.maxY },
    { x: bounds.maxX, y: bounds.maxY },
  ];
  return corners.reduce((best, corner) => {
    const bestDistance = (position.x - best.x) ** 2 + (position.y - best.y) ** 2;
    const distance = (position.x - corner.x) ** 2 + (position.y - corner.y) ** 2;
    return distance < bestDistance ? corner : best;
  });
}

export function getDaysUntil(dateText: string | null, now = new Date()) {
  if (!dateText) return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const target = new Date(dateText);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function getPendingRsvp(guest: {
  confirmed: boolean | null;
  rsvp_status: string | null;
}) {
  const status = (guest.rsvp_status ?? '').trim().toLowerCase();
  if (status === 'pending') return true;
  if (status === 'confirmed' || status === 'declined') return false;
  return !guest.confirmed;
}

export function shouldTemporarilyHideHint(state: HintStateRow | undefined, nowMs: number) {
  if (!state) return false;
  if (state.last_opened_at && nowMs - new Date(state.last_opened_at).getTime() < OPENED_COOLDOWN_MS) {
    return true;
  }
  if (
    state.last_dismissed_at &&
    nowMs - new Date(state.last_dismissed_at).getTime() < DISMISS_COOLDOWN_MS
  ) {
    return true;
  }
  return false;
}

export function extractEventTabFromPath(path: string): EventDetailsInitialTab | undefined {
  const normalized = normalizeText(path);
  if (normalized.includes('/cronograma') || normalized.includes('/timeline')) return 'timeline';
  if (normalized.includes('/checklist') || normalized.includes('/tarefas') || normalized.includes('/tasks')) return 'tasks';
  if (normalized.includes('/financeiro') || normalized.includes('/orcamento') || normalized.includes('/budget')) return 'budget';
  if (normalized.includes('/convidados') || normalized.includes('/rsvp') || normalized.includes('/guests')) return 'guests';
  if (normalized.includes('/fornecedores') || normalized.includes('/vendors')) return 'vendors';
  if (normalized.includes('/documentos') || normalized.includes('/documents')) return 'documents';
  if (normalized.includes('/notas') || normalized.includes('/notes')) return 'notes';
  if (normalized.includes('/equipe') || normalized.includes('/team')) return 'team';
  if (normalized.includes('/mesas') || normalized.includes('/tables')) return 'tables';
  if (normalized.includes('/convites') || normalized.includes('/invites')) return 'invites';
  if (normalized.includes('/historico') || normalized.includes('/history')) return 'history';
  if (normalized.includes('/visao-geral') || normalized.includes('/overview')) return 'overview';
  if (normalized.includes('/comando') || normalized.includes('/command')) return 'overview';
  return undefined;
}

export function buildRouteContext(
  segments: readonly string[],
  params: Record<string, string | string[] | undefined>,
): RouteContext {
  const [root = 'dashboard', leaf = ''] = getVisibleSegments(segments);
  const routeEventId = normalizeSingleParam(params.id) || normalizeSingleParam(params.eventId) || null;

  if (root === 'dashboard' || root === 'Dashboard') return { currentPath: '/dashboard', currentEventId: null };
  if (root === 'clientes' || root === 'Clients') return { currentPath: '/dashboard/clientes', currentEventId: null };
  if (root === 'financeiro' || root === 'Finance') return { currentPath: '/dashboard/financeiro', currentEventId: null };
  if (root === 'eventos' || root === 'Events') {
    if ((leaf === '[id]' || leaf === 'EventDetails') && routeEventId) {
      return { currentPath: `/dashboard/eventos/${routeEventId}`, currentEventId: routeEventId };
    }
    return { currentPath: '/dashboard/eventos', currentEventId: null };
  }
  if (root === 'mais' || root === 'More') {
    if (leaf === 'perfil' || leaf === 'Profile') return { currentPath: '/dashboard/perfil', currentEventId: null };
    if (leaf === 'saude-operacional' || leaf === 'OperationalHealth') return { currentPath: '/dashboard/saude-operacional', currentEventId: null };
    if (leaf === 'assinaturas' || leaf === 'SuperBilling') return { currentPath: '/dashboard/faturamento', currentEventId: null };
    if (leaf === 'configuracoes' || leaf === 'Settings') return { currentPath: '/dashboard/configuracoes', currentEventId: null };
    return { currentPath: '/dashboard/mais', currentEventId: null };
  }
  return { currentPath: '/dashboard', currentEventId: null };
}

export function getAssistantAnswer(data: unknown) {
  if (!data || typeof data !== 'object') return '';
  const payload = data as Record<string, unknown>;
  for (const candidate of [payload.answer, payload.reply, payload.message, payload.assistant, payload.output_text, payload.text]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

export function getSuggestedActions(data: unknown) {
  if (!data || typeof data !== 'object') return [] as SuggestedAction[];
  const rawActions = (data as Record<string, unknown>).suggested_actions;
  if (!Array.isArray(rawActions)) return [] as SuggestedAction[];
  return rawActions.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const path = typeof row.path === 'string' ? row.path.trim() : '';
    if (!path) return [];
    const label = typeof row.label === 'string' && row.label.trim() ? row.label.trim() : 'Abrir módulo';
    return [{ label, path }];
  });
}

export function normalizeAccessToken(token: string | null | undefined) {
  if (!token) return null;
  let value = token.trim();
  if (value.toLowerCase().startsWith('bearer ')) value = value.slice(7).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }
  return value.split('.').length === 3 ? value : null;
}

export function buildMessageHistory(messages: ChatMessage[]) {
  return messages.slice(-MESSAGE_HISTORY_LIMIT).map((message) => ({
    role: message.role === 'user' ? 'user' as const : 'assistant' as const,
    content: message.text,
  })) satisfies MessageHistoryItem[];
}

export function buildHintMessage(hint: PlanHint, userName: string) {
  const normalizedTitle = normalizeText(hint.title);
  const greeting = `Olá ${userName || 'assessora'}, verifique esta pendência:`;
  if (normalizedTitle.includes('buffet')) {
    return `${greeting}\n\n- ${hint.title}.\n- Não encontrei fornecedor com categoria "Buffet" neste evento.\n\nPassos recomendados:\n1. Abra o evento indicado.\n2. Acesse a aba Fornecedores.\n3. Cadastre ou ajuste um fornecedor Buffet.\n4. Confirme contato e status.`;
  }
  if (normalizedTitle.includes('convidado')) {
    return `${greeting}\n\n- ${hint.title}.\n- Existem confirmações de presença pendentes.\n\nPassos recomendados:\n1. Abra o evento indicado.\n2. Acesse a aba Convidados.\n3. Filtre pendentes e revise contatos.\n4. Reenvie os convites.`;
  }
  if (normalizedTitle.includes('tarefa') || normalizedTitle.includes('atras')) {
    return `${greeting}\n\n- ${hint.title}.\n- Existem tarefas vencidas no evento.\n\nPassos recomendados:\n1. Abra o evento indicado.\n2. Acesse Cronograma ou Checklist.\n3. Conclua primeiro as tarefas vencidas.\n4. Reordene prioridades das próximas 24h.`;
  }
  return `${greeting}\n\n- ${hint.title}.\n- ${hint.message}\n\nPassos recomendados:\n1. Abra o evento indicado.\n2. Revise a aba relacionada à pendência.\n3. Aplique o ajuste necessário.\n4. Volte aqui para validar.`;
}
