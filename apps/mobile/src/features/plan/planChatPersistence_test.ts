import { assertEquals } from 'jsr:@std/assert@1';

import {
  createPlanChatSnapshot,
  restorePlanChatSnapshot,
} from './planChatPersistence.ts';

Deno.test('Plan chat snapshot keeps the draft and the latest thirty human messages', () => {
  const messages = Array.from({ length: 35 }, (_, index) => ({
    id: `message-${index}`,
    role: index % 2 === 0 ? 'user' as const : 'bot' as const,
    text: `Mensagem ${index}`,
  }));

  const snapshot = createPlanChatSnapshot({ messages, draft: 'Minha pergunta' });
  assertEquals(snapshot.messages.length, 30);
  assertEquals(snapshot.messages[0]?.id, 'message-5');
  assertEquals(snapshot.draft, 'Minha pergunta');
});

Deno.test('Plan chat restore rejects malformed records without losing the default welcome', () => {
  const fallback = [{ id: 'welcome', role: 'bot' as const, text: 'Olá!' }];
  assertEquals(restorePlanChatSnapshot('{broken', fallback), {
    messages: fallback,
    draft: '',
  });

  const restored = restorePlanChatSnapshot(JSON.stringify({
    version: 1,
    draft: '  continuar  ',
    messages: [
      { id: 'ok', role: 'user', text: 'Pergunta preservada' },
      { id: 'bad', role: 'system', text: 'não pode persistir' },
      { id: 'empty', role: 'bot', text: '' },
    ],
  }), fallback);

  assertEquals(restored.messages, [{ id: 'ok', role: 'user', text: 'Pergunta preservada' }]);
  assertEquals(restored.draft, 'continuar');
});
