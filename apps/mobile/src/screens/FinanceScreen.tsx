import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '../components/ui/EmptyState';
import { GradientCard } from '../components/ui/GradientCard';
import { PrimeLogoLoader } from '../components/PrimeLogoLoader';
import { Screen } from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { CashDonut } from '../features/finance/CashDonut';
import { FinanceModals } from '../features/finance/FinanceModals';
import { displayDate, filterMovements, friendlyFinanceError, normalizeExpenseRow, SETTLED_STATUSES, settledTotal, toBRL } from '../features/finance/financeScreenHelpers';
import { financeStyles as styles } from '../features/finance/financeScreenStyles';
import type { EntryForm, ExpenseForm, FinanceCategory, FinanceEntry, FinanceExpense, FinanceStatus, MovementKind } from '../features/finance/types';
import { useFinanceData } from '../features/finance/useFinanceData';
import { parseBRLInput, shouldShowEmptyAnalytics } from '../features/finance/financePresentation';
import { deleteStoredFile, getPrivateFileDownloadUrl, linkStoredFile, uploadPrivateAsset } from '../lib/r2FileStorage';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

const EMPTY_ENTRY: EntryForm = { title: '', client_name: '', amount: '', status: 'confirmado', date: '', payment_method: '', notes: '' };
const EMPTY_EXPENSE: ExpenseForm = { title: '', amount: '', status: 'pago', date: '', category_id: '', team_member_name: '', payment_method: '', notes: '' };
const ENTRY_COLUMNS = 'id,user_id,client_name,title,amount,status,received_at,expected_at,payment_method,proof_file_id,proof_url,notes,created_at';
const EXPENSE_COLUMNS = 'id,user_id,title,amount,status,paid_at,expected_at,category_id,category_label,team_member_name,payment_method,proof_file_id,proof_url,notes,created_at,user_finance_categories(name,color)';

