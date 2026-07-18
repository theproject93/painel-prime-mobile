import { assert, assertFalse } from 'jsr:@std/assert@1';

const tabsUrl = new URL('./tabs/', import.meta.url);
const tabFiles = [
  'NotesTab.tsx',
  'TeamTab.tsx',
  'TablesTab.tsx',
  'InvitesTab.tsx',
  'ReceptionTab.tsx',
  'ClientPortalTab.tsx',
  'PresentsTab.tsx',
  'AnalyticsTab.tsx',
];

Deno.test('simple event tabs stay presentational and individually bounded', async () => {
  for (const file of tabFiles) {
    const source = await Deno.readTextFile(new URL(file, tabsUrl));
    const lineCount = source.split(/\r?\n/).length;

    assert(lineCount <= 300, `${file} has ${lineCount} lines; tab budget is 300`);
    assertFalse(source.includes("from '../../../lib/supabase'"), `${file} imports Supabase`);
    assertFalse(source.includes('supabase.'), `${file} accesses Supabase directly`);
  }

  const facade = await Deno.readTextFile(new URL('SimpleEventTabs.tsx', tabsUrl));
  for (const tab of ['NotesTab', 'TeamTab', 'TablesTab', 'InvitesTab', 'ReceptionTab', 'ClientPortalTab', 'PresentsTab', 'AnalyticsTab']) {
    assert(facade.includes(`<${tab}`), `${tab} is not rendered by the simple-tabs facade`);
  }
  assertFalse(facade.includes('supabase.'));
});
