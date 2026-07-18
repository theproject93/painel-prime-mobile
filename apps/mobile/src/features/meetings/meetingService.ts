import { supabase } from '../../lib/supabase';
import type { Meeting } from './meetingModel';
const MEETING_COLUMNS = 'id, event_id, title, room_url, status, notes, scheduled_at, updated_at, created_at, meeting_minutes(id, pdf_url, summary_markdown)';
export async function fetchEventMeetings(eventId: string) {
  // egress-guard: allow-unbounded -- the event meeting timeline is a complete, event-scoped history.
  const result = await supabase.from('event_meetings').select(MEETING_COLUMNS).eq('event_id', eventId).order('scheduled_at', { ascending: false });
  return { ...result, data: (result.data ?? []) as Meeting[] };
}
export async function invokeMeetingAction<T>(action: string, payload: Record<string, unknown>) { const result = await supabase.functions.invoke('meeting-management', { body: { action, ...payload } }); if (result.error) throw new Error(result.error.message || `Falha na ação ${action}`); return result.data as T; }
export function subscribeToMeetings(eventId: string, refresh: () => void) { const channel = supabase.channel(`mobile-meetings:${eventId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'event_meetings', filter: `event_id=eq.${eventId}` }, refresh).on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_minutes' }, refresh).subscribe(); return () => { void supabase.removeChannel(channel); }; }
