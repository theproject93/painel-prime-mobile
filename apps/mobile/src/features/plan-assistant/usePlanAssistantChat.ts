import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { uploadPrivateAsset } from '../../lib/r2FileStorage';
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
  invokePlanAssistantVoice,
} from './transport';
import type {
  ChatMessage,
  PendingContractAttachment,
  PlanAssistantApiResponse,
  PlanHint,
  PlanIaQuotaInfo,
} from './types';
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
  const [quota, setQuota] = useState<PlanIaQuotaInfo | null>(null);
  const [pendingContractAttachment, setPendingContractAttachment] = useState<PendingContractAttachment | null>(null);

  const messageId = useRef(1);
  const hydratedUser = useRef<string | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);
  const tenantIdRef = useRef<string | null>(null);

  activeThreadIdRef.current = activeThreadId;
  tenantIdRef.current = tenantId;

  const nextMessageId = useCallback((prefix: 'bot' | 'user') => {
    const id = `${prefix}-${Date.now()}-${messageId.current}`;
    messageId.current += 1;
    return id;
  }, []);

  const updateMessage = useCallback((messageIdToUpdate: string, updater: (message: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((msg) => (msg.id === messageIdToUpdate ? updater(msg) : msg)));
  }, []);

  const pushBotMessage = useCallback((message: Omit<ChatMessage, 'id' | 'role'>) => {
    setMessages((previous) => [...previous, { id: nextMessageId('bot'), role: 'bot', ...message }]);
  }, [nextMessageId]);

  // Resolve tenant, load threads, and fetch quota
  useEffect(() => {
    if (!userId) {
      setTenantId(null);
      setThreads([]);
      setActiveThreadId(null);
      setQuota(null);
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

      // Fetch quota
      try {
        const { data: usageData, error } = await supabase.rpc('get_plan_ia_usage_status' as any, {
          p_tenant_id: resolvedTenant,
          p_user_id: userId,
        });
        if (!error && usageData && typeof usageData === 'object' && isMounted) {
          setQuota(usageData as PlanIaQuotaInfo);
        }
      } catch {
        // Best-effort quota fetch
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
          audioUrl: r.reply_audio_url || undefined,
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
    setPendingContractAttachment(null);
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

  // Helper to ensure an active thread exists in DB
  const ensureActiveThread = useCallback(async (fallbackTitle: string) => {
    const currentTenant = tenantIdRef.current;
    let currentThreadId = activeThreadIdRef.current;
    if (currentThreadId && currentTenant) {
      return { threadId: currentThreadId, tenant: currentTenant };
    }
    if (!currentTenant) return null;

    try {
      const title = buildThreadTitleFromText(fallbackTitle);
      const newThread = await createThread(supabase, currentTenant, userId, title);
      currentThreadId = newThread.id;
      setActiveThreadId(newThread.id);
      activeThreadIdRef.current = newThread.id;
      setThreads((prev) => [newThread, ...prev]);
      return { threadId: newThread.id, tenant: currentTenant };
    } catch (err) {
      console.warn('Auto thread creation failed, continuing chat:', err);
      return null;
    }
  }, [userId]);

  // Pick PDF contract using expo-document-picker
  const pickContractPdf = useCallback(async () => {
    try {
      const DocumentPicker = require('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      const asset = result.assets[0];
      setPendingContractAttachment({
        fileUri: asset.uri,
        name: asset.name || 'contrato.pdf',
        mimeType: asset.mimeType || 'application/pdf',
        size: asset.size,
        eventId: currentEventId,
      });
    } catch (err) {
      console.warn('Erro ao selecionar contrato PDF:', err);
    }
  }, [currentEventId]);

  const clearPendingContractAttachment = useCallback(() => {
    setPendingContractAttachment(null);
  }, []);

  // Send voice message (AWS Transcribe + Bedrock + Amazon Polly Camila)
  const sendVoiceMessage = useCallback(async (recording: { uri: string; name: string; mimeType: string }) => {
    if (isReplying || !userId) return;

    const userMessageId = nextMessageId('user');
    const botPlaceholderId = nextMessageId('bot');

    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      text: 'Mensagem de voz enviada',
      audioUrl: recording.uri,
      inputModality: 'audio',
    };

    const botMessage: ChatMessage = {
      id: botPlaceholderId,
      role: 'bot',
      text: 'Plan IA está ouvindo o seu áudio...',
      jobStatus: 'processing',
    };

    setMessages((prev) => [...prev, userMessage, botMessage]);
    setIsReplying(true);

    const threadCtx = await ensureActiveThread('Mensagem de voz');

    try {
      const formData = new FormData();
      formData.append('audio', {
        uri: recording.uri,
        name: recording.name,
        type: recording.mimeType,
      } as any);
      formData.append('current_path', currentPath);
      formData.append('channel', 'app_mobile');
      if (currentEventId) formData.append('current_event_id', currentEventId);
      if (threadCtx?.threadId) formData.append('thread_id', threadCtx.threadId);

      const voiceData = await invokePlanAssistantVoice(formData);

      const transcript = typeof voiceData?.user_transcript === 'string' ? voiceData.user_transcript.trim() : '';
      const answer = typeof voiceData?.answer === 'string' ? voiceData.answer.trim() : '';
      const audioUrl = typeof voiceData?.audio_data_url === 'string' ? voiceData.audio_data_url : undefined;

      // Update user message with transcript while preserving audioUrl so user can replay sent audio
      updateMessage(userMessageId, (msg) => ({
        ...msg,
        text: transcript || 'Mensagem de voz enviada',
        audioUrl: recording.uri,
      }));

      // Update bot message with synthesized Amazon Polly Camila audio and auto-play
      updateMessage(botPlaceholderId, (msg) => ({
        ...msg,
        text: answer || 'Áudio processado com sucesso.',
        audioUrl,
        autoPlayAudio: Boolean(audioUrl),
        inputModality: 'audio',
        replyModality: audioUrl ? 'audio' : 'text',
        jobStatus: 'done',
      }));

      // Persist exchange to DB thread
      if (threadCtx) {
        void saveThreadMessage(supabase, {
          threadId: threadCtx.threadId,
          tenantId: threadCtx.tenant,
          role: 'user',
          content: transcript || 'Mensagem de voz enviada',
        });
        if (answer) {
          void saveThreadMessage(supabase, {
            threadId: threadCtx.threadId,
            tenantId: threadCtx.tenant,
            role: 'assistant',
            content: answer,
          });
        }
      }
    } catch (error) {
      console.warn('Falha no fluxo de voz da Plan IA:', error);
      updateMessage(botPlaceholderId, (msg) => ({
        ...msg,
        text: 'Não consegui concluir o processamento do seu áudio agora. Tente novamente em alguns instantes.',
        jobStatus: 'failed',
      }));
    } finally {
      setIsReplying(false);
    }
  }, [currentEventId, currentPath, ensureActiveThread, isReplying, nextMessageId, updateMessage, userId]);

  // Send text message or PDF attachment
  const sendMessage = useCallback(async (rawText?: string) => {
    const text = (rawText ?? input).trim();
    const attachment = pendingContractAttachment;
    if ((!text && !attachment) || isReplying) return;

    // Flow with Contract PDF attachment
    if (attachment) {
      const userText = text || `Anexei o contrato "${attachment.name}" para análise.`;
      const userMsgId = nextMessageId('user');
      const botMsgId = nextMessageId('bot');

      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          role: 'user',
          text: userText,
          attachmentName: attachment.name,
        },
        {
          id: botMsgId,
          role: 'bot',
          text: 'Enviando contrato para análise...',
          attachmentName: attachment.name,
          jobStatus: 'uploading',
        },
      ]);
      setInput('');
      setPendingContractAttachment(null);
      setIsReplying(true);

      const threadCtx = await ensureActiveThread(userText);

      try {
        const upload = await uploadPrivateAsset({
          uri: attachment.fileUri,
          fileName: attachment.name,
          contentType: attachment.mimeType || 'application/pdf',
          entityType: 'plan_contract_pdf' as any,
          entityId: currentEventId,
        });

        updateMessage(botMsgId, (msg) => ({
          ...msg,
          text: 'Processando documento e extraindo cláusulas...',
          jobStatus: 'processing',
        }));

        const currentReqId = generateUuidV4();
        const request = {
          requestId: currentReqId,
          request_id: currentReqId,
          message: text || 'Analise este contrato e extraia os dados principais.',
          current_path: currentPath,
          current_event_id: currentEventId,
          context_type: 'event',
          context_id: currentEventId,
          attachments: [{ stored_file_id: upload.fileId, kind: 'contract_pdf' as const }],
          hints: topHintPayload,
          message_history: buildMessageHistory(messages),
          user_name: userName,
        };

        const accessToken = await getPlanAssistantAccessToken();
        let data: PlanAssistantApiResponse;
        try {
          const result = await invokePlanAssistantChat(request, accessToken);
          data = result.payload;
        } catch {
          data = await invokePlanAssistantChatViaSupabase(request, accessToken);
        }

        const potentialJobId = data.jobId || data.job_id;
        if (potentialJobId && typeof potentialJobId === 'string' && !data.answer) {
          try {
            const pollResult = await pollLocalAiJob(supabase, 'plan-assistant-chat', potentialJobId);
            if (pollResult.answer) data.answer = pollResult.answer;
            if (pollResult.suggested_actions) data.suggested_actions = pollResult.suggested_actions;
          } catch (pollErr) {
            console.warn('Poll contrato falhou:', pollErr);
          }
        }

        const answer = getAssistantAnswer(data);
        const actions = getSuggestedActions(data);

        updateMessage(botMsgId, (msg) => ({
          ...msg,
          text: answer || 'Contrato processado com sucesso.',
          ctaLabel: actions[0]?.label,
          ctaPath: actions[0]?.path,
          ctaAction: actions[0]?.path ? 'route' : undefined,
          jobStatus: 'done',
        }));

        if (threadCtx) {
          void saveThreadMessage(supabase, {
            threadId: threadCtx.threadId,
            tenantId: threadCtx.tenant,
            role: 'user',
            content: userText,
          });
          if (answer) {
            void saveThreadMessage(supabase, {
              threadId: threadCtx.threadId,
              tenantId: threadCtx.tenant,
              role: 'assistant',
              content: answer,
            });
          }
        }
      } catch (err) {
        console.warn('Falha no upload/processamento do contrato:', err);
        updateMessage(botMsgId, (msg) => ({
          ...msg,
          text: 'Não consegui concluir a análise do contrato agora. Tente novamente em alguns instantes.',
          jobStatus: 'failed',
        }));
      } finally {
        setIsReplying(false);
      }
      return;
    }

    // Standard text message flow
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

    const threadCtx = await ensureActiveThread(text);

    // Auto-save user message to DB
    if (threadCtx) {
      void saveThreadMessage(supabase, {
        threadId: threadCtx.threadId,
        tenantId: threadCtx.tenant,
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

      if (data.quota && typeof data.quota === 'object' && 'allowed' in data.quota) {
        setQuota(data.quota as PlanIaQuotaInfo);
      }

      pushBotMessage({ text: answer, ctaLabel: actions[0]?.label, ctaPath: actions[0]?.path });

      // Auto-save AI reply to DB
      if (threadCtx) {
        void saveThreadMessage(supabase, {
          threadId: threadCtx.threadId,
          tenantId: threadCtx.tenant,
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
  }, [currentEventId, currentPath, ensureActiveThread, input, isReplying, messages, nextMessageId, pendingContractAttachment, pushBotMessage, topHintPayload, updateMessage, userName]);

  return {
    messages,
    input,
    setInput,
    isReplying,
    sendMessage,
    sendVoiceMessage,
    appendHintMessage,
    threads,
    activeThreadId,
    selectThread,
    createNewThread,
    renameThread,
    deleteThread,
    quota,
    pendingContractAttachment,
    pickContractPdf,
    clearPendingContractAttachment,
  };
}
