import { getPrivateFileDownloadUrl } from '../../lib/r2FileStorage';
import { supabase } from '../../lib/supabase';
import { EVENTS_PAGE_SIZE, eventPayload, type CreateEventForm, type EventItem } from './eventsModel';
const EVENT_COLUMNS = 'id, name, event_date, location, status, event_type, couple_photo_url, couple_photo_file_id, budget_total, guests_planned';
export async function fetchEventsPage(userId: string, page: number) { const from = page * EVENTS_PAGE_SIZE; const result = await supabase.from('events').select(EVENT_COLUMNS).eq('user_id', userId).or('status.is.null,status.neq.deleted').order('event_date', { ascending: true }).range(from, from + EVENTS_PAGE_SIZE - 1); return { ...result, data: (result.data ?? []) as EventItem[] }; }
export async function createEvent(userId: string, form: CreateEventForm) { return supabase.from('events').insert([eventPayload(userId, form)]).select(EVENT_COLUMNS).single(); }
export async function resolveEventCover(fileId: string) { return getPrivateFileDownloadUrl(fileId); }
