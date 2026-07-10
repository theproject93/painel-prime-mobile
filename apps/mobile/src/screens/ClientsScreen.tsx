import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatCardPremium } from '../components/ui/StatCardPremium';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors, gradients, radii, shadows, spacing } from '../theme/colors';

type Stage =
  | 'conhecendo_cliente'
  | 'analisando_orcamento'
  | 'assinatura_contrato'
  | 'cliente_fechado'
  | 'cliente_perdido';

type ClientItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: Stage;
  event_type: string | null;
  event_date_expected: string | null;
  budget_expected: number | null;
  notes: string | null;
  created_at: string;
};

type FollowupTask = {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  reason: string | null;
  due_date: string;
  status: 'open' | 'done' | 'dismissed';
  created_at: string;
};

type LeadInteraction = {
  id: string;
  user_id: string;
  client_id: string;
  channel: 'whatsapp' | 'email' | 'ligacao' | 'instagram' | 'reuniao' | 'outro';
  direction: 'outbound' | 'inbound';
  summary: string;
  happened_at: string;
  next_followup_at: string | null;
};

type FunnelMetric = {
  stage: string;
  leads: number;
  avg_days_in_stage: number;
  conversion_rate: number;
};

type PipelineForecast = {
  stage: string;
  leads: number;
  total_budget: number;
  weighted_budget: number;
  win_rate: number;
};

type PriorityQueueItem = {
  client_id: string;
  client_name: string;
  stage: string;
  priority_score: number;
  priority_reason: string;
  next_action: string;
  due_date: string | null;
};

type ExecutionMetric = {
  metric: string;
  value: number;
};

type DocType = 'budget' | 'contract';

type ClientDoc = {
  id: string;
  client_id: string;
  doc_type: DocType;
  title: string;
  content: string;
  status: 'draft' | 'pending_signature' | 'signed';
};

type SignReq = {
  id: string;
  client_id: string;
  token: string;
  status: 'pending' | 'signed' | 'expired' | 'cancelled';
  created_at: string;
};

type ConsentRecord = {
  id: string;
  user_id: string;
  client_id: string;
  lawful_basis: 'consentimento' | 'execucao_contrato' | 'legitimo_interesse' | 'anonimizacao_solicitada';
  consent_text_version: string;
  consent_note: string | null;
  source: 'manual' | 'formulario' | 'whatsapp' | 'email' | 'sistema';
  consented_at: string;
};

const STAGES: Array<{ value: Stage; label: string }> = [
  { value: 'conhecendo_cliente', label: 'Conhecendo cliente' },
  { value: 'analisando_orcamento', label: 'Analisando orçamento' },
  { value: 'assinatura_contrato', label: 'Assinatura de contrato' },
  { value: 'cliente_fechado', label: 'Cliente fechado' },
  { value: 'cliente_perdido', label: 'Cliente perdido' },
];

function stageLabel(stage: Stage) {
  return STAGES.find((row) => row.value === stage)?.label ?? stage;
}

