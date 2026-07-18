import { assert, assertEquals, assertLessOrEqual } from 'jsr:@std/assert@1';

Deno.test('table map container delegates gestures and PDF export', async () => {
  const source = await Deno.readTextFile(
    new URL('../../components/EventTablesVisualMap.tsx', import.meta.url),
  );
  const dragSource = await Deno.readTextFile(new URL('./useMapDrag.ts', import.meta.url));
  const surfaceSource = await Deno.readTextFile(new URL('./TableMapSurface.tsx', import.meta.url));
  const modalSource = await Deno.readTextFile(new URL('./MapFullscreenModal.tsx', import.meta.url));
  assertLessOrEqual(source.split(/\r?\n/u).length, 450);
  assertLessOrEqual(surfaceSource.split(/\r?\n/u).length, 300);
  assertLessOrEqual(modalSource.split(/\r?\n/u).length, 300);
  assert(!source.includes('PanResponder.create'));
  assert(!source.includes('Print.printToFileAsync'));
  assert(!source.includes('captureRef('));
  assert(dragSource.includes('requestAnimationFrame'));
  assertEquals((dragSource.match(/void persistTableRef\.current\(/g) ?? []).length, 1);
  assertEquals((dragSource.match(/void persistFixtureRef\.current\(/g) ?? []).length, 1);
});
