import { assertEquals } from 'jsr:@std/assert';
import { analyticsPresentation, fallbackAnalytics } from './analyticsModel.ts';
Deno.test('analytics fallback computes both datasets once', () => { const result = fallbackAnalytics([{ id: '1', stage: 'conhecendo_cliente', budget_expected: 1000 }, { id: '2', stage: 'cliente_fechado', budget_expected: 2000 }]); assertEquals(result.funnel.total, 2); assertEquals(result.forecast.map(({ weighted_value }) => weighted_value), [100, 2000]); assertEquals(analyticsPresentation(result.funnel, result.forecast).conversionLeadToClosed, '100.0'); });
