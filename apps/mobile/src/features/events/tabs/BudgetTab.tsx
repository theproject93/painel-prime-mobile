import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MoneyField, PrivacyToggle } from '../../../components/ui/PremiumInputs';
import { EventEmptyState, EventFilterChips, EventFormSheet, EventListCard, EventModuleShell, EventSectionTitle } from '../EventWorkspace';
import { styles } from '../eventDetailsStyles';
import { brl, fmt, parsePaymentNote } from '../eventDetailsUtils';
import { vendorStatusLabel } from '../eventWorkspaceUtils';
import type { PaymentMethod } from '../eventDetailsTypes';
import { colors } from '../../../theme/colors';

export type BudgetTabModel = {
  budgetTotal: number; totalExpenses: number; hidden: boolean; personaDescription: string; vendors: any[];
  expenses: any[]; payments: any[]; vendorFilter: string; statusFilter: string; vendorInput: string;
  composerOpen: boolean; draftName: string; draftValue: string; paymentExpenseId: string | null;
  paymentMethod: PaymentMethod; paymentNote: string;
  onTogglePrivacy: () => void; onVendorFilterClear: () => void; onStatusFilterChange: (value: string) => void;
  onOpenComposer: () => void; onCloseComposer: () => void; onDraftNameChange: (value: string) => void;
  onDraftValueChange: (value: string) => void; onVendorInputChange: (value: string) => void; onCreateExpense: () => void;
  onOpenPayment: (expenseId: string) => void; onClosePayment: () => void; onPaymentMethodChange: (value: string) => void;
  onPaymentNoteChange: (value: string) => void; onCreatePayment: () => void; onAdvanceExpense: (expense: any) => void;
  onDeleteExpense: (expenseId: string) => void; onDeletePayment: (paymentId: string) => void; onOpenReceipt: (documentId: string) => void;
};

