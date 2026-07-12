import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Screen } from '../components/Screen';
import { EmptyState } from '../components/ui/EmptyState';
import { GradientCard } from '../components/ui/GradientCard';
import { useAuth } from '../contexts/AuthContext';
import { parseBRLInput, shouldShowEmptyAnalytics } from '../features/finance/financePresentation';
import {
  deleteStoredFile,
  getPrivateFileDownloadUrl,
  linkStoredFile,
  uploadPrivateAsset,
} from '../lib/r2FileStorage';
import { supabase } from '../lib/supabase';
import { colors, radii, shadows, spacing } from '../theme/colors';

type FinanceStatus = 'pendente' | 'confirmado' | 'pago' | 'parcelado' | 'previsto';
type MovementKind = 'entrada' | 'despesa';

type FinanceEntry = {
  id: string;
  user_id: string;
  client_name: string | null;
  title: string;
  amount: number;
  status: FinanceStatus;
  received_at: string | null;
  expected_at: string | null;
  payment_method: string | null;
  proof_file_id: string | null;
  proof_url: string | null;
  notes: string | null;
  created_at?: string | null;
};

type FinanceExpense = {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  status: FinanceStatus;
  paid_at: string | null;
  expected_at: string | null;
  category_id: string | null;
  category_label: string | null;
  team_member_name: string | null;
  payment_method: string | null;
  proof_file_id: string | null;
  proof_url: string | null;
  notes: string | null;
  created_at?: string | null;
  user_finance_categories?: { name: string; color: string | null } | null;
};

type FinanceCategory = {
  id: string;
  user_id: string;
  name: string;
  type: 'entrada' | 'saida';
  color: string | null;
};

const SETTLED_STATUSES = new Set<FinanceStatus>(['confirmado', 'pago', 'parcelado']);

