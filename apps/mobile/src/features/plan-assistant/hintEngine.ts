import { getDaysUntil, getPendingRsvp, normalizeText } from './core';
import type { PlanHint } from './types';

export type EventLite = { id: string; name: string; event_date: string | null };
export type VendorLite = {
  event_id: string;
  category: string | null;
  expected_arrival_time: string | null;
  expected_done_time: string | null;
};
export type GuestLite = { event_id: string; confirmed: boolean | null; rsvp_status: string | null };
export type TaskLite = { event_id: string; completed: boolean | null; due_date: string | null };

export function buildPlanHints(
  events: EventLite[],
  vendors: VendorLite[],
  guests: GuestLite[],
  tasks: TaskLite[],
  now = new Date(),
) {
  const hints: PlanHint[] = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  for (const event of events) {
    const eventVendors = vendors.filter((vendor) => vendor.event_id === event.id);
    const eventGuests = guests.filter((guest) => guest.event_id === event.id);
    const eventTasks = tasks.filter((task) => task.event_id === event.id);
    const daysToEvent = getDaysUntil(event.event_date, now);

    if (!eventVendors.some((vendor) => normalizeText(vendor.category ?? '').includes('buffet'))) {
      hints.push({
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
    if (withoutSchedule > 0) {
      hints.push({
        id: `vendor-schedule-${event.id}`,
        severity: daysToEvent !== null && daysToEvent <= 30 ? 'high' : 'medium',
        title: `${withoutSchedule} fornecedor(es) sem horário`,
        message: `No evento ${event.name}, faltam horários de chegada/finalização.`,
        ctaLabel: 'Ajustar fornecedores',
        ctaPath: `/dashboard/eventos/${event.id}`,
      });
    }

    if (eventGuests.length >= 8) {
      const pendingGuests = eventGuests.filter(getPendingRsvp).length;
      if (pendingGuests >= 8 && pendingGuests / eventGuests.length >= 0.4) {
        hints.push({
          id: `pending-guests-${event.id}`,
          severity: daysToEvent !== null && daysToEvent <= 21 ? 'high' : 'medium',
          title: `${pendingGuests} convidados pendentes`,
          message: `No evento ${event.name}, ainda há muitas respostas RSVP pendentes.`,
          ctaLabel: 'Ver convidados',
          ctaPath: `/dashboard/eventos/${event.id}`,
        });
      }
    }

    const overdueTasks = eventTasks.filter((task) => (
      !task.completed && Boolean(task.due_date) && new Date(task.due_date as string) < today
    )).length;
    if (overdueTasks > 0 && (daysToEvent === null || daysToEvent <= 45)) {
      hints.push({
        id: `overdue-tasks-${event.id}`,
        severity: 'high',
        title: `${overdueTasks} tarefa(s) atrasada(s)`,
        message: `Evento ${event.name} tem tarefas vencidas perto da data.`,
        ctaLabel: 'Ver cronograma',
        ctaPath: `/dashboard/eventos/${event.id}/cronograma`,
      });
    }
  }

  const rank: Record<PlanHint['severity'], number> = { high: 0, medium: 1, low: 2 };
  return hints.sort((a, b) => rank[a.severity] - rank[b.severity] || a.title.localeCompare(b.title));
}
