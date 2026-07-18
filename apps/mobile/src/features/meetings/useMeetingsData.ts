import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchEventMeetings, subscribeToMeetings } from './meetingService';
import { meetingError, patchMeeting, type Meeting } from './meetingModel';
export function useMeetingsData(eventId: string) {
  const [meetings, setMeetings] = useState<Meeting[]>([]), [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false), [error, setError] = useState('');
  const inFlight = useRef<Promise<void> | null>(null), queued = useRef(false);
  const fetchMeetings = useCallback(async (background = false) => { if (!eventId) return; if (inFlight.current) { queued.current = true; return inFlight.current; } const request = (async () => { background ? setRefreshing(true) : setLoading(true); setError(''); try { const result = await fetchEventMeetings(eventId); if (result.error) throw new Error(result.error.message); setMeetings(result.data); } catch (cause) { setError(meetingError(cause, 'Não foi possível carregar as reuniões.')); } finally { setLoading(false); setRefreshing(false); } })(); inFlight.current = request; await request; inFlight.current = null; if (queued.current) { queued.current = false; await fetchMeetings(true); } }, [eventId]);
  useEffect(() => { void fetchMeetings(); }, [fetchMeetings]);
  useEffect(() => eventId ? subscribeToMeetings(eventId, () => void fetchMeetings(true)) : undefined, [eventId, fetchMeetings]);
  const patch = useCallback((next: Meeting) => setMeetings((current) => patchMeeting(current, next)), []);
  const patchFields = useCallback((id: string, fields: Partial<Meeting>) => setMeetings((current) => current.map((meeting) => meeting.id === id ? { ...meeting, ...fields } : meeting)), []);
  return { meetings, loading, refreshing, error, setError, fetchMeetings, patch, patchFields };
}
