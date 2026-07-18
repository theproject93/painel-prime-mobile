import { assert, assertFalse } from 'jsr:@std/assert@1';

const screenUrl = new URL('../../screens/EventDetailsScreen.tsx', import.meta.url);

Deno.test('EventDetailsScreen respects the first decomposition budget', async () => {
  const screen = await Deno.readTextFile(screenUrl);
  const lineCount = screen.split(/\r?\n/).length;

  assert(lineCount <= 2_800, `EventDetailsScreen has ${lineCount} lines; PR 1 budget is 2800`);
});

Deno.test('EventDetailsScreen delegates static types, helpers and styles', async () => {
  const screen = await Deno.readTextFile(screenUrl);

  assertFalse(screen.includes('type EventRow ='));
  assertFalse(screen.includes('function parsePaymentNote('));
  assertFalse(screen.includes('const styles = StyleSheet.create('));
});
