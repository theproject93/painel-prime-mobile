import { assertEquals } from 'jsr:@std/assert';

import {
  guestStatusLabel,
  priorityLabel,
  summarizeTasks,
  vendorStatusLabel,
} from './eventWorkspaceUtils.ts';

Deno.test('summarizeTasks separates pending, overdue and completed work', () => {
  const summary = summarizeTasks([
    { completed: false, due_date: '2026-07-10' },
    { completed: false, due_date: '2026-07-20' },
    { completed: true, due_date: '2026-07-01' },
  ], new Date('2026-07-12T12:00:00Z'));

  assertEquals(summary, { total: 3, pending: 2, overdue: 1, completed: 1 });
});

Deno.test('workspace labels translate technical states into assessor language', () => {
  assertEquals(priorityLabel('urgent'), 'Urgente');
  assertEquals(guestStatusLabel('declined'), 'Não vai');
  assertEquals(vendorStatusLabel('paid'), 'Pago');
  assertEquals(vendorStatusLabel(null), 'A confirmar');
});
