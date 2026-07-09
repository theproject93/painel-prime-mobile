import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { getVisibleSegments, normalizeSingleParam } from '../lib/router';
import { supabase } from '../lib/supabase';
import type { EventDetailsInitialTab } from '../navigation/eventRouteTypes';
import { colors } from '../theme/colors';
import { WalkthroughAnchorTarget, useWalkthroughAnchors } from './WalkthroughAnchors';

type PlanHint = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  ctaLabel: string;
  ctaPath: string;
};

type ChatMessage = {
  id: string;
  role: 'bot' | 'user';
  text: string;
  ctaLabel?: string;
  ctaPath?: string;
};

type MessageHistoryItem = {
  role: 'assistant' | 'user';
  content: string;
};

type SuggestedAction = {
  label: string;
  path: string;
};

type PlanAssistantApiResponse = {
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
  };
};

type HintStateRow = {
  hint_id: string;
  last_action: 'shown' | 'opened' | 'dismissed';
  last_action_at: string;
  last_shown_at: string | null;
  last_opened_at: string | null;
  last_dismissed_at: string | null;
};

type EventLite = {
  id: string;
  name: string;
  event_date: string | null;
};

type VendorLite = {
  event_id: string;
  category: string | null;
  expected_arrival_time: string | null;
  expected_done_time: string | null;
};

type GuestLite = {
  event_id: string;
  confirmed: boolean | null;
  rsvp_status: string | null;
};

type TaskLite = {
  event_id: string;
  completed: boolean | null;
  due_date: string | null;
};

type FinanceEntryLite = {
  amount: number | string | null;
  status: string | null;
};

type FinanceExpenseLite = {
  amount: number | string | null;
  status: string | null;
};

type EventLiteData = {
  id: string;
  name: string;
  event_date: string | null;
  budget_total: number | string | null;
};

type EventExpenseLite = {
  value: number | string | null;
};

type EventPaymentLite = {
  amount: number | string | null;
};

type RouteContext = {
  currentPath: string;
  currentEventId: string | null;
};

const HINT_COOLDOWN_MS = 1000 * 60 * 45;
const OPENED_COOLDOWN_MS = 1000 * 60 * 60 * 2;
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 6;
const PROACTIVE_BUBBLE_MS = 1000 * 12;
const BOTTOM_TAB_BAR_HEIGHT = 56;
const FAB_VERTICAL_GAP = 14;
const FAB_SIZE = 56;
const FAB_SIDE_SAFE_MARGIN = 28;
const FAB_POSITION_STORAGE_PREFIX = 'planejarpro:plan_assistant_fab_position';
const PLAN_FACE_IMAGE = require('../../assets/plan-face-real.png');
const MESSAGE_HISTORY_LIMIT = 8;

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBRL(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getNearestFabCorner(
  position: { x: number; y: number },
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
) {
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.minX, y: bounds.maxY },
    { x: bounds.maxX, y: bounds.maxY },
  ];

  let best = corners[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const corner of corners) {
    const dx = position.x - corner.x;
    const dy = position.y - corner.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      best = corner;
      bestDistance = distance;
    }
  }
  return best;
}

function getDaysUntil(dateText: string | null) {
  if (!dateText) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateText);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function isConfirmedEntryStatus(status: string | null | undefined) {
  const normalized = normalizeText(status ?? '');
  return normalized === 'confirmado' || normalized === 'pago' || normalized === 'parcelado';
}

function isPlannedStatus(status: string | null | undefined) {
  const normalized = normalizeText(status ?? '');
  return normalized === 'pendente' || normalized === 'previsto' || normalized === 'parcelado';
}

function isConfirmedExpenseStatus(status: string | null | undefined) {
  const normalized = normalizeText(status ?? '');
  return normalized === 'confirmado' || normalized === 'pago' || normalized === 'parcelado';
}

function getPendingRsvp(guest: GuestLite) {
  const status = (guest.rsvp_status ?? '').trim().toLowerCase();
  if (status === 'pending') return true;
  if (status === 'confirmed' || status === 'declined') return false;
  return !guest.confirmed;
}

function shouldTemporarilyHideHint(state: HintStateRow | undefined, nowMs: number) {
  if (!state) return false;
  if (state.last_opened_at) {
    const openedMs = new Date(state.last_opened_at).getTime();
    if (nowMs - openedMs < OPENED_COOLDOWN_MS) return true;
  }

  if (state.last_dismissed_at) {
    const dismissedMs = new Date(state.last_dismissed_at).getTime();
    if (nowMs - dismissedMs < DISMISS_COOLDOWN_MS) return true;
  }

  return false;
}

function extractEventTabFromPath(path: string): EventDetailsInitialTab | undefined {
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
  if (normalized.includes('/comando') || normalized.includes('/command')) return 'command';
  return undefined;
}

function buildRouteContext(
  segments: readonly string[],
  params: Record<string, string | string[] | undefined>,
): RouteContext {
  const normalizedChain = getVisibleSegments(segments);
  const root = normalizedChain[0] ?? 'dashboard';
  const leaf = normalizedChain[1] ?? '';
  const subLeaf = normalizedChain[2] ?? '';
  const routeEventId =
    normalizeSingleParam(params.id) ||
    normalizeSingleParam(params.eventId) ||
    null;

  if (root === 'dashboard' || root === 'Dashboard') {
    return { currentPath: '/dashboard', currentEventId: null };
  }

  if (root === 'clientes' || root === 'Clients') {
    return { currentPath: '/dashboard/clientes', currentEventId: null };
  }

  if (root === 'financeiro' || root === 'Finance') {
    return { currentPath: '/dashboard/financeiro', currentEventId: null };
  }

  if (root === 'eventos' || root === 'Events') {
    if ((leaf === '[id]' || leaf === 'EventDetails' || leaf === 'EventCommandCenter') && routeEventId) {
      if (subLeaf === 'torre' || leaf === 'EventCommandCenter') {
        return {
          currentPath: `/dashboard/eventos/${routeEventId}/torre`,
          currentEventId: routeEventId,
        };
      }
      return {
        currentPath: `/dashboard/eventos/${routeEventId}`,
        currentEventId: routeEventId,
      };
    }
    return { currentPath: '/dashboard/eventos', currentEventId: null };
  }

  if (root === 'mais' || root === 'More') {
    if (leaf === 'perfil' || leaf === 'Profile') {
      return { currentPath: '/dashboard/perfil', currentEventId: null };
    }
    if (leaf === 'planejamento' || leaf === 'Planning') {
      return { currentPath: '/dashboard/planejamento', currentEventId: null };
    }
    if (leaf === 'saude-operacional' || leaf === 'OperationalHealth') {
      return { currentPath: '/dashboard/saude-operacional', currentEventId: null };
    }
    if (leaf === 'assinaturas' || leaf === 'SuperBilling') {
      return { currentPath: '/dashboard/faturamento', currentEventId: null };
    }
    if (leaf === 'configuracoes' || leaf === 'Settings') {
      return { currentPath: '/dashboard/configuracoes', currentEventId: null };
    }
    return { currentPath: '/dashboard/mais', currentEventId: null };
  }

  return { currentPath: '/dashboard', currentEventId: null };
}

