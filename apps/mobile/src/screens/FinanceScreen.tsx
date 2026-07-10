import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import {
  deleteStoredFile,
  getPrivateFileDownloadUrl,
  linkStoredFile,
  uploadPrivateAsset,
} from '../lib/r2FileStorage';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

type FinanceStatus = 'pendente' | 'confirmado' | 'pago' | 'parcelado' | 'previsto';

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
  user_finance_categories?: {
    name: string;
    color: string | null;
  } | null;
};

type FinanceCategory = {
  id: string;
  user_id: string;
  name: string;
  type: 'entrada' | 'saida';
  color: string | null;
};

const RECEIVED_STATUSES = new Set<FinanceStatus>(['confirmado', 'pago', 'parcelado']);
const CASH_OUT_STATUSES = new Set<FinanceStatus>(['confirmado', 'pago', 'parcelado']);

function toBRL(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
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

  const [tab, setTab] = useState<'entradas' | 'saidas'>('saidas');
  const [search, setSearch] = useState('');

  const [entryForm, setEntryForm] = useState({
    title: '',
    client_name: '',
    amount: '',
    status: 'confirmado' as FinanceStatus,
    date: '',
    payment_method: '',
    notes: '',
  });
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    amount: '',
    status: 'pendente' as FinanceStatus,
    date: '',
    category_id: '',
    team_member_name: '',
    payment_method: '',
    notes: '',
  });

  const [entryProof, setEntryProof] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [expenseProof, setExpenseProof] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#D4AF37');
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

    if (entriesRes.error || expensesRes.error || categoriesRes.error || balanceRes.error || onboardingRes.error) {
      setError(
        entriesRes.error?.message ||
          expensesRes.error?.message ||
          categoriesRes.error?.message ||
          balanceRes.error?.message ||
          onboardingRes.error?.message ||
          'Falha ao carregar financeiro.',
      );
      setLoading(false);
      return;
    }

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

    const hasOnboarding = Boolean(onboardingRes.data?.completed_at);
    setCashInput(String(Number(balanceRes.data?.base_balance ?? 0)));
    setOnboardingOpen(!hasOnboarding);

    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const settledEntries = useMemo(
    () => entries.filter((row) => RECEIVED_STATUSES.has(row.status)).reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [entries],
  );
  const settledExpenses = useMemo(
    () => expenses.filter((row) => CASH_OUT_STATUSES.has(row.status)).reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [expenses],
  );
  const balance = baseBalance + settledEntries - settledExpenses;

  const listData = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (tab === 'entradas') {
      return entries.filter((row) => {
        if (!term) return true;
        return `${row.title} ${row.client_name ?? ''}`.toLowerCase().includes(term);
      });
    }
    return expenses.filter((row) => {
      if (!term) return true;
      return `${row.title} ${row.category_label ?? ''}`.toLowerCase().includes(term);
    });
  }, [entries, expenses, search, tab]);

  const cashflowSeries = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, idx) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      return {
        key: monthKey(date),
        name: monthLabel(date),
        entradas: 0,
        saidas: 0,
        saldo: 0,
      };
    });
    const monthIndex = new Map(months.map((row, idx) => [row.key, idx]));

    entries.forEach((entry) => {
      const date = parseDate(entry.received_at ?? entry.expected_at);
      if (!date) return;
      const idx = monthIndex.get(monthKey(date));
      if (idx === undefined) return;
      months[idx].entradas += Number(entry.amount || 0);
    });

    expenses.forEach((expense) => {
      const date = parseDate(expense.paid_at ?? expense.expected_at);
      if (!date) return;
      const idx = monthIndex.get(monthKey(date));
      if (idx === undefined) return;
      months[idx].saidas += Number(expense.amount || 0);
    });

    months.forEach((row) => {
      row.saldo = row.entradas - row.saidas;
    });

    return months;
  }, [entries, expenses]);

  const categorySplit = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((expense) => {
      const label = expense.category_label || expense.user_finance_categories?.name || 'Outros';
      map.set(label, (map.get(label) ?? 0) + Number(expense.amount || 0));
    });
    const total = Array.from(map.values()).reduce((sum, value) => sum + value, 0);
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, pct: total > 0 ? Math.round((value / total) * 100) : 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [expenses]);

  const teamRanking = useMemo(() => {
    const map = new Map<string, { name: string; total: number; items: number }>();
    expenses.forEach((row) => {
      const name = row.team_member_name?.trim() || 'Sem responsavel';
      const current = map.get(name) ?? { name, total: 0, items: 0 };
      current.total += Number(row.amount || 0);
      current.items += 1;
      map.set(name, current);
    });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [expenses]);

  const insights = useMemo(() => {
    const expectedIn = entries
      .filter((row) => row.status === 'pendente' || row.status === 'previsto')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const expectedOut = expenses
      .filter((row) => row.status === 'pendente' || row.status === 'previsto')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const nextStatus =
      expectedIn >= expectedOut
        ? 'Fluxo previsto positivo para os próximos dias.'
        : 'Atenção: saídas previstas estão acima das entradas previstas.';
    return [
      `Entradas previstas: ${toBRL(expectedIn)} | Saídas previstas: ${toBRL(expectedOut)}.`,
      nextStatus,
      `Categorias ativas: ${categories.length}.`,
    ];
  }, [categories.length, entries, expenses]);

  async function saveOnboardingCash() {
    if (!user) return;
    const value = Number(cashInput.replace(',', '.')) || 0;
    const [balanceRes, onboardingRes] = await Promise.all([
      supabase.from('user_finance_balance').upsert({ user_id: user.id, base_balance: value, updated_at: new Date().toISOString() }),
      supabase.from('user_finance_onboarding').upsert({ user_id: user.id, completed_at: new Date().toISOString() }),
    ]);
    if (balanceRes.error || onboardingRes.error) {
      setError(balanceRes.error?.message || onboardingRes.error?.message || 'Falha ao salvar onboarding.');
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
      color: newCategoryColor.trim() || null,
    });
    if (insertError) {
      setError(insertError.message);
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
    if (!user || saving || !entryForm.title.trim()) return;
    const amount = Number(entryForm.amount.replace(',', '.')) || 0;
    setSaving(true);
    let proofFileId: string | null = null;
    try {
      const upload = entryProof ? await uploadProof(entryProof, 'entries') : null;
      proofFileId = upload?.fileId ?? null;
      const isPlanned = entryForm.status === 'pendente' || entryForm.status === 'previsto';
      const payload = {
        user_id: user.id,
        title: entryForm.title.trim(),
        client_name: entryForm.client_name.trim() || null,
        amount,
        status: entryForm.status,
        received_at: isPlanned ? null : entryForm.date || null,
        expected_at: isPlanned ? entryForm.date || null : null,
        payment_method: entryForm.payment_method.trim() || null,
        notes: entryForm.notes.trim() || null,
        proof_url: null,
        proof_file_id: proofFileId,
      };
      const { data, error: insertError } = await supabase
        .from('user_finance_entries')
        .insert(payload)
        .select('id')
        .maybeSingle();
      if (insertError) throw new Error(insertError.message);
      if (proofFileId && data?.id) {
        void linkStoredFile(proofFileId, data.id).catch(() => {
          // Best effort only.
        });
      }
      setEntryForm({ title: '', client_name: '', amount: '', status: 'confirmado', date: '', payment_method: '', notes: '' });
      setEntryProof(null);
      await loadData();
    } catch (createError: any) {
      if (proofFileId) {
        void deleteStoredFile(proofFileId).catch(() => {
          // Best effort only.
        });
      }
      setError(createError?.message ?? 'Não foi possível salvar a entrada.');
    } finally {
      setSaving(false);
    }
  }

  async function createExpense() {
    if (!user || saving || !expenseForm.title.trim()) return;
    const amount = Number(expenseForm.amount.replace(',', '.')) || 0;
    setSaving(true);
    let proofFileId: string | null = null;
    try {
      const upload = expenseProof ? await uploadProof(expenseProof, 'expenses') : null;
      proofFileId = upload?.fileId ?? null;
      const isPlanned = expenseForm.status === 'pendente' || expenseForm.status === 'previsto';
      const payload = {
        user_id: user.id,
        title: expenseForm.title.trim(),
        amount,
        status: expenseForm.status,
        paid_at: isPlanned ? null : expenseForm.date || null,
        expected_at: isPlanned ? expenseForm.date || null : null,
        category_id: expenseForm.category_id || null,
        team_member_name: expenseForm.team_member_name.trim() || null,
        payment_method: expenseForm.payment_method.trim() || null,
        notes: expenseForm.notes.trim() || null,
        proof_url: null,
        proof_file_id: proofFileId,
      };
      const { data, error: insertError } = await supabase
        .from('user_finance_expenses')
        .insert(payload)
        .select('id')
        .maybeSingle();
      if (insertError) throw new Error(insertError.message);
      if (proofFileId && data?.id) {
        void linkStoredFile(proofFileId, data.id).catch(() => {
          // Best effort only.
        });
      }
      setExpenseForm({ title: '', amount: '', status: 'pendente', date: '', category_id: '', team_member_name: '', payment_method: '', notes: '' });
      setExpenseProof(null);
      await loadData();
    } catch (createError: any) {
      if (proofFileId) {
        void deleteStoredFile(proofFileId).catch(() => {
          // Best effort only.
        });
      }
      setError(createError?.message ?? 'Não foi possível salvar a saída.');
    } finally {
      setSaving(false);
    }
  }

  async function openProof(proofFileId: string | null, proofUrl: string | null, id: string) {
    setOpeningProofId(id);
    try {
      if (proofFileId) {
        const signedUrl = await getPrivateFileDownloadUrl(proofFileId);
        await Linking.openURL(signedUrl);
        return;
      }

      if (!proofUrl) {
        throw new Error('Sem comprovante');
      }

      let objectPath = proofUrl;
      if (proofUrl.startsWith('http')) {
        const parsed = new URL(proofUrl);
        const match = parsed.pathname.split('/finance-proofs/')[1];
        objectPath = match ?? '';
      }
      if (!objectPath) {
        await Linking.openURL(proofUrl);
        return;
      }
      const { data, error: signedError } = await supabase.storage.from('finance-proofs').createSignedUrl(objectPath, 300);
      if (signedError || !data?.signedUrl) throw new Error(signedError?.message ?? 'Sem URL assinada');
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
        <ActivityIndicator color={colors.primaryStrong} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 140 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Financeiro</Text>
        <Text style={styles.subtitle}>Onboarding, caixa, comprovantes e análise</Text>
      </View>

      {error ? <Text style={styles.err}>{error}</Text> : null}

              <View style={styles.analyticsSection}>
          <View style={styles.metricsRow}>
            <MetricCard label="Saldo em caixa" value={toBRL(balance)} sub={`Base: ${toBRL(baseBalance)}`} />
            <MetricCard label="Entradas" value={toBRL(settledEntries)} sub={`${entries.length} registros`} />
            <MetricCard label="Saídas" value={toBRL(settledExpenses)} sub={`${expenses.length} registros`} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Fluxo de caixa (6 meses)</Text>
            {cashflowSeries.map((row) => {
              const max = Math.max(...cashflowSeries.map((item) => Math.max(item.entradas, item.saidas)), 1);
              return (
                <View key={row.key} style={styles.chartRow}>
                  <Text style={styles.chartLabel}>{row.name}</Text>
                  <View style={styles.chartBars}>
                    <View style={[styles.chartBarIn, { width: `${Math.round((row.entradas / max) * 100)}%` }]} />
                    <View style={[styles.chartBarOut, { width: `${Math.round((row.saidas / max) * 100)}%` }]} />
                  </View>
                  <Text style={styles.chartValue}>{toBRL(row.saldo)}</Text>
                </View>
              );
            })}
          </View>
        </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Categorias de saída</Text>
        {categorySplit.length === 0 ? <Text style={styles.caption}>Sem despesas suficientes para o gráfico.</Text> : null}
        {categorySplit.map((row) => (
          <View key={row.name} style={styles.chartRow}>
            <Text style={styles.chartLabel}>{row.name}</Text>
            <View style={styles.chartBars}>
              <View style={[styles.chartBarGold, { width: `${Math.max(8, row.pct)}%` }]} />
            </View>
            <Text style={styles.chartValue}>{row.pct}%</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ranking e insights</Text>
        {teamRanking.length === 0 ? <Text style={styles.caption}>Sem dados suficientes para ranking.</Text> : null}
        {teamRanking.map((row, index) => (
          <View key={row.name} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{index + 1}. {row.name}</Text>
              <Text style={styles.caption}>{row.items} despesas</Text>
            </View>
            <Text style={styles.itemValue}>{toBRL(row.total)}</Text>
          </View>
        ))}
        {insights.map((text, index) => (
          <Text key={`insight-${index}`} style={styles.caption}>
            - {text}
          </Text>
        ))}
      </View>

              <View style={styles.card}>
          <TextInput
            style={styles.input}
            value={search}
            onChangeText={setSearch}
            placeholder={tab === 'entradas' ? 'Buscar entrada' : 'Buscar despesa'}
            placeholderTextColor={colors.mutedText}
          />
          <View style={styles.rowBtns}>
            <Pressable style={[styles.btnGhost, tab === 'entradas' && styles.btnTabOn]} onPress={() => setTab('entradas')}>
              <Text style={styles.smallText}>Entradas</Text>
            </Pressable>
            <Pressable style={[styles.btnGhost, tab === 'saidas' && styles.btnTabOn]} onPress={() => setTab('saidas')}>
              <Text style={styles.smallText}>Saidas</Text>
            </Pressable>
          </View>

          {listData.length === 0 ? <Text style={styles.caption}>Nenhum registro encontrado.</Text> : null}
          {listData.map((row: any) => (
            <View key={row.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{row.title}</Text>
                <Text style={styles.caption}>{row.status || '-'} | {(row.received_at || row.expected_at || row.paid_at || '').slice(0, 10) || 'sem data'}</Text>
              </View>
              <Text style={styles.itemValue}>{toBRL(Number(row.amount || 0))}</Text>
              {row.proof_file_id || row.proof_url ? (
                <Pressable style={styles.btnGhost} onPress={() => void openProof(row.proof_file_id ?? null, row.proof_url ?? null, String(row.id))}>
                  <Text style={styles.smallText}>{openingProofId === row.id ? 'Abrindo...' : 'Comprovante'}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

              <View style={styles.formsSection}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nova entrada</Text>
            <TextInput style={styles.input} value={entryForm.title} onChangeText={(value) => setEntryForm((prev) => ({ ...prev, title: value }))} placeholder="Título" />
            <TextInput style={styles.input} value={entryForm.client_name} onChangeText={(value) => setEntryForm((prev) => ({ ...prev, client_name: value }))} placeholder="Cliente" />
            <TextInput style={styles.input} value={entryForm.amount} onChangeText={(value) => setEntryForm((prev) => ({ ...prev, amount: value }))} placeholder="Valor" keyboardType="numeric" />
            <TextInput style={styles.input} value={entryForm.date} onChangeText={(value) => setEntryForm((prev) => ({ ...prev, date: value }))} placeholder="Data (YYYY-MM-DD)" />
            <TextInput style={styles.input} value={entryForm.payment_method} onChangeText={(value) => setEntryForm((prev) => ({ ...prev, payment_method: value }))} placeholder="Metodo de pagamento" />
            <TextInput style={[styles.input, styles.area]} value={entryForm.notes} onChangeText={(value) => setEntryForm((prev) => ({ ...prev, notes: value }))} placeholder="Notas" multiline />
            <View style={styles.rowBtns}>
              {(['pendente', 'confirmado', 'pago', 'parcelado', 'previsto'] as FinanceStatus[]).map((status) => (
                <Pressable key={status} style={[styles.btnGhost, entryForm.status === status && styles.btnTabOn]} onPress={() => setEntryForm((prev) => ({ ...prev, status }))}>
                  <Text style={styles.smallText}>{status}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.btnGhost} onPress={() => void pickProof('entry')}>
              <Text style={styles.smallText}>{entryProof ? `Arquivo: ${entryProof.name}` : 'Selecionar comprovante'}</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => void createEntry()}>
              <Text style={styles.btnText}>{saving ? 'Salvando...' : 'Salvar entrada'}</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nova despesa</Text>
            <TextInput style={styles.input} value={expenseForm.title} onChangeText={(value) => setExpenseForm((prev) => ({ ...prev, title: value }))} placeholder="Título" />
            <TextInput style={styles.input} value={expenseForm.amount} onChangeText={(value) => setExpenseForm((prev) => ({ ...prev, amount: value }))} placeholder="Valor" keyboardType="numeric" />
            <TextInput style={styles.input} value={expenseForm.date} onChangeText={(value) => setExpenseForm((prev) => ({ ...prev, date: value }))} placeholder="Data (YYYY-MM-DD)" />
            <TextInput style={styles.input} value={expenseForm.team_member_name} onChangeText={(value) => setExpenseForm((prev) => ({ ...prev, team_member_name: value }))} placeholder="Responsavel" />
            <TextInput style={styles.input} value={expenseForm.payment_method} onChangeText={(value) => setExpenseForm((prev) => ({ ...prev, payment_method: value }))} placeholder="Metodo de pagamento" />
            <TextInput style={[styles.input, styles.area]} value={expenseForm.notes} onChangeText={(value) => setExpenseForm((prev) => ({ ...prev, notes: value }))} placeholder="Notas" multiline />
            <View style={styles.rowBtns}>
              {categories.filter((row) => row.type === 'saida').slice(0, 8).map((category) => (
                <Pressable key={category.id} style={[styles.btnGhost, expenseForm.category_id === category.id && styles.btnTabOn]} onPress={() => setExpenseForm((prev) => ({ ...prev, category_id: category.id }))}>
                  <Text style={styles.smallText}>{category.name}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.rowBtns}>
              {(['pendente', 'confirmado', 'pago', 'parcelado', 'previsto'] as FinanceStatus[]).map((status) => (
                <Pressable key={status} style={[styles.btnGhost, expenseForm.status === status && styles.btnTabOn]} onPress={() => setExpenseForm((prev) => ({ ...prev, status }))}>
                  <Text style={styles.smallText}>{status}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.btnGhost} onPress={() => void pickProof('expense')}>
              <Text style={styles.smallText}>{expenseProof ? `Arquivo: ${expenseProof.name}` : 'Selecionar comprovante'}</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => void createExpense()}>
              <Text style={styles.btnText}>{saving ? 'Salvando...' : 'Salvar despesa'}</Text>
            </Pressable>
          </View>
        </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Categorias</Text>
        <TextInput style={styles.input} value={newCategoryName} onChangeText={setNewCategoryName} placeholder="Nome da categoria" />
        <TextInput style={styles.input} value={newCategoryColor} onChangeText={setNewCategoryColor} placeholder="Cor (#D4AF37)" />
        <View style={styles.rowBtns}>
          <Pressable style={[styles.btnGhost, newCategoryType === 'entrada' && styles.btnTabOn]} onPress={() => setNewCategoryType('entrada')}>
            <Text style={styles.smallText}>Entrada</Text>
          </Pressable>
          <Pressable style={[styles.btnGhost, newCategoryType === 'saida' && styles.btnTabOn]} onPress={() => setNewCategoryType('saida')}>
            <Text style={styles.smallText}>Saida</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={() => void createCategory()}>
            <Text style={styles.btnText}>Adicionar categoria</Text>
          </Pressable>
        </View>
        {categories.map((category) => (
          <Text key={category.id} style={styles.caption}>- {category.name} ({category.type})</Text>
        ))}
      </View>

      <Modal visible={onboardingOpen} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Onboarding financeiro</Text>
            <Text style={styles.caption}>Defina seu saldo base para iniciar o painel.</Text>
            <TextInput style={styles.input} value={cashInput} onChangeText={setCashInput} placeholder="Saldo inicial" keyboardType="numeric" />
            <View style={styles.rowBtns}>
              <Pressable style={styles.btn} onPress={() => void saveOnboardingCash()}>
                <Text style={styles.btnText}>Salvar e continuar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10, paddingBottom: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { gap: 2 },
  title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  subtitle: { color: colors.mutedText, fontSize: 13 },
  err: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 8 },
  analyticsSection: { gap: 14 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, gap: 8 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  caption: { color: colors.mutedText, fontSize: 12 },
  rowBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: colors.text, backgroundColor: colors.card },
  area: { minHeight: 84, textAlignVertical: 'top' },
  btn: { minHeight: 38, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnText: { color: colors.primaryTextOn, fontSize: 12, fontWeight: '700' },
  btnGhost: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, backgroundColor: colors.card },
  btnTabOn: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
  smallText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricCard: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, padding: 10, gap: 3 },
  metricLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '600' },
  metricValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
  metricSub: { color: colors.mutedText, fontSize: 11 },
  formsSection: { gap: 14 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chartLabel: { width: 40, color: colors.text, fontSize: 11, fontWeight: '600' },
  chartBars: { flex: 1, gap: 4 },
  chartBarIn: { height: 6, borderRadius: 999, backgroundColor: '#16A34A' },
  chartBarOut: { height: 6, borderRadius: 999, backgroundColor: '#DC2626' },
  chartBarGold: { height: 8, borderRadius: 999, backgroundColor: '#D4AF37' },
  chartValue: { width: 86, textAlign: 'right', color: colors.mutedText, fontSize: 11 },
  itemRow: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  itemValue: { color: colors.primaryStrong, fontSize: 12, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', padding: 16, justifyContent: 'center' },
  modalCard: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
