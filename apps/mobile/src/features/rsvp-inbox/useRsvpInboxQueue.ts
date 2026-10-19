import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildDefaultReviewSelections,
  summarizeReviewThreads,
  type ConversationReviewThread,
  type GuestStatus,
  type ReviewSelectionStatus,
  type RsvpInboxFilter,
} from './rsvpInboxModel';
import {
  fetchRsvpReviewQueue,
  invokeRsvpReviewAction,
  subscribeToRsvpInbox,
  type ReviewActionResult,
} from './rsvpInboxService';

export function useRsvpInboxQueue(eventId: string) {
  const [threads, setThreads] = useState<ConversationReviewThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [filter, setFilter] = useState<RsvpInboxFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberSelections, setMemberSelections] = useState<
    Record<string, ReviewSelectionStatus>
  >({});

  const loadQueue = useCallback(
    async (isRefresh = false) => {
      if (!eventId) return;
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const queue = await fetchRsvpReviewQueue(eventId);
        setThreads(queue);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Falha ao carregar fila de atendimento RSVP.';
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [eventId]
  );

  useEffect(() => {
    void loadQueue(false);
  }, [loadQueue]);

  useEffect(() => {
    if (!eventId) return;
    const unsubscribe = subscribeToRsvpInbox(eventId, () => {
      void loadQueue(true);
    });
    return () => {
      unsubscribe();
    };
  }, [eventId, loadQueue]);

  const selectedThread = useMemo(() => {
    if (!selectedThreadId) return null;
    return threads.find((t) => t.thread_id === selectedThreadId) ?? null;
  }, [threads, selectedThreadId]);

  // Update memberSelections whenever selectedThread changes
  useEffect(() => {
    if (selectedThread) {
      setMemberSelections(buildDefaultReviewSelections(selectedThread));
    } else {
      setMemberSelections({});
    }
  }, [selectedThread]);

  const setMemberStatus = useCallback((guestId: string, status: ReviewSelectionStatus) => {
    setMemberSelections((prev) => ({
      ...prev,
      [guestId]: status,
    }));
  }, []);

  const stats = useMemo(() => summarizeReviewThreads(threads), [threads]);

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (filter === 'attention') {
        return t.state === 'handoff' || t.state === 'clarify';
      }
      if (filter === 'active') {
        return t.state === 'awaiting_reply';
      }
      if (filter === 'resolved') {
        return t.state === 'resolved';
      }
      return true;
    });
  }, [threads, filter]);

  // Actions
  const applyAttendance = useCallback(
    async (replyText?: string): Promise<ReviewActionResult> => {
      if (!selectedThread) throw new Error('Nenhuma conversa selecionada.');

      const members: Array<{ guestId: string; nextStatus: GuestStatus }> = [];
      for (const [gId, sel] of Object.entries(memberSelections)) {
        if (sel === 'confirmed' || sel === 'declined' || sel === 'pending') {
          members.push({ guestId: gId, nextStatus: sel });
        }
      }

      if (members.length === 0) {
        throw new Error('Selecione o status de pelo menos um convidado para aplicar.');
      }

      const res = await invokeRsvpReviewAction({
        action: 'apply',
        eventId,
        threadId: selectedThread.thread_id,
        members,
        replyText,
      });

      void loadQueue(true);
      return res;
    },
    [selectedThread, memberSelections, eventId, loadQueue]
  );

  const sendClarification = useCallback(
    async (replyText: string): Promise<ReviewActionResult> => {
      if (!selectedThread) throw new Error('Nenhuma conversa selecionada.');
      if (!replyText.trim()) throw new Error('Digite a mensagem de esclarecimento.');

      const res = await invokeRsvpReviewAction({
        action: 'clarify',
        eventId,
        threadId: selectedThread.thread_id,
        replyText,
      });

      void loadQueue(true);
      return res;
    },
    [selectedThread, eventId, loadQueue]
  );

  const markHandoff = useCallback(
    async (reason?: string): Promise<ReviewActionResult> => {
      if (!selectedThread) throw new Error('Nenhuma conversa selecionada.');

      const res = await invokeRsvpReviewAction({
        action: 'handoff',
        eventId,
        threadId: selectedThread.thread_id,
        reason,
      });

      void loadQueue(true);
      return res;
    },
    [selectedThread, eventId, loadQueue]
  );

  const sendFreeFormMessage = useCallback(
    async (text: string): Promise<ReviewActionResult> => {
      if (!selectedThread) throw new Error('Nenhuma conversa selecionada.');
      if (!text.trim()) throw new Error('Digite o texto da mensagem.');

      const res = await invokeRsvpReviewAction({
        action: 'send_message',
        eventId,
        threadId: selectedThread.thread_id,
        replyText: text.trim(),
      });

      void loadQueue(true);
      return res;
    },
    [selectedThread, eventId, loadQueue]
  );

  const resendQrCode = useCallback(
    async (guestId: string): Promise<ReviewActionResult> => {
      const res = await invokeRsvpReviewAction({
        action: 'resend_qr',
        eventId,
        guestId,
        threadId: selectedThread?.thread_id,
      });

      void loadQueue(true);
      return res;
    },
    [selectedThread, eventId, loadQueue]
  );

  return {
    threads: filteredThreads,
    allThreads: threads,
    selectedThread,
    selectedThreadId,
    setSelectedThreadId,
    filter,
    setFilter,
    stats,
    loading,
    refreshing,
    error,
    setError,
    memberSelections,
    setMemberStatus,
    applyAttendance,
    sendClarification,
    markHandoff,
    sendFreeFormMessage,
    resendQrCode,
    refresh: () => loadQueue(true),
  };
}
