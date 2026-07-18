import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { EventDataState } from './eventDetailsData';
import type { EventRow, SmartTimelineSuggestion } from './eventDetailsTypes';
import { normalizeAiSuggestion } from './eventDetailsUtils';

type UseEventTimelineArgs = {
  eventId: string;
  event: EventRow | null;
  data: EventDataState;
  act: (action: () => Promise<void>, reload?: boolean) => Promise<void>;
};

export function useEventTimeline({ eventId, event, data, act }: UseEventTimelineArgs) {
  const [loadingAiTimelineSuggestions, setLoadingAiTimelineSuggestions] = useState(false);
  const [aiTimelineError, setAiTimelineError] = useState<string | null>(null);
  const [lastAiTimelineRunAt, setLastAiTimelineRunAt] = useState<string | null>(null);
  const [aiTimelineSuggestions, setAiTimelineSuggestions] = useState<SmartTimelineSuggestion[]>([]);

  const smartTimelineSuggestions = useMemo<SmartTimelineSuggestion[]>(() => {
    const out: SmartTimelineSuggestion[] = [];
    const pendingTasks = data.tasks.filter((item) => !item.completed);
    const pendingVendors = data.vendors.filter((item) => (item.status ?? 'pending') !== 'confirmed');
    const pendingGuests = data.guests.filter((item) => (item.rsvp_status ?? 'pending') === 'pending');

    if (pendingTasks.length >= 8) {
      out.push({
        id: 'rules-tasks',
        title: 'Bloco de execução de tarefas',
        reason: 'Muitas tarefas abertas para o evento.',
        activity: 'Reunião de alinhamento da equipe e distribuição de prioridades',
        time: '08:30',
        assignee: 'Assessoria',
        priority: 'high',
        source: 'rules',
      });
    }

    if (pendingVendors.length > 0) {
      out.push({
        id: 'rules-vendors',
        title: 'Checklist com fornecedores',
        reason: 'Existem fornecedores sem confirmação.',
        activity: 'Confirmar chegada e responsavel de todos os fornecedores pendentes',
        time: '09:30',
        assignee: 'Coordenação',
        priority: 'high',
        source: 'rules',
      });
    }

    if (pendingGuests.length >= 10) {
      out.push({
        id: 'rules-rsvp',
        title: 'Virada de RSVP',
        reason: 'Lista de convidados com alto volume pendente.',
        activity: 'Executar disparo final de RSVP e registrar retorno',
        time: '11:00',
        assignee: 'Recepcao',
        priority: 'normal',
        source: 'rules',
      });
    }

    if (data.timeline.length === 0) {
      out.push({
        id: 'rules-base',
        title: 'Estruturar cronograma do dia',
        reason: 'Evento sem itens na timeline.',
        activity: 'Montar cronograma base de operação do evento',
        time: '08:00',
        assignee: 'Assessoria',
        priority: 'high',
        source: 'rules',
      });
    }

    return out;
  }, [data.guests, data.tasks, data.timeline.length, data.vendors]);

  const timelineSuggestions = useMemo(() => {
    const out: SmartTimelineSuggestion[] = [];
    const seen = new Set<string>();
    [...aiTimelineSuggestions, ...smartTimelineSuggestions].forEach((item) => {
      const key = `${item.title}|${item.activity}|${item.time}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(item);
      }
    });
    return out;
  }, [aiTimelineSuggestions, smartTimelineSuggestions]);

  async function createTimelineItem(payload: {
    time: string;
    activity: string;
    assignee: string | null;
  }) {
    const { error: insertError } = await supabase.from('event_timeline').insert({
      event_id: eventId,
      time: payload.time,
      activity: payload.activity,
      assignee_name: payload.assignee,
      position: data.timeline.length,
    });
    if (insertError) throw new Error(insertError.message);
  }

  async function applySmartTimelineSuggestion(suggestion: SmartTimelineSuggestion) {
    await act(async () => {
      await createTimelineItem({
        time: suggestion.time,
        activity: suggestion.activity,
        assignee: suggestion.assignee || null,
      });
      setAiTimelineSuggestions((previous) => previous.filter((item) => item.id !== suggestion.id));
    });
  }

  async function generateHybridTimelineSuggestions() {
    if (!event) return;
    setLoadingAiTimelineSuggestions(true);
    setAiTimelineError(null);
    try {
      const payload = {
        event: {
          id: event.id,
          name: event.name,
          couple: event.couple,
          event_date: event.event_date,
          location: event.location,
        },
        metrics: {
          pending_tasks: data.tasks.filter((item) => !item.completed).length,
          pending_vendors: data.vendors.filter((item) => (item.status ?? 'pending') !== 'confirmed').length,
          pending_rsvp: data.guests.filter((item) => (item.rsvp_status ?? 'pending') === 'pending').length,
        },
        current_timeline: data.timeline.slice(0, 20).map((item) => ({
          time: item.time,
          activity: item.activity,
          assignee: item.assignee_name ?? '',
        })),
        rules_suggestions: smartTimelineSuggestions.map((item) => ({
          title: item.title,
          reason: item.reason,
          activity: item.activity,
          time: item.time,
          assignee: item.assignee,
          priority: item.priority,
        })),
      };

      const { data: aiData, error: invokeError } = await supabase.functions.invoke('timeline-ai', {
        body: payload,
      });
      if (invokeError) throw new Error(invokeError.message);

      const rawJson = aiData as unknown;
      const suggestionsRaw: unknown[] = Array.isArray(rawJson)
        ? rawJson
        : rawJson && typeof rawJson === 'object' && Array.isArray((rawJson as Record<string, unknown>).suggestions)
          ? ((rawJson as Record<string, unknown>).suggestions as unknown[])
          : [];

      const parsed = suggestionsRaw
        .map((raw, index) => normalizeAiSuggestion(raw, index))
        .filter((item): item is SmartTimelineSuggestion => Boolean(item));

      if (parsed.length === 0) {
        setAiTimelineError('A IA não retornou sugestões válidas. Mantendo sugestões locais.');
      }
      setAiTimelineSuggestions(parsed);
      setLastAiTimelineRunAt(new Date().toISOString());
    } catch (aiError: any) {
      setAiTimelineError(aiError?.message ?? 'Falha ao gerar sugestoes da IA.');
      setAiTimelineSuggestions([]);
    } finally {
      setLoadingAiTimelineSuggestions(false);
    }
  }

  return {
    loadingAiTimelineSuggestions,
    aiTimelineError,
    lastAiTimelineRunAt,
    timelineSuggestions,
    applySmartTimelineSuggestion,
    generateHybridTimelineSuggestions,
  };
}
