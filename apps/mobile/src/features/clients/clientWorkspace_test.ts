import { assertEquals } from 'jsr:@std/assert@1';

import {
  normalizePapermarkInsights,
  safeExternalHttpUrl,
} from './clientWorkspace.ts';

Deno.test('normalizes Papermark metrics for a human commercial dashboard', () => {
  const result = normalizePapermarkInsights({
    totalViews: 7,
    totalDurationSeconds: 245,
    lastViewedAt: '2026-07-13T20:00:00.000Z',
    lastViewerEmail: 'cliente@example.com',
    recentViews: [{ viewedAt: '2026-07-13T20:00:00.000Z', viewerEmail: 'cliente@example.com', durationSeconds: 90 }],
    topPages: [{ pageNumber: 3, views: 4, durationSeconds: 120 }],
  }, 82);

  assertEquals(result.totalViews, 7);
  assertEquals(result.totalDurationSeconds, 245);
  assertEquals(result.score, 82);
  assertEquals(result.recentViews[0]?.viewerEmail, 'cliente@example.com');
  assertEquals(result.topPages[0]?.pageNumber, 3);
});

Deno.test('Papermark dashboard clamps unsafe values and external links', () => {
  const result = normalizePapermarkInsights({ totalViews: -4, totalDurationSeconds: 'bad' }, 500);
  assertEquals(result.totalViews, 0);
  assertEquals(result.totalDurationSeconds, 0);
  assertEquals(result.score, 100);
  assertEquals(safeExternalHttpUrl('javascript:alert(1)'), null);
  assertEquals(safeExternalHttpUrl('https://papermark.example/doc'), 'https://papermark.example/doc');
});
