import { assert, assertEquals } from 'jsr:@std/assert';
import { generateUuidV4 } from './uuid.ts';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.test('generateUuidV4 produces valid RFC4122 v4 UUIDs', () => {
  const generated = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const id = generateUuidV4();
    assertEquals(typeof id, 'string');
    assertEquals(id.length, 36);
    assert(
      UUID_V4_PATTERN.test(id),
      `Generated ID "${id}" must strictly match RFC4122 v4 pattern`
    );
    assert(!generated.has(id), `Collision detected on UUID: "${id}"`);
    generated.add(id);
  }
});
