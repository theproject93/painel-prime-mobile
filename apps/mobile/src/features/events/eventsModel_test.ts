import { assertEquals } from 'jsr:@std/assert';
import { filterEvents, mergeEvents, type EventItem } from './eventsModel.ts';
const event = (id: string, event_date: string, status = 'active'): EventItem => ({ id, event_date, status, name: id, location: 'BH', event_type: 'wedding', couple_photo_url: null });
Deno.test('event pages deduplicate by id and remain ordered', () => { assertEquals(mergeEvents([event('b', '2026-08-02')], [event('a', '2026-08-01'), event('b', '2026-08-02')]).map(({ id }) => id), ['a', 'b']); assertEquals(filterEvents([event('a', '2026-08-01'), event('b', '2026-08-02', 'completed')], '', 'completed').map(({ id }) => id), ['b']); });
