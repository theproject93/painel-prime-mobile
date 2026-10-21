import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

export type PlanAiThread = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
};

export type PlanAiMessageRow = {
  id: string;
  thread_id: string;
  tenant_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type PlanThreadGroup = {
  today: PlanAiThread[];
  yesterday: PlanAiThread[];
  last7Days: PlanAiThread[];
  older: PlanAiThread[];
};

export type ThreadEvent =
  | { type: 'SELECT_THREAD'; thread: PlanAiThread }
  | { type: 'NEW_THREAD' }
  | { type: 'THREADS_UPDATED' };

const threadListeners = new Set<(event: ThreadEvent) => void>();

export function subscribeThreadEvents(listener: (event: ThreadEvent) => void): () => void {
  threadListeners.add(listener);
  return () => {
    threadListeners.delete(listener);
  };
}

export function emitThreadEvent(event: ThreadEvent): void {
  for (const listener of threadListeners) {
    try {
      listener(event);
    } catch (err) {
      console.warn('Error in thread listener', err);
    }
  }
}

const THREADS_SELECT =
  'id, tenant_id, user_id, title, created_at, updated_at' as const;
const THREAD_INSERT_RETURN =
  'id, tenant_id, user_id, title, created_at, updated_at' as const;
const MESSAGES_SELECT =
  'id, thread_id, tenant_id, role, content, created_at' as const;
const TITLE_RETURN = 'id, title' as const;

const THREADS_LIMIT = 50;
const MESSAGES_LIMIT = 100;

const STORAGE_KEY_PREFIX = 'painelprime.plan.threads.cache.';
const STORAGE_MSG_PREFIX = 'painelprime.plan.messages.cache.';

export function buildThreadTitleFromText(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return 'Nova conversa';
  return clean.length > 45 ? `${clean.slice(0, 45).trimEnd()}…` : clean;
}

export function groupThreadsByPeriod(
  threads: PlanAiThread[],
  nowMs: number = Date.now()
): PlanThreadGroup {
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const todayStart = startOfToday.getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;

  const grouped: PlanThreadGroup = {
    today: [],
    yesterday: [],
    last7Days: [],
    older: [],
  };

  for (const thread of threads) {
    const updated = new Date(thread.updated_at).getTime();
    if (Number.isNaN(updated) || updated >= todayStart) {
      if (!Number.isNaN(updated) && updated < todayStart) {
        grouped.older.push(thread);
      } else {
        grouped.today.push(thread);
      }
    } else if (updated >= yesterdayStart) {
      grouped.yesterday.push(thread);
    } else if (updated >= weekStart) {
      grouped.last7Days.push(thread);
    } else {
      grouped.older.push(thread);
    }
  }

  return grouped;
}

export function filterThreadsByQuery(
  threads: PlanAiThread[],
  query: string
): PlanAiThread[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return threads;
  return threads.filter((thread) =>
    thread.title.toLowerCase().includes(normalized)
  );
}

export async function resolvePlanTenantId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_primary_tenant_id', {
    p_user_id: userId,
  });
  if (error) {
    console.warn('resolve_primary_tenant_id error:', error.message);
    return null;
  }
  return typeof data === 'string' && data ? data : null;
}

export async function listThreads(
  supabase: SupabaseClient,
  tenantId: string,
  limit: number = THREADS_LIMIT
): Promise<PlanAiThread[]> {
  try {
    const { data, error } = await supabase
      .from('plan_ai_threads')
      .select(THREADS_SELECT)
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    const threads = (data as PlanAiThread[]) ?? [];
    void saveOfflineThreads(tenantId, threads);
    return threads;
  } catch (error) {
    console.warn('Failed to fetch threads from Supabase, falling back to cache:', error);
    return getOfflineThreads(tenantId);
  }
}

export async function createThread(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string | null,
  title: string = 'Nova conversa'
): Promise<PlanAiThread> {
  const { data, error } = await supabase
    .from('plan_ai_threads')
    .insert({ tenant_id: tenantId, user_id: userId, title })
    .select(THREAD_INSERT_RETURN)
    .single();

  if (error) throw error;
  const newThread = data as PlanAiThread;
  const cached = await getOfflineThreads(tenantId);
  void saveOfflineThreads(tenantId, [newThread, ...cached.filter((t) => t.id !== newThread.id)]);
  return newThread;
}

