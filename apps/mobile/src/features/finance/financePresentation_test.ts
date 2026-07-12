import { assertEquals } from 'jsr:@std/assert@1';

import {
  classifyCashForecast,
  parseBRLInput,
  shouldShowEmptyAnalytics,
} from './financePresentation.ts';

Deno.test('parseBRLInput accepts Brazilian thousand and decimal separators', () => {
  assertEquals(parseBRLInput('1.000,50'), 1000.5);
  assertEquals(parseBRLInput('89,90'), 89.9);
});

Deno.test('cash forecast never calls zero movement positive', () => {
  assertEquals(classifyCashForecast(0, 0), 'empty');
  assertEquals(classifyCashForecast(100, 100), 'neutral');
  assertEquals(classifyCashForecast(101, 100), 'positive');
  assertEquals(classifyCashForecast(100, 101), 'negative');
});

Deno.test('analytics stays empty until there is a real movement', () => {
  assertEquals(shouldShowEmptyAnalytics(0, 0), true);
  assertEquals(shouldShowEmptyAnalytics(150, 0), false);
  assertEquals(shouldShowEmptyAnalytics(0, 50), false);
});
