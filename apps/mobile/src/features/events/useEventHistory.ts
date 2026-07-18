import { useEffect, useMemo, useState } from 'react';

import type { EventDataState, EventDetailsTab } from './eventDetailsData';
import type { EventRow, HistoryKind, ProjectMilestone } from './eventDetailsTypes';
import { brl } from './eventDetailsUtils';

type UseEventHistoryArgs = {
  activeTab: EventDetailsTab;
  event: EventRow | null;
  data: EventDataState;
  displayName: string;
};

export function useEventHistory({ activeTab, event, data, displayName }: UseEventHistoryArgs) {
  const [historyFilter, setHistoryFilter] = useState<'all' | HistoryKind>('all');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const historyRows = useMemo(() => {
    const rows: Array<{ at: string; kind: HistoryKind; text: string }> = [];
    if (event?.created_at) rows.push({ at: event.created_at, kind: 'event', text: 'Evento criado' });
    data.timeline.forEach((row) => row.created_at && rows.push({ at: row.created_at, kind: 'timeline', text: `Timeline: ${row.activity || ''}` }));
    data.tasks.forEach((row) => row.created_at && rows.push({ at: row.created_at, kind: 'task', text: `Tarefa: ${row.text || ''}` }));
    data.guests.forEach((row) => {
      if (row.created_at) rows.push({ at: row.created_at, kind: 'guest', text: `Convidado: ${row.name || ''}` });
      if (row.invited_at) rows.push({ at: row.invited_at, kind: 'invite', text: `Convite enviado: ${row.name || ''}` });
      if (row.responded_at) rows.push({ at: row.responded_at, kind: 'rsvp', text: `RSVP ${String(row.rsvp_status ?? 'pending')}: ${row.name || ''}` });
    });
    data.vendors.forEach((row) => row.created_at && rows.push({ at: row.created_at, kind: 'vendor', text: `Fornecedor: ${row.name || ''}` }));
    data.documents.forEach((row) => row.created_at && rows.push({ at: row.created_at, kind: 'document', text: `Documento: ${row.name || ''}` }));
    data.expenses.forEach((row) => row.created_at && rows.push({ at: row.created_at, kind: 'expense', text: `Despesa: ${row.name || ''}` }));
    data.payments.forEach((row) => {
      const at = row.created_at || row.paid_at;
      if (at) rows.push({ at, kind: 'payment', text: `Pagamento: ${brl(Number(row.amount ?? 0))}` });
    });
    return rows.sort((left, right) => +new Date(right.at) - +new Date(left.at)).slice(0, 180);
  }, [data.documents, data.expenses, data.guests, data.payments, data.tasks, data.timeline, data.vendors, event?.created_at]);

  const history = useMemo(() => {
    if (historyFilter === 'all') return historyRows;
    return historyRows.filter((row) => row.kind === historyFilter);
  }, [historyRows, historyFilter]);

  const historyTimelineNodes = useMemo<ProjectMilestone[]>(() => {
    const startDateText = event?.created_at ?? null;
    if (!startDateText) return [];
    const startDate = new Date(startDateText);
    if (Number.isNaN(startDate.getTime())) return [];
    const toDayNumber = (value: string | null | undefined) => {
      if (!value) return 1;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return 1;
      return Math.max(1, Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    };
    const milestones: ProjectMilestone[] = [{
      id: `project-start-${event?.id ?? 'event'}`,
      date: startDate,
      dayNumber: 1,
      title: 'Início do projeto',
      detail: `Comecamos a trabalhar com ${displayName}.`,
      kind: 'start',
    }];

    data.vendors.forEach((row) => {
      if (!row.created_at) return;
      const date = new Date(row.created_at);
      if (Number.isNaN(date.getTime())) return;
      milestones.push({ id: `vendor-${row.id}`, date, dayNumber: toDayNumber(row.created_at), title: 'Fornecedor incluído', detail: `${row.name || 'Fornecedor'} (${row.category || 'Sem categoria'}) foi adicionado.`, kind: 'vendor' });
    });
    data.guests.forEach((row) => {
      if (row.created_at) {
        const date = new Date(row.created_at);
        if (!Number.isNaN(date.getTime())) milestones.push({ id: `guest-${row.id}`, date, dayNumber: toDayNumber(row.created_at), title: 'Convidado incluído', detail: `${row.name || 'Convidado'} entrou na lista.`, kind: 'guest' });
      }
      if (row.invited_at) {
        const date = new Date(row.invited_at);
        if (!Number.isNaN(date.getTime())) milestones.push({ id: `invite-${row.id}`, date, dayNumber: toDayNumber(row.invited_at), title: 'Convite enviado', detail: `Convite enviado para ${row.name || 'Convidado'}.`, kind: 'invite' });
      }
      if (row.responded_at) {
        const date = new Date(row.responded_at);
        if (!Number.isNaN(date.getTime())) {
          const status = String(row.rsvp_status ?? 'pending');
          const responseText = status === 'confirmed' ? 'confirmou presença' : status === 'declined' ? 'recusou presença' : 'respondeu o convite';
          milestones.push({ id: `rsvp-${row.id}`, date, dayNumber: toDayNumber(row.responded_at), title: 'RSVP atualizado', detail: `${row.name || 'Convidado'} ${responseText}.`, kind: 'rsvp' });
        }
      }
    });
    data.expenses.forEach((row) => {
      if (!row.created_at) return;
      const date = new Date(row.created_at);
      if (!Number.isNaN(date.getTime())) milestones.push({ id: `expense-${row.id}`, date, dayNumber: toDayNumber(row.created_at), title: 'Lançamento financeiro', detail: `${row.name || 'Despesa'} foi lançado (${brl(Number(row.value ?? 0))}).`, kind: 'expense' });
    });
    data.documents.forEach((row) => {
      if (!row.created_at) return;
      const date = new Date(row.created_at);
      if (!Number.isNaN(date.getTime())) milestones.push({ id: `document-${row.id}`, date, dayNumber: toDayNumber(row.created_at), title: 'Documento anexado', detail: `${row.name || 'Documento'} foi anexado ao evento.`, kind: 'document' });
    });
    data.payments.forEach((row) => {
      const createdAt = row.created_at ?? row.paid_at;
      if (!createdAt) return;
      const date = new Date(createdAt);
      if (!Number.isNaN(date.getTime())) milestones.push({ id: `payment-${row.id}`, date, dayNumber: toDayNumber(createdAt), title: 'Pagamento registrado', detail: `Pagamento de ${brl(Number(row.amount ?? 0))} foi lancado.`, kind: 'payment' });
    });
    if (event?.event_date) {
      const date = new Date(event.event_date);
      if (!Number.isNaN(date.getTime())) milestones.push({ id: `event-day-${event.id}`, date, dayNumber: toDayNumber(event.event_date), title: 'Data do evento', detail: `Marco final: ${date.toLocaleDateString('pt-BR')}.`, kind: 'start' });
    }
    return milestones.sort((left, right) => left.date.getTime() - right.date.getTime()).slice(0, 140);
  }, [data.documents, data.expenses, data.guests, data.payments, data.vendors, displayName, event?.created_at, event?.event_date, event?.id]);

  const selectedHistoryIndex = useMemo(() => {
    if (!selectedHistoryId) return -1;
    return historyTimelineNodes.findIndex((row) => row.id === selectedHistoryId);
  }, [historyTimelineNodes, selectedHistoryId]);
  const historyProgress = useMemo(() => {
    if (historyTimelineNodes.length <= 1) return 100;
    return (Math.max(0, selectedHistoryIndex) / (historyTimelineNodes.length - 1)) * 100;
  }, [historyTimelineNodes.length, selectedHistoryIndex]);

  useEffect(() => {
    if (historyTimelineNodes.length === 0) {
      setSelectedHistoryId(null);
      return;
    }
    const exists = historyTimelineNodes.some((row) => row.id === selectedHistoryId);
    if (!selectedHistoryId || !exists) setSelectedHistoryId(historyTimelineNodes[0].id);
  }, [historyTimelineNodes, selectedHistoryId]);

  useEffect(() => {
    if (activeTab !== 'history' || historyTimelineNodes.length <= 1) return;
    const timer = setInterval(() => {
      setSelectedHistoryId((previous) => {
        const current = historyTimelineNodes.findIndex((row) => row.id === previous);
        if (current < 0 || current >= historyTimelineNodes.length - 1) return historyTimelineNodes[0].id;
        return historyTimelineNodes[current + 1].id;
      });
    }, 2200);
    return () => clearInterval(timer);
  }, [activeTab, historyTimelineNodes]);

  return {
    historyFilter,
    setHistoryFilter,
    history,
    historyTimelineNodes,
    selectedHistoryId,
    setSelectedHistoryId,
    historyProgress,
  };
}
