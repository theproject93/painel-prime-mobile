import { assertEquals } from 'jsr:@std/assert';
import { patchMeeting, type Meeting } from './meetingModel.ts';
const meeting = (id: string, scheduled_at: string, notes: string | null = null): Meeting => ({ id, event_id: 'event', title: id, room_url: null, status: 'scheduled', notes, scheduled_at, updated_at: null, created_at: scheduled_at, meeting_minutes: null });
Deno.test('meeting patch replaces one row and preserves descending schedule', () => { const result = patchMeeting([meeting('a', '2026-07-18T10:00:00Z'), meeting('b', '2026-07-18T09:00:00Z')], meeting('b', '2026-07-18T11:00:00Z', 'ok')); assertEquals(result.map(({ id }) => id), ['b', 'a']); assertEquals(result[0].notes, 'ok'); });
