import { assertEquals } from 'jsr:@std/assert';

import { splitSecureValue, utf8ByteLength } from './secureStoreChunks.ts';

Deno.test('splitSecureValue keeps every UTF-8 chunk below the configured byte limit', () => {
  const value = 'á'.repeat(1801) + '✨' + 'session-token';
  const chunks = splitSecureValue(value, 1800);

  assertEquals(chunks.every((chunk) => utf8ByteLength(chunk) <= 1800), true);
  assertEquals(chunks.join(''), value);
});

Deno.test('splitSecureValue persists an empty value as one chunk', () => {
  assertEquals(splitSecureValue('', 1800), ['']);
});
