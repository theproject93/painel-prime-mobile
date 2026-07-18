import { assert, assertLessOrEqual } from 'jsr:@std/assert@1';

const componentPath = new URL('../../components/PlanAssistantFloating.tsx', import.meta.url);

Deno.test('Plan assistant container stays an orchestrator without background polling', async () => {
  const source = await Deno.readTextFile(componentPath);
  const hintsSource = await Deno.readTextFile(
    new URL('../plan-assistant/usePlanAssistantHints.ts', import.meta.url),
  );
  const lineCount = source.split(/\r?\n/u).length;

  assertLessOrEqual(lineCount, 500);
  assert(!source.includes('setInterval('));
  assert(!hintsSource.includes('setInterval('));
  assert(!hintsSource.includes('currentPath'));
  assert(hintsSource.includes("AppState.currentState !== 'active'"));
});
