import { assertEquals } from 'jsr:@std/assert@1';

import { EVENT_MODULES, isEventDetailsInitialTab } from './eventRouteTypes.ts';

Deno.test('essential event areas are shown first in advisor-friendly order', () => {
  assertEquals(
    EVENT_MODULES.filter((module) => module.group === 'essential').map((module) => module.key),
    ['overview', 'tasks', 'guests', 'meetings', 'vendors', 'documents'],
  );
  assertEquals(EVENT_MODULES.some((module) => module.key === ('command' as never)), false);
});

Deno.test('invalid route values fall back through the public guard', () => {
  assertEquals(isEventDetailsInitialTab('overview'), true);
  assertEquals(isEventDetailsInitialTab('command'), false);
  assertEquals(isEventDetailsInitialTab('anything'), false);
});