function toBRL(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function displayDate(value: string | null | undefined) {
  if (!value) return 'Sem data definida';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Sem data definida';
  return date.toLocaleDateString('pt-BR');
}

function friendlyFinanceError(_message?: string | null) {
  return 'Não foi possível concluir agora. Confira sua conexão e tente novamente.';
}

function CashDonut({ entries, expenses }: { entries: number; expenses: number }) {
  const size = 116;
  const stroke = 13;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = entries + expenses;
  const entriesRatio = total > 0 ? entries / total : 0;

  return (
    <View accessible accessibilityLabel={`Entradas ${toBRL(entries)}. Despesas ${toBRL(expenses)}.`}>
      <Svg width={size} height={size} accessibilityElementsHidden>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.surfaceSubtle} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.gold600}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference * entriesRatio} ${circumference}`}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View pointerEvents="none" style={styles.donutCenter}>
        <Text style={styles.donutCaption}>Saldo</Text>
        <Ionicons name="wallet-outline" size={24} color={colors.gold700} />
      </View>
    </View>
  );
}

export function FinanceScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [baseBalance, setBaseBalance] = useState(0);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [tab, setTab] = useState<MovementKind>('despesa');
  const [search, setSearch] = useState('');
  const [movementOpen, setMovementOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const [entryForm, setEntryForm] = useState({
    title: '', client_name: '', amount: '', status: 'confirmado' as FinanceStatus,
    date: '', payment_method: '', notes: '',
  });
  const [expenseForm, setExpenseForm] = useState({
    title: '', amount: '', status: 'pago' as FinanceStatus, date: '', category_id: '',
    team_member_name: '', payment_method: '', notes: '',
  });
  const [entryProof, setEntryProof] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [expenseProof, setExpenseProof] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'entrada' | 'saida'>('saida');
  const [openingProofId, setOpeningProofId] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [cashInput, setCashInput] = useState('0');

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    try {
      const [onboardingRes, balanceRes, entriesRes, expensesRes, categoriesRes] = await Promise.all([
        supabase.from('user_finance_onboarding').select('completed_at').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_finance_balance').select('base_balance').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('user_finance_entries')
          .select('id,user_id,client_name,title,amount,status,received_at,expected_at,payment_method,proof_file_id,proof_url,notes,created_at')
          .eq('user_id', user.id)
          .order('received_at', { ascending: false, nullsFirst: false }),
        supabase
          .from('user_finance_expenses')
          .select('id,user_id,title,amount,status,paid_at,expected_at,category_id,category_label,team_member_name,payment_method,proof_file_id,proof_url,notes,created_at,user_finance_categories(name,color)')
          .eq('user_id', user.id)
          .order('paid_at', { ascending: false, nullsFirst: false }),
        supabase.from('user_finance_categories').select('id,user_id,name,type,color').eq('user_id', user.id),
      ]);

      const requestError = entriesRes.error || expensesRes.error || categoriesRes.error || balanceRes.error || onboardingRes.error;
      if (requestError) throw requestError;

      setEntries((entriesRes.data ?? []) as FinanceEntry[]);
      setExpenses(
        ((expensesRes.data ?? []) as any[]).map((row) => ({
          ...row,
          user_finance_categories: Array.isArray(row.user_finance_categories)
            ? row.user_finance_categories[0] ?? null
            : row.user_finance_categories ?? null,
        })) as FinanceExpense[],
      );
      setCategories((categoriesRes.data ?? []) as FinanceCategory[]);
      setBaseBalance(Number(balanceRes.data?.base_balance ?? 0));
      setCashInput(String(Number(balanceRes.data?.base_balance ?? 0)));
      setOnboardingOpen(!onboardingRes.data?.completed_at);
    } catch (loadError: any) {
      setError(friendlyFinanceError(loadError?.message));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => void loadData(), [loadData]));

  const settledEntries = useMemo(
    () => entries.filter((row) => SETTLED_STATUSES.has(row.status)).reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [entries],
  );
  const settledExpenses = useMemo(
    () => expenses.filter((row) => SETTLED_STATUSES.has(row.status)).reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [expenses],
  );
  const balance = baseBalance + settledEntries - settledExpenses;
  const emptyAnalytics = shouldShowEmptyAnalytics(settledEntries, settledExpenses);

  const listData = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = tab === 'entrada' ? entries : expenses;
    return source.filter((row) => {
      if (!term) return true;
      const context = 'client_name' in row ? row.client_name : row.category_label;
      return `${row.title} ${context ?? ''}`.toLowerCase().includes(term);
    });
  }, [entries, expenses, search, tab]);

  function openMovement(kind: MovementKind) {
    setTab(kind);
    setError('');
    setMovementOpen(true);
  }

  async function saveOnboardingCash() {
    if (!user) return;
    const value = parseBRLInput(cashInput);
    const [balanceRes, onboardingRes] = await Promise.all([
      supabase.from('user_finance_balance').upsert({ user_id: user.id, base_balance: value, updated_at: new Date().toISOString() }),
      supabase.from('user_finance_onboarding').upsert({ user_id: user.id, completed_at: new Date().toISOString() }),
    ]);
    if (balanceRes.error || onboardingRes.error) {
      setError(friendlyFinanceError());
      return;
    }
    setOnboardingOpen(false);
    await loadData();
  }

  async function createCategory() {
    if (!user || !newCategoryName.trim()) return;
    const { error: insertError } = await supabase.from('user_finance_categories').insert({
      user_id: user.id,
      name: newCategoryName.trim(),
      type: newCategoryType,
      color: colors.gold600,
    });
    if (insertError) {
      setError(friendlyFinanceError(insertError.message));
      return;
    }
    setNewCategoryName('');
    await loadData();
  }

  async function pickProof(kind: 'entry' | 'expense') {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['application/pdf', 'image/*'],
    });
    if (result.canceled || !result.assets[0]) return;
    if (kind === 'entry') setEntryProof(result.assets[0]);
    else setExpenseProof(result.assets[0]);
  }

  async function uploadProof(asset: DocumentPicker.DocumentPickerAsset, kind: 'entries' | 'expenses') {
    if (!user) return null;
    const safeName = (asset.name || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_') || 'arquivo';
    return uploadPrivateAsset({
      uri: asset.uri,
      fileName: safeName,
      contentType: asset.mimeType || 'application/octet-stream',
      byteSize: asset.size ?? null,
      entityType: kind === 'entries' ? 'finance_entry_proof' : 'finance_expense_proof',
    });
  }

  async function createEntry() {
    if (!user || saving || !entryForm.title.trim() || parseBRLInput(entryForm.amount) <= 0) return;
    setSaving(true);
    let proofFileId: string | null = null;
    try {
      const upload = entryProof ? await uploadProof(entryProof, 'entries') : null;
      proofFileId = upload?.fileId ?? null;
      const isPlanned = entryForm.status === 'previsto';
      const { data, error: insertError } = await supabase.from('user_finance_entries').insert({
        user_id: user.id,
        title: entryForm.title.trim(),
        client_name: entryForm.client_name.trim() || null,
        amount: parseBRLInput(entryForm.amount),
        status: entryForm.status,
        received_at: isPlanned ? null : entryForm.date || null,
        expected_at: isPlanned ? entryForm.date || null : null,
        payment_method: entryForm.payment_method.trim() || null,
        notes: entryForm.notes.trim() || null,
        proof_url: null,
        proof_file_id: proofFileId,
      }).select('id').maybeSingle();
      if (insertError) throw insertError;
      if (proofFileId && data?.id) void linkStoredFile(proofFileId, data.id).catch(() => undefined);
      setEntryForm({ title: '', client_name: '', amount: '', status: 'confirmado', date: '', payment_method: '', notes: '' });
      setEntryProof(null);
      setMovementOpen(false);
      await loadData();
    } catch (createError: any) {
      if (proofFileId) void deleteStoredFile(proofFileId).catch(() => undefined);
      setError(friendlyFinanceError(createError?.message));
    } finally {
      setSaving(false);
    }
  }

  async function createExpense() {
    if (!user || saving || !expenseForm.title.trim() || parseBRLInput(expenseForm.amount) <= 0) return;
    setSaving(true);
    let proofFileId: string | null = null;
    try {
      const upload = expenseProof ? await uploadProof(expenseProof, 'expenses') : null;
      proofFileId = upload?.fileId ?? null;
      const isPlanned = expenseForm.status === 'previsto';
      const { data, error: insertError } = await supabase.from('user_finance_expenses').insert({
        user_id: user.id,
        title: expenseForm.title.trim(),
        amount: parseBRLInput(expenseForm.amount),
        status: expenseForm.status,
        paid_at: isPlanned ? null : expenseForm.date || null,
        expected_at: isPlanned ? expenseForm.date || null : null,
        category_id: expenseForm.category_id || null,
        team_member_name: expenseForm.team_member_name.trim() || null,
        payment_method: expenseForm.payment_method.trim() || null,
        notes: expenseForm.notes.trim() || null,
        proof_url: null,
        proof_file_id: proofFileId,
      }).select('id').maybeSingle();
      if (insertError) throw insertError;
      if (proofFileId && data?.id) void linkStoredFile(proofFileId, data.id).catch(() => undefined);
      setExpenseForm({ title: '', amount: '', status: 'pago', date: '', category_id: '', team_member_name: '', payment_method: '', notes: '' });
      setExpenseProof(null);
      setMovementOpen(false);
      await loadData();
    } catch (createError: any) {
      if (proofFileId) void deleteStoredFile(proofFileId).catch(() => undefined);
      setError(friendlyFinanceError(createError?.message));
    } finally {
      setSaving(false);
    }
  }

  async function openProof(proofFileId: string | null, proofUrl: string | null, id: string) {
    setOpeningProofId(id);
    try {
      if (proofFileId) {
        await Linking.openURL(await getPrivateFileDownloadUrl(proofFileId));
        return;
      }
      if (!proofUrl) throw new Error('missing_proof');
      if (proofUrl.startsWith('http')) {
        const parsed = new URL(proofUrl);
        const objectPath = parsed.pathname.split('/finance-proofs/')[1];
        if (!objectPath) {
          await Linking.openURL(proofUrl);
          return;
        }
        const { data, error: signedError } = await supabase.storage.from('finance-proofs').createSignedUrl(objectPath, 300);
        if (signedError || !data?.signedUrl) throw signedError ?? new Error('missing_url');
        await Linking.openURL(data.signedUrl);
        return;
      }
      const { data, error: signedError } = await supabase.storage.from('finance-proofs').createSignedUrl(proofUrl, 300);
      if (signedError || !data?.signedUrl) throw signedError ?? new Error('missing_url');
      await Linking.openURL(data.signedUrl);
    } catch {
      setError('Não foi possível abrir o comprovante.');
    } finally {
      setOpeningProofId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold600} />
        <Text style={styles.loadingText}>Organizando seu caixa...</Text>
      </View>
    );
  }

  return (
    <>
      <Screen title="Meu caixa" subtitle="Entradas e despesas da sua assessoria">
        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.dangerText} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <GradientCard gradient="gold" gradientPosition="background" style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroEyebrow}>SALDO DA SUA ASSESSORIA</Text>
              <Text style={styles.heroValue}>{toBRL(balance)}</Text>
            </View>
            <View style={styles.walletIcon}>
              <Ionicons name="wallet" size={24} color={colors.ink950} />
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="arrow-down-circle" size={18} color={colors.success600} />
              <View>
                <Text style={styles.summaryLabel}>Entradas</Text>
                <Text style={styles.summaryValue}>{toBRL(settledEntries)}</Text>
              </View>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Ionicons name="arrow-up-circle" size={18} color={colors.dangerText} />
              <View>
                <Text style={styles.summaryLabel}>Despesas</Text>
                <Text style={styles.summaryValue}>{toBRL(settledExpenses)}</Text>
              </View>
            </View>
          </View>
        </GradientCard>

        <View style={styles.actionsRow}>
          <Pressable style={styles.primaryAction} onPress={() => openMovement(tab)} accessibilityRole="button">
            <Ionicons name="add" size={22} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>Novo lançamento</Text>
          </Pressable>
          <Pressable style={styles.secondaryAction} onPress={() => setCategoriesOpen(true)} accessibilityRole="button">
            <Ionicons name="pricetags-outline" size={20} color={colors.gold700} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Visão do caixa</Text>
          {emptyAnalytics ? (
            <EmptyState
              title="Seu caixa começa aqui"
              message="Adicione a primeira entrada ou despesa para acompanhar a distribuição."
              actionLabel="Adicionar lançamento"
              onAction={() => openMovement(tab)}
            />
          ) : (
            <View style={styles.chartContent}>
              <CashDonut entries={settledEntries} expenses={settledExpenses} />
              <View style={styles.legend}>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: colors.gold600 }]} />
                  <Text style={styles.legendLabel}>Entradas</Text>
                  <Text style={styles.legendValue}>{toBRL(settledEntries)}</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: colors.surfaceSubtle }]} />
                  <Text style={styles.legendLabel}>Despesas</Text>
                  <Text style={styles.legendValue}>{toBRL(settledExpenses)}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={styles.segmented}>
          {(['entrada', 'despesa'] as MovementKind[]).map((kind) => (
            <Pressable
              key={kind}
              style={[styles.segment, tab === kind && styles.segmentActive]}
              onPress={() => setTab(kind)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === kind }}
            >
              <Text style={[styles.segmentText, tab === kind && styles.segmentTextActive]}>
                {kind === 'entrada' ? 'Entradas' : 'Despesas'}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={tab === 'entrada' ? 'Buscar entrada' : 'Buscar despesa'}
          placeholderTextColor={colors.mutedText}
          accessibilityLabel={tab === 'entrada' ? 'Buscar entrada' : 'Buscar despesa'}
        />

        <View style={styles.movementsHeader}>
          <Text style={styles.sectionTitle}>{tab === 'entrada' ? 'Entradas recentes' : 'Despesas recentes'}</Text>
          <Text style={styles.countText}>{listData.length}</Text>
        </View>

        {listData.length === 0 ? (
          <View style={styles.card}>
            <EmptyState
              title={tab === 'entrada' ? 'Nenhuma entrada ainda' : 'Nenhuma despesa ainda'}
              message="Registre seus movimentos para manter o caixa da assessoria sempre claro."
              actionLabel="Novo lançamento"
              onAction={() => openMovement(tab)}
            />
          </View>
        ) : (
          listData.map((row) => {
            const isEntry = 'received_at' in row;
            const confirmed = SETTLED_STATUSES.has(row.status);
            const date = isEntry ? row.received_at ?? row.expected_at : row.paid_at ?? row.expected_at;
            const context = isEntry
              ? row.client_name
              : row.category_label || row.user_finance_categories?.name;
            return (
              <View key={row.id} style={styles.movementCard}>
                <View style={[styles.movementIcon, isEntry ? styles.inIcon : styles.outIcon]}>
                  <Ionicons name={isEntry ? 'arrow-down' : 'arrow-up'} size={18} color={isEntry ? colors.success600 : colors.dangerText} />
                </View>
                <View style={styles.movementBody}>
                  <Text style={styles.movementTitle} numberOfLines={1}>{row.title}</Text>
                  <Text style={styles.movementMeta} numberOfLines={1}>{context || displayDate(date)}</Text>
                  <Text style={[styles.statusText, confirmed ? styles.statusConfirmed : styles.statusPlanned]}>
                    {isEntry ? (confirmed ? 'Recebida' : 'Prevista') : (confirmed ? 'Paga' : 'Prevista')}
                    {' · '}{displayDate(date)}
                  </Text>
                </View>
                <View style={styles.movementRight}>
                  <Text style={[styles.amountText, isEntry ? styles.amountIn : styles.amountOut]}>
                    {isEntry ? '+' : '−'} {toBRL(Number(row.amount || 0))}
                  </Text>
                  {row.proof_file_id || row.proof_url ? (
                    <Pressable
                      hitSlop={8}
                      onPress={() => void openProof(row.proof_file_id, row.proof_url, String(row.id))}
                      accessibilityRole="button"
                      accessibilityLabel="Abrir comprovante"
                    >
                      {openingProofId === row.id
                        ? <ActivityIndicator size="small" color={colors.gold700} />
                        : <Ionicons name="document-attach-outline" size={20} color={colors.gold700} />}
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </Screen>

      <Modal visible={movementOpen} transparent animationType="slide" onRequestClose={() => setMovementOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalDismissArea} onPress={() => setMovementOpen(false)} accessibilityLabel="Fechar" />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Novo lançamento</Text>
                <Text style={styles.sheetSubtitle}>Movimento do caixa da sua assessoria</Text>
              </View>
              <Pressable hitSlop={10} onPress={() => setMovementOpen(false)} accessibilityRole="button" accessibilityLabel="Fechar lançamento">
                <Ionicons name="close" size={26} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.segmented}>
              {(['entrada', 'despesa'] as MovementKind[]).map((kind) => (
                <Pressable key={kind} style={[styles.segment, tab === kind && styles.segmentActive]} onPress={() => setTab(kind)}>
                  <Text style={[styles.segmentText, tab === kind && styles.segmentTextActive]}>{kind === 'entrada' ? 'Entrada' : 'Despesa'}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
              {tab === 'entrada' ? (
                <>
                  <Field label="Descrição" value={entryForm.title} onChangeText={(value) => setEntryForm((prev) => ({ ...prev, title: value }))} placeholder="Ex.: Sinal do casamento" />
                  <Field label="Cliente (opcional)" value={entryForm.client_name} onChangeText={(value) => setEntryForm((prev) => ({ ...prev, client_name: value }))} placeholder="Nome do cliente" />
                  <Field label="Valor" value={entryForm.amount} onChangeText={(value) => setEntryForm((prev) => ({ ...prev, amount: value }))} placeholder="R$ 0,00" keyboardType="decimal-pad" />
                  <StatusChoice
                    first="Recebida"
                    second="Prevista"
                    selected={entryForm.status === 'previsto' ? 'second' : 'first'}
                    onSelect={(choice) => setEntryForm((prev) => ({ ...prev, status: choice === 'first' ? 'confirmado' : 'previsto' }))}
                  />
                  <Field label={entryForm.status === 'previsto' ? 'Data prevista' : 'Data do recebimento'} value={entryForm.date} onChangeText={(value) => setEntryForm((prev) => ({ ...prev, date: value }))} placeholder="AAAA-MM-DD" />
                  <Field label="Forma de pagamento (opcional)" value={entryForm.payment_method} onChangeText={(value) => setEntryForm((prev) => ({ ...prev, payment_method: value }))} placeholder="PIX, cartão, transferência..." />
                  <Field label="Observação (opcional)" value={entryForm.notes} onChangeText={(value) => setEntryForm((prev) => ({ ...prev, notes: value }))} placeholder="Informações importantes" multiline />
                  <AttachmentButton asset={entryProof} onPress={() => void pickProof('entry')} />
                </>
              ) : (
                <>
                  <Field label="Descrição" value={expenseForm.title} onChangeText={(value) => setExpenseForm((prev) => ({ ...prev, title: value }))} placeholder="Ex.: Material de escritório" />
                  <Field label="Valor" value={expenseForm.amount} onChangeText={(value) => setExpenseForm((prev) => ({ ...prev, amount: value }))} placeholder="R$ 0,00" keyboardType="decimal-pad" />
                  <StatusChoice
                    first="Paga"
                    second="Prevista"
                    selected={expenseForm.status === 'previsto' ? 'second' : 'first'}
                    onSelect={(choice) => setExpenseForm((prev) => ({ ...prev, status: choice === 'first' ? 'pago' : 'previsto' }))}
                  />
                  <Field label={expenseForm.status === 'previsto' ? 'Data prevista' : 'Data do pagamento'} value={expenseForm.date} onChangeText={(value) => setExpenseForm((prev) => ({ ...prev, date: value }))} placeholder="AAAA-MM-DD" />
                  {categories.filter((row) => row.type === 'saida').length ? (
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Categoria (opcional)</Text>
                      <View style={styles.chips}>
                        {categories.filter((row) => row.type === 'saida').map((category) => (
                          <Pressable
                            key={category.id}
                            style={[styles.chip, expenseForm.category_id === category.id && styles.chipActive]}
                            onPress={() => setExpenseForm((prev) => ({ ...prev, category_id: category.id }))}
                          >
                            <Text style={[styles.chipText, expenseForm.category_id === category.id && styles.chipTextActive]}>{category.name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  <Field label="Responsável (opcional)" value={expenseForm.team_member_name} onChangeText={(value) => setExpenseForm((prev) => ({ ...prev, team_member_name: value }))} placeholder="Quem realizou o pagamento" />
                  <Field label="Forma de pagamento (opcional)" value={expenseForm.payment_method} onChangeText={(value) => setExpenseForm((prev) => ({ ...prev, payment_method: value }))} placeholder="PIX, cartão, transferência..." />
                  <Field label="Observação (opcional)" value={expenseForm.notes} onChangeText={(value) => setExpenseForm((prev) => ({ ...prev, notes: value }))} placeholder="Informações importantes" multiline />
                  <AttachmentButton asset={expenseProof} onPress={() => void pickProof('expense')} />
                </>
              )}
              <Pressable
                style={[styles.saveButton, saving && styles.disabled]}
                disabled={saving}
                onPress={() => void (tab === 'entrada' ? createEntry() : createExpense())}
              >
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Salvar {tab}</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={categoriesOpen} transparent animationType="slide" onRequestClose={() => setCategoriesOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalDismissArea} onPress={() => setCategoriesOpen(false)} />
          <View style={[styles.sheet, styles.categorySheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Categorias</Text>
                <Text style={styles.sheetSubtitle}>Organize seus lançamentos</Text>
              </View>
              <Pressable hitSlop={10} onPress={() => setCategoriesOpen(false)}><Ionicons name="close" size={26} color={colors.textSecondary} /></Pressable>
            </View>
            <Field label="Nova categoria" value={newCategoryName} onChangeText={setNewCategoryName} placeholder="Ex.: Transporte" />
            <View style={styles.segmented}>
              <Pressable style={[styles.segment, newCategoryType === 'entrada' && styles.segmentActive]} onPress={() => setNewCategoryType('entrada')}><Text style={[styles.segmentText, newCategoryType === 'entrada' && styles.segmentTextActive]}>Entrada</Text></Pressable>
              <Pressable style={[styles.segment, newCategoryType === 'saida' && styles.segmentActive]} onPress={() => setNewCategoryType('saida')}><Text style={[styles.segmentText, newCategoryType === 'saida' && styles.segmentTextActive]}>Despesa</Text></Pressable>
            </View>
            <Pressable style={styles.saveButton} onPress={() => void createCategory()}><Text style={styles.saveButtonText}>Adicionar categoria</Text></Pressable>
            <ScrollView style={styles.categoryList}>
              {categories.map((category) => (
                <View key={category.id} style={styles.categoryRow}>
                  <View style={[styles.categoryDot, { backgroundColor: category.color || colors.gold600 }]} />
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryType}>{category.type === 'entrada' ? 'Entrada' : 'Despesa'}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={onboardingOpen} transparent animationType="fade">
        <View style={styles.onboardingBackdrop}>
          <View style={styles.onboardingCard}>
            <View style={styles.onboardingIcon}><Ionicons name="wallet-outline" size={30} color={colors.gold700} /></View>
            <Text style={styles.sheetTitle}>Configure seu caixa</Text>
            <Text style={styles.onboardingText}>Informe quanto sua assessoria tem disponível hoje. Você poderá lançar entradas e despesas em seguida.</Text>
            <Field label="Saldo inicial" value={cashInput} onChangeText={setCashInput} placeholder="R$ 0,00" keyboardType="decimal-pad" />
            <Pressable style={styles.saveButton} onPress={() => void saveOnboardingCash()}><Text style={styles.saveButtonText}>Começar meu caixa</Text></Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Field({ label, multiline, ...props }: { label: string; multiline?: boolean } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.mutedText}
        style={[styles.input, multiline && styles.textarea]}
      />
    </View>
  );
}

function StatusChoice({ first, second, selected, onSelect }: { first: string; second: string; selected: 'first' | 'second'; onSelect: (value: 'first' | 'second') => void }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>Situação</Text>
      <View style={styles.segmented}>
        <Pressable style={[styles.segment, selected === 'first' && styles.segmentActive]} onPress={() => onSelect('first')}><Text style={[styles.segmentText, selected === 'first' && styles.segmentTextActive]}>{first}</Text></Pressable>
        <Pressable style={[styles.segment, selected === 'second' && styles.segmentActive]} onPress={() => onSelect('second')}><Text style={[styles.segmentText, selected === 'second' && styles.segmentTextActive]}>{second}</Text></Pressable>
      </View>
    </View>
  );
}

function AttachmentButton({ asset, onPress }: { asset: DocumentPicker.DocumentPickerAsset | null; onPress: () => void }) {
  return (
    <Pressable style={styles.attachmentButton} onPress={onPress}>
      <Ionicons name="attach" size={20} color={colors.gold700} />
      <Text style={styles.attachmentText} numberOfLines={1}>{asset ? asset.name : 'Adicionar comprovante (opcional)'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.background },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radii.md, padding: spacing.md, backgroundColor: colors.dangerBg },
  errorText: { flex: 1, color: colors.dangerText, fontSize: 13, lineHeight: 18 },
  hero: { padding: spacing.lg, gap: spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroEyebrow: { color: colors.ink950, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  heroValue: { color: colors.ink950, fontSize: 29, fontWeight: '800', marginTop: spacing.xs },
  walletIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.48)' },
  summaryRow: { flexDirection: 'row', borderRadius: radii.md, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.52)' },
  summaryItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryDivider: { width: 1, marginHorizontal: spacing.sm, backgroundColor: 'rgba(15,17,21,0.12)' },
  summaryLabel: { color: colors.textSecondary, fontSize: 11 },
  summaryValue: { color: colors.ink950, fontSize: 13, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  primaryAction: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.md, backgroundColor: colors.ink950, ...shadows.card },
  primaryActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondaryAction: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  card: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, backgroundColor: colors.card, ...shadows.sm },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.md },
  chartContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  donutCenter: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  donutCaption: { color: colors.textSecondary, fontSize: 10, fontWeight: '600', marginBottom: 2 },
  legend: { flex: 1, gap: spacing.md },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { flex: 1, color: colors.textSecondary, fontSize: 12 },
  legendValue: { color: colors.text, fontSize: 12, fontWeight: '700' },
  segmented: { flexDirection: 'row', gap: spacing.xs, borderRadius: radii.md, padding: spacing.xs, backgroundColor: colors.surfaceSubtle },
  segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm },
  segmentActive: { backgroundColor: colors.card, ...shadows.sm },
  segmentText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: colors.gold700, fontWeight: '800' },
  searchInput: { minHeight: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, color: colors.text, backgroundColor: colors.card },
  movementsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  countText: { minWidth: 28, textAlign: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: radii.full, color: colors.gold700, fontSize: 12, fontWeight: '700', backgroundColor: colors.gold100 },
  movementCard: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, backgroundColor: colors.card, ...shadows.sm },
  movementIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  inIcon: { backgroundColor: colors.success100 },
  outIcon: { backgroundColor: colors.danger100 },
  movementBody: { flex: 1, minWidth: 0, gap: 2 },
  movementTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  movementMeta: { color: colors.textSecondary, fontSize: 12 },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusConfirmed: { color: colors.success600 },
  statusPlanned: { color: colors.warningText },
  movementRight: { alignItems: 'flex-end', gap: spacing.sm },
  amountText: { fontSize: 13, fontWeight: '800' },
  amountIn: { color: colors.success600 },
  amountOut: { color: colors.text },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,17,21,0.45)' },
  modalDismissArea: { flex: 1 },
  sheet: { maxHeight: '90%', gap: spacing.md, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.background },
  categorySheet: { maxHeight: '78%' },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: colors.text, fontSize: 21, fontWeight: '800' },
  sheetSubtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  formContent: { gap: spacing.md, paddingBottom: spacing.xl },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, color: colors.text, fontSize: 14, backgroundColor: colors.card },
  textarea: { minHeight: 84, paddingTop: spacing.md, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 38, justifyContent: 'center', borderRadius: radii.full, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, backgroundColor: colors.card },
  chipActive: { borderColor: colors.gold600, backgroundColor: colors.gold100 },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.gold700, fontWeight: '700' },
  attachmentButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.gold600, paddingHorizontal: spacing.md, backgroundColor: colors.gold50 },
  attachmentText: { flex: 1, color: colors.gold700, fontSize: 12, fontWeight: '700' },
  saveButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, backgroundColor: colors.ink950 },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  categoryList: { marginTop: spacing.xs },
  categoryRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  categoryName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  categoryType: { color: colors.textSecondary, fontSize: 12 },
  onboardingBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(15,17,21,0.55)' },
  onboardingCard: { width: '100%', maxWidth: 420, gap: spacing.lg, borderRadius: 24, padding: spacing.xl, backgroundColor: colors.card, ...shadows.elevated },
  onboardingIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold100 },
  onboardingText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
});