export async function loadThreadMessages(
  supabase: SupabaseClient,
  tenantId: string,
  threadId: string,
  limit: number = MESSAGES_LIMIT
): Promise<PlanAiMessageRow[]> {
  try {
    const { data, error } = await supabase
      .from('plan_ai_messages')
      .select(MESSAGES_SELECT)
      .eq('tenant_id', tenantId)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    const messages = (data as PlanAiMessageRow[]) ?? [];
    void saveOfflineMessages(threadId, messages);
    return messages;
  } catch (error) {
    console.warn('Failed to load thread messages from Supabase, using cache:', error);
    return getOfflineMessages(threadId);
  }
}

export async function saveThreadMessage(
  supabase: SupabaseClient,
  params: {
    threadId: string;
    tenantId: string;
    role: 'user' | 'assistant';
    content: string;
  }
): Promise<void> {
  const { error } = await supabase.from('plan_ai_messages').insert({
    thread_id: params.threadId,
    tenant_id: params.tenantId,
    role: params.role,
    content: params.content,
  });

  if (error) throw error;

  const nowIso = new Date().toISOString();
  const cachedMessages = await getOfflineMessages(params.threadId);
  const newMessage: PlanAiMessageRow = {
    id: `cached-${Date.now()}`,
    thread_id: params.threadId,
    tenant_id: params.tenantId,
    role: params.role,
    content: params.content,
    created_at: nowIso,
  };
  void saveOfflineMessages(params.threadId, [...cachedMessages, newMessage]);
}

export async function renameThread(
  supabase: SupabaseClient,
  tenantId: string,
  threadId: string,
  title: string
): Promise<{ id: string; title: string }> {
  const { data, error } = await supabase
    .from('plan_ai_threads')
    .update({ title })
    .eq('id', threadId)
    .eq('tenant_id', tenantId)
    .select(TITLE_RETURN)
    .single();

  if (error) throw error;
  const result = data as { id: string; title: string };
  const cached = await getOfflineThreads(tenantId);
  void saveOfflineThreads(
    tenantId,
    cached.map((t) => (t.id === threadId ? { ...t, title } : t))
  );
  return result;
}

export async function deleteThread(
  supabase: SupabaseClient,
  tenantId: string,
  threadId: string
): Promise<void> {
  const { error } = await supabase
    .from('plan_ai_threads')
    .delete()
    .eq('id', threadId)
    .eq('tenant_id', tenantId);

  if (error) throw error;
  const cached = await getOfflineThreads(tenantId);
  void saveOfflineThreads(
    tenantId,
    cached.filter((t) => t.id !== threadId)
  );
  void AsyncStorage.removeItem(`${STORAGE_MSG_PREFIX}${threadId}`).catch(() => {});
}

export async function getOfflineThreads(tenantId: string): Promise<PlanAiThread[]> {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${tenantId}`);
    if (!raw) return [];
    return JSON.parse(raw) as PlanAiThread[];
  } catch {
    return [];
  }
}

export async function saveOfflineThreads(tenantId: string, threads: PlanAiThread[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${STORAGE_KEY_PREFIX}${tenantId}`, JSON.stringify(threads));
  } catch (err) {
    console.warn('Failed to cache threads offline:', err);
  }
}

export async function getOfflineMessages(threadId: string): Promise<PlanAiMessageRow[]> {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_MSG_PREFIX}${threadId}`);
    if (!raw) return [];
    return JSON.parse(raw) as PlanAiMessageRow[];
  } catch {
    return [];
  }
}

export async function saveOfflineMessages(threadId: string, messages: PlanAiMessageRow[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${STORAGE_MSG_PREFIX}${threadId}`, JSON.stringify(messages));
  } catch (err) {
    console.warn('Failed to cache thread messages offline:', err);
  }
}
