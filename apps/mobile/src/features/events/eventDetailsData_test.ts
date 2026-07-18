import { assert, assertEquals, assertNotStrictEquals, assertStrictEquals } from 'jsr:@std/assert@1';

import {
  EVENT_DATA_PAGE_SIZE,
  EVENT_TAB_DATA_KEYS,
  createEventDataState,
  createEventLoadedState,
  createEventPagingState,
  mergeEventDataPage,
} from './eventDetailsData.ts';

Deno.test('event detail data state starts isolated with the established page size', () => {
  const first = createEventDataState();
  const second = createEventDataState();

  assertEquals(EVENT_DATA_PAGE_SIZE, 50);
  assertEquals(Object.keys(first), [
    'tasks', 'expenses', 'payments', 'guests', 'timeline',
    'vendors', 'documents', 'notes', 'team', 'tables',
  ]);
  assertNotStrictEquals(first.tasks, second.tasks);
  assertEquals(createEventLoadedState().tasks, false);
  assertEquals(createEventPagingState().tasks, { page: -1, hasMore: true });
});

Deno.test('event detail page merge replaces on reset and appends only new ids', () => {
  const existing = [{ id: '1', name: 'original' }, { id: '2', name: 'keep' }];
  const incoming = [{ id: '2', name: 'duplicate' }, { id: '3', name: 'new' }];

  const appended = mergeEventDataPage(existing, incoming, 'append');
  assertEquals(appended.map((row) => row.id), ['1', '2', '3']);
  assertStrictEquals(appended[1], existing[1]);
  assertStrictEquals(appended[2], incoming[1]);
  assertEquals(mergeEventDataPage(existing, incoming, 'reset'), incoming);
  assertEquals(existing.map((row) => row.id), ['1', '2']);
});

Deno.test('event tabs keep their current data dependencies', () => {
  assertEquals(EVENT_TAB_DATA_KEYS.overview, ['expenses', 'payments', 'tasks', 'guests', 'timeline', 'vendors']);
  assertEquals(EVENT_TAB_DATA_KEYS.documents, ['documents', 'vendors']);
  assertEquals(EVENT_TAB_DATA_KEYS.reception, ['guests', 'team']);
  assertEquals(EVENT_TAB_DATA_KEYS.meetings, []);
  assert(Object.keys(EVENT_TAB_DATA_KEYS).includes('command'));
});