export function BudgetTab({ model }: { model: BudgetTabModel }) {
  const m = model;
  return (
    <EventModuleShell title="Orçamento do evento" description="Despesas e pagamentos ligados a este evento." icon="wallet-outline"
      metrics={[
        { label: 'Orçamento disponível', value: m.hidden ? 'R$ ••••••' : brl(m.budgetTotal), tone: 'gold' },
        { label: 'Investido', value: m.hidden ? 'R$ ••••••' : brl(m.totalExpenses), tone: 'neutral' },
        { label: 'Ainda disponível', value: m.hidden ? 'R$ ••••••' : brl(m.budgetTotal - m.totalExpenses), tone: m.budgetTotal - m.totalExpenses < 0 ? 'danger' : 'success' },
      ]} actionLabel="Nova despesa" onAction={m.onOpenComposer}>
      <View style={styles.financePrivacyRow}><View style={styles.formGrow}><Text style={styles.subtitle}>Dinheiro do evento</Text><Text style={styles.caption}>{m.personaDescription}</Text></View><PrivacyToggle hidden={m.hidden} onPress={m.onTogglePrivacy} /></View>
      {m.vendorFilter ? <Pressable style={styles.activeFilter} onPress={m.onVendorFilterClear}><Text style={styles.activeFilterText}>Fornecedor: {m.vendors.find((vendor) => String(vendor.id) === m.vendorFilter)?.name ?? 'selecionado'}</Text><Ionicons name="close" size={16} color={colors.gold700} /></Pressable> : null}
      <EventFilterChips selected={m.statusFilter} onSelect={m.onStatusFilterChange} options={[{ value: 'all', label: 'Todas' }, { value: 'pending', label: 'Pendentes' }, { value: 'confirmed', label: 'Confirmadas' }, { value: 'paid', label: 'Pagas' }, { value: 'cancelled', label: 'Canceladas' }]} />
      <EventSectionTitle title="Despesas" />
      {m.expenses.length === 0 ? <EventEmptyState icon="wallet-outline" title="Nenhuma despesa neste filtro" description="Adicione um custo do evento para começar o acompanhamento." actionLabel="Adicionar despesa" onAction={m.onOpenComposer} /> : null}
      {m.expenses.map((expense) => <EventListCard key={expense.id} title={String(expense.name ?? 'Despesa')} subtitle={m.vendors.find((vendor) => String(vendor.id) === String(expense.vendor_id))?.name || 'Sem fornecedor vinculado'} status={brl(Number(expense.value ?? 0))} statusTone={expense.status === 'paid' ? 'success' : expense.status === 'cancelled' ? 'danger' : 'gold'} meta={[vendorStatusLabel(expense.status)]} actions={[
        { label: 'Registrar pagamento', icon: 'card-outline', onPress: () => m.onOpenPayment(String(expense.id)) },
        { label: expense.status === 'confirmed' ? 'Marcar paga' : 'Confirmar', icon: 'checkmark-outline', onPress: () => m.onAdvanceExpense(expense) },
        { label: 'Excluir', icon: 'trash-outline', tone: 'danger', onPress: () => m.onDeleteExpense(String(expense.id)) },
      ]} />)}
      <EventSectionTitle title="Pagamentos registrados" />
      {m.payments.map((payment) => <EventListCard key={payment.id} title={brl(Number(payment.amount ?? 0))} subtitle={`${fmt(payment.paid_at)} • ${String(payment.method ?? 'outro').toUpperCase()}`} status="Pago" statusTone="success" actions={[
        { label: 'Ver recibo', icon: 'receipt-outline', onPress: () => { const id = parsePaymentNote(payment.note).meta.receipt_document_id; if (id) m.onOpenReceipt(id); } },
        { label: 'Excluir', icon: 'trash-outline', tone: 'danger', onPress: () => m.onDeletePayment(String(payment.id)) },
      ]} />)}
      <EventFormSheet visible={m.composerOpen} title="Nova despesa" subtitle="Vincule ao fornecedor quando fizer sentido." onClose={m.onCloseComposer}>
        <Text style={styles.formLabel}>Descrição</Text><TextInput style={styles.input} value={m.draftName} onChangeText={m.onDraftNameChange} placeholder="Ex.: Buffet" />
        <Text style={styles.formLabel}>Valor</Text><MoneyField value={m.draftValue} onChangeValue={m.onDraftValueChange} />
        {m.vendors.length ? <><Text style={styles.formLabel}>Fornecedor (opcional)</Text><EventFilterChips selected={m.vendorInput} onSelect={m.onVendorInputChange} options={[{ value: '', label: 'Sem vínculo' }, ...m.vendors.map((vendor) => ({ value: String(vendor.id), label: String(vendor.name) }))]} /></> : null}
        <Pressable style={styles.btn} onPress={m.onCreateExpense}><Text style={styles.btnText}>Adicionar despesa</Text></Pressable>
      </EventFormSheet>
      <EventFormSheet visible={Boolean(m.paymentExpenseId)} title="Registrar pagamento" subtitle={m.expenses.find((expense) => String(expense.id) === m.paymentExpenseId)?.name} onClose={m.onClosePayment}>
        <Text style={styles.formLabel}>Forma de pagamento</Text><EventFilterChips selected={m.paymentMethod} onSelect={m.onPaymentMethodChange} options={[{ value: 'pix', label: 'Pix' }, { value: 'dinheiro', label: 'Dinheiro' }, { value: 'credito', label: 'Crédito' }, { value: 'debito', label: 'Débito' }, { value: 'transferencia', label: 'Transferência' }]} />
        <Text style={styles.formLabel}>Observação (opcional)</Text><TextInput style={styles.input} value={m.paymentNote} onChangeText={m.onPaymentNoteChange} placeholder="Detalhes do pagamento" />
        <Pressable style={styles.btn} onPress={m.onCreatePayment}><Text style={styles.btnText}>Confirmar pagamento</Text></Pressable>
      </EventFormSheet>
    </EventModuleShell>
  );
}
