import type { EventDetailsInitialTab } from '../../navigation/eventRouteTypes.ts';

export type EventDataKey =
  | 'tasks'
  | 'expenses'
  | 'payments'
  | 'guests'
  | 'timeline'
  | 'vendors'
  | 'documents'
  | 'notes'
  | 'team'
  | 'tables';

export type EventDetailsTab = EventDetailsInitialTab | 'command';
export type EventDataState = Record<EventDataKey, any[]>;
export type EventLoadedState = Record<EventDataKey, boolean>;
export type EventPagingState = Record<EventDataKey, { page: number; hasMore: boolean }>;
export type EventDataLoadMode = 'reset' | 'append';

export const EVENT_DATA_PAGE_SIZE = 50;

export const EVENT_DATA_TABLES: Record<EventDataKey, string> = {
  tasks: 'event_tasks',
  expenses: 'event_expenses',
  payments: 'expense_payments',
  guests: 'event_guests',
  timeline: 'event_timeline',
  vendors: 'event_vendors',
  documents: 'event_documents',
  notes: 'event_notes',
  team: 'event_team_members',
  tables: 'event_tables',
};

export const EVENT_TAB_DATA_KEYS: Record<EventDetailsTab, EventDataKey[]> = {
  overview: ['expenses', 'payments', 'tasks', 'guests', 'timeline', 'vendors'],
  command: ['expenses', 'payments', 'tasks', 'guests', 'timeline', 'vendors'],
  history: ['tasks', 'guests', 'timeline', 'vendors', 'documents', 'expenses', 'payments'],
  tasks: ['tasks', 'vendors', 'team'],
  budget: ['expenses', 'payments'],
  guests: ['guests'],
  timeline: ['timeline', 'vendors', 'team'],
  vendors: ['vendors'],
  documents: ['documents', 'vendors'],
  notes: ['notes'],
  team: ['team'],
  tables: ['tables', 'guests'],
  invites: ['guests'],
  reception: ['guests', 'team'],
  portal: ['guests'],
  meetings: [],
  presentes: ['guests'],
  analytics: ['expenses', 'payments'],
};

export function createEventDataState(): EventDataState {
  return {
    tasks: [],
    expenses: [],
    payments: [],
    guests: [],
    timeline: [],
    vendors: [],
    documents: [],
    notes: [],
    team: [],
    tables: [],
  };
}

export function createEventLoadedState(): EventLoadedState {
  return {
    tasks: false,
    expenses: false,
    payments: false,
    guests: false,
    timeline: false,
    vendors: false,
    documents: false,
    notes: false,
    team: false,
    tables: false,
  };
}

export function createEventPagingState(): EventPagingState {
  return {
    tasks: { page: -1, hasMore: true },
    expenses: { page: -1, hasMore: true },
    payments: { page: -1, hasMore: true },
    guests: { page: -1, hasMore: true },
    timeline: { page: -1, hasMore: true },
    vendors: { page: -1, hasMore: true },
    documents: { page: -1, hasMore: true },
    notes: { page: -1, hasMore: true },
    team: { page: -1, hasMore: true },
    tables: { page: -1, hasMore: true },
  };
}

export function mergeEventDataPage<T extends { id?: unknown }>(
  existing: T[],
  incoming: T[],
  mode: EventDataLoadMode,
): T[] {
  if (mode === 'reset') return incoming;
  const existingIds = new Set(existing.map((row) => row.id));
  return [...existing, ...incoming.filter((row) => !existingIds.has(row.id))];
}
