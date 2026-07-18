import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  getPlanAssistantAccessToken,
  invokePlanAssistantChat,
  invokePlanAssistantChatViaSupabase,
} from './transport';
import type { ChatMessage, PlanAssistantApiResponse, PlanHint } from './types';

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
  const messageId = useRef(1);
  const hydratedUser = useRef<string | null>(null);

  const nextMessageId = useCallback((prefix: 'bot' | 'user') => {
    const id = `${prefix}-${messageId.current}`;
    messageId.current += 1;
    return id;
  }, []);
  const pushBotMessage = useCallback((message: Omit<ChatMessage, 'id' | 'role'>) => {
    setMessages((previous) => [...previous, { id: nextMessageId('bot'), role: 'bot', ...message }]);
  }, [nextMessageId]);

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
    const request = {
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

      const answer = getAssistantAnswer(data);
      const actions = getSuggestedActions(data);
      if (!answer) throw new Error('empty_answer');
      if (data.meta?.ai_used === false && data.meta.response_mode !== 'deterministic') {
        console.warn('plan-assistant-chat returned fallback mode', data.meta.ai_error);
      }
      if (primaryError) {
        console.warn('plan-assistant-chat primary transport failed, fallback transport succeeded', primaryError);
      }
      pushBotMessage({ text: answer, ctaLabel: actions[0]?.label, ctaPath: actions[0]?.path });
    } catch (error) {
      console.warn('plan-assistant-chat failed on both transports', error);
      if (String(error).includes('plan_assistant_relogin_required')) {
        pushBotMessage({ text: 'Sua sessão expirou e foi desconectada por segurança. Entre novamente no app para usar a PLAN IA.' });
      } else {
        pushBotMessage({
          text: 'Não consegui conectar a PLAN IA na nuvem agora.\n\nTente novamente em alguns segundos. Se persistir, verifique se a Edge Function `plan-assistant-chat` está ativa e com os segredos Cloudflare configurados.',
        });
      }
    } finally {
      setIsReplying(false);
    }
  }, [currentEventId, currentPath, input, isReplying, messages, nextMessageId, pushBotMessage, topHintPayload, userName]);

  return { messages, input, setInput, isReplying, sendMessage, appendHintMessage };
}
