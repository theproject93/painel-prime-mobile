import { supabase } from '../../lib/supabase';
import type { Meeting } from './meetingModel';
const MEETING_COLUMNS = 'id, event_id, title, room_url, status, notes, scheduled_at, updated_at, created_at, meeting_minutes(id, pdf_url, summary_markdown)';
export async function fetchEventMeetings(eventId: string) {
  // egress-guard: allow-unbounded -- the event meeting timeline is a complete, event-scoped history.
  const result = await supabase.from('event_meetings').select(MEETING_COLUMNS).eq('event_id', eventId).order('scheduled_at', { ascending: false });
  return { ...result, data: (result.data ?? []) as Meeting[] };
}
const FRIENDLY_MEETING_ERRORS: Record<string, string> = {
  meeting_plan_forbidden: 'O seu plano atual não inclui acesso ao módulo de reuniões.',
  meeting_entitlement_lookup_failed: 'Não foi possível validar o plano no momento. Tente novamente.',
  invalid_invitees: 'A lista de convidados é inválida.',
  invalid_scheduled_at: 'A data e horário informados são inválidos.',
  invalid_title: 'O assunto da reunião é inválido.',
  invalid_duration: 'A duração da reunião é inválida.',
  invalid_meeting_id: 'Reunião não encontrada.',
  meeting_title_required: 'Informe o assunto da reunião.',
  meeting_title_too_long: 'O assunto da reunião deve ter até 200 caracteres.',
  meeting_provider_unavailable: 'Provedor de vídeo indisponível no momento.',
  meeting_creation_failed: 'Não foi possível criar a sala de videoconferência.',
};

export async function invokeMeetingAction<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const result = await supabase.functions.invoke('meeting-management', { body: { action, ...payload } });
  if (result.error) {
    let errorCode = '';
    try {
      const ctx = (result.error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        errorCode = body?.error || '';
      }
    } catch {}
    const friendly = errorCode ? (FRIENDLY_MEETING_ERRORS[errorCode] || errorCode) : '';
    throw new Error(friendly || result.error.message || `Falha na ação ${action}`);
  }
  return result.data as T;
}
export async function fetchAllMeetings() {
  const result = await supabase
    .from('event_meetings')
    .select(`${MEETING_COLUMNS}, event:events(id, name)`)
    .order('scheduled_at', { ascending: false });
  return { ...result, data: (result.data ?? []) as unknown as Meeting[] };
}

export async function fetchMeetingById(meetingId: string) {
  const result = await supabase
    .from('event_meetings')
    .select(`${MEETING_COLUMNS}, event:events(id, name)`)
    .eq('id', meetingId)
    .maybeSingle();
  return { ...result, data: result.data as unknown as Meeting | null };
}

export function subscribeToGlobalMeetings(refresh: () => void) {
  const channel = supabase
    .channel('mobile-global-meetings')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_meetings' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_minutes' }, refresh)
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToMeetings(eventId: string, refresh: () => void) { const channel = supabase.channel(`mobile-meetings:${eventId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'event_meetings', filter: `event_id=eq.${eventId}` }, refresh).on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_minutes' }, refresh).subscribe(); return () => { void supabase.removeChannel(channel); }; }

