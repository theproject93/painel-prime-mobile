import { assert, assertLessOrEqual } from 'jsr:@std/assert@1';

Deno.test('finance screen remains an orchestrator with focused mutation patches', async () => {
  const screen = await Deno.readTextFile(new URL('../../screens/FinanceScreen.tsx', import.meta.url));
  const modals = await Deno.readTextFile(new URL('./FinanceModals.tsx', import.meta.url));
  assertLessOrEqual(screen.split(/\r?\n/u).length, 450);
  assertLessOrEqual(modals.split(/\r?\n/u).length, 300);
  assert(!screen.includes('await data.reload()'));
  assert(!modals.includes('supabase'));
  assert(!modals.includes('expo-router'));
  assert(screen.includes('data.setEntries'));
  assert(screen.includes('data.setExpenses'));
  assert(screen.includes('data.setCategories'));
});
