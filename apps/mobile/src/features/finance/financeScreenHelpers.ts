import type { FinanceEntry, FinanceExpense, FinanceStatus, MovementKind } from './types';

export const SETTLED_STATUSES = new Set<FinanceStatus>(['confirmado', 'pago', 'parcelado']);
export function toBRL(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
export function displayDate(value: string | null | undefined) {
  if (!value) return 'Sem data definida';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Sem data definida' : date.toLocaleDateString('pt-BR');
}
export function friendlyFinanceError() {
  return 'Não foi possível concluir agora. Confira sua conexão e tente novamente.';
}
export function settledTotal(rows: Array<{ amount: number; status: FinanceStatus }>) {
  return rows.filter((row) => SETTLED_STATUSES.has(row.status)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
}
export function filterMovements(
  entries: FinanceEntry[], expenses: FinanceExpense[], kind: MovementKind, search: string,
) {
  const term = search.trim().toLowerCase();
  return (kind === 'entrada' ? entries : expenses).filter((row) => {
    if (!term) return true;
    const context = 'client_name' in row ? row.client_name : row.category_label;
    return `${row.title} ${context ?? ''}`.toLowerCase().includes(term);
  });
}
export function normalizeExpenseRow(row: FinanceExpense & { user_finance_categories?: unknown }) {
  return {
    ...row,
    user_finance_categories: Array.isArray(row.user_finance_categories)
      ? row.user_finance_categories[0] ?? null
      : row.user_finance_categories ?? null,
  } as FinanceExpense;
}
