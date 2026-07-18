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

export const EVENT_DATA_COLUMNS: Record<EventDataKey, string> = {
  tasks: 'id,event_id,text,completed,due_date,priority,position,notes,assignee_name,created_at',
  expenses: 'id,event_id,name,value,color,status,vendor_id,created_at',
  payments: 'id,event_id,expense_id,amount,method,note,paid_at,created_at',
  guests: 'id,event_id,name,phone,confirmed,rsvp_status,rsvp_note,responded_at,plus_one_count,companion_names,dietary_restrictions,table_id,qr_token,invite_token,invited_at,checked_in_at,checked_in_by,family_group_id,group_leader_id,group_sort_order,is_group_leader,guest_source,invite_dispatch_channel,invite_dispatch_error,invite_dispatch_last_at,invite_dispatch_message_id,invite_dispatch_status,created_at',
  timeline: 'id,event_id,activity,time,description,assignee_name,position,created_at',
  vendors: 'id,event_id,catalog_vendor_id,name,category,phone,email,notes,status,expected_arrival_time,expected_done_time,is_self_vendor,contract_document_id,control_token,import_draft_id,import_review_reason,import_review_status,created_at',
  documents: 'id,event_id,name,category,file_id,file_type,file_url,vendor_id,created_at',
  notes: 'id,event_id,content,color,created_at,updated_at',
  team: 'id,event_id,name,phone,role,address,team_name,is_leader,advisor_team_id,advisor_team_member_id,photo_file_id,photo_url,created_at',
  tables: 'id,event_id,name,note,seats,shape,pos_x,pos_y,posx,posy,created_at',
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
