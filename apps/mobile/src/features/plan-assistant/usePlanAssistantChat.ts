import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { supabase } from '../../lib/supabase';
import {
  createPlanChatSnapshot,
  planChatStorageKey,
  restorePlanChatSnapshot,
  type PersistedPlanChatMessage,
} from '../plan/planChatPersistence';
import {
  DEFAULT_PLAN_MESSAGES,
  buildHintMessage,
  buildMessageHistory,
  getAssistantAnswer,
  getSuggestedActions,
} from './core';
import {
  buildThreadTitleFromText,
  createThread,
  deleteThread as deleteThreadApi,
  listThreads as listThreadsApi,
  loadThreadMessages as loadThreadMessagesApi,
  renameThread as renameThreadApi,
  resolvePlanTenantId,
  saveThreadMessage,
  subscribeThreadEvents,
  type PlanAiThread,
} from './planAssistantThreads';
import { pollLocalAiJob } from './pollLocalAiJob';
import {
  getPlanAssistantAccessToken,
  invokePlanAssistantChat,
  invokePlanAssistantChatViaSupabase,
} from './transport';
import type { ChatMessage, PlanAssistantApiResponse, PlanHint } from './types';
import { generateUuidV4 } from './uuid';

type Params = {
  userId: string | null;
  userName: string;
  currentPath: string;
  currentEventId: string | null;
  hints: PlanHint[];
};