function toBRL(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizeStage(value: string | null | undefined): Stage {
  if (value === 'lead') return 'conhecendo_cliente';
  if (value === 'proposal') return 'analisando_orcamento';
  if (value === 'won') return 'cliente_fechado';
  if (value === 'lost') return 'cliente_perdido';
  if (value === 'conhecendo_cliente') return value;
  if (value === 'analisando_orcamento') return value;
  if (value === 'assinatura_contrato') return value;
  if (value === 'cliente_fechado') return value;
  if (value === 'cliente_perdido') return value;
  return 'conhecendo_cliente';
}

const WIN_RATE_BY_STAGE: Record<Stage, number> = {
  conhecendo_cliente: 0.2,
  analisando_orcamento: 0.45,
  assinatura_contrato: 0.75,
  cliente_fechado: 1,
  cliente_perdido: 0,
};

export function ClientsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [followups, setFollowups] = useState<FollowupTask[]>([]);
  const [interactionsByClient, setInteractionsByClient] = useState<Record<string, LeadInteraction[]>>({});
  const [funnelMetrics, setFunnelMetrics] = useState<FunnelMetric[]>([]);
  const [pipelineForecast, setPipelineForecast] = useState<PipelineForecast[]>([]);
  const [priorityQueue, setPriorityQueue] = useState<PriorityQueueItem[]>([]);
  const [executionMetrics, setExecutionMetrics] = useState<ExecutionMetric[]>([]);
  const [docsByClient, setDocsByClient] = useState<Record<string, ClientDoc[]>>({});
  const [reqByClient, setReqByClient] = useState<Record<string, SignReq[]>>({});
  const [consentByClient, setConsentByClient] = useState<Record<string, ConsentRecord[]>>({});

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | Stage>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    stage: 'conhecendo_cliente' as Stage,
    eventType: '',
    eventDate: '',
    budgetExpected: '',
    notes: '',
  });

  const [interactionForm, setInteractionForm] = useState({
    channel: 'whatsapp' as LeadInteraction['channel'],
    direction: 'outbound' as LeadInteraction['direction'],
    summary: '',
    next_followup_at: '',
  });
  const [budgetText, setBudgetText] = useState('');
  const [contractText, setContractText] = useState('');
  const [consentBasis, setConsentBasis] = useState<ConsentRecord['lawful_basis']>('consentimento');
  const [consentNote, setConsentNote] = useState('');
  const [savingDoc, setSavingDoc] = useState<DocType | null>(null);
  const [sendingSignature, setSendingSignature] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    const clientsRes = await supabase
      .from('crm_clients')
      .select('id,name,email,phone,stage,event_type,event_date_expected,budget_expected,notes,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (clientsRes.error) {
      setError(clientsRes.error.message);
      setLoading(false);
      return;
    }

    const clientRows = ((clientsRes.data ?? []) as any[]).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      email: row.email ?? null,
      phone: row.phone ?? null,
      stage: normalizeStage(row.stage),
      event_type: row.event_type ?? null,
      event_date_expected: row.event_date_expected ?? null,
      budget_expected: Number.isFinite(Number(row.budget_expected)) ? Number(row.budget_expected) : null,
      notes: row.notes ?? null,
      created_at: String(row.created_at ?? new Date().toISOString()),
    })) as ClientItem[];

    const clientIds = clientRows.map((row) => row.id);

    const [interactionsRes, followupsRes, docsRes, reqRes, consentRes, funnelRes, forecastRes, priorityRes, executionRes] = await Promise.all([
      clientIds.length > 0
        ? supabase
            .from('crm_lead_interactions')
            .select('id,user_id,client_id,channel,direction,summary,happened_at,next_followup_at')
            .in('client_id', clientIds)
            .order('happened_at', { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('crm_followup_tasks')
        .select('id,user_id,client_id,title,reason,due_date,status,created_at')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('due_date', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(500),
      clientIds.length > 0
        ? supabase
            .from('crm_client_documents')
            .select('id,client_id,doc_type,title,content,status')
            .in('client_id', clientIds)
        : Promise.resolve({ data: [], error: null }),
      clientIds.length > 0
        ? supabase
            .from('crm_signature_requests')
            .select('id,client_id,token,status,created_at')
            .in('client_id', clientIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      clientIds.length > 0
        ? supabase
            .from('crm_consent_records')
            .select('id,user_id,client_id,lawful_basis,consent_text_version,consent_note,source,consented_at')
            .in('client_id', clientIds)
            .order('consented_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase.rpc('get_crm_funnel_metrics'),
      supabase.rpc('get_crm_pipeline_forecast'),
      supabase.rpc('get_crm_priority_queue', { p_limit: 12 }),
      supabase.rpc('get_crm_execution_metrics'),
    ]);

    const groupedInteractions: Record<string, LeadInteraction[]> = {};
    ((interactionsRes.data ?? []) as LeadInteraction[]).forEach((row) => {
      groupedInteractions[row.client_id] = [...(groupedInteractions[row.client_id] ?? []), row];
    });
    const groupedDocs: Record<string, ClientDoc[]> = {};
    ((docsRes.data ?? []) as ClientDoc[]).forEach((row) => {
      groupedDocs[row.client_id] = [...(groupedDocs[row.client_id] ?? []), row];
    });
    const groupedReq: Record<string, SignReq[]> = {};
    ((reqRes.data ?? []) as SignReq[]).forEach((row) => {
      groupedReq[row.client_id] = [...(groupedReq[row.client_id] ?? []), row];
    });
    const groupedConsent: Record<string, ConsentRecord[]> = {};
    ((consentRes.data ?? []) as ConsentRecord[]).forEach((row) => {
      groupedConsent[row.client_id] = [...(groupedConsent[row.client_id] ?? []), row];
    });

    const fallbackFunnel: FunnelMetric[] = STAGES.map((stage) => ({
      stage: stage.value,
      leads: clientRows.filter((row) => row.stage === stage.value).length,
      avg_days_in_stage: 0,
      conversion_rate: WIN_RATE_BY_STAGE[stage.value],
    }));

    const fallbackForecast: PipelineForecast[] = STAGES.map((stage) => {
      const rows = clientRows.filter((row) => row.stage === stage.value);
      const total = rows.reduce((sum, row) => sum + Number(row.budget_expected ?? 0), 0);
      const winRate = WIN_RATE_BY_STAGE[stage.value];
      return {
        stage: stage.value,
        leads: rows.length,
        total_budget: total,
        weighted_budget: total * winRate,
        win_rate: winRate,
      };
    });

    const fallbackPriority: PriorityQueueItem[] = clientRows
      .filter((row) => row.stage !== 'cliente_fechado' && row.stage !== 'cliente_perdido')
      .slice(0, 12)
      .map((row, index) => ({
        client_id: row.id,
        client_name: row.name,
        stage: row.stage,
        priority_score: 100 - index,
        priority_reason: 'Sem priorizaçúo RPC, usando fallback local.',
        next_action: 'Registrar interaçúo e próximo follow-up',
        due_date: row.event_date_expected,
      }));

    const fallbackExecution: ExecutionMetric[] = [
      { metric: 'tarefas_playbook_abertas', value: followupsRes.data?.length ?? 0 },
      { metric: 'clientes_ativos_sem_playbook', value: clientRows.filter((row) => row.stage !== 'cliente_fechado' && row.stage !== 'cliente_perdido').length },
    ];

    setClients(clientRows);
    setInteractionsByClient(groupedInteractions);
    setFollowups((followupsRes.data ?? []) as FollowupTask[]);
    setDocsByClient(groupedDocs);
    setReqByClient(groupedReq);
    setConsentByClient(groupedConsent);
    setFunnelMetrics(funnelRes.error ? fallbackFunnel : ((funnelRes.data as FunnelMetric[]) ?? fallbackFunnel));
    setPipelineForecast(forecastRes.error ? fallbackForecast : ((forecastRes.data as PipelineForecast[]) ?? fallbackForecast));
    setPriorityQueue(priorityRes.error ? fallbackPriority : ((priorityRes.data as PriorityQueueItem[]) ?? fallbackPriority));
    setExecutionMetrics(executionRes.error ? fallbackExecution : ((executionRes.data as ExecutionMetric[]) ?? fallbackExecution));

    setSelectedId((prev) => {
      if (prev && clientRows.some((row) => row.id === prev)) return prev;
      return clientRows[0]?.id ?? null;
    });

    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clients.filter((row) => {
      if (stageFilter !== 'all' && row.stage !== stageFilter) return false;
      if (!term) return true;
      return `${row.name} ${row.email ?? ''} ${row.phone ?? ''}`.toLowerCase().includes(term);
    });
  }, [clients, search, stageFilter]);

  const stageBuckets = useMemo(() => {
    const buckets: Record<Stage, ClientItem[]> = {
      conhecendo_cliente: [],
      analisando_orcamento: [],
      assinatura_contrato: [],
      cliente_fechado: [],
      cliente_perdido: [],
    };
    filtered.forEach((row) => {
      buckets[row.stage].push(row);
    });
    return buckets;
  }, [filtered]);

  const selected = useMemo(() => clients.find((row) => row.id === selectedId) ?? null, [clients, selectedId]);
  const selectedInteractions = useMemo(() => (selected ? interactionsByClient[selected.id] ?? [] : []), [interactionsByClient, selected]);
  const selectedFollowups = useMemo(() => (selected ? followups.filter((row) => row.client_id === selected.id) : []), [followups, selected]);
  const selectedDocs = useMemo(() => (selected ? docsByClient[selected.id] ?? [] : []), [docsByClient, selected]);
  const selectedReq = useMemo(() => (selected ? reqByClient[selected.id] ?? [] : []), [reqByClient, selected]);
  const selectedConsent = useMemo(() => (selected ? consentByClient[selected.id] ?? [] : []), [consentByClient, selected]);

  const weightedPipeline = useMemo(
    () => pipelineForecast.reduce((sum, row) => sum + Number(row.weighted_budget ?? 0), 0),
    [pipelineForecast],
  );

  const conversionRate = useMemo(() => {
    const totalLeads = pipelineForecast.reduce((sum, row) => sum + row.leads, 0);
    if (totalLeads === 0) return 0;
    const avgWinRate = pipelineForecast.reduce((sum, row) => sum + row.leads * row.win_rate, 0) / totalLeads;
    return Math.round(avgWinRate * 100);
  }, [pipelineForecast]);

  useEffect(() => {
    if (!selected) {
      setBudgetText('');
      setContractText('');
      return;
    }
    const budgetDoc = selectedDocs.find((row) => row.doc_type === 'budget');
    const contractDoc = selectedDocs.find((row) => row.doc_type === 'contract');
    setBudgetText(
      budgetDoc?.content ??
        `Proposta comercial para ${selected.name}\n\nEscopo:\n- Planejamento\n- Fornecedores\n- Operaçúo`,
    );
    setContractText(
      contractDoc?.content ??
        `Contrato de prestaçúo de serviços\n\nContratante: ${selected.name}\n\nClíusulas:\n1. Objeto\n2. Pagamento\n3. Cancelamento`,
    );
  }, [selected, selectedDocs]);

  async function createClient() {
    if (!user || saving || !form.name.trim()) return;
    setSaving(true);
    setError('');

    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      stage: form.stage,
      event_type: form.eventType.trim() || null,
      event_date_expected: form.eventDate.trim() || null,
      budget_expected: Number.isFinite(Number(form.budgetExpected)) ? Number(form.budgetExpected) : null,
      notes: form.notes.trim() || null,
    };

    const { error: insertError } = await supabase.from('crm_clients').insert(payload);
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setForm({
      name: '',
      email: '',
      phone: '',
      stage: 'conhecendo_cliente',
      eventType: '',
      eventDate: '',
      budgetExpected: '',
      notes: '',
    });
    setOpenCreate(false);
    await loadData();
  }

  async function setStage(clientId: string, stage: Stage) {
    const { error: updateError } = await supabase.from('crm_clients').update({ stage }).eq('id', clientId);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setClients((prev) => prev.map((row) => (row.id === clientId ? { ...row, stage } : row)));
  }

  async function addInteraction() {
    if (!user || !selected || !interactionForm.summary.trim()) return;

    const { data, error: insertError } = await supabase
      .from('crm_lead_interactions')
      .insert({
        user_id: user.id,
        client_id: selected.id,
        channel: interactionForm.channel,
        direction: interactionForm.direction,
        summary: interactionForm.summary.trim(),
        happened_at: new Date().toISOString(),
        next_followup_at: interactionForm.next_followup_at || null,
      })
      .select('id,user_id,client_id,channel,direction,summary,happened_at,next_followup_at')
      .maybeSingle();

    if (insertError || !data) {
      setError(insertError?.message ?? 'Núo foi possível registrar a interaçúo.');
      return;
    }

    setInteractionsByClient((prev) => ({
      ...prev,
      [selected.id]: [data as LeadInteraction, ...(prev[selected.id] ?? [])],
    }));

    setInteractionForm((prev) => ({ ...prev, summary: '', next_followup_at: '' }));
    await generateFollowups();
  }

  async function markFollowupDone(taskId: string) {
    if (!user) return;
    const { error: updateError } = await supabase
      .from('crm_followup_tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('user_id', user.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setFollowups((prev) => prev.filter((row) => row.id !== taskId));
  }

  async function generateFollowups() {
    if (!user) return;
    const { error: rpcError } = await supabase.rpc('generate_crm_followups_for_user', { p_user_id: user.id });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const { data } = await supabase
      .from('crm_followup_tasks')
      .select('id,user_id,client_id,title,reason,due_date,status,created_at')
      .eq('user_id', user.id)
      .eq('status', 'open')
      .order('due_date', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(500);
    setFollowups((data ?? []) as FollowupTask[]);
  }

  async function generatePlaybookTasks() {
    if (!user) return;
    const { error: rpcError } = await supabase.rpc('generate_crm_stage_playbook_tasks', { p_user_id: user.id });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await generateFollowups();
  }

  async function upsertDoc(type: DocType, content: string, status: ClientDoc['status'] = 'draft') {
    if (!selected || !user) return null;
    setSavingDoc(type);
    const existing = selectedDocs.find((row) => row.doc_type === type);

    if (!existing) {
      const { data, error: insertError } = await supabase
        .from('crm_client_documents')
        .insert({
          user_id: user.id,
          client_id: selected.id,
          doc_type: type,
          title: `${type === 'budget' ? 'Orçamento' : 'Contrato'} - ${selected.name}`,
          content,
          status,
        })
        .select('id,client_id,doc_type,title,content,status')
        .maybeSingle();
      setSavingDoc(null);
      if (insertError || !data) {
        setError(insertError?.message ?? 'Núo foi possível salvar documento.');
        return null;
      }
      const inserted = data as ClientDoc;
      setDocsByClient((prev) => ({ ...prev, [selected.id]: [...(prev[selected.id] ?? []), inserted] }));
      return inserted;
    }

    const { data, error: updateError } = await supabase
      .from('crm_client_documents')
      .update({ content, status, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('id,client_id,doc_type,title,content,status')
      .maybeSingle();
    setSavingDoc(null);
    if (updateError || !data) {
      setError(updateError?.message ?? 'Núo foi possível atualizar documento.');
      return null;
    }
    const updated = data as ClientDoc;
    setDocsByClient((prev) => ({
      ...prev,
      [selected.id]: (prev[selected.id] ?? []).map((row) => (row.id === updated.id ? updated : row)),
    }));
    return updated;
  }

  async function sendForSignature() {
    if (!selected || !user || sendingSignature) return;
    setSendingSignature(true);
    const doc = await upsertDoc('contract', contractText, 'pending_signature');
    if (!doc) {
      setSendingSignature(false);
      return;
    }
    const expires = new Date();
    expires.setDate(expires.getDate() + 15);
    const { data, error: reqError } = await supabase
      .from('crm_signature_requests')
      .insert({
        user_id: user.id,
        client_id: selected.id,
        document_id: doc.id,
        client_name: selected.name,
        client_email: selected.email,
        status: 'pending',
        expires_at: expires.toISOString(),
      })
      .select('id,client_id,token,status,created_at')
      .maybeSingle();
    setSendingSignature(false);
    if (reqError || !data) {
      setError(reqError?.message ?? 'Núo foi possível enviar para assinatura.');
      return;
    }
    const req = data as SignReq;
    setReqByClient((prev) => ({ ...prev, [selected.id]: [req, ...(prev[selected.id] ?? [])] }));
    const base = process.env.EXPO_PUBLIC_BASE_SIGNATURE_URL || 'https://painelprime.com.br/assinatura';
    const link = `${base}/${req.token}`;
    await Share.share({ message: `Assinatura de contrato - ${selected.name}\n${link}` });
  }

  async function addConsent() {
    if (!selected || !user || savingConsent) return;
    setSavingConsent(true);
    const { data, error: consentError } = await supabase
      .from('crm_consent_records')
      .insert({
        user_id: user.id,
        client_id: selected.id,
        lawful_basis: consentBasis,
        consent_text_version: 'v1',
        consent_note: consentNote.trim() || null,
        source: 'manual',
        consented_at: new Date().toISOString(),
      })
      .select('id,user_id,client_id,lawful_basis,consent_text_version,consent_note,source,consented_at')
      .maybeSingle();
    setSavingConsent(false);
    if (consentError || !data) {
      setError(consentError?.message ?? 'Núo foi possível registrar consentimento.');
      return;
    }
    setConsentNote('');
    const row = data as ConsentRecord;
    setConsentByClient((prev) => ({ ...prev, [selected.id]: [row, ...(prev[selected.id] ?? [])] }));
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
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Clientes</Text>
          <Text style={styles.subtitle}>{clients.length} cliente{clients.length !== 1 ? 's' : ''} no funil</Text>
        </View>
                  <View style={styles.rowBtns}>
            <Pressable style={styles.btn} onPress={() => setOpenCreate(true)}>
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.btnText}>Novo</Text>
            </Pressable>
          </View>
              </View>

      {error ? <Text style={styles.err}>{error}</Text> : null}

      <View style={styles.statsRow}>
        <StatCardPremium title="Clientes" value={clients.length} icon="people" gradient="royal" subtitle="base total" />
        <StatCardPremium title="Follow-ups" value={followups.length} icon="checkbox" gradient="gold" subtitle="abertos" />
      </View>
      <View style={[styles.statsRow, { marginTop: spacing.sm }]}>
        <StatCardPremium title="Funil" value={toBRL(weightedPipeline)} icon="cash" gradient="success" subtitle="valor ponderado" />
        <StatCardPremium title="Taxa" value={`${conversionRate}%`} icon="trending-up" gradient="info" subtitle="conversúo" />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader icon="search" title="Funil de vendas" subtitle="Arraste para ver todas as etapas" />
      </View>

            <View style={styles.pipelineSection}>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome/email/telefone"
          placeholderTextColor={colors.mutedText}
        />
        <View style={styles.rowBtns}>
          <StagePill label="Todos" selected={stageFilter === 'all'} onPress={() => setStageFilter('all')} />
          {STAGES.map((stage) => (
            <StagePill
              key={stage.value}
              label={stage.label}
              selected={stageFilter === stage.value}
              onPress={() => setStageFilter(stage.value)}
            />
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boardRow}>
          {STAGES.map((stage) => (
              <View key={stage.value} style={styles.column}>
                <Text style={styles.columnTitle}>{stage.label}</Text>
                <Text style={styles.columnCount}>{stageBuckets[stage.value].length}</Text>
                {stageBuckets[stage.value].slice(0, 20).map((client) => (
                  <Pressable
                    key={client.id}
                    style={[styles.clientCard, selectedId === client.id && styles.clientCardOn]}
                    onPress={() => setSelectedId(client.id)}
                  >
                    <Text style={styles.clientName}>{client.name}</Text>
                    <Text style={styles.clientMeta}>{client.event_type || 'Evento núo definido'}</Text>
                    <Text style={styles.clientMeta}>{client.event_date_expected || 'Sem data'}</Text>
                    <Text style={styles.clientBudget}>{toBRL(Number(client.budget_expected ?? 0))}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>

      {selected ? (
                  <View style={styles.card}>
          <Text style={styles.cardTitle}>Cliente selecionado: {selected.name}</Text>
          <Text style={styles.caption}>{selected.email || '-'} | {selected.phone || '-'}</Text>
          <Text style={styles.caption}>Etapa atual: {stageLabel(selected.stage)}</Text>
          <View style={styles.rowBtns}>
            {STAGES.map((stage) => (
              <Pressable key={stage.value} style={[styles.btnGhost, selected.stage === stage.value && styles.btnStageOn]} onPress={() => void setStage(selected.id, stage.value)}>
                <Text style={styles.smallText}>{stage.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.cardSubTitle}>Registrar interaçúo</Text>
          <View style={styles.rowBtns}>
            <Pressable style={[styles.btnGhost, interactionForm.channel === 'whatsapp' && styles.btnStageOn]} onPress={() => setInteractionForm((prev) => ({ ...prev, channel: 'whatsapp' }))}><Text style={styles.smallText}>WhatsApp</Text></Pressable>
            <Pressable style={[styles.btnGhost, interactionForm.channel === 'email' && styles.btnStageOn]} onPress={() => setInteractionForm((prev) => ({ ...prev, channel: 'email' }))}><Text style={styles.smallText}>Email</Text></Pressable>
            <Pressable style={[styles.btnGhost, interactionForm.channel === 'ligacao' && styles.btnStageOn]} onPress={() => setInteractionForm((prev) => ({ ...prev, channel: 'ligacao' }))}><Text style={styles.smallText}>Ligaçúo</Text></Pressable>
          </View>
          <View style={styles.rowBtns}>
            <Pressable style={[styles.btnGhost, interactionForm.direction === 'outbound' && styles.btnStageOn]} onPress={() => setInteractionForm((prev) => ({ ...prev, direction: 'outbound' }))}><Text style={styles.smallText}>Saida</Text></Pressable>
            <Pressable style={[styles.btnGhost, interactionForm.direction === 'inbound' && styles.btnStageOn]} onPress={() => setInteractionForm((prev) => ({ ...prev, direction: 'inbound' }))}><Text style={styles.smallText}>Entrada</Text></Pressable>
          </View>
          <TextInput style={styles.input} value={interactionForm.summary} onChangeText={(value) => setInteractionForm((prev) => ({ ...prev, summary: value }))} placeholder="Resumo da interaçúo" />
          <TextInput style={styles.input} value={interactionForm.next_followup_at} onChangeText={(value) => setInteractionForm((prev) => ({ ...prev, next_followup_at: value }))} placeholder="Próximo follow-up (YYYY-MM-DD)" />
          <Pressable style={styles.btn} onPress={() => void addInteraction()}>
            <Text style={styles.btnText}>Salvar interaçúo</Text>
          </Pressable>

          <Text style={styles.cardSubTitle}>Follow-ups do cliente</Text>
          {selectedFollowups.length === 0 ? <Text style={styles.caption}>Sem follow-up aberto.</Text> : null}
          {selectedFollowups.map((task) => (
            <View key={task.id} style={styles.taskRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{task.title}</Text>
                <Text style={styles.caption}>{task.due_date}</Text>
              </View>
              <Pressable style={styles.btnGhost} onPress={() => void markFollowupDone(task.id)}>
                <Text style={styles.smallText}>Concluir</Text>
              </Pressable>
            </View>
          ))}

          <Text style={styles.cardSubTitle}>Histórico de interaçÁes</Text>
          {selectedInteractions.length === 0 ? <Text style={styles.caption}>Sem interaçÁes registradas.</Text> : null}
          {selectedInteractions.slice(0, 12).map((interaction) => (
            <View key={interaction.id} style={styles.taskRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{interaction.summary}</Text>
                <Text style={styles.caption}>
                  {interaction.channel} | {interaction.direction} | {new Date(interaction.happened_at).toLocaleString('pt-BR')}
                </Text>
              </View>
            </View>
          ))}

          <Text style={styles.cardSubTitle}>Documentos e assinatura</Text>
          <TextInput
            style={[styles.input, styles.areaLarge]}
            value={budgetText}
            onChangeText={setBudgetText}
            placeholder="Orçamento (texto)"
            multiline
          />
          <View style={styles.rowBtns}>
            <Pressable style={styles.btnGhost} onPress={() => void upsertDoc('budget', budgetText, 'draft')}>
              <Text style={styles.smallText}>{savingDoc === 'budget' ? 'Salvando...' : 'Salvar orçamento'}</Text>
            </Pressable>
          </View>
          <TextInput
            style={[styles.input, styles.areaLarge]}
            value={contractText}
            onChangeText={setContractText}
            placeholder="Contrato (texto)"
            multiline
          />
          <View style={styles.rowBtns}>
            <Pressable style={styles.btnGhost} onPress={() => void upsertDoc('contract', contractText, 'draft')}>
              <Text style={styles.smallText}>{savingDoc === 'contract' ? 'Salvando...' : 'Salvar contrato'}</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => void sendForSignature()}>
              <Text style={styles.btnText}>{sendingSignature ? 'Enviando...' : 'Enviar assinatura'}</Text>
            </Pressable>
          </View>
          {selectedReq.length === 0 ? <Text style={styles.caption}>Nenhuma assinatura enviada.</Text> : null}
          {selectedReq.slice(0, 6).map((req) => (
            <View key={req.id} style={styles.taskRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>Assinatura {req.status}</Text>
                <Text style={styles.caption}>{new Date(req.created_at).toLocaleString('pt-BR')}</Text>
              </View>
              <Pressable
                style={styles.btnGhost}
                onPress={() =>
                  void Share.share({
                    message: `${process.env.EXPO_PUBLIC_BASE_SIGNATURE_URL || 'https://painelprime.com.br/assinatura'}/${req.token}`,
                  })
                }
              >
                <Text style={styles.smallText}>Compartilhar link</Text>
              </Pressable>
            </View>
          ))}

          <Text style={styles.cardSubTitle}>Consentimento (LGPD)</Text>
          <View style={styles.rowBtns}>
            <Pressable style={[styles.btnGhost, consentBasis === 'consentimento' && styles.btnStageOn]} onPress={() => setConsentBasis('consentimento')}>
              <Text style={styles.smallText}>Consentimento</Text>
            </Pressable>
            <Pressable style={[styles.btnGhost, consentBasis === 'execucao_contrato' && styles.btnStageOn]} onPress={() => setConsentBasis('execucao_contrato')}>
              <Text style={styles.smallText}>Execucao contrato</Text>
            </Pressable>
            <Pressable style={[styles.btnGhost, consentBasis === 'legitimo_interesse' && styles.btnStageOn]} onPress={() => setConsentBasis('legitimo_interesse')}>
              <Text style={styles.smallText}>Legitimo interesse</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            value={consentNote}
            onChangeText={setConsentNote}
            placeholder="Observaçúo de consentimento"
          />
          <Pressable style={styles.btnGhost} onPress={() => void addConsent()}>
            <Text style={styles.smallText}>{savingConsent ? 'Registrando...' : 'Registrar consentimento'}</Text>
          </Pressable>
          {selectedConsent.length === 0 ? <Text style={styles.caption}>Sem registros de consentimento.</Text> : null}
          {selectedConsent.slice(0, 6).map((row) => (
            <View key={row.id} style={styles.taskRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{row.lawful_basis}</Text>
                <Text style={styles.caption}>{new Date(row.consented_at).toLocaleString('pt-BR')}</Text>
              </View>
            </View>
          ))}
          </View>
              ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fila de prioridade</Text>
        {priorityQueue.length === 0 ? <Text style={styles.caption}>Sem dados de prioridade.</Text> : null}
        {priorityQueue.slice(0, 8).map((item) => (
          <View key={item.client_id} style={styles.taskRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.clientName}>{item.client_name}</Text>
              <Text style={styles.caption}>{item.priority_reason || item.next_action}</Text>
            </View>
            <Text style={styles.clientBudget}>{item.priority_score}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Forecast por etapa</Text>
        {pipelineForecast.map((row) => (
          <View key={row.stage} style={styles.taskRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.clientName}>{stageLabel(normalizeStage(row.stage))}</Text>
              <Text style={styles.caption}>{row.leads} leads | taxa {Math.round(Number(row.win_rate ?? 0) * 100)}%</Text>
            </View>
            <Text style={styles.clientBudget}>{toBRL(Number(row.weighted_budget ?? 0))}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Execucao CRM</Text>
        {executionMetrics.length === 0 ? <Text style={styles.caption}>Sem metricas retornadas.</Text> : null}
        {executionMetrics.map((metric) => (
          <View key={metric.metric} style={styles.taskRow}>
            <Text style={styles.clientName}>{metric.metric}</Text>
            <Text style={styles.clientBudget}>{metric.value}</Text>
          </View>
        ))}
        {funnelMetrics.length > 0 ? <Text style={styles.cardSubTitle}>Funil</Text> : null}
        {funnelMetrics.map((metric) => (
          <View key={metric.stage} style={styles.taskRow}>
            <Text style={styles.clientName}>{stageLabel(normalizeStage(metric.stage))}</Text>
            <Text style={styles.caption}>{metric.leads} leads</Text>
          </View>
        ))}
      </View>

      <Modal visible={openCreate} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Novo cliente</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="Nome" />
            <TextInput style={styles.input} value={form.email} onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))} placeholder="Email" />
            <TextInput style={styles.input} value={form.phone} onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))} placeholder="Telefone" />
            <TextInput style={styles.input} value={form.eventType} onChangeText={(value) => setForm((prev) => ({ ...prev, eventType: value }))} placeholder="Tipo de evento" />
            <TextInput style={styles.input} value={form.eventDate} onChangeText={(value) => setForm((prev) => ({ ...prev, eventDate: value }))} placeholder="Data esperada (YYYY-MM-DD)" />
            <TextInput style={styles.input} value={form.budgetExpected} onChangeText={(value) => setForm((prev) => ({ ...prev, budgetExpected: value }))} placeholder="Orçamento esperado" keyboardType="numeric" />
            <TextInput style={[styles.input, styles.area]} value={form.notes} onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))} placeholder="Notas" multiline />
            <View style={styles.rowBtns}>
              {STAGES.map((stage) => (
                <Pressable key={stage.value} style={[styles.btnGhost, form.stage === stage.value && styles.btnStageOn]} onPress={() => setForm((prev) => ({ ...prev, stage: stage.value }))}>
                  <Text style={styles.smallText}>{stage.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.rowBtns}>
              <Pressable style={styles.btnGhost} onPress={() => setOpenCreate(false)}>
                <Text style={styles.smallText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => void createClient()}>
                <Text style={styles.btnText}>{saving ? 'Salvando...' : 'Salvar cliente'}</Text>
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

function StagePill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.btnGhost, selected && styles.btnStageOn]} onPress={onPress}>
      <Text style={styles.smallText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10, paddingBottom: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  subtitle: { color: colors.mutedText, fontSize: 13 },
  err: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 8 },
  rowBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statsRow: { flexDirection: 'row', gap: 8 },
  pipelineSection: { gap: 8 },
  btn: { minHeight: 38, borderRadius: 10, backgroundColor: colors.primary, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.primaryTextOn, fontWeight: '700', fontSize: 12 },
  btnGhost: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  btnStageOn: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
  smallText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: colors.text, backgroundColor: colors.card },
  area: { minHeight: 80, textAlignVertical: 'top' },
  areaLarge: { minHeight: 140, textAlignVertical: 'top' },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricCard: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, gap: 4 },
  metricLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '600' },
  metricValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
  metricSub: { color: colors.mutedText, fontSize: 11 },
  boardRow: { gap: 10, paddingVertical: 4 },
  column: { width: 250, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, gap: 8 },
  columnTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
  columnCount: { color: colors.mutedText, fontSize: 12 },
  clientCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8, gap: 3, backgroundColor: '#FFFFFF' },
  clientCardOn: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
  clientName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  clientMeta: { color: colors.mutedText, fontSize: 11 },
  clientBudget: { color: colors.primaryStrong, fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, gap: 8 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardSubTitle: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 4 },
  caption: { color: colors.mutedText, fontSize: 12 },
  taskRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', padding: 16, justifyContent: 'center' },
  modalCard: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
});
