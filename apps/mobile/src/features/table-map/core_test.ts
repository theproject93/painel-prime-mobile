import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import {
  buildInitialTablePositions,
  buildMapLines,
  buildOccupancy,
  clamp,
  fixtureLabel,
  parseFixtureRows,
  snap,
  toNumber,
} from './core.ts';
import { buildMapPdfHtml, escapeMapHtml } from './mapPdfExport.ts';

Deno.test('table map keeps numeric, grid and active-drag position contracts', () => {
  assertEquals(clamp(15, 0, 10), 10);
  assertEquals(snap(31), 40);
  assertEquals(toNumber('12.5'), 12.5);
  assertEquals(toNumber('invalid', 7), 7);
  assertEquals(buildInitialTablePositions(
    [{ id: 't1', name: 'Mesa', seats: 8, posx: 100, posy: 120 }],
    { t1: { x: 333, y: 444 } },
    new Set(['table:t1']),
  ), { t1: { x: 333, y: 444 } });
});

Deno.test('table map parses fixtures, labels and occupancy without changing payloads', () => {
  const [fixture] = parseFixtureRows([{ id: 9, type: 'bar', x: '20', y: 40, w: null, h: null, custom_label: 'Bar externo' }]);
  assertEquals(fixtureLabel(fixture), 'Bar externo');
  assertEquals(fixture.w, 0);
  assertEquals(buildOccupancy([
    { id: 'g1', table_id: 't1' },
    { id: 'g2', table_id: 't1' },
    { id: 'g3', table_id: null },
  ]).get('t1'), 2);
});

Deno.test('table map PDF escapes labels and event identifiers', () => {
  assertEquals(escapeMapHtml(`<mesa "A" & 'B'>`), '&lt;mesa &quot;A&quot; &amp; &#39;B&#39;&gt;');
  const html = buildMapPdfHtml('event<&>', 'base64', ['Mesa <principal> & apoio']);
  assertStringIncludes(html, 'event&lt;&amp;&gt;');
  assertStringIncludes(html, 'Mesa &lt;principal&gt; &amp; apoio');
  assert(!html.includes('Mesa <principal>'));
});

Deno.test('table map summary preserves tables, occupancy and fixtures', () => {
  const lines = buildMapLines(
    [{ id: 't1', name: 'Mesa 1', seats: 8 }],
    { t1: { x: 20, y: 40 } },
    new Map([['t1', 3]]),
    [{ id: 'f1', type: 'altar', x: 60, y: 80, w: 220, h: 90 }],
  );
  assertEquals(lines.includes('- Mesa 1 | 3/8 | x:20 y:40'), true);
  assertEquals(lines.includes('- Altar | altar | x:60 y:80'), true);
});
