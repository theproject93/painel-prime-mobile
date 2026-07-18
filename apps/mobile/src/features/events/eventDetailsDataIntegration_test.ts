import { assert, assertFalse } from 'jsr:@std/assert@1';

const sourceRoot = new URL('../../', import.meta.url);
const read = (path: string) => Deno.readTextFile(new URL(path, sourceRoot));

Deno.test('EventDetailsScreen delegates paged tab data to useEventDetailsData', async () => {
  const screen = await read('screens/EventDetailsScreen.tsx');

  assert(screen.includes("import { useEventDetailsData } from '../features/events/useEventDetailsData';"));
  assert(screen.includes('} = useEventDetailsData(eventId, activeTab, loadingEvent);'));
  assert(screen.includes('loadKey,'));
  assertFalse(screen.includes('async function fetchKey('));
  assertFalse(screen.includes('async function loadKey('));
  assertFalse(screen.includes('const [paging, setPaging]'));
  assertFalse(screen.includes('const TABLE_BY_KEY'));
  assertFalse(screen.includes('const TAB_KEYS'));
});

Deno.test('useEventDetailsData preserves the existing Supabase query and pagination contract', async () => {
  const hook = await read('features/events/useEventDetailsData.ts');

  assert(hook.includes('.select(EVENT_DATA_COLUMNS[key])'));
  assertFalse(hook.includes(".select('*')"));
  assert(hook.includes(".eq('event_id', eventId)"));
  assert(hook.includes('.order(order, { ascending: false })'));
  assert(hook.includes('.range(from, to)'));
  assert(hook.includes("const order = key === 'payments' ? 'paid_at' : 'created_at';"));
  assert(hook.includes('loadKey,'));
  assertFalse(hook.includes('Portal'));
  assertFalse(hook.includes('recepcao'));
});
