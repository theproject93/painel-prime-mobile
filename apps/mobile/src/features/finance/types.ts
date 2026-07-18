export type FinanceStatus = 'pendente' | 'confirmado' | 'pago' | 'parcelado' | 'previsto';
export type MovementKind = 'entrada' | 'despesa';
export type FinanceEntry = {
  id: string; user_id: string; client_name: string | null; title: string; amount: number;
  status: FinanceStatus; received_at: string | null; expected_at: string | null;
  payment_method: string | null; proof_file_id: string | null; proof_url: string | null;
  notes: string | null; created_at?: string | null;
};
export type FinanceExpense = {
  id: string; user_id: string; title: string; amount: number; status: FinanceStatus;
  paid_at: string | null; expected_at: string | null; category_id: string | null;
  category_label: string | null; team_member_name: string | null; payment_method: string | null;
  proof_file_id: string | null; proof_url: string | null; notes: string | null; created_at?: string | null;
  user_finance_categories?: { name: string; color: string | null } | null;
};
export type FinanceCategory = { id: string; user_id: string; name: string; type: 'entrada' | 'saida'; color: string | null };
export type EntryForm = { title: string; client_name: string; amount: string; status: FinanceStatus; date: string; payment_method: string; notes: string };
export type ExpenseForm = { title: string; amount: string; status: FinanceStatus; date: string; category_id: string; team_member_name: string; payment_method: string; notes: string };