export function usePlanAssistantChat(params: Params) {
  const { userId, userName, currentPath, currentEventId, hints } = params;
  const [messages, setMessages] = useState<ChatMessage[]>(DEFAULT_PLAN_MESSAGES);
  const [input, setInput] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [threads, setThreads] = useState<PlanAiThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const messageId = useRef(1);
  const hydratedUser = useRef<string | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);
  const tenantIdRef = useRef<string | null>(null);

  activeThreadIdRef.current = activeThreadId;
  tenantIdRef.current = tenantId;

  const nextMessageId = useCallback((prefix: 'bot' | 'user') => {
    const id = `${prefix}-${messageId.current}`;
    messageId.current += 1;
    return id;
  }, []);

  const pushBotMessage = useCallback((message: Omit<ChatMessage, 'id' | 'role'>) => {
    setMessages((previous) => [...previous, { id: nextMessageId('bot'), role: 'bot', ...message }]);
  }, [nextMessageId]);

  // Resolve tenant and load threads
  useEffect(() => {
    if (!userId) {
      setTenantId(null);
      setThreads([]);
      setActiveThreadId(null);
      return;
    }
    let isMounted = true;
    void resolvePlanTenantId(supabase, userId).then(async (resolvedTenant) => {
      if (!isMounted || !resolvedTenant) return;
      setTenantId(resolvedTenant);
      tenantIdRef.current = resolvedTenant;
      const loadedThreads = await listThreadsApi(supabase, resolvedTenant);
      if (isMounted) {
        setThreads(loadedThreads);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Switch to selected thread messages
  const selectThread = useCallback(async (thread: PlanAiThread) => {
    setActiveThreadId(thread.id);
    activeThreadIdRef.current = thread.id;
    const currentTenant = tenantIdRef.current;
    if (!currentTenant) return;

    try {
      const rows = await loadThreadMessagesApi(supabase, currentTenant, thread.id);
      if (rows.length === 0) {
        setMessages(DEFAULT_PLAN_MESSAGES);
      } else {
        const loadedMessages: ChatMessage[] = rows.map((r, idx) => ({
          id: `msg-${r.id || idx}`,
          role: r.role === 'user' ? 'user' : 'bot',
          text: r.content,
        }));
        setMessages(loadedMessages);
      }
    } catch (err) {
      console.warn('Failed to load thread messages:', err);
    }
  }, []);

  // Create brand new thread
  const createNewThread = useCallback(() => {
    setActiveThreadId(null);
    activeThreadIdRef.current = null;
    setMessages(DEFAULT_PLAN_MESSAGES);
    setInput('');
  }, []);

  // Rename thread
  const renameThread = useCallback(async (threadId: string, newTitle: string) => {
    const currentTenant = tenantIdRef.current;
    if (!currentTenant) return;
    await renameThreadApi(supabase, currentTenant, threadId, newTitle);
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, title: newTitle } : t))
    );
  }, []);

  // Delete thread
  const deleteThread = useCallback(async (threadId: string) => {
    const currentTenant = tenantIdRef.current;
    if (!currentTenant) return;
    await deleteThreadApi(supabase, currentTenant, threadId);
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    if (activeThreadIdRef.current === threadId) {
      createNewThread();
    }
  }, [createNewThread]);

  // Subscribe to cross-component thread events (e.g. from PlanThreadModal)
  useEffect(() => {
    const unsubscribe = subscribeThreadEvents((event) => {
      if (event.type === 'SELECT_THREAD') {
        void selectThread(event.thread);
      } else if (event.type === 'NEW_THREAD') {
        createNewThread();
      } else if (event.type === 'THREADS_UPDATED') {
        const currentTenant = tenantIdRef.current;
        if (currentTenant) {
          void listThreadsApi(supabase, currentTenant).then(setThreads);
        }
      }
    });
    return unsubscribe;
  }, [createNewThread, selectThread]);

  // Initial restore from local snapshot
  useEffect(() => {
    if (!userId) {
      hydratedUser.current = null;
      setMessages(DEFAULT_PLAN_MESSAGES);
      setInput('');
      return;
    }
    let active = true;
    hydratedUser.current = null;
    void AsyncStorage.getItem(planChatStorageKey(userId)).then((raw) => {
      if (!active) return;
      const snapshot = restorePlanChatSnapshot(raw, DEFAULT_PLAN_MESSAGES);
      setMessages(snapshot.messages as ChatMessage[]);
      setInput(snapshot.draft);
      hydratedUser.current = userId;
    }).catch((error) => {
      console.warn('Plan chat restore failed', error);
      if (active) hydratedUser.current = userId;
    });
    return () => { active = false; };
  }, [userId]);

  // Persist draft & current snapshot to AsyncStorage
  useEffect(() => {
    if (!userId || hydratedUser.current !== userId) return;
    const timeout = setTimeout(() => {
      const snapshot = createPlanChatSnapshot({
        messages: messages as PersistedPlanChatMessage[],
        draft: input,
      });
      void AsyncStorage.setItem(planChatStorageKey(userId), JSON.stringify(snapshot)).catch(
        (error) => console.warn('Plan chat persistence failed', error),
      );
    }, 180);
    return () => clearTimeout(timeout);
  }, [input, messages, userId]);

  const topHintPayload = useMemo(() => hints.slice(0, 5).map((hint) => ({
    id: hint.id,
    title: hint.title,
    ctaLabel: hint.ctaLabel,
    ctaPath: hint.ctaPath,
  })), [hints]);

  const appendHintMessage = useCallback((hint: PlanHint) => {
    pushBotMessage({
      text: buildHintMessage(hint, userName),
      ctaLabel: hint.ctaLabel,
      ctaPath: hint.ctaPath,
    });
  }, [pushBotMessage, userName]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isReplying) return;

    const currentReqId = generateUuidV4();
    const request = {
      requestId: currentReqId,
      request_id: currentReqId,
      message: text,
      current_path: currentPath,
      current_event_id: currentEventId,
      hints: topHintPayload,
      message_history: buildMessageHistory(messages),
      user_name: userName,
    };

    setMessages((previous) => [...previous, { id: nextMessageId('user'), role: 'user', text }]);
    setInput('');
    setIsReplying(true);

    const currentTenant = tenantIdRef.current;
    let currentThreadId = activeThreadIdRef.current;

    // Auto-create thread if not active
    if (!currentThreadId && currentTenant) {
      try {
        const title = buildThreadTitleFromText(text);
        const newThread = await createThread(supabase, currentTenant, userId, title);
        currentThreadId = newThread.id;
        setActiveThreadId(newThread.id);
        activeThreadIdRef.current = newThread.id;
        setThreads((prev) => [newThread, ...prev]);
      } catch (err) {
        console.warn('Auto thread creation failed, continuing chat:', err);
      }
    }

    // Auto-save user message to DB
    if (currentThreadId && currentTenant) {
      void saveThreadMessage(supabase, {
        threadId: currentThreadId,
        tenantId: currentTenant,
        role: 'user',
        content: text,
      }).catch((err) => console.warn('Failed to save user message to thread:', err));
    }

    try {
      let data: PlanAssistantApiResponse;
      let primaryError: unknown = null;
      let accessToken = await getPlanAssistantAccessToken();
      try {
        const result = await invokePlanAssistantChat(request, accessToken);
        data = result.payload;
        accessToken = result.accessToken;
      } catch (error) {
        primaryError = error;
        if (!accessToken) accessToken = await getPlanAssistantAccessToken(true);
        try {
          data = await invokePlanAssistantChatViaSupabase(request, accessToken);
        } catch (fallbackError) {
          throw new Error(`plan_assistant_both_transports_failed primary=${String(error)} secondary=${String(fallbackError)}`);
        }
      }

      // Check for async job polling (HTTP 202)
      const potentialJobId = data.jobId || data.job_id;
      if (potentialJobId && typeof potentialJobId === 'string' && !data.answer) {
        try {
          const pollResult = await pollLocalAiJob(supabase, 'plan-assistant-chat', potentialJobId);
          if (pollResult.answer) {
            data.answer = pollResult.answer;
          }
          if (Array.isArray(pollResult.suggested_actions)) {
            data.suggested_actions = pollResult.suggested_actions;
          }
        } catch (pollErr) {
          console.warn('Plan assistant poll failed:', pollErr);
        }
      }

      const answer = getAssistantAnswer(data);
      const actions = getSuggestedActions(data);
      if (!answer) throw new Error('empty_answer');
      if (data.meta?.ai_used === false && data.meta.response_mode !== 'deterministic') {
        console.warn('plan assistant returned fallback mode', data.meta.ai_error);
      }
      if (primaryError) {
        console.warn('plan assistant primary transport failed, fallback transport succeeded', primaryError);
      }

      pushBotMessage({ text: answer, ctaLabel: actions[0]?.label, ctaPath: actions[0]?.path });

      // Auto-save AI reply to DB
      if (currentThreadId && currentTenant) {
        void saveThreadMessage(supabase, {
          threadId: currentThreadId,
          tenantId: currentTenant,
          role: 'assistant',
          content: answer,
        }).catch((err) => console.warn('Failed to save assistant message to thread:', err));
      }
    } catch (error) {
      console.warn('plan assistant failed on both transports', error);
      const errorStr = String(error).toLowerCase();
      if (
        errorStr.includes('plan_assistant_relogin_required') ||
        errorStr.includes('plan_assistant_unauthorized') ||
        errorStr.includes('unauthorized') ||
        errorStr.includes('jwt') ||
        errorStr.includes('401')
      ) {
        pushBotMessage({
          text: 'Sua sessão expirou por segurança. Entre novamente no aplicativo para continuar conversando com a Plan IA.',
        });
      } else {
        pushBotMessage({
          text: 'Não consegui concluir a resposta agora. Tente novamente em alguns instantes.',
        });
      }
    } finally {
      setIsReplying(false);
    }
  }, [currentEventId, currentPath, input, isReplying, messages, nextMessageId, pushBotMessage, topHintPayload, userId, userName]);

  return {
    messages,
    input,
    setInput,
    isReplying,
    sendMessage,
    appendHintMessage,
    threads,
    activeThreadId,
    selectThread,
    createNewThread,
    renameThread,
    deleteThread,
  };
}