export function FinanceScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const data = useFinanceData(user?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<MovementKind>('despesa');
  const [search, setSearch] = useState('');
  const [movementOpen, setMovementOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [entryForm, setEntryForm] = useState<EntryForm>(EMPTY_ENTRY);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(EMPTY_EXPENSE);
  const [entryProof, setEntryProof] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [expenseProof, setExpenseProof] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'entrada' | 'saida'>('saida');
  const [openingProofId, setOpeningProofId] = useState<string | null>(null);

  const settledEntries = useMemo(() => settledTotal(data.entries), [data.entries]);
  const settledExpenses = useMemo(() => settledTotal(data.expenses), [data.expenses]);
  const balance = data.baseBalance + settledEntries - settledExpenses;
  const listData = useMemo(
    () => filterMovements(data.entries, data.expenses, tab, search),
    [data.entries, data.expenses, search, tab],
  );

  async function saveOnboardingCash() {
    if (!user) return;
    const value = parseBRLInput(data.cashInput);
    const [balanceResult, onboardingResult] = await Promise.all([
      supabase.from('user_finance_balance').upsert({ user_id: user.id, base_balance: value, updated_at: new Date().toISOString() }),
      supabase.from('user_finance_onboarding').upsert({ user_id: user.id, completed_at: new Date().toISOString() }),
    ]);
    if (balanceResult.error || onboardingResult.error) { data.setError(friendlyFinanceError()); return; }
    data.setBaseBalance(value);
    data.setOnboardingOpen(false);
  }

  async function createCategory() {
    if (!user || !newCategoryName.trim()) return;
    const { data: created, error } = await supabase.from('user_finance_categories').insert({
      user_id: user.id, name: newCategoryName.trim(), type: newCategoryType, color: colors.gold600,
    }).select('id,user_id,name,type,color').maybeSingle();
    if (error || !created) { data.setError(friendlyFinanceError()); return; }
    data.setCategories((current) => [...current, created as FinanceCategory]);
    setNewCategoryName('');
  }

  async function pickProof(kind: 'entry' | 'expense') {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: ['application/pdf', 'image/*'] });
    if (result.canceled || !result.assets[0]) return;
    if (kind === 'entry') setEntryProof(result.assets[0]); else setExpenseProof(result.assets[0]);
  }

  async function uploadProof(asset: DocumentPicker.DocumentPickerAsset, kind: 'entries' | 'expenses') {
    const safeName = (asset.name || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_') || 'arquivo';
    return uploadPrivateAsset({
      uri: asset.uri, fileName: safeName, contentType: asset.mimeType || 'application/octet-stream',
      byteSize: asset.size ?? null, entityType: kind === 'entries' ? 'finance_entry_proof' : 'finance_expense_proof',
    });
  }

  async function createEntry() {
    if (!user || saving || !entryForm.title.trim() || parseBRLInput(entryForm.amount) <= 0) return;
    setSaving(true);
    let proofFileId: string | null = null;
    try {
      proofFileId = entryProof ? (await uploadProof(entryProof, 'entries')).fileId : null;
      const planned = entryForm.status === 'previsto';
      const { data: created, error } = await supabase.from('user_finance_entries').insert({
        user_id: user.id, title: entryForm.title.trim(), client_name: entryForm.client_name.trim() || null,
        amount: parseBRLInput(entryForm.amount), status: entryForm.status,
        received_at: planned ? null : entryForm.date || null, expected_at: planned ? entryForm.date || null : null,
        payment_method: entryForm.payment_method.trim() || null, notes: entryForm.notes.trim() || null,
        proof_url: null, proof_file_id: proofFileId,
      }).select(ENTRY_COLUMNS).maybeSingle();
      if (error || !created) throw error ?? new Error('missing_entry');
      if (proofFileId) void linkStoredFile(proofFileId, created.id).catch(() => undefined);
      data.setEntries((current) => [created as FinanceEntry, ...current]);
      setEntryForm(EMPTY_ENTRY); setEntryProof(null); setMovementOpen(false);
    } catch { if (proofFileId) void deleteStoredFile(proofFileId).catch(() => undefined); data.setError(friendlyFinanceError()); }
    finally { setSaving(false); }
  }

  async function createExpense() {
    if (!user || saving || !expenseForm.title.trim() || parseBRLInput(expenseForm.amount) <= 0) return;
    setSaving(true);
    let proofFileId: string | null = null;
    try {
      proofFileId = expenseProof ? (await uploadProof(expenseProof, 'expenses')).fileId : null;
      const planned = expenseForm.status === 'previsto';
      const category = data.categories.find((item) => item.id === expenseForm.category_id);
      const { data: created, error } = await supabase.from('user_finance_expenses').insert({
        user_id: user.id, title: expenseForm.title.trim(), amount: parseBRLInput(expenseForm.amount), status: expenseForm.status,
        paid_at: planned ? null : expenseForm.date || null, expected_at: planned ? expenseForm.date || null : null,
        category_id: expenseForm.category_id || null, category_label: category?.name ?? null,
        team_member_name: expenseForm.team_member_name.trim() || null, payment_method: expenseForm.payment_method.trim() || null,
        notes: expenseForm.notes.trim() || null, proof_url: null, proof_file_id: proofFileId,
      }).select(EXPENSE_COLUMNS).maybeSingle();
      if (error || !created) throw error ?? new Error('missing_expense');
      if (proofFileId) void linkStoredFile(proofFileId, created.id).catch(() => undefined);
      data.setExpenses((current) => [normalizeExpenseRow(created as unknown as FinanceExpense), ...current]);
      setExpenseForm(EMPTY_EXPENSE); setExpenseProof(null); setMovementOpen(false);
    } catch { if (proofFileId) void deleteStoredFile(proofFileId).catch(() => undefined); data.setError(friendlyFinanceError()); }
    finally { setSaving(false); }
  }

  async function openProof(fileId: string | null, proofUrl: string | null, id: string) {
    setOpeningProofId(id);
    try {
      if (fileId) { await Linking.openURL(await getPrivateFileDownloadUrl(fileId)); return; }
      if (!proofUrl) throw new Error('missing_proof');
      if (proofUrl.startsWith('http')) {
        const path = new URL(proofUrl).pathname.split('/finance-proofs/')[1];
        if (!path) { await Linking.openURL(proofUrl); return; }
        proofUrl = path;
      }
      const { data: signed, error } = await supabase.storage.from('finance-proofs').createSignedUrl(proofUrl, 300);
      if (error || !signed?.signedUrl) throw error ?? new Error('missing_url');
      await Linking.openURL(signed.signedUrl);
    } catch { data.setError('Não foi possível abrir o comprovante.'); }
    finally { setOpeningProofId(null); }
  }

  if (data.loading) return <PrimeLogoLoader label="Organizando seu caixa" />;
  const openMovement = (kind: MovementKind) => { setTab(kind); data.setError(''); setMovementOpen(true); };
  return <>
    <Screen title="Meu caixa" subtitle="Entradas e despesas da sua assessoria">
      {data.error ? <View style={styles.errorCard}><Ionicons name="alert-circle-outline" size={18} color={colors.dangerText} /><Text style={styles.errorText}>{data.error}</Text></View> : null}
      <GradientCard gradient="gold" gradientPosition="background" style={styles.hero}>
        <View style={styles.heroTop}><View><Text style={styles.heroEyebrow}>SALDO DA SUA ASSESSORIA</Text><Text style={styles.heroValue}>{toBRL(balance)}</Text></View><View style={styles.walletIcon}><Ionicons name="wallet" size={24} color={colors.ink950} /></View></View>
        <View style={styles.summaryRow}><View style={styles.summaryItem}><Ionicons name="arrow-down-circle" size={18} color={colors.success600} /><View><Text style={styles.summaryLabel}>Entradas</Text><Text style={styles.summaryValue}>{toBRL(settledEntries)}</Text></View></View><View style={styles.summaryDivider} /><View style={styles.summaryItem}><Ionicons name="arrow-up-circle" size={18} color={colors.dangerText} /><View><Text style={styles.summaryLabel}>Despesas</Text><Text style={styles.summaryValue}>{toBRL(settledExpenses)}</Text></View></View></View>
      </GradientCard>
      <View style={styles.actionsRow}><Pressable style={styles.primaryAction} onPress={() => openMovement(tab)}><Ionicons name="add" size={22} color="#FFFFFF" /><Text style={styles.primaryActionText}>Novo lançamento</Text></Pressable><Pressable style={styles.secondaryAction} onPress={() => setCategoriesOpen(true)}><Ionicons name="pricetags-outline" size={20} color={colors.gold700} /></Pressable></View>
      <View style={styles.card}><Text style={styles.cardTitle}>Visão do caixa</Text>{shouldShowEmptyAnalytics(settledEntries, settledExpenses) ? <EmptyState title="Seu caixa começa aqui" message="Adicione a primeira entrada ou despesa para acompanhar a distribuição." actionLabel="Adicionar lançamento" onAction={() => openMovement(tab)} /> : <View style={styles.chartContent}><CashDonut entries={settledEntries} expenses={settledExpenses} /><View style={styles.legend}>{[['Entradas', settledEntries, colors.gold600], ['Despesas', settledExpenses, colors.surfaceSubtle]].map(([label, value, color]) => <View key={String(label)} style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: String(color) }]} /><Text style={styles.legendLabel}>{label}</Text><Text style={styles.legendValue}>{toBRL(Number(value))}</Text></View>)}</View></View>}</View>
      <View style={styles.segmented}>{(['entrada', 'despesa'] as MovementKind[]).map((kind) => <Pressable key={kind} style={[styles.segment, tab === kind && styles.segmentActive]} onPress={() => setTab(kind)}><Text style={[styles.segmentText, tab === kind && styles.segmentTextActive]}>{kind === 'entrada' ? 'Entradas' : 'Despesas'}</Text></Pressable>)}</View>
      <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder={tab === 'entrada' ? 'Buscar entrada' : 'Buscar despesa'} placeholderTextColor={colors.mutedText} />
      <View style={styles.movementsHeader}><Text style={styles.sectionTitle}>{tab === 'entrada' ? 'Entradas recentes' : 'Despesas recentes'}</Text><Text style={styles.countText}>{listData.length}</Text></View>
      {listData.length === 0 ? <View style={styles.card}><EmptyState title={tab === 'entrada' ? 'Nenhuma entrada ainda' : 'Nenhuma despesa ainda'} message="Registre seus movimentos para manter o caixa da assessoria sempre claro." actionLabel="Novo lançamento" onAction={() => openMovement(tab)} /></View> : listData.map((row) => {
        const entry = 'received_at' in row; const confirmed = SETTLED_STATUSES.has(row.status); const date = entry ? row.received_at ?? row.expected_at : row.paid_at ?? row.expected_at; const context = entry ? row.client_name : row.category_label || row.user_finance_categories?.name;
        return <View key={row.id} style={styles.movementCard}><View style={[styles.movementIcon, entry ? styles.inIcon : styles.outIcon]}><Ionicons name={entry ? 'arrow-down' : 'arrow-up'} size={18} color={entry ? colors.success600 : colors.dangerText} /></View><View style={styles.movementBody}><Text style={styles.movementTitle} numberOfLines={1}>{row.title}</Text><Text style={styles.movementMeta} numberOfLines={1}>{context || displayDate(date)}</Text><Text style={[styles.statusText, confirmed ? styles.statusConfirmed : styles.statusPlanned]}>{entry ? confirmed ? 'Recebida' : 'Prevista' : confirmed ? 'Paga' : 'Prevista'} · {displayDate(date)}</Text></View><View style={styles.movementRight}><Text style={[styles.amountText, entry ? styles.amountIn : styles.amountOut]}>{entry ? '+' : '−'} {toBRL(Number(row.amount || 0))}</Text>{row.proof_file_id || row.proof_url ? <Pressable onPress={() => void openProof(row.proof_file_id, row.proof_url, row.id)}>{openingProofId === row.id ? <ActivityIndicator size="small" color={colors.gold700} /> : <Ionicons name="document-attach-outline" size={20} color={colors.gold700} />}</Pressable> : null}</View></View>;
      })}
    </Screen>
    <FinanceModals bottomInset={insets.bottom} tab={tab} setTab={setTab} movementOpen={movementOpen} setMovementOpen={setMovementOpen} categoriesOpen={categoriesOpen} setCategoriesOpen={setCategoriesOpen} onboardingOpen={data.onboardingOpen} saving={saving} entryForm={entryForm} setEntryForm={setEntryForm} expenseForm={expenseForm} setExpenseForm={setExpenseForm} entryProof={entryProof} expenseProof={expenseProof} categories={data.categories} newCategoryName={newCategoryName} setNewCategoryName={setNewCategoryName} newCategoryType={newCategoryType} setNewCategoryType={setNewCategoryType} cashInput={data.cashInput} setCashInput={data.setCashInput} onPickProof={(kind) => void pickProof(kind)} onSaveMovement={() => void (tab === 'entrada' ? createEntry() : createExpense())} onCreateCategory={() => void createCategory()} onSaveOnboarding={() => void saveOnboardingCash()} />
  </>;
}