function getAssistantAnswer(data: unknown) {
  if (!data || typeof data !== 'object') return '';
  const payload = data as Record<string, unknown>;
  const candidates = [
    payload.answer,
    payload.reply,
    payload.message,
    payload.assistant,
    payload.output_text,
    payload.text,
  ];

  for (const row of candidates) {
    if (typeof row === 'string' && row.trim()) return row.trim();
  }

  return '';
}

function getSuggestedActions(data: unknown) {
  if (!data || typeof data !== 'object') return [] as SuggestedAction[];
  const payload = data as Record<string, unknown>;
  const rawActions = payload.suggested_actions;
  if (!Array.isArray(rawActions)) return [] as SuggestedAction[];

  const actions: SuggestedAction[] = [];
  for (const item of rawActions) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const path = typeof row.path === 'string' ? row.path.trim() : '';
    if (!path) continue;
    const label =
      typeof row.label === 'string' && row.label.trim()
        ? row.label.trim()
        : 'Abrir módulo';
    actions.push({ label, path });
  }
  return actions;
}

async function invokePlanAssistantChat(body: {
  message: string;
  current_path: string;
  current_event_id: string | null;
  hints: Array<{ id: string; title: string; ctaLabel: string; ctaPath: string }>;
  message_history?: MessageHistoryItem[];
  user_name: string;
},
  providedAccessToken?: string | null
) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('plan_assistant_missing_env');
  }

  const resolveAccessToken = async (forceRefresh = false) => {
    if (forceRefresh) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      return normalizeAccessToken(refreshed.session?.access_token ?? null);
    }
    const { data: sessionData } = await supabase.auth.getSession();
    let session = sessionData.session;
    if (!session) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      session = refreshed.session;
    }
    return normalizeAccessToken(session?.access_token ?? null);
  };

  const sendWithToken = async (token: string) =>
    fetch(`${supabaseUrl}/functions/v1/plan-assistant-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

  let accessToken = normalizeAccessToken(providedAccessToken) ?? (await resolveAccessToken(false));
  if (!accessToken) throw new Error('plan_assistant_unauthorized');

  let response = await sendWithToken(accessToken);
  if (response.status === 401) {
    const refreshedToken = await resolveAccessToken(true);
    if (!refreshedToken) throw new Error('plan_assistant_unauthorized_after_refresh');
    accessToken = refreshedToken;
    response = await sendWithToken(accessToken);
  }

  const text = await response.text();
  let payload: PlanAssistantApiResponse = {};
  try {
    payload = text ? (JSON.parse(text) as PlanAssistantApiResponse) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const reason = text || payload?.message || `http_${response.status}`;
    throw new Error(`plan_assistant_http_${response.status}:${reason}`);
  }

  return { payload, accessToken };
}

async function invokePlanAssistantChatViaSupabase(
  body: {
  message: string;
  current_path: string;
  current_event_id: string | null;
  hints: Array<{ id: string; title: string; ctaLabel: string; ctaPath: string }>;
  message_history?: MessageHistoryItem[];
  user_name: string;
},
  accessToken?: string | null
) {
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const headers: Record<string, string> = {};
  const normalizedToken = normalizeAccessToken(accessToken);
  if (normalizedToken) {
    headers.Authorization = `Bearer ${normalizedToken}`;
  }
  if (supabaseAnonKey) {
    headers.apikey = supabaseAnonKey;
  }

  const { data, error } = await supabase.functions.invoke('plan-assistant-chat', {
    body,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });
  if (error) {
    throw new Error(`plan_assistant_invoke_error:${error.message}`);
  }
  return (data ?? {}) as PlanAssistantApiResponse;
}

function normalizeAccessToken(token: string | null | undefined) {
  if (!token) return null;
  let value = token.trim();
  if (!value) return null;
  if (value.toLowerCase().startsWith('bearer ')) {
    value = value.slice(7).trim();
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  // JWT format safeguard.
  if (value.split('.').length !== 3) return null;
  return value;
}

function buildMessageHistory(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'bot')
    .slice(-MESSAGE_HISTORY_LIMIT)
    .map((message) => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: message.text,
    })) satisfies MessageHistoryItem[];
}

async function getPlanAssistantAccessToken(forceRefresh = false) {
  if (forceRefresh) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    const refreshedToken = normalizeAccessToken(refreshed.session?.access_token ?? null);
    if (!refreshedToken) return null;
    const { data, error } = await supabase.auth.getUser(refreshedToken);
    if (error || !data.user) {
      await supabase.auth.signOut();
      throw new Error('plan_assistant_relogin_required');
    }
    return refreshedToken;
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const fromSession = normalizeAccessToken(sessionData.session?.access_token ?? null);
  if (fromSession) {
    const { data, error } = await supabase.auth.getUser(fromSession);
    if (!error && data.user) return fromSession;
  }
  const { data: refreshed } = await supabase.auth.refreshSession();
  const refreshedToken = normalizeAccessToken(refreshed.session?.access_token ?? null);
  if (!refreshedToken) return null;
  const { data, error } = await supabase.auth.getUser(refreshedToken);
  if (error || !data.user) {
    await supabase.auth.signOut();
    throw new Error('plan_assistant_relogin_required');
  }
  return refreshedToken;
}

function buildHintMessage(hint: PlanHint, userName: string) {
  const normalizedTitle = normalizeText(hint.title);
  const greeting = `Olá ${userName || 'assessora'}, verifique esta pendência:`;

  if (normalizedTitle.includes('buffet')) {
    return (
      `${greeting}\n\n` +
      `- ${hint.title}.\n` +
      '- Não encontrei fornecedor com categoria "Buffet" neste evento.\n\n' +
      'Passos recomendados:\n' +
      '1. Abra o evento indicado.\n' +
      '2. Acesse a aba Fornecedores.\n' +
      '3. Cadastre ou ajuste um fornecedor Buffet.\n' +
      '4. Confirme contato e status.'
    );
  }

  if (normalizedTitle.includes('convidado')) {
    return (
      `${greeting}\n\n` +
      `- ${hint.title}.\n` +
      '- Existem confirmações de presença pendentes.\n\n' +
      'Passos recomendados:\n' +
      '1. Abra o evento indicado.\n' +
      '2. Acesse a aba Convidados.\n' +
      '3. Filtre pendentes e revise contatos.\n' +
      '4. Reenvie os convites.'
    );
  }

  if (normalizedTitle.includes('tarefa') || normalizedTitle.includes('atras')) {
    return (
      `${greeting}\n\n` +
      `- ${hint.title}.\n` +
      '- Existem tarefas vencidas no evento.\n\n' +
      'Passos recomendados:\n' +
      '1. Abra o evento indicado.\n' +
      '2. Acesse Cronograma ou Checklist.\n' +
      '3. Conclua primeiro as tarefas vencidas.\n' +
      '4. Reordene prioridades das próximas 24h.'
    );
  }

  return (
    `${greeting}\n\n` +
    `- ${hint.title}.\n` +
    `- ${hint.message}\n\n` +
    'Passos recomendados:\n' +
    '1. Abra o evento indicado.\n' +
    '2. Revise a aba relacionada à pendência.\n' +
    '3. Aplique o ajuste necessário.\n' +
    '4. Volte aqui para validar.'
  );
}
async function buildContextAwareFallback(params: {
  question: string;
  userId: string | null;
  userName: string;
  currentEventId: string | null;
  hints: PlanHint[];
}) {
  const { question, userId, userName, currentEventId, hints } = params;
  const normalizedQuestion = normalizeText(question);

  if (!userId) {
    return {
      text:
        `Olá ${userName || 'assessora'}.\n\n` +
        'Não consegui validar sua sessão para ler os dados agora.\n\n' +
        'Passos recomendados:\n' +
        '1. Atualize o app e faça login novamente.\n' +
        '2. Abra o módulo que deseja analisar.\n' +
        '3. Envie a pergunta outra vez.',
      ctaLabel: 'Abrir dashboard',
      ctaPath: '/dashboard',
    };
  }

  const [balanceRes, entriesRes, expensesRes, eventRes, eventExpensesRes, eventPaymentsRes] =
    await Promise.all([
      supabase
        .from('user_finance_balance')
        .select('base_balance')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('user_finance_entries')
        .select('amount,status')
        .eq('user_id', userId)
        .limit(2000),
      supabase
        .from('user_finance_expenses')
        .select('amount,status')
        .eq('user_id', userId)
        .limit(2000),
      currentEventId
        ? supabase
            .from('events')
            .select('id,name,event_date,budget_total')
            .eq('id', currentEventId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      currentEventId
        ? supabase
            .from('event_expenses')
            .select('value')
            .eq('event_id', currentEventId)
            .limit(2000)
        : Promise.resolve({ data: [], error: null }),
      currentEventId
        ? supabase
            .from('expense_payments')
            .select('amount')
            .eq('event_id', currentEventId)
            .limit(2000)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const entries = (entriesRes.data ?? []) as FinanceEntryLite[];
  const expenses = (expensesRes.data ?? []) as FinanceExpenseLite[];
  const baseBalance = toNumber((balanceRes.data as { base_balance?: unknown } | null)?.base_balance);
  const confirmedIn = entries
    .filter((entry) => isConfirmedEntryStatus(entry.status))
    .reduce((sum, entry) => sum + toNumber(entry.amount), 0);
  const plannedIn = entries
    .filter((entry) => isPlannedStatus(entry.status))
    .reduce((sum, entry) => sum + toNumber(entry.amount), 0);
  const confirmedOut = expenses
    .filter((expense) => isConfirmedExpenseStatus(expense.status))
    .reduce((sum, expense) => sum + toNumber(expense.amount), 0);
  const plannedOut = expenses
    .filter((expense) => isPlannedStatus(expense.status))
    .reduce((sum, expense) => sum + toNumber(expense.amount), 0);
  const cashBalance = baseBalance + confirmedIn - confirmedOut;

  const eventData = (eventRes.data as EventLiteData | null) ?? null;
  const eventSpent = ((eventExpensesRes.data ?? []) as EventExpenseLite[]).reduce(
    (sum, row) => sum + toNumber(row.value),
    0,
  );
  const eventPaid = ((eventPaymentsRes.data ?? []) as EventPaymentLite[]).reduce(
    (sum, row) => sum + toNumber(row.amount),
    0,
  );
  const eventOpen = Math.max(eventSpent - eventPaid, 0);

  const asksCash =
    normalizedQuestion.includes('saldo') ||
    normalizedQuestion.includes('caixa') ||
    normalizedQuestion.includes('fluxo');

  const lines: string[] = [];
  lines.push(`Olá ${userName || 'assessora'}.`);
  lines.push('');
  lines.push('Resumo do cenário');
  lines.push(`- Saldo em caixa atual: ${toBRL(cashBalance)}.`);
  lines.push(`- Entradas confirmadas: ${toBRL(confirmedIn)} | previstas: ${toBRL(plannedIn)}.`);
  lines.push(`- Saídas confirmadas: ${toBRL(confirmedOut)} | previstas: ${toBRL(plannedOut)}.`);
  if (eventData) {
    lines.push(
      `- No evento "${eventData.name}", lançado ${toBRL(eventSpent)}, pago ${toBRL(eventPaid)} e em aberto ${toBRL(eventOpen)}.`,
    );
  }

  lines.push('');
  lines.push('Passos recomendados');
  lines.push('1. Abra o Financeiro Geral e valide os mesmos valores acima.');
  lines.push('2. Confira as últimas movimentações e status.');
  if (eventData) {
    lines.push(`3. Abra o evento "${eventData.name}" na aba Financeiro para validar itens em aberto.`);
  } else {
    lines.push('3. Abra o evento principal e revise a aba Financeiro.');
  }
  lines.push('4. Se houver divergência, edite o lançamento na origem e salve novamente.');

  const action = hints[0] ?? {
    id: 'finance',
    severity: 'medium' as const,
    title: 'Abrir financeiro',
    message: '',
    ctaLabel: 'Abrir financeiro',
    ctaPath: '/dashboard/financeiro',
  };

  return {
    text: lines.join('\n'),
    ctaLabel: asksCash ? 'Abrir financeiro' : action.ctaLabel,
    ctaPath: asksCash ? '/dashboard/financeiro' : action.ctaPath,
  };
}

function navigateByCtaPath(
  router: ReturnType<typeof useRouter>,
  rawPath: string | undefined,
) {
  if (!rawPath) return false;
  const base = rawPath.trim();
  if (!base) return false;
  const path = normalizeText(base.split('?')[0]);

  const eventMatch = path.match(/\/dashboard\/eventos\/([0-9a-f-]{8,})/i);
  if (eventMatch) {
    const eventId = eventMatch[1];
    if (path.includes('/torre') || path.includes('/command')) {
      router.push(`/eventos/${eventId}/torre`);
      return true;
    }

    const initialTab = extractEventTabFromPath(path);
    const search = initialTab ? `?initialTab=${initialTab}` : '';
    router.push(`/eventos/${eventId}${search}`);
    return true;
  }

  if (path.startsWith('/dashboard/eventos')) {
    router.push('/eventos');
    return true;
  }

  if (path.startsWith('/dashboard/financeiro')) {
    router.push('/financeiro');
    return true;
  }

  if (path.startsWith('/dashboard/clientes') || path.startsWith('/dashboard/crm')) {
    router.push('/clientes');
    return true;
  }

  if (path.startsWith('/dashboard/planejamento')) {
    router.push('/mais/planejamento');
    return true;
  }

  if (path.startsWith('/dashboard/saude')) {
    router.push('/mais/saude-operacional');
    return true;
  }

  if (path.startsWith('/dashboard/perfil')) {
    router.push('/mais/perfil');
    return true;
  }

  if (path.startsWith('/dashboard/configuracoes')) {
    router.push('/mais/configuracoes');
    return true;
  }

  if (path.startsWith('/dashboard/faturamento') || path.startsWith('/dashboard/billing')) {
    router.push('/mais/assinaturas');
    return true;
  }

  if (path.startsWith('/dashboard/mais')) {
    router.push('/mais');
    return true;
  }

  if (path.startsWith('/dashboard')) {
    router.push('/dashboard');
    return true;
  }

  return false;
}

export function PlanAssistantFloating() {
  const { user } = useAuth();
  const { requestMeasure } = useWalkthroughAnchors();
  const router = useRouter();
  const segments = useSegments();
  const searchParams = useLocalSearchParams<{
    id?: string | string[];
    eventId?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const listRef = useRef<ScrollView | null>(null);
  const messageIdRef = useRef(1);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const touchStartMsRef = useRef(0);
  const isOpenRef = useRef(false);
  const fabBoundsRef = useRef<{ minX: number; maxX: number; minY: number; maxY: number } | null>(null);
  const fabPositionRef = useRef<{ x: number; y: number } | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [hints, setHints] = useState<PlanHint[]>([]);
  const [loadingHints, setLoadingHints] = useState(false);
  const [proactiveHint, setProactiveHint] = useState<PlanHint | null>(null);
  const [showProactiveBubble, setShowProactiveBubble] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: 'Olá! Eu sou a Plan. Posso responder dúvidas da plataforma e ajudar com prioridades.',
    },
  ]);
  const [isReplying, setIsReplying] = useState(false);
  const [hintStateMap, setHintStateMap] = useState<Record<string, HintStateRow>>({});
  const [fabPosition, setFabPosition] = useState<{ x: number; y: number } | null>(null);

  function nextMessageId(prefix: 'bot' | 'user') {
    const nextId = `${prefix}-${messageIdRef.current}`;
    messageIdRef.current += 1;
    return nextId;
  }

  const userId = user?.id ?? null;
  const userName = useMemo(() => {
    const metadata = (user?.user_metadata as Record<string, unknown> | undefined) ?? {};
    const nameFromMetadata =
      typeof metadata.name === 'string' ? metadata.name.trim() : '';
    if (nameFromMetadata.length > 0) {
      return nameFromMetadata;
    }
    return user?.email?.split('@')[0] ?? 'assessora';
  }, [user?.email, user?.user_metadata]);

  const routeContext = useMemo(
    () => buildRouteContext(segments, searchParams),
    [searchParams, segments],
  );
  const currentPath = routeContext.currentPath;
  const currentEventId = routeContext.currentEventId;

  const topHintPayload = useMemo(
    () =>
      hints.slice(0, 5).map((hint) => ({
        id: hint.id,
        title: hint.title,
        ctaLabel: hint.ctaLabel,
        ctaPath: hint.ctaPath,
      })),
    [hints],
  );

  const floatingBaseBottom = useMemo(
    () => insets.bottom + BOTTOM_TAB_BAR_HEIGHT + FAB_VERTICAL_GAP,
    [insets.bottom],
  );
  const fabBottom = useMemo(() => floatingBaseBottom, [floatingBaseBottom]);
  const chatBottom = useMemo(
    () => Math.max(18 + insets.bottom, floatingBaseBottom - 8),
    [floatingBaseBottom, insets.bottom],
  );
  const fabBounds = useMemo(() => {
    const minX = FAB_SIDE_SAFE_MARGIN;
    const maxX = Math.max(minX, screenWidth - FAB_SIZE - FAB_SIDE_SAFE_MARGIN);
    const minY = insets.top + 8;
    const maxY = Math.max(minY, screenHeight - floatingBaseBottom - FAB_SIZE);
    return { minX, maxX, minY, maxY };
  }, [floatingBaseBottom, insets.top, screenHeight, screenWidth]);
  const defaultFabPosition = useMemo(
    () => ({
      x: clampNumber(screenWidth - FAB_SIZE - FAB_SIDE_SAFE_MARGIN, fabBounds.minX, fabBounds.maxX),
      y: clampNumber(screenHeight - fabBottom - FAB_SIZE, fabBounds.minY, fabBounds.maxY),
    }),
    [fabBottom, fabBounds.maxX, fabBounds.maxY, fabBounds.minX, fabBounds.minY, screenHeight, screenWidth],
  );
  const resolvedFabPosition = fabPosition ?? defaultFabPosition;
  const fabPositionStorageKey = useMemo(
    () => `${FAB_POSITION_STORAGE_PREFIX}:${userId ?? 'guest'}`,
    [userId],
  );

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    fabBoundsRef.current = fabBounds;
  }, [fabBounds]);

  useEffect(() => {
    fabPositionRef.current = resolvedFabPosition;
  }, [resolvedFabPosition]);

  useEffect(() => {
    setFabPosition((prev) => {
      const seed = prev ?? defaultFabPosition;
      const next = {
        x: clampNumber(seed.x, fabBounds.minX, fabBounds.maxX),
        y: clampNumber(seed.y, fabBounds.minY, fabBounds.maxY),
      };
      if (prev && prev.x === next.x && prev.y === next.y) return prev;
      return next;
    });
  }, [defaultFabPosition, fabBounds.maxX, fabBounds.maxY, fabBounds.minX, fabBounds.minY]);

  useEffect(() => {
    let cancelled = false;
    async function loadFabPosition() {
      try {
        const raw = await AsyncStorage.getItem(fabPositionStorageKey);
        if (!raw || cancelled) return;
        const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
        const x = Number(parsed?.x);
        const y = Number(parsed?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        const next = {
          x: clampNumber(x, fabBounds.minX, fabBounds.maxX),
          y: clampNumber(y, fabBounds.minY, fabBounds.maxY),
        };

        if (!cancelled) {
          setFabPosition(next);
        }
      } catch {
        // Nao bloqueia render caso storage falhe.
      }
    }

    void loadFabPosition();
    return () => {
      cancelled = true;
    };
  }, [fabBounds.maxX, fabBounds.maxY, fabBounds.minX, fabBounds.minY, fabPositionStorageKey]);

  useEffect(() => {
    if (!fabPosition) return;
    const payload = JSON.stringify({ x: fabPosition.x, y: fabPosition.y });
    void AsyncStorage.setItem(fabPositionStorageKey, payload);
  }, [fabPosition, fabPositionStorageKey]);

  useEffect(() => {
    requestMeasure('plan_assistant.fab');
  }, [requestMeasure, resolvedFabPosition.x, resolvedFabPosition.y]);

  const fabPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isOpenRef.current,
        onStartShouldSetPanResponderCapture: () => !isOpenRef.current,
        onMoveShouldSetPanResponder: () => !isOpenRef.current,
        onMoveShouldSetPanResponderCapture: () => !isOpenRef.current,
        onPanResponderGrant: () => {
          draggingRef.current = false;
          touchStartMsRef.current = Date.now();
          dragStartRef.current = fabPositionRef.current ?? defaultFabPosition;
        },
        onPanResponderMove: (_event, gestureState) => {
          const origin = dragStartRef.current ?? fabPositionRef.current ?? defaultFabPosition;
          const bounds = fabBoundsRef.current ?? fabBounds;
          const nextX = clampNumber(origin.x + gestureState.dx, bounds.minX, bounds.maxX);
          const nextY = clampNumber(origin.y + gestureState.dy, bounds.minY, bounds.maxY);
          if (Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6) {
            draggingRef.current = true;
          }
          setFabPosition((prev) => {
            if (prev && prev.x === nextX && prev.y === nextY) return prev;
            fabPositionRef.current = { x: nextX, y: nextY };
            return { x: nextX, y: nextY };
          });
        },
        onPanResponderRelease: (_event, gestureState) => {
          const touchDurationMs = Date.now() - touchStartMsRef.current;
          const movedLittle = Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6;
          const isTap = !draggingRef.current && movedLittle && touchDurationMs < 280;
          if (isTap) {
            if (isOpenRef.current) {
              closeChat();
            } else {
              openChat();
            }
          } else {
            const bounds = fabBoundsRef.current ?? fabBounds;
            const current = fabPositionRef.current ?? defaultFabPosition;
            const snapped = getNearestFabCorner(current, bounds);
            fabPositionRef.current = snapped;
            setFabPosition(snapped);
          }
          dragStartRef.current = null;
          setTimeout(() => {
            draggingRef.current = false;
          }, 80);
        },
        onPanResponderTerminate: () => {
          dragStartRef.current = null;
          draggingRef.current = false;
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [defaultFabPosition, fabBounds],
  );

  const registerHintAction = useCallback(
    async (hint: PlanHint, action: 'shown' | 'opened' | 'dismissed') => {
      if (!userId) return;
      const nowIso = new Date().toISOString();
      const current = hintStateMap[hint.id];
      const payload = {
        user_id: userId,
        hint_id: hint.id,
        last_action: action,
        last_action_at: nowIso,
        last_shown_at: action === 'shown' ? nowIso : current?.last_shown_at ?? null,
        last_opened_at: action === 'opened' ? nowIso : current?.last_opened_at ?? null,
        last_dismissed_at:
          action === 'dismissed' ? nowIso : current?.last_dismissed_at ?? null,
        updated_at: nowIso,
      };

      const { error } = await supabase
        .from('user_plan_assistant_hint_state')
        .upsert(payload, { onConflict: 'user_id,hint_id' });
      if (error) return;

      setHintStateMap((prev) => {
        const previous = prev[hint.id];
        return {
          ...prev,
          [hint.id]: {
            hint_id: hint.id,
            last_action: action,
            last_action_at: nowIso,
            last_shown_at: action === 'shown' ? nowIso : previous?.last_shown_at ?? null,
            last_opened_at: action === 'opened' ? nowIso : previous?.last_opened_at ?? null,
            last_dismissed_at:
              action === 'dismissed' ? nowIso : previous?.last_dismissed_at ?? null,
          },
        };
      });
    },
    [hintStateMap, userId],
  );

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollToEnd({ animated: true });
  }, [messages, isOpen, isReplying]);

  useEffect(() => {
    if (!showProactiveBubble) return;
    const timer = setTimeout(() => setShowProactiveBubble(false), PROACTIVE_BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [showProactiveBubble]);
  useEffect(() => {
    if (!userId) {
      setHints([]);
      setHintStateMap({});
      setProactiveHint(null);
      setShowProactiveBubble(false);
      return;
    }

    let isMounted = true;

    async function loadHints() {
      setLoadingHints(true);
      try {
        const eventsRes = await supabase
          .from('events')
          .select('id,name,event_date')
          .eq('user_id', userId)
          .or('status.is.null,status.neq.deleted')
          .order('event_date', { ascending: true })
          .limit(8);

        if (eventsRes.error) throw eventsRes.error;
        const events = (eventsRes.data as EventLite[]) ?? [];

        if (events.length === 0) {
          if (isMounted) {
            setHints([]);
            setHintStateMap({});
          }
          return;
        }

        const eventIds = events.map((event) => event.id);
        const [vendorsRes, guestsRes, tasksRes] = await Promise.all([
          supabase
            .from('event_vendors')
            .select('event_id,category,expected_arrival_time,expected_done_time')
            .in('event_id', eventIds),
          supabase
            .from('event_guests')
            .select('event_id,confirmed,rsvp_status')
            .in('event_id', eventIds),
          supabase
            .from('event_tasks')
            .select('event_id,completed,due_date')
            .in('event_id', eventIds),
        ]);

        if (vendorsRes.error) throw vendorsRes.error;
        if (guestsRes.error) throw guestsRes.error;
        if (tasksRes.error) throw tasksRes.error;

        const vendors = (vendorsRes.data as VendorLite[]) ?? [];
        const guests = (guestsRes.data as GuestLite[]) ?? [];
        const tasks = (tasksRes.data as TaskLite[]) ?? [];
        const nextHints: PlanHint[] = [];

        for (const event of events) {
          const eventVendors = vendors.filter((vendor) => vendor.event_id === event.id);
          const eventGuests = guests.filter((guest) => guest.event_id === event.id);
          const eventTasks = tasks.filter((task) => task.event_id === event.id);
          const daysToEvent = getDaysUntil(event.event_date);

          const hasBuffet = eventVendors.some((vendor) =>
            normalizeText(vendor.category ?? '').includes('buffet'),
          );
          if (!hasBuffet) {
            nextHints.push({
              id: `missing-buffet-${event.id}`,
              severity: 'high',
              title: `Evento ${event.name} sem buffet`,
              message: 'Não encontrei fornecedor de buffet nesse evento.',
              ctaLabel: 'Abrir evento',
              ctaPath: `/dashboard/eventos/${event.id}`,
            });
          }

          const withoutSchedule = eventVendors.filter(
            (vendor) => !vendor.expected_arrival_time || !vendor.expected_done_time,
          ).length;
          if (withoutSchedule >= 1) {
            nextHints.push({
              id: `vendor-schedule-${event.id}`,
              severity: daysToEvent !== null && daysToEvent <= 30 ? 'high' : 'medium',
              title: `${withoutSchedule} fornecedor(es) sem horário`,
              message: `No evento ${event.name}, faltam horários de chegada/finalização.`,
              ctaLabel: 'Ajustar fornecedores',
              ctaPath: `/dashboard/eventos/${event.id}`,
            });
          }

          if (eventGuests.length >= 8) {
            const pendingGuests = eventGuests.filter((guest) => getPendingRsvp(guest)).length;
            const pendingRate = pendingGuests / eventGuests.length;
            if (pendingGuests >= 8 && pendingRate >= 0.4) {
              nextHints.push({
                id: `pending-guests-${event.id}`,
                severity: daysToEvent !== null && daysToEvent <= 21 ? 'high' : 'medium',
                title: `${pendingGuests} convidados pendentes`,
                message: `No evento ${event.name}, ainda há muitas respostas RSVP pendentes.`,
                ctaLabel: 'Ver convidados',
                ctaPath: `/dashboard/eventos/${event.id}`,
              });
            }
          }

          const overdueTasks = eventTasks.filter((task) => {
            if (task.completed) return false;
            if (!task.due_date) return false;
            return new Date(task.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
          }).length;

          if (overdueTasks > 0 && (daysToEvent === null || daysToEvent <= 45)) {
            nextHints.push({
              id: `overdue-tasks-${event.id}`,
              severity: 'high',
              title: `${overdueTasks} tarefa(s) atrasada(s)`,
              message: `Evento ${event.name} tem tarefas vencidas perto da data.`,
              ctaLabel: 'Ver cronograma',
              ctaPath: `/dashboard/eventos/${event.id}/cronograma`,
            });
          }
        }

        const severityRank: Record<PlanHint['severity'], number> = {
          high: 0,
          medium: 1,
          low: 2,
        };
        nextHints.sort((a, b) => {
          const severityDiff = severityRank[a.severity] - severityRank[b.severity];
          if (severityDiff !== 0) return severityDiff;
          return a.title.localeCompare(b.title);
        });

        const selected = nextHints.slice(0, 6);
        if (selected.length === 0) {
          if (isMounted) {
            setHints([]);
            setHintStateMap({});
          }
          return;
        }

        const stateRes = await supabase
          .from('user_plan_assistant_hint_state')
          .select(
            'hint_id,last_action,last_action_at,last_shown_at,last_opened_at,last_dismissed_at',
          )
          .eq('user_id', userId)
          .in(
            'hint_id',
            selected.map((hint) => hint.id),
          );
        if (stateRes.error) throw stateRes.error;

        const stateRows = (stateRes.data as HintStateRow[]) ?? [];
        const nextMap = stateRows.reduce<Record<string, HintStateRow>>((acc, row) => {
          acc[row.hint_id] = row;
          return acc;
        }, {});

        if (isMounted) {
          const nowMs = Date.now();
          const visibleHints = selected.filter(
            (hint) => !shouldTemporarilyHideHint(nextMap[hint.id], nowMs),
          );
          setHints(visibleHints);
          setHintStateMap(nextMap);
          setProactiveHint((previous) => {
            if (!previous) return previous;
            const stillVisible = visibleHints.some((hint) => hint.id === previous.id);
            return stillVisible ? previous : null;
          });
          setShowProactiveBubble((previous) => previous && visibleHints.length > 0);
        }
      } catch {
        if (isMounted) {
          setHints([]);
          setHintStateMap({});
        }
      } finally {
        if (isMounted) setLoadingHints(false);
      }
    }

    void loadHints();
    const interval = setInterval(() => {
      void loadHints();
    }, 1000 * 60 * 3);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentPath, userId]);

  useEffect(() => {
    if (!userId || isOpen || hints.length === 0) return;
    const top = hints[0];
    const state = hintStateMap[top.id];
    const now = Date.now();
    const lastShown = state?.last_shown_at ? new Date(state.last_shown_at).getTime() : 0;
    const lastDismissed = state?.last_dismissed_at ? new Date(state.last_dismissed_at).getTime() : 0;

    if (now - lastShown < HINT_COOLDOWN_MS) return;
    if (now - lastDismissed < DISMISS_COOLDOWN_MS) return;

    setProactiveHint(top);
    setShowProactiveBubble(true);
    void registerHintAction(top, 'shown');
  }, [hintStateMap, hints, isOpen, registerHintAction, userId]);

  function pushBotMessage(message: Omit<ChatMessage, 'id' | 'role'>) {
    setMessages((prev) => [
      ...prev,
      { id: nextMessageId('bot'), role: 'bot', ...message },
    ]);
  }

  async function openHintInChat(hint: PlanHint) {
    setIsOpen(true);
    setShowProactiveBubble(false);
    await registerHintAction(hint, 'opened');
    setHints((prev) => prev.filter((item) => item.id !== hint.id));
    setProactiveHint((prev) => (prev?.id === hint.id ? null : prev));
    pushBotMessage({
      text: buildHintMessage(hint, userName),
      ctaLabel: hint.ctaLabel,
      ctaPath: hint.ctaPath,
    });
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || isReplying) return;
    const messageHistory = buildMessageHistory(messages);

    setMessages((prev) => [...prev, { id: nextMessageId('user'), role: 'user', text }]);
    setInput('');
    setIsReplying(true);

    try {
      const payload = {
        message: text,
        current_path: currentPath,
        current_event_id: currentEventId,
        hints: topHintPayload,
        message_history: messageHistory,
        user_name: userName,
      };

      let data: PlanAssistantApiResponse | null = null;
      let firstError: unknown = null;
      let secondError: unknown = null;
      let accessToken: string | null = await getPlanAssistantAccessToken(true);

      try {
        const result = await invokePlanAssistantChat(payload, accessToken);
        data = result.payload;
        accessToken = result.accessToken;
      } catch (primaryError) {
        firstError = primaryError;
        try {
          if (!accessToken) {
            accessToken = await getPlanAssistantAccessToken(true);
          }
          data = await invokePlanAssistantChatViaSupabase(payload, accessToken);
        } catch (invokeError) {
          secondError = invokeError;
          throw new Error(
            `plan_assistant_both_transports_failed primary=${String(primaryError)} secondary=${String(invokeError)}`
          );
        }
      }

      const answer = getAssistantAnswer(data);
      const actions = getSuggestedActions(data);
      if (!answer) throw new Error('empty_answer');

      if (data.meta && data.meta.ai_used === false) {
        console.warn('plan-assistant-chat returned fallback mode', data.meta.ai_error);
      }

      if (firstError) {
        console.warn('plan-assistant-chat primary transport failed, fallback transport succeeded', firstError);
      }

      pushBotMessage({
        text: answer,
        ctaLabel: actions[0]?.label,
        ctaPath: actions[0]?.path,
      });
    } catch (chatError) {
      console.warn('plan-assistant-chat failed on both transports', chatError);
      const errorText = String(chatError);
      if (errorText.includes('plan_assistant_relogin_required')) {
        pushBotMessage({
          text:
            'Sua sessão expirou e foi desconectada por segurança. ' +
            'Entre novamente no app para usar a PLAN IA.',
        });
        return;
      }
      pushBotMessage({
        text:
          `Não consegui conectar a PLAN IA na nuvem agora.\n\n` +
          `Tente novamente em alguns segundos. Se persistir, verifique se a Edge Function ` +
          '`plan-assistant-chat` está ativa e com os segredos Cloudflare configurados.',
      });
    } finally {
      setIsReplying(false);
    }
  }

  function closeChat() {
    setIsOpen(false);
  }

  function openChat() {
    setIsOpen(true);
    setShowProactiveBubble(false);
  }

  function dismissProactive() {
    setShowProactiveBubble(false);
    if (!proactiveHint) return;
    void registerHintAction(proactiveHint, 'dismissed');
    setHints((prev) => prev.filter((item) => item.id !== proactiveHint.id));
    setProactiveHint((prev) => (prev?.id === proactiveHint.id ? null : prev));
  }

  function openCta(path: string | undefined) {
    const didNavigate = navigateByCtaPath(router, path);
    if (didNavigate) {
      setIsOpen(false);
    }
  }

  return (
    <View pointerEvents="box-none" style={styles.root}>
      {showProactiveBubble && proactiveHint && !isOpen ? (
        <View style={[styles.proactiveCard, { bottom: fabBottom + 70 }]}>
          <View style={styles.proactiveTop}>
            <View style={styles.proactiveLead}>
              <Image source={PLAN_FACE_IMAGE} style={styles.proactiveAvatar} resizeMode="cover" />
              <View style={styles.proactiveContent}>
                <Text style={styles.proactiveBadge}>Plan dica rápida</Text>
                <Text style={styles.proactiveTitle}>{proactiveHint.title}</Text>
                <Text style={styles.proactiveText}>{proactiveHint.message}</Text>
              </View>
            </View>
            <Pressable onPress={dismissProactive} hitSlop={8}>
              <Ionicons name="close" size={16} color={colors.mutedText} />
            </Pressable>
          </View>
          <Pressable onPress={() => void openHintInChat(proactiveHint)}>
            <Text style={styles.proactiveAction}>Resolver agora</Text>
          </Pressable>
        </View>
      ) : null}

      <WalkthroughAnchorTarget
        id="plan_assistant.fab"
        borderRadius={30}
        style={[styles.fabAnchor, { left: resolvedFabPosition.x, top: resolvedFabPosition.y }]}
      >
        <View {...fabPanResponder.panHandlers} style={styles.fab} collapsable={false}>
          {isOpen ? (
            <Ionicons name="close" size={22} color="#FFFFFF" />
          ) : (
            <Image source={PLAN_FACE_IMAGE} style={styles.fabAvatar} resizeMode="cover" />
          )}
        </View>
      </WalkthroughAnchorTarget>

      <Modal visible={isOpen} animationType="fade" transparent onRequestClose={closeChat}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeChat} />
          <KeyboardAvoidingView
            style={styles.modalContent}
            behavior="padding"
            keyboardVerticalOffset={0}
          >
            <View style={[styles.chatPanel, { marginBottom: chatBottom }]}>
              <View style={styles.chatHeader}>
                <View style={styles.chatHeaderTitleWrap}>
                  <Image source={PLAN_FACE_IMAGE} style={styles.chatAvatarImage} resizeMode="cover" />
                  <View>
                    <Text style={styles.chatTitle}>Plan</Text>
                    <Text style={styles.chatSubtitle}>Assistente da plataforma</Text>
                  </View>
                </View>
                <Pressable onPress={closeChat} hitSlop={8}>
                  <Ionicons name="close" size={18} color="#FFFFFF" />
                </Pressable>
              </View>

              <View style={styles.hintsWrap}>
                <Text style={styles.hintsTitle}>Alertas proativos</Text>
                {loadingHints ? (
                  <Text style={styles.hintsCaption}>Analisando operação...</Text>
                ) : null}
                {!loadingHints && hints.length === 0 ? (
                  <Text style={styles.hintsCaption}>Sem pendências urgentes agora.</Text>
                ) : null}
                {!loadingHints && hints.length > 0 ? (
                  <View style={styles.hintsRow}>
                    {hints.slice(0, 3).map((hint) => (
                      <Pressable
                        key={hint.id}
                        style={styles.hintChip}
                        onPress={() => void openHintInChat(hint)}
                      >
                        <Text style={styles.hintChipText} numberOfLines={1}>
                          {hint.title}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>

              <ScrollView ref={listRef} style={styles.messagesArea} contentContainerStyle={styles.messagesContent}>
                {messages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.messageRow,
                      message.role === 'user' ? styles.messageRowUser : styles.messageRowBot,
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        message.role === 'user' ? styles.messageBubbleUser : styles.messageBubbleBot,
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          message.role === 'user' ? styles.messageTextUser : null,
                        ]}
                      >
                        {message.text}
                      </Text>
                      {message.role === 'bot' && message.ctaPath ? (
                        <Pressable
                          style={styles.messageCta}
                          onPress={() => openCta(message.ctaPath)}
                        >
                          <Text style={styles.messageCtaText}>{message.ctaLabel ?? 'Abrir módulo'}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
                {isReplying ? (
                  <View style={[styles.messageRow, styles.messageRowBot]}>
                    <View style={[styles.messageBubble, styles.messageBubbleBot, styles.loadingBubble]}>
                      <ActivityIndicator size="small" color={colors.primaryStrong} />
                      <Text style={styles.loadingText}>Plan está analisando...</Text>
                    </View>
                  </View>
                ) : null}
              </ScrollView>

              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Pergunte sobre a plataforma..."
                  placeholderTextColor={colors.mutedText}
                  editable={!isReplying}
                  onSubmitEditing={() => {
                    void sendMessage();
                  }}
                  returnKeyType="send"
                />
                <Pressable style={styles.sendButton} disabled={isReplying} onPress={() => void sendMessage()}>
                  <Ionicons name="send" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    elevation: 80,
  },
  fabAnchor: {
    position: 'absolute',
    right: 14,
    width: 56,
    height: 56,
    borderRadius: 999,
  },
  fab: {
    height: 56,
    width: 56,
    borderRadius: 999,
    backgroundColor: colors.primaryStrong,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  proactiveCard: {
    position: 'absolute',
    right: 14,
    width: 310,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 7,
  },
  proactiveTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  proactiveLead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
  },
  proactiveAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 2,
  },
  proactiveContent: {
    flex: 1,
    gap: 2,
  },
  proactiveBadge: {
    color: colors.primaryStrong,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  proactiveTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  proactiveText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  proactiveAction: {
    color: colors.primaryStrong,
    fontSize: 12,
    fontWeight: '700',
  },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
  },
  chatPanel: {
    width: '100%',
    height: '86%',
    maxHeight: '92%',
    backgroundColor: colors.card,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatHeader: {
    backgroundColor: colors.primaryStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatAvatarImage: {
    height: 34,
    width: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  chatTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  chatSubtitle: {
    color: '#FFFFFF',
    fontSize: 11,
    opacity: 0.85,
    fontWeight: '500',
  },
  hintsWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 6,
    backgroundColor: '#FCFCFD',
  },
  hintsTitle: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  hintsCaption: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '600',
  },
  hintsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  hintChip: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  hintChipText: {
    color: colors.primaryStrong,
    fontSize: 11,
    fontWeight: '700',
  },
  messagesArea: {
    flex: 1,
    backgroundColor: colors.card,
  },
  messagesContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  messageRow: {
    width: '100%',
    flexDirection: 'row',
  },
  messageRowBot: {
    justifyContent: 'flex-start',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '88%',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  messageBubbleBot: {
    backgroundColor: '#F4F6F8',
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageBubbleUser: {
    backgroundColor: colors.text,
  },
  messageText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  messageTextUser: {
    color: '#FFFFFF',
  },
  messageCta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  messageCtaText: {
    color: colors.primaryStrong,
    fontSize: 11,
    fontWeight: '700',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '600',
  },
  inputWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    color: colors.text,
    backgroundColor: '#FFFFFF',
  },
  sendButton: {
    height: 40,
    width: 40,
    borderRadius: 10,
    backgroundColor: colors.primaryStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
});



