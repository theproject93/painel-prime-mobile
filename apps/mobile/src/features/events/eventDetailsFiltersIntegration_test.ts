import { assert, assertEquals, assertFalse, assertStringIncludes } from 'jsr:@std/assert@1';

const sourceRoot = new URL('../../', import.meta.url);
const read = (path: string) => Deno.readTextFile(new URL(path, sourceRoot));

Deno.test('EventDetailsScreen delegates filter state and projections to useEventFilters', async () => {
  const screen = await read('screens/EventDetailsScreen.tsx');

  assertStringIncludes(screen, "import { useEventFilters } from '../features/events/useEventFilters';");
  assertStringIncludes(screen, '} = useEventFilters(data, isOverdueDate);');
  assertFalse(screen.includes('filterEventGuests'));

  const stateNames = [
    'guestFilter',
    'guestSearch',
    'guestSort',
    'vendorSearch',
    'vendorSort',
    'budgetVendorFilter',
    'budgetStatusFilter',
    'documentSearch',
    'documentVendorFilter',
    'documentCategoryFilter',
    'documentReceiptFilterId',
    'taskView',
  ];
  stateNames.forEach((name) => assertFalse(screen.includes(`const [${name},`)));
});

Deno.test('useEventFilters owns only local React state and pure list projections', async () => {
  const hook = await read('features/events/useEventFilters.ts');

  assertStringIncludes(hook, "from './eventDetailsFilters';");
  assertEquals(
    ['filterEventGuests', 'filterEventVendors', 'filterEventExpenses', 'filterEventPayments', 'filterEventDocuments', 'filterEventTasks']
      .filter((helper) => hook.includes(helper)).length,
    6,
  );
  assert(/useState/.test(hook));
  assert(/useMemo/.test(hook));
  assertFalse(hook.includes("'@supabase/"));
  assertFalse(hook.includes("from 'expo"));
  assertFalse(hook.includes("from 'react-native"));
});
