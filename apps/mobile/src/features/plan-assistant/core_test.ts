import { assertEquals } from 'jsr:@std/assert@1';

import {
  HINT_REFRESH_TTL_MS,
  buildMessageHistory,
  buildRouteContext,
  getAssistantAnswer,
  getNearestFabCorner,
  getSuggestedActions,
  normalizeAccessToken,
  parsePlanAssistantResponseText,
  sanitizeAssistantMessage,
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

Deno.test('sanitizeAssistantMessage scrubs internal tool names and blocks infra leak strings', () => {
  // Clean message preserved
  assertEquals(
    sanitizeAssistantMessage('Olá! Posso ajudar com suas tarefas.'),
    'Olá! Posso ajudar com suas tarefas.',
  );
  // Tool invocation stripped
  assertEquals(
    sanitizeAssistantMessage('Aqui está o resumo: (get_event_details) tudo certo.'),
    'Aqui está o resumo: tudo certo.',
  );
  assertEquals(
    sanitizeAssistantMessage('Resumo → get_event_details_123 com dados.'),
    'Resumo com dados.',
  );
  // Edge Function name leaked -> humanized fallback
  assertEquals(
    sanitizeAssistantMessage('Erro ao invocar plan-assistant-chat na porta 8080'),
    'Não consegui concluir a resposta agora. Tente novamente em alguns instantes.',
  );
  // Cloudflare secret or table name leaked -> humanized fallback
  assertEquals(
    sanitizeAssistantMessage('CLOUDFLARE_API_KEY missing from relation "events"'),
    'Não consegui concluir a resposta agora. Tente novamente em alguns instantes.',
  );
  // AI provider or database error leaked -> humanized fallback
  assertEquals(
    sanitizeAssistantMessage('Failed to invoke bedrock or groq: 504 Gateway Timeout'),
    'Não consegui concluir a resposta agora. Tente novamente em alguns instantes.',
  );
  assertEquals(
    sanitizeAssistantMessage('PostgreSQL error: column "user_id" does not exist'),
    'Não consegui concluir a resposta agora. Tente novamente em alguns instantes.',
  );
  assertEquals(
    sanitizeAssistantMessage('openai rate limit or gemini quota exceeded'),
    'Não consegui concluir a resposta agora. Tente novamente em alguns instantes.',
  );
  assertEquals(
    sanitizeAssistantMessage('CORS error: fetch failed on worker script'),
    'Não consegui concluir a resposta agora. Tente novamente em alguns instantes.',
  );
  assertEquals(
    sanitizeAssistantMessage('jwt expired or invalid claim'),
    'Não consegui concluir a resposta agora. Tente novamente em alguns instantes.',
  );
  assertEquals(
    sanitizeAssistantMessage('Error query on plan_ai_threads or plan_ai_messages table'),
    'Não consegui concluir a resposta agora. Tente novamente em alguns instantes.',
  );
  assertEquals(
    sanitizeAssistantMessage('Database function resolve_primary_tenant_id failed'),
    'Não consegui concluir a resposta agora. Tente novamente em alguns instantes.',
  );
  assertEquals(
    sanitizeAssistantMessage('HTTP 400 invalid_request_id provided'),
    'Não consegui concluir a resposta agora. Tente novamente em alguns instantes.',
  );
  assertEquals(
    sanitizeAssistantMessage('cf-ray: 88123abcf0123-GRU cf-cache-status: DYNAMIC'),
    'Não consegui concluir a resposta agora. Tente novamente em alguns instantes.',
  );
  assertEquals(getAssistantAnswer({ error: 'rate_limited', message: 'Rate limit exceeded' }), '');
});

Deno.test('parsePlanAssistantResponseText parses direct JSON, standard SSE and default message streams', () => {
  // Direct JSON
  const directJson = '{"answer":"Resposta direta","suggested_actions":[{"label":"Ver","path":"/dashboard"}]}';
  const direct = parsePlanAssistantResponseText(directJson);
  assertEquals(direct.answer, 'Resposta direta');
  assertEquals(direct.suggested_actions?.[0]?.label, 'Ver');

  // SSE Stream with delta and done
  const sseStream =
    'event: delta\ndata: {"text":"Parte 1 "}\n\n' +
    'event: delta\ndata: {"text":"e parte 2."}\n\n' +
    'event: done\ndata: {"answer":"Parte 1 e parte 2.","suggested_actions":[{"label":"Abrir","path":"/eventos"}]}\n\n';
  const parsedStream = parsePlanAssistantResponseText(sseStream);
  assertEquals(parsedStream.answer, 'Parte 1 e parte 2.');
  assertEquals(parsedStream.suggested_actions?.[0]?.label, 'Abrir');

  // SSE Stream with deltas only
  const deltasOnly =
    'event: delta\ndata: {"text":"Apenas "}\n\n' +
    'event: delta\ndata: {"text":"deltas."}\n\n';
  const parsedDeltas = parsePlanAssistantResponseText(deltasOnly);
  assertEquals(parsedDeltas.answer, 'Apenas deltas.');

  // SSE Stream with default message event and delta/choices format
  const messageStream =
    'data: {"text":"Texto sem "}\n\n' +
    'data: {"choices":[{"delta":{"content":"evento explícito."}}]}\n\n';
  const parsedMessage = parsePlanAssistantResponseText(messageStream);
  assertEquals(parsedMessage.answer, 'Texto sem evento explícito.');
});
