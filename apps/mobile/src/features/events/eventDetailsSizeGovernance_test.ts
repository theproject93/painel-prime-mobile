import { assert, assertFalse } from 'jsr:@std/assert@1';

const screenUrl = new URL('../../screens/EventDetailsScreen.tsx', import.meta.url);

Deno.test('EventDetailsScreen respects the final decomposition budget', async () => {
  const screen = await Deno.readTextFile(screenUrl);
  const lineCount = screen.split(/\r?\n/).length;

  assert(lineCount <= 1_000, `EventDetailsScreen has ${lineCount} lines; final budget is 1000`);
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

Deno.test('EventDetailsScreen delegates the simple event tabs', async () => {
  const screen = await Deno.readTextFile(screenUrl);

  assert(screen.includes('<SimpleEventTabs'));
  assertFalse(screen.includes('function PresentesTabContent('));
});

Deno.test('EventDetailsScreen delegates the operational event tabs', async () => {
  const screen = await Deno.readTextFile(screenUrl);

  assert(screen.includes('<OperationalEventTabs'));
  assertFalse(screen.includes("activeTab === 'tasks'"));
  assertFalse(screen.includes("activeTab === 'documents'"));
});

Deno.test('EventDetailsScreen delegates overview, command and history', async () => {
  const screen = await Deno.readTextFile(screenUrl);

  assert(screen.includes('<CoreEventTabs'));
  assertFalse(screen.includes("activeTab === 'overview'"));
  assertFalse(screen.includes("activeTab === 'command'"));
  assertFalse(screen.includes("activeTab === 'history'"));
});
