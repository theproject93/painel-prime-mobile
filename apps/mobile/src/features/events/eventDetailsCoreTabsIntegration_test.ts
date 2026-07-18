import { assert, assertFalse } from 'jsr:@std/assert@1';

const tabsUrl = new URL('./tabs/', import.meta.url);
const tabFiles = ['OverviewTab.tsx', 'CommandTab.tsx', 'HistoryTab.tsx'];

Deno.test('core event tabs stay presentational and bounded', async () => {
  for (const file of tabFiles) {
    const source = await Deno.readTextFile(new URL(file, tabsUrl));
    const lineCount = source.split(/\r?\n/).length;
    assert(lineCount <= 300, `${file} has ${lineCount} lines; tab budget is 300`);
    assertFalse(source.includes('supabase.'), `${file} accesses Supabase directly`);
  }

  const facade = await Deno.readTextFile(new URL('CoreEventTabs.tsx', tabsUrl));
  for (const tab of ['OverviewTab', 'CommandTab', 'HistoryTab']) {
    assert(facade.includes(`<${tab}`), `${tab} is not rendered by the core facade`);
  }
  assertFalse(facade.includes('supabase.'));
});
