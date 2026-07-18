import type {
  CommandVendorStatus,
  PaymentMeta,
  PaymentMethod,
  ProjectMilestoneKind,
  SmartTimelineSuggestion,
} from './eventDetailsTypes.ts';

const PAYMENT_META_PREFIX = '[[PP_META:';
const PAYMENT_META_SUFFIX = ']]';

export function parsePaymentNote(note: string | null | undefined): { userNote: string; meta: PaymentMeta } {
  const raw = (note ?? '').trim();
  if (!raw) return { userNote: '', meta: {} };
  const start = raw.lastIndexOf(PAYMENT_META_PREFIX);
  const hasSuffix = raw.endsWith(PAYMENT_META_SUFFIX);
  if (start < 0 || !hasSuffix) return { userNote: raw, meta: {} };
  const jsonStart = start + PAYMENT_META_PREFIX.length;
  const jsonEnd = raw.length - PAYMENT_META_SUFFIX.length;
  const before = raw.slice(0, start).trim();
  const json = raw.slice(jsonStart, jsonEnd).trim();
  try {
    return { userNote: before, meta: (JSON.parse(json) as PaymentMeta) ?? {} };
  } catch {
    return { userNote: raw, meta: {} };
  }
}

export function composePaymentNote(userNote: string | null | undefined, meta: PaymentMeta): string | null {
  const clean = (userNote ?? '').trim();
  const hasMeta = typeof meta.receipt_document_id === 'string' || meta.receipt_document_id === null;
  if (!hasMeta) return clean || null;
  return `${clean}${clean ? '\n' : ''}${PAYMENT_META_PREFIX}${JSON.stringify(meta)}${PAYMENT_META_SUFFIX}`;
}

export function normalizePaymentMethod(value: string): PaymentMethod {
  const normalized = value.trim().toLowerCase() as PaymentMethod;
  const allowed: PaymentMethod[] = ['pix', 'dinheiro', 'debito', 'credito', 'boleto', 'transferencia', 'outro'];
  return allowed.includes(normalized) ? normalized : 'pix';
}

export function combineDateTime(dateStr: string, timeStr: string | null | undefined) {
  if (!timeStr) return null;
  const [hour, minute] = timeStr.split(':').map((value) => Number(value));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const date = new Date(dateStr);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export function labelVendorStatus(status: CommandVendorStatus) {
  switch (status) {
    case 'en_route': return 'A caminho';
    case 'arrived': return 'Chegou';
    case 'done': return 'Finalizado';
    default: return 'Aguardando';
  }
}

export function sanitizeTimeValue(value: string) {
  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)/);
  if (!match) return '10:00';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function pickString(source: Record<string, unknown>, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return fallback;
}

export function normalizeAiSuggestion(raw: unknown, index: number): SmartTimelineSuggestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  const title = pickString(candidate, ['title', 'titulo'], `Sugestão IA ${index + 1}`);
  const reason = pickString(candidate, ['reason', 'motivo', 'justificativa'], 'Sugestão gerada pela IA.');
  const activity = pickString(candidate, ['activity', 'atividade', 'task'], '');
  if (!activity) return null;
  const assignee = pickString(candidate, ['assignee', 'responsavel', 'owner'], 'Assessoria');
  const rawPriority = pickString(candidate, ['priority', 'prioridade'], 'normal').toLowerCase();
  const priority: 'high' | 'normal' = rawPriority === 'high' || rawPriority === 'alta' ? 'high' : 'normal';
  const time = sanitizeTimeValue(pickString(candidate, ['time', 'hora'], '10:00'));
  return {
    id: `ai-${index}-${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    reason,
    activity,
    time,
    assignee,
    priority,
    source: 'ai',
  };
}

export function paymentMethodLabel(method: PaymentMethod) {
  switch (method) {
    case 'pix': return 'PIX';
    case 'dinheiro': return 'Dinheiro';
    case 'debito': return 'Debito';
    case 'credito': return 'Credito';
    case 'boleto': return 'Boleto';
    case 'transferencia': return 'Transferencia';
    default: return 'Outro';
  }
}

export function getMilestoneColor(kind: ProjectMilestoneKind) {
  switch (kind) {
    case 'start': return '#8B5CF6';
    case 'vendor': return '#06B6D4';
    case 'guest': return '#22C55E';
    case 'expense': return '#F59E0B';
    case 'document': return '#D946EF';
    case 'payment': return '#16A34A';
    case 'invite': return '#0EA5E9';
    case 'rsvp': return '#4F46E5';
    default: return '#6B7280';
  }
}

function asDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function isOverdueDate(value: string | null | undefined) {
  const date = asDate(value);
  if (!date) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return date.getTime() < now.getTime();
}

export function isTodayDate(value: string | null | undefined) {
  const date = asDate(value);
  if (!date) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

export function isThisWeekDate(value: string | null | undefined) {
  const date = asDate(value);
  if (!date) return false;
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date.getTime() >= start.getTime() && date.getTime() < end.getTime();
}

export function brl(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmt(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}
