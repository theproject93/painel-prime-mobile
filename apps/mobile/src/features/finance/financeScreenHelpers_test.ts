import { assertEquals } from 'jsr:@std/assert@1';
import { displayDate, filterMovements, normalizeExpenseRow, settledTotal } from './financeScreenHelpers.ts';
import type { FinanceEntry, FinanceExpense } from './types.ts';

const entry = { id: 'e1', title: 'Sinal', client_name: 'Ana', amount: 100, status: 'confirmado' } as FinanceEntry;
const expense = { id: 'x1', title: 'Flores', category_label: 'Decoração', amount: 40, status: 'previsto' } as FinanceExpense;

Deno.test('finance totals only include settled statuses', () => {
  assertEquals(settledTotal([entry, expense]), 100);
});
Deno.test('finance filters preserve title and context matching', () => {
  assertEquals(filterMovements([entry], [expense], 'entrada', 'ana'), [entry]);
  assertEquals(filterMovements([entry], [expense], 'despesa', 'decoração'), [expense]);
});

Deno.test('finance expense relation and date presentation stay normalized', () => {
  assertEquals(normalizeExpenseRow({ ...expense, user_finance_categories: [{ name: 'Festa', color: null }] } as never).user_finance_categories, { name: 'Festa', color: null });
  assertEquals(displayDate(null), 'Sem data definida');
});
