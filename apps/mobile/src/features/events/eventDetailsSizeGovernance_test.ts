import { assert, assertFalse } from 'jsr:@std/assert@1';

const screenUrl = new URL('../../screens/EventDetailsScreen.tsx', import.meta.url);

Deno.test('EventDetailsScreen respects the action-hooks decomposition budget', async () => {
  const screen = await Deno.readTextFile(screenUrl);
  const lineCount = screen.split(/\r?\n/).length;

  assert(lineCount <= 2_200, `EventDetailsScreen has ${lineCount} lines; PR 2 budget is 2200`);
});

Deno.test('EventDetailsScreen delegates static types, helpers and styles', async () => {
  const screen = await Deno.readTextFile(screenUrl);

  assertFalse(screen.includes('type EventRow ='));
  assertFalse(screen.includes('function parsePaymentNote('));
  assertFalse(screen.includes('const styles = StyleSheet.create('));
});

Deno.test('EventDetailsScreen delegates uploads, timeline intelligence and command actions', async () => {
  const screen = await Deno.readTextFile(screenUrl);

  assert(screen.includes('useEventUploads({'));
  assert(screen.includes('useEventTimeline({'));
  assert(screen.includes('useEventCommandCenter({'));
  assertFalse(screen.includes('DocumentPicker.getDocumentAsync('));
  assertFalse(screen.includes("supabase.functions.invoke('timeline-ai'"));
  assertFalse(screen.includes("supabase.from('event_command_config')"));
});
