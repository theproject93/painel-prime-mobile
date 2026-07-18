import { Ionicons } from '@expo/vector-icons';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { colors, spacing } from '../../theme/colors';
import { AttachmentButton, FinanceField, StatusChoice } from './FinanceFormControls';
import { financeStyles as styles } from './financeScreenStyles';
import type { EntryForm, ExpenseForm, FinanceCategory, MovementKind } from './types';

type Props = {
  bottomInset: number; tab: MovementKind; setTab: (kind: MovementKind) => void;
  movementOpen: boolean; setMovementOpen: (open: boolean) => void;
  categoriesOpen: boolean; setCategoriesOpen: (open: boolean) => void;
  onboardingOpen: boolean; saving: boolean;
  entryForm: EntryForm; setEntryForm: React.Dispatch<React.SetStateAction<EntryForm>>;
  expenseForm: ExpenseForm; setExpenseForm: React.Dispatch<React.SetStateAction<ExpenseForm>>;
  entryProof: DocumentPickerAsset | null; expenseProof: DocumentPickerAsset | null;
  categories: FinanceCategory[]; newCategoryName: string; setNewCategoryName: (value: string) => void;
  newCategoryType: 'entrada' | 'saida'; setNewCategoryType: (value: 'entrada' | 'saida') => void;
  cashInput: string; setCashInput: (value: string) => void;
  onPickProof: (kind: 'entry' | 'expense') => void; onSaveMovement: () => void;
  onCreateCategory: () => void; onSaveOnboarding: () => void;
};

