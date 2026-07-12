import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { eventStatusLabel, withTimeout } from './eventPresentation.ts';

Deno.test('event status is translated and unknown values stay human-readable', () => {
  assertEquals(eventStatusLabel('active'), 'Ativo');
  assertEquals(eventStatusLabel('completed'), 'Concluído');
  assertEquals(eventStatusLabel('waiting_customer'), 'Waiting Customer');
});

Deno.test('table map operations cannot stay pending forever', async () => {
  await assertRejects(() => withTimeout(new Promise(() => undefined), 5), Error, 'timeout');
  assertEquals(await withTimeout(Promise.resolve('ok'), 50), 'ok');
});
