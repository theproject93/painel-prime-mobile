import { assert, assertFalse } from 'jsr:@std/assert@1';

const tabsUrl = new URL('./tabs/', import.meta.url);
const tabFiles = ['TasksTab.tsx', 'BudgetTab.tsx', 'GuestsTab.tsx', 'TimelineTab.tsx', 'VendorsTab.tsx', 'DocumentsTab.tsx'];

Deno.test('operational event tabs stay presentational and individually bounded', async () => {
  for (const file of tabFiles) {
    const source = await Deno.readTextFile(new URL(file, tabsUrl));
    const lineCount = source.split(/\r?\n/).length;
    assert(lineCount <= 300, `${file} has ${lineCount} lines; tab budget is 300`);
    assertFalse(source.includes('supabase.'), `${file} accesses Supabase directly`);
  }

  const facade = await Deno.readTextFile(new URL('OperationalEventTabs.tsx', tabsUrl));
  for (const tab of ['TasksTab', 'BudgetTab', 'GuestsTab', 'TimelineTab', 'VendorsTab', 'DocumentsTab']) {
    assert(facade.includes(`<${tab}`), `${tab} is not rendered by the operational facade`);
  }
  assertFalse(facade.includes('supabase.'));
});