export function FinanceModals(props: Props) {
  const sheetBottom = Math.max(props.bottomInset, spacing.lg);
  const expenseCategories = props.categories.filter((row) => row.type === 'saida');
  return <>
    <Modal visible={props.movementOpen} transparent animationType="slide" onRequestClose={() => props.setMovementOpen(false)}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.modalDismissArea} onPress={() => props.setMovementOpen(false)} accessibilityLabel="Fechar" />
        <View style={[styles.sheet, { paddingBottom: sheetBottom }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>Novo lançamento</Text><Text style={styles.sheetSubtitle}>Movimento do caixa da sua assessoria</Text></View><Pressable hitSlop={10} onPress={() => props.setMovementOpen(false)} accessibilityLabel="Fechar lançamento"><Ionicons name="close" size={26} color={colors.textSecondary} /></Pressable></View>
          <View style={styles.segmented}>{(['entrada', 'despesa'] as MovementKind[]).map((kind) => <Pressable key={kind} style={[styles.segment, props.tab === kind && styles.segmentActive]} onPress={() => props.setTab(kind)}><Text style={[styles.segmentText, props.tab === kind && styles.segmentTextActive]}>{kind === 'entrada' ? 'Entrada' : 'Despesa'}</Text></Pressable>)}</View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
            {props.tab === 'entrada' ? <>
              <FinanceField label="Descrição" value={props.entryForm.title} onChangeText={(value) => props.setEntryForm((current) => ({ ...current, title: value }))} placeholder="Ex.: Sinal do casamento" />
              <FinanceField label="Cliente (opcional)" value={props.entryForm.client_name} onChangeText={(value) => props.setEntryForm((current) => ({ ...current, client_name: value }))} placeholder="Nome do cliente" />
              <FinanceField label="Valor" value={props.entryForm.amount} onChangeText={(value) => props.setEntryForm((current) => ({ ...current, amount: value }))} placeholder="R$ 0,00" keyboardType="decimal-pad" />
              <StatusChoice first="Recebida" second="Prevista" selected={props.entryForm.status === 'previsto' ? 'second' : 'first'} onSelect={(choice) => props.setEntryForm((current) => ({ ...current, status: choice === 'first' ? 'confirmado' : 'previsto' }))} />
              <FinanceField label={props.entryForm.status === 'previsto' ? 'Data prevista' : 'Data do recebimento'} value={props.entryForm.date} onChangeText={(value) => props.setEntryForm((current) => ({ ...current, date: value }))} placeholder="AAAA-MM-DD" />
              <FinanceField label="Forma de pagamento (opcional)" value={props.entryForm.payment_method} onChangeText={(value) => props.setEntryForm((current) => ({ ...current, payment_method: value }))} placeholder="PIX, cartão, transferência..." />
              <FinanceField label="Observação (opcional)" value={props.entryForm.notes} onChangeText={(value) => props.setEntryForm((current) => ({ ...current, notes: value }))} placeholder="Informações importantes" multiline />
              <AttachmentButton asset={props.entryProof} onPress={() => props.onPickProof('entry')} />
            </> : <>
              <FinanceField label="Descrição" value={props.expenseForm.title} onChangeText={(value) => props.setExpenseForm((current) => ({ ...current, title: value }))} placeholder="Ex.: Material de escritório" />
              <FinanceField label="Valor" value={props.expenseForm.amount} onChangeText={(value) => props.setExpenseForm((current) => ({ ...current, amount: value }))} placeholder="R$ 0,00" keyboardType="decimal-pad" />
              <StatusChoice first="Paga" second="Prevista" selected={props.expenseForm.status === 'previsto' ? 'second' : 'first'} onSelect={(choice) => props.setExpenseForm((current) => ({ ...current, status: choice === 'first' ? 'pago' : 'previsto' }))} />
              <FinanceField label={props.expenseForm.status === 'previsto' ? 'Data prevista' : 'Data do pagamento'} value={props.expenseForm.date} onChangeText={(value) => props.setExpenseForm((current) => ({ ...current, date: value }))} placeholder="AAAA-MM-DD" />
              {expenseCategories.length ? <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>Categoria (opcional)</Text><View style={styles.chips}>{expenseCategories.map((category) => <Pressable key={category.id} style={[styles.chip, props.expenseForm.category_id === category.id && styles.chipActive]} onPress={() => props.setExpenseForm((current) => ({ ...current, category_id: category.id }))}><Text style={[styles.chipText, props.expenseForm.category_id === category.id && styles.chipTextActive]}>{category.name}</Text></Pressable>)}</View></View> : null}
              <FinanceField label="Responsável (opcional)" value={props.expenseForm.team_member_name} onChangeText={(value) => props.setExpenseForm((current) => ({ ...current, team_member_name: value }))} placeholder="Quem realizou o pagamento" />
              <FinanceField label="Forma de pagamento (opcional)" value={props.expenseForm.payment_method} onChangeText={(value) => props.setExpenseForm((current) => ({ ...current, payment_method: value }))} placeholder="PIX, cartão, transferência..." />
              <FinanceField label="Observação (opcional)" value={props.expenseForm.notes} onChangeText={(value) => props.setExpenseForm((current) => ({ ...current, notes: value }))} placeholder="Informações importantes" multiline />
              <AttachmentButton asset={props.expenseProof} onPress={() => props.onPickProof('expense')} />
            </>}
            <Pressable style={[styles.saveButton, props.saving && styles.disabled]} disabled={props.saving} onPress={props.onSaveMovement}>{props.saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Salvar {props.tab}</Text>}</Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <Modal visible={props.categoriesOpen} transparent animationType="slide" onRequestClose={() => props.setCategoriesOpen(false)}><KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><Pressable style={styles.modalDismissArea} onPress={() => props.setCategoriesOpen(false)} /><View style={[styles.sheet, styles.categorySheet, { paddingBottom: sheetBottom }]}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>Categorias</Text><Text style={styles.sheetSubtitle}>Organize seus lançamentos</Text></View><Pressable hitSlop={10} onPress={() => props.setCategoriesOpen(false)}><Ionicons name="close" size={26} color={colors.textSecondary} /></Pressable></View><FinanceField label="Nova categoria" value={props.newCategoryName} onChangeText={props.setNewCategoryName} placeholder="Ex.: Transporte" /><View style={styles.segmented}>{(['entrada', 'saida'] as const).map((type) => <Pressable key={type} style={[styles.segment, props.newCategoryType === type && styles.segmentActive]} onPress={() => props.setNewCategoryType(type)}><Text style={[styles.segmentText, props.newCategoryType === type && styles.segmentTextActive]}>{type === 'entrada' ? 'Entrada' : 'Despesa'}</Text></Pressable>)}</View><Pressable style={styles.saveButton} onPress={props.onCreateCategory}><Text style={styles.saveButtonText}>Adicionar categoria</Text></Pressable><ScrollView style={styles.categoryList}>{props.categories.map((category) => <View key={category.id} style={styles.categoryRow}><View style={[styles.categoryDot, { backgroundColor: category.color || colors.gold600 }]} /><Text style={styles.categoryName}>{category.name}</Text><Text style={styles.categoryType}>{category.type === 'entrada' ? 'Entrada' : 'Despesa'}</Text></View>)}</ScrollView></View></KeyboardAvoidingView></Modal>

    <Modal visible={props.onboardingOpen} transparent animationType="fade"><View style={styles.onboardingBackdrop}><View style={styles.onboardingCard}><View style={styles.onboardingIcon}><Ionicons name="wallet-outline" size={30} color={colors.gold700} /></View><Text style={styles.sheetTitle}>Configure seu caixa</Text><Text style={styles.onboardingText}>Informe quanto sua assessoria tem disponível hoje. Você poderá lançar entradas e despesas em seguida.</Text><FinanceField label="Saldo inicial" value={props.cashInput} onChangeText={props.setCashInput} placeholder="R$ 0,00" keyboardType="decimal-pad" /><Pressable style={styles.saveButton} onPress={props.onSaveOnboarding}><Text style={styles.saveButtonText}>Começar meu caixa</Text></Pressable></View></View></Modal>
  </>;
}
