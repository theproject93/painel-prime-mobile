import { assertEquals } from 'jsr:@std/assert@1';

import {
  HINT_REFRESH_TTL_MS,
  buildMessageHistory,
  buildRouteContext,
  getAssistantAnswer,
  getNearestFabCorner,
  getSuggestedActions,
  normalizeAccessToken,
} from './core.ts';
import { buildPlanHints } from './hintEngine.ts';

Deno.test('Plan assistant preserves route context and event tab payloads', () => {
  assertEquals(buildRouteContext(['(app)', '(tabs)', 'eventos', '[id]'], { id: 'event-123' }), {
    currentPath: '/dashboard/eventos/event-123',
    currentEventId: 'event-123',
  });
  assertEquals(buildRouteContext(['(app)', '(tabs)', 'financeiro'], {}), {
    currentPath: '/dashboard/financeiro',
    currentEventId: null,
  });
});

Deno.test('Plan assistant parses the existing response, token and history contracts', () => {
  assertEquals(getAssistantAnswer({ answer: '  resposta  ' }), 'resposta');
  assertEquals(getSuggestedActions({ suggested_actions: [{ path: '/dashboard', label: ' Abrir ' }] }), [
    { path: '/dashboard', label: 'Abrir' },
  ]);
  assertEquals(normalizeAccessToken('Bearer one.two.three'), 'one.two.three');
  assertEquals(normalizeAccessToken('invalid'), null);
  assertEquals(buildMessageHistory([
    { id: '1', role: 'user', text: 'Pergunta' },
    { id: '2', role: 'bot', text: 'Resposta' },
  ]), [
    { role: 'user', content: 'Pergunta' },
    { role: 'assistant', content: 'Resposta' },
  ]);
});

Deno.test('Plan assistant keeps the FAB inside the nearest safe corner', () => {
  assertEquals(getNearestFabCorner({ x: 92, y: 12 }, { minX: 10, maxX: 100, minY: 10, maxY: 200 }), {
    x: 100,
    y: 10,
  });
});

Deno.test('Plan hints preserve severity, RSVP and overdue-task ordering', () => {
  const hints = buildPlanHints(
    [{ id: 'event-1', name: 'Evento', event_date: '2026-07-25' }],
    [],
    Array.from({ length: 8 }, () => ({ event_id: 'event-1', confirmed: false, rsvp_status: 'pending' })),
    [{ event_id: 'event-1', completed: false, due_date: '2026-07-10' }],
    new Date('2026-07-18T12:00:00Z'),
  );
  assertEquals(hints.map((hint) => hint.id), [
    'overdue-tasks-event-1',
    'pending-guests-event-1',
    'missing-buffet-event-1',
  ]);
  assertEquals(HINT_REFRESH_TTL_MS, 15 * 60 * 1000);
});
