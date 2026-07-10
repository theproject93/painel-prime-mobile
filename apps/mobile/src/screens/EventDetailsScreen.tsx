import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { EventTablesVisualMap } from '../components/EventTablesVisualMap';
import { useAuth } from '../contexts/AuthContext';
import {
  deleteStoredFile,
  getPrivateFileDownloadUrl,
  linkStoredFile,
  uploadPrivateAsset,
} from '../lib/r2FileStorage';
import { supabase } from '../lib/supabase';
import { isEventDetailsInitialTab } from '../navigation/eventRouteTypes';
import { colors } from '../theme/colors';

type Tab = 'overview' | 'command' | 'history' | 'tasks' | 'budget' | 'guests' | 'timeline' | 'vendors' | 'documents' | 'notes' | 'team' | 'tables' | 'invites' | 'catalog' | 'portal' | 'presentes' | 'analytics';
type DataKey = 'tasks' | 'expenses' | 'payments' | 'guests' | 'timeline' | 'vendors' | 'documents' | 'notes' | 'team' | 'tables';
type VisibleKey = 'tasks' | 'guests' | 'vendors' | 'documents' | 'timeline';
const PAGE_SIZE = 50;

type EventRow = {
  id: string;
  name: string;
  couple: string | null;
  couple_photo_file_id?: string | null;
  couple_photo_url: string | null;
  event_date: string;
  location: string | null;
  status: string | null;
  budget_total: number | null;
  invite_message_template: string | null;
  invite_dress_code: string | null;
  created_at: string;
};

type SmartTimelineSuggestion = {
  id: string;
  title: string;
  reason: string;
  activity: string;
  time: string;
  assignee: string;
  priority: 'high' | 'normal';
  source: 'rules' | 'ai';
};

type PaymentMethod = 'pix' | 'dinheiro' | 'debito' | 'credito' | 'boleto' | 'transferencia' | 'outro';
type HistoryKind = 'event' | 'task' | 'guest' | 'timeline' | 'vendor' | 'document' | 'expense' | 'payment' | 'invite' | 'rsvp';
type PaymentMeta = {
  receipt_document_id?: string | null;
};
type AlertLevel = 'error' | 'warning' | 'info';
type OverviewAlert = {
  type: AlertLevel;
  message: string;
};
type ProjectMilestoneKind = 'start' | 'vendor' | 'guest' | 'expense' | 'document' | 'payment' | 'invite' | 'rsvp';
type ProjectMilestone = {
  id: string;
  date: Date;
  dayNumber: number;
  title: string;
  detail: string;
  kind: ProjectMilestoneKind;
};
type CommandVendorStatus = 'pending' | 'en_route' | 'arrived' | 'done';
type CommandStatusRow = {
  vendor_id: string;
  status: CommandVendorStatus;
  created_at: string;
  updated_by: 'assessoria' | 'fornecedor';
  note: string | null;
};
type CommandConfig = {
  lead_minutes: number[];
  late_grace_minutes: number;
};
type CommandIncidentRow = {
  id: string;
  event_id: string;
  vendor_id: string | null;
  severity: 'warning' | 'critical';
  status: 'open' | 'resolved';
  title: string;
  note: string | null;
  action_plan: string | null;
  created_at: string;
  resolved_at: string | null;
  vendor?:
    | {
        name: string;
        category: string;
      }
    | {
        name: string;
        category: string;
      }[]
    | null;
};
type CommandComputedAlert = {
  vendor_id: string;
  alert_type: 'arrival_pre_alert' | 'arrival_late' | 'done_late';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  dedupe_key: string;
};

const CHART_COLORS = ['#D4AF37', '#0EA5E9', '#22C55E', '#F97316', '#A855F7', '#EF4444'];

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Visão Geral' },
  { key: 'command', label: 'Torre de Comando' },
  { key: 'history', label: 'Histórico' },
  { key: 'tasks', label: 'Tarefas' },
  { key: 'budget', label: 'Orçamento' },
  { key: 'guests', label: 'Convidados' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'vendors', label: 'Fornecedores' },
  { key: 'documents', label: 'Documentos' },
  { key: 'notes', label: 'Notas' },
  { key: 'team', label: 'Equipe' },
  { key: 'tables', label: 'Mesas' },
  { key: 'invites', label: 'Convites' },
  { key: 'catalog', label: 'Catálogo' },
  { key: 'portal', label: 'Portal do Cliente' },
  { key: 'presentes', label: 'Presentes' },
  { key: 'analytics', label: 'Relatório de Encerramento' },
];

const TABLE_BY_KEY: Record<DataKey, string> = {
  tasks: 'event_tasks',
  expenses: 'event_expenses',
  payments: 'expense_payments',
  guests: 'event_guests',
  timeline: 'event_timeline',
  vendors: 'event_vendors',
  documents: 'event_documents',
  notes: 'event_notes',
  team: 'event_team_members',
  tables: 'event_tables',
};

const TAB_KEYS: Record<Tab, DataKey[]> = {
  overview: ['expenses', 'payments', 'tasks', 'guests', 'timeline', 'vendors'],
  command: ['expenses', 'payments', 'tasks', 'guests', 'timeline', 'vendors'],
  history: ['tasks', 'guests', 'timeline', 'vendors', 'documents', 'expenses', 'payments'],
  tasks: ['tasks'],
  budget: ['expenses', 'payments'],
  guests: ['guests'],
  timeline: ['timeline'],
  vendors: ['vendors'],
  documents: ['documents', 'vendors'],
  notes: ['notes'],
  team: ['team'],
  tables: ['tables', 'guests'],
  invites: ['guests'],
  catalog: ['vendors'],
  portal: ['guests'],
  presentes: ['guests'],
  analytics: ['expenses', 'payments'],
};

export function EventDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[]; initialTab?: string | string[] }>();
  const eventId = Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '';
  const initialTabParam = Array.isArray(params.initialTab) ? params.initialTab[0] : params.initialTab;
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [loadingTab, setLoadingTab] = useState(false);
  const [loadingMore, setLoadingMore] = useState<DataKey | null>(null);
  const [error, setError] = useState('');
  const [data, setData] = useState<Record<DataKey, any[]>>({
    tasks: [], expenses: [], payments: [], guests: [], timeline: [],
    vendors: [], documents: [], notes: [], team: [], tables: [],
  });
  const [loaded, setLoaded] = useState<Record<DataKey, boolean>>({
    tasks: false, expenses: false, payments: false, guests: false, timeline: false,
    vendors: false, documents: false, notes: false, team: false, tables: false,
  });
  const [paging, setPaging] = useState<Record<DataKey, { page: number; hasMore: boolean }>>({
    tasks: { page: -1, hasMore: true },
    expenses: { page: -1, hasMore: true },
    payments: { page: -1, hasMore: true },
    guests: { page: -1, hasMore: true },
    timeline: { page: -1, hasMore: true },
    vendors: { page: -1, hasMore: true },
    documents: { page: -1, hasMore: true },
    notes: { page: -1, hasMore: true },
    team: { page: -1, hasMore: true },
    tables: { page: -1, hasMore: true },
  });
  const [f, setF] = useState({
    a: '', b: '', c: '', d: '', budgetTotal: '', inviteTemplate: '', inviteDress: '',
  });
  const [guestFilter, setGuestFilter] = useState<'all' | 'pending' | 'confirmed' | 'declined'>('all');
  const [guestSearch, setGuestSearch] = useState('');
  const [guestSort, setGuestSort] = useState<'name_asc' | 'name_desc'>('name_asc');
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorSort, setVendorSort] = useState<'name_asc' | 'name_desc' | 'status'>('name_asc');
  const [budgetVendorFilter, setBudgetVendorFilter] = useState('');
  const [budgetStatusFilter, setBudgetStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'paid' | 'cancelled'>('all');
  const [budgetVendorInput, setBudgetVendorInput] = useState('');
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentVendorFilter, setDocumentVendorFilter] = useState('');
  const [documentCategoryFilter, setDocumentCategoryFilter] = useState('');
  const [documentVendorInput, setDocumentVendorInput] = useState('');
  const [visible, setVisible] = useState<Record<VisibleKey, number>>({
    tasks: 40,
    guests: 40,
    vendors: 40,
    documents: 40,
    timeline: 40,
  });
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [tablesViewMode, setTablesViewMode] = useState<'list' | 'map'>('list');
  const [loadingAiTimelineSuggestions, setLoadingAiTimelineSuggestions] = useState(false);
  const [aiTimelineError, setAiTimelineError] = useState<string | null>(null);
  const [lastAiTimelineRunAt, setLastAiTimelineRunAt] = useState<string | null>(null);
  const [aiTimelineSuggestions, setAiTimelineSuggestions] = useState<SmartTimelineSuggestion[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'all' | HistoryKind>('all');
  const [documentReceiptFilterId, setDocumentReceiptFilterId] = useState('');
  const [budgetPaymentMethod, setBudgetPaymentMethod] = useState<PaymentMethod>('pix');
  const [budgetPaymentReceiptDocId, setBudgetPaymentReceiptDocId] = useState('');
  const [budgetPaymentNote, setBudgetPaymentNote] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');
  const [newVendorEmail, setNewVendorEmail] = useState('');
  const [newVendorArrival, setNewVendorArrival] = useState('');
  const [newVendorDone, setNewVendorDone] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [budgetCardDraft, setBudgetCardDraft] = useState('0');
  const [isBudgetCardEditing, setIsBudgetCardEditing] = useState(false);
  const [savingBudgetCard, setSavingBudgetCard] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [editingBasics, setEditingBasics] = useState(false);
  const [savingBasics, setSavingBasics] = useState(false);
  const [basicDraft, setBasicDraft] = useState({
    name: '',
    couple: '',
    eventDate: '',
    location: '',
  });
  const [commandStatuses, setCommandStatuses] = useState<CommandStatusRow[]>([]);
  const [commandIncidents, setCommandIncidents] = useState<CommandIncidentRow[]>([]);
  const [commandConfig, setCommandConfig] = useState<CommandConfig>({
    lead_minutes: [60, 30, 15],
    late_grace_minutes: 10,
  });
  const [commandLeadInput, setCommandLeadInput] = useState('60,30,15');
  const [commandGraceInput, setCommandGraceInput] = useState('10');
  const [savingCommandConfig, setSavingCommandConfig] = useState(false);
  const [savingCommandIncident, setSavingCommandIncident] = useState(false);
  const [resolvingIncidentId, setResolvingIncidentId] = useState<string | null>(null);
  const [commandIncidentForm, setCommandIncidentForm] = useState({
    vendor_id: '',
    severity: 'warning' as 'warning' | 'critical',
    title: '',
    action_plan: '',
    note: '',
  });

  useEffect(() => {
    void (async () => {
      setLoadingEvent(true);
      const { data: row, error: e } = await supabase
        .from('events')
        .select('id,name,couple,couple_photo_url,couple_photo_file_id,event_date,location,status,budget_total,invite_message_template,invite_dress_code,created_at')
        .eq('id', eventId)
        .single();
      if (e) setError(e.message);
      if (row) {
        let ev = row as EventRow;
        if (ev.couple_photo_file_id) {
          try {
            const signedUrl = await getPrivateFileDownloadUrl(ev.couple_photo_file_id);
            ev = { ...ev, couple_photo_url: signedUrl };
          } catch {
            // Keep legacy URL fallback.
          }
        }
        setEvent(ev);
        setF((s) => ({
          ...s,
          budgetTotal: String(Number(ev.budget_total ?? 0)),
          inviteTemplate: ev.invite_message_template?.trim() || 'Olá [Nome do Convidado], confirme sua presença: [LinkRSVP]',
          inviteDress: ev.invite_dress_code?.trim() || '',
        }));
        setBasicDraft({
          name: ev.name ?? '',
          couple: ev.couple ?? '',
          eventDate: ev.event_date ? String(ev.event_date).slice(0, 10) : '',
          location: ev.location ?? '',
        });
        setEditingBasics(false);
      }
      setLoadingEvent(false);
    })();
  }, [eventId]);

  useEffect(() => {
    if (initialTabParam && isEventDetailsInitialTab(initialTabParam)) {
      setActiveTab(initialTabParam);
    } else {
      setActiveTab('overview');
    }
  }, [eventId, initialTabParam]);

  useEffect(() => {
    setCommandStatuses([]);
    setCommandIncidents([]);
    setCommandConfig({ lead_minutes: [60, 30, 15], late_grace_minutes: 10 });
    setCommandLeadInput('60,30,15');
    setCommandGraceInput('10');
    setCommandIncidentForm({
      vendor_id: '',
      severity: 'warning',
      title: '',
      action_plan: '',
      note: '',
    });
  }, [eventId]);

  async function fetchKey(key: DataKey, page: number) {
    const order = key === 'payments' ? 'paid_at' : 'created_at';
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data: rows, error: e } = await supabase
      .from(TABLE_BY_KEY[key])
      .select('*')
      .eq('event_id', eventId)
      .order(order, { ascending: false })
      .range(from, to);
    if (e) throw new Error(e.message);
    return rows ?? [];
  }

  async function loadKey(key: DataKey, mode: 'reset' | 'append') {
    const page = mode === 'reset' ? 0 : paging[key].page + 1;
    const rows = await fetchKey(key, page);
    setData((s) => {
      if (mode === 'reset') return { ...s, [key]: rows };
      const ids = new Set(s[key].map((x) => x.id));
      const merged = [...s[key], ...rows.filter((x) => !ids.has(x.id))];
      return { ...s, [key]: merged };
    });
    setPaging((s) => ({
      ...s,
      [key]: { page, hasMore: rows.length === PAGE_SIZE },
    }));
    setLoaded((s) => ({ ...s, [key]: true }));
  }

  async function loadTab(tab: Tab, force = false) {
    const wanted = TAB_KEYS[tab];
    const todo = force ? wanted : wanted.filter((k) => !loaded[k]);
    if (todo.length === 0) return;
    setLoadingTab(true);
    setError('');
    try {
      await Promise.all(todo.map((key) => loadKey(key, 'reset')));
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar aba');
    } finally {
      setLoadingTab(false);
    }
  }

  async function loadMoreKey(key: DataKey) {
    if (!paging[key].hasMore || loadingMore === key) return;
    setLoadingMore(key);
    setError('');
    try {
      await loadKey(key, 'append');
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar mais registros');
    } finally {
      setLoadingMore(null);
    }
  }

  useEffect(() => {
    if (!loadingEvent) void loadTab(activeTab);
  }, [activeTab, loadingEvent]);

  async function loadCommandCenterData() {
    const [statusRes, incidentsRes, configRes] = await Promise.all([
      supabase
        .from('event_vendor_status')
        .select('vendor_id,status,created_at,updated_by,note')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(240),
      supabase
        .from('event_command_incidents')
        .select('id,event_id,vendor_id,severity,status,title,note,action_plan,created_at,resolved_at,vendor:event_vendors(name,category)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('event_command_config')
        .select('lead_minutes,late_grace_minutes')
        .eq('event_id', eventId)
        .maybeSingle(),
    ]);

    if (!statusRes.error) {
      setCommandStatuses((statusRes.data as CommandStatusRow[]) ?? []);
    }
    if (!incidentsRes.error) {
      setCommandIncidents((incidentsRes.data as CommandIncidentRow[]) ?? []);
    }
    if (!configRes.error && configRes.data) {
      const loaded = configRes.data as CommandConfig;
      const lead = Array.isArray(loaded.lead_minutes) ? loaded.lead_minutes : [60, 30, 15];
      const grace = Number(loaded.late_grace_minutes ?? 10);
      setCommandConfig({
        lead_minutes: lead,
        late_grace_minutes: Number.isFinite(grace) ? grace : 10,
      });
      setCommandLeadInput(lead.join(','));
      setCommandGraceInput(String(Number.isFinite(grace) ? grace : 10));
    }
  }

  useEffect(() => {
    if (loadingEvent || activeTab !== 'command') return;
    void loadCommandCenterData();
  }, [activeTab, loadingEvent, eventId]);

  async function act(fn: () => Promise<void>, reload = true) {
    setError('');
    try {
      await fn();
      if (reload) await loadTab(activeTab, true);
    } catch (e: any) {
      setError(e?.message ?? 'Erro');
    }
  }

  function confirmBatchDelete(message: string, action: () => Promise<void>) {
    Alert.alert('Confirmar exclusão', message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          void act(action);
        },
      },
    ]);
  }

  const displayName = useMemo(() => {
    const couple = (event?.couple ?? '').trim();
    return couple || event?.name || 'Evento';
  }, [event?.couple, event?.name]);

  const totalPaid = useMemo(() => data.payments.reduce((s, x) => s + Number(x.amount ?? 0), 0), [data.payments]);
  const totalExpenses = useMemo(
    () =>
      data.expenses.reduce((s, x) => {
        if ((x.status ?? 'pending') === 'cancelled') return s;
        return s + Number(x.value ?? 0);
      }, 0),
    [data.expenses],
  );
  const budgetTotal = Number(event?.budget_total ?? 0);
  const budgetProgress = budgetTotal > 0 ? Math.min((totalExpenses / budgetTotal) * 100, 100) : 0;
  const completedTasks = useMemo(() => data.tasks.filter((x) => Boolean(x.completed)).length, [data.tasks]);
  const tasksProgress = data.tasks.length > 0 ? (completedTasks / data.tasks.length) * 100 : 0;
  const daysRemaining = useMemo(() => {
    if (!event?.event_date) return 0;
    const diff = new Date(event.event_date).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [event?.event_date]);
  const pendingTasks = useMemo(() => data.tasks.filter((x) => !x.completed), [data.tasks]);
  const overdueTasks = useMemo(() => pendingTasks.filter((x) => isOverdueDate(x.due_date)), [pendingTasks]);
  const todayTasks = useMemo(() => pendingTasks.filter((x) => isTodayDate(x.due_date)), [pendingTasks]);
  const thisWeekTasks = useMemo(() => pendingTasks.filter((x) => isThisWeekDate(x.due_date)), [pendingTasks]);
  const futureTasks = useMemo(
    () =>
      pendingTasks.filter(
        (x) => !isOverdueDate(x.due_date) && !isTodayDate(x.due_date) && !isThisWeekDate(x.due_date),
      ),
    [pendingTasks],
  );

  useEffect(() => {
    setBudgetCardDraft(String(Number(event?.budget_total ?? 0)));
    setIsBudgetCardEditing(false);
  }, [event?.id, event?.budget_total]);

  const historyRows = useMemo(() => {
    const rows: Array<{ at: string; kind: HistoryKind; text: string }> = [];
    if (event?.created_at) rows.push({ at: event.created_at, kind: 'event', text: 'Evento criado' });
    data.timeline.forEach((x) => x.created_at && rows.push({ at: x.created_at, kind: 'timeline', text: `Timeline: ${x.activity || ''}` }));
    data.tasks.forEach((x) => x.created_at && rows.push({ at: x.created_at, kind: 'task', text: `Tarefa: ${x.text || ''}` }));
    data.guests.forEach((x) => {
      if (x.created_at) rows.push({ at: x.created_at, kind: 'guest', text: `Convidado: ${x.name || ''}` });
      if (x.invited_at) rows.push({ at: x.invited_at, kind: 'invite', text: `Convite enviado: ${x.name || ''}` });
      if (x.responded_at) rows.push({ at: x.responded_at, kind: 'rsvp', text: `RSVP ${String(x.rsvp_status ?? 'pending')}: ${x.name || ''}` });
    });
    data.vendors.forEach((x) => x.created_at && rows.push({ at: x.created_at, kind: 'vendor', text: `Fornecedor: ${x.name || ''}` }));
    data.documents.forEach((x) => x.created_at && rows.push({ at: x.created_at, kind: 'document', text: `Documento: ${x.name || ''}` }));
    data.expenses.forEach((x) => x.created_at && rows.push({ at: x.created_at, kind: 'expense', text: `Despesa: ${x.name || ''}` }));
    data.payments.forEach((x) => {
      const at = x.created_at || x.paid_at;
      if (at) rows.push({ at, kind: 'payment', text: `Pagamento: ${brl(Number(x.amount ?? 0))}` });
    });
    return rows.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 180);
  }, [data.documents, data.expenses, data.guests, data.payments, data.tasks, data.timeline, data.vendors, event?.created_at]);

  const history = useMemo(() => {
    if (historyFilter === 'all') return historyRows;
    return historyRows.filter((row) => row.kind === historyFilter);
  }, [historyRows, historyFilter]);

  const projectMilestones = useMemo<ProjectMilestone[]>(() => {
    const startDateText = event?.created_at ?? null;
    if (!startDateText) return [];
    const startDate = new Date(startDateText);
    if (Number.isNaN(startDate.getTime())) return [];

    const toDayNumber = (value: string | null | undefined) => {
      if (!value) return 1;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return 1;
      const diffMs = date.getTime() - startDate.getTime();
      return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
    };

    const milestones: ProjectMilestone[] = [
      {
        id: `project-start-${event?.id ?? 'event'}`,
        date: startDate,
        dayNumber: 1,
        title: 'Início do projeto',
        detail: `Comecamos a trabalhar com ${displayName}.`,
        kind: 'start',
      },
    ];

    data.vendors.forEach((row) => {
      if (!row.created_at) return;
      const date = new Date(row.created_at);
      if (Number.isNaN(date.getTime())) return;
      milestones.push({
        id: `vendor-${row.id}`,
        date,
        dayNumber: toDayNumber(row.created_at),
        title: 'Fornecedor incluído',
        detail: `${row.name || 'Fornecedor'} (${row.category || 'Sem categoria'}) foi adicionado.`,
        kind: 'vendor',
      });
    });

    data.guests.forEach((row) => {
      if (row.created_at) {
        const date = new Date(row.created_at);
        if (!Number.isNaN(date.getTime())) {
          milestones.push({
            id: `guest-${row.id}`,
            date,
            dayNumber: toDayNumber(row.created_at),
            title: 'Convidado incluído',
            detail: `${row.name || 'Convidado'} entrou na lista.`,
            kind: 'guest',
          });
        }
      }
      if (row.invited_at) {
        const date = new Date(row.invited_at);
        if (!Number.isNaN(date.getTime())) {
          milestones.push({
            id: `invite-${row.id}`,
            date,
            dayNumber: toDayNumber(row.invited_at),
            title: 'Convite enviado',
            detail: `Convite enviado para ${row.name || 'Convidado'}.`,
            kind: 'invite',
          });
        }
      }
      if (row.responded_at) {
        const date = new Date(row.responded_at);
        if (!Number.isNaN(date.getTime())) {
          const status = String(row.rsvp_status ?? 'pending');
          const responseText = status === 'confirmed' ? 'confirmou presença' : status === 'declined' ? 'recusou presença' : 'respondeu o convite';
          milestones.push({
            id: `rsvp-${row.id}`,
            date,
            dayNumber: toDayNumber(row.responded_at),
            title: 'RSVP atualizado',
            detail: `${row.name || 'Convidado'} ${responseText}.`,
            kind: 'rsvp',
          });
        }
      }
    });

    data.expenses.forEach((row) => {
      if (!row.created_at) return;
      const date = new Date(row.created_at);
      if (Number.isNaN(date.getTime())) return;
      milestones.push({
        id: `expense-${row.id}`,
        date,
        dayNumber: toDayNumber(row.created_at),
        title: 'Lançamento financeiro',
        detail: `${row.name || 'Despesa'} foi lançado (${brl(Number(row.value ?? 0))}).`,
        kind: 'expense',
      });
    });

    data.documents.forEach((row) => {
      if (!row.created_at) return;
      const date = new Date(row.created_at);
      if (Number.isNaN(date.getTime())) return;
      milestones.push({
        id: `document-${row.id}`,
        date,
        dayNumber: toDayNumber(row.created_at),
        title: 'Documento anexado',
        detail: `${row.name || 'Documento'} foi anexado ao evento.`,
        kind: 'document',
      });
    });

    data.payments.forEach((row) => {
      const createdAt = row.created_at ?? row.paid_at;
      if (!createdAt) return;
      const date = new Date(createdAt);
      if (Number.isNaN(date.getTime())) return;
      milestones.push({
        id: `payment-${row.id}`,
        date,
        dayNumber: toDayNumber(createdAt),
        title: 'Pagamento registrado',
        detail: `Pagamento de ${brl(Number(row.amount ?? 0))} foi lancado.`,
        kind: 'payment',
      });
    });

    if (event?.event_date) {
      const date = new Date(event.event_date);
      if (!Number.isNaN(date.getTime())) {
        milestones.push({
          id: `event-day-${event.id}`,
          date,
          dayNumber: toDayNumber(event.event_date),
          title: 'Data do evento',
          detail: `Marco final: ${date.toLocaleDateString('pt-BR')}.`,
          kind: 'start',
        });
      }
    }

    return milestones.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 140);
  }, [data.documents, data.expenses, data.guests, data.payments, data.vendors, displayName, event?.created_at, event?.event_date, event?.id]);

  const historyTimelineNodes = useMemo(() => projectMilestones, [projectMilestones]);
  const selectedHistoryIndex = useMemo(() => {
    if (!selectedHistoryId) return -1;
    return historyTimelineNodes.findIndex((row) => row.id === selectedHistoryId);
  }, [historyTimelineNodes, selectedHistoryId]);
  const historyProgress = useMemo(() => {
    if (historyTimelineNodes.length <= 1) return 100;
    const index = Math.max(0, selectedHistoryIndex);
    return (index / (historyTimelineNodes.length - 1)) * 100;
  }, [historyTimelineNodes.length, selectedHistoryIndex]);

  useEffect(() => {
    if (historyTimelineNodes.length === 0) {
      setSelectedHistoryId(null);
      return;
    }
    const exists = historyTimelineNodes.some((row) => row.id === selectedHistoryId);
    if (!selectedHistoryId || !exists) {
      setSelectedHistoryId(historyTimelineNodes[0].id);
    }
  }, [historyTimelineNodes, selectedHistoryId]);

  useEffect(() => {
    if (activeTab !== 'history' || historyTimelineNodes.length <= 1) return;
    const timer = setInterval(() => {
      setSelectedHistoryId((previous) => {
        const current = historyTimelineNodes.findIndex((row) => row.id === previous);
        if (current < 0 || current >= historyTimelineNodes.length - 1) return historyTimelineNodes[0].id;
        return historyTimelineNodes[current + 1].id;
      });
    }, 2200);
    return () => clearInterval(timer);
  }, [activeTab, historyTimelineNodes]);
  const guestSummary = useMemo(() => {
    const total = data.guests.length;
    const pending = data.guests.filter((g) => (g.rsvp_status ?? 'pending') === 'pending').length;
    const confirmed = data.guests.filter((g) => (g.rsvp_status ?? 'pending') === 'confirmed').length;
    const declined = data.guests.filter((g) => (g.rsvp_status ?? 'pending') === 'declined').length;
    return { total, pending, confirmed, declined };
  }, [data.guests]);
  const unconfirmedGuests = guestSummary.pending;
  const expensesForCharts = useMemo(() => {
    const map = new Map<string, { id: string; name: string; value: number; color: string }>();
    data.expenses.forEach((row) => {
      if ((row.status ?? 'pending') === 'cancelled') return;
      const key = String(row.category ?? row.name ?? 'Sem categoria').trim() || 'Sem categoria';
      const current = map.get(key);
      const value = Number(row.value ?? 0);
      if (current) {
        current.value += value;
      } else {
        map.set(key, {
          id: key,
          name: key,
          value,
          color: row.color || CHART_COLORS[map.size % CHART_COLORS.length],
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [data.expenses]);
  const paymentsByMethod = useMemo(() => {
    const map = new Map<PaymentMethod, number>();
    data.payments.forEach((row) => {
      const method = normalizePaymentMethod(String(row.method ?? 'pix'));
      map.set(method, (map.get(method) ?? 0) + Number(row.amount ?? 0));
    });
    return Array.from(map.entries()).map(([method, value], index) => ({
      id: method,
      method,
      label: paymentMethodLabel(method),
      value,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [data.payments]);
  const totalPaidByMethod = useMemo(
    () => paymentsByMethod.reduce((acc, row) => acc + Number(row.value || 0), 0),
    [paymentsByMethod],
  );
  const alerts = useMemo<OverviewAlert[]>(() => {
    const out: OverviewAlert[] = [];
    if (overdueTasks.length > 0) {
      out.push({
        type: 'error',
        message: `${overdueTasks.length} tarefa(s) atrasada(s)!`,
      });
    }
    if (budgetProgress > 90) {
      out.push({
        type: 'warning',
        message: `Orçamento em ${budgetProgress.toFixed(0)}% - atenção!`,
      });
    }
    if (daysRemaining > 0 && daysRemaining <= 7 && pendingTasks.length > 5) {
      out.push({
        type: 'info',
        message: `Faltam ${daysRemaining} dias e ainda há ${pendingTasks.length} tarefas.`,
      });
    }
    if (daysRemaining > 0 && daysRemaining <= 14 && unconfirmedGuests > 10) {
      out.push({
        type: 'info',
        message: `${unconfirmedGuests} convidados ainda não confirmaram presença.`,
      });
    }
    return out;
  }, [overdueTasks.length, budgetProgress, daysRemaining, pendingTasks.length, unconfirmedGuests]);
  const filteredGuests = useMemo(() => {
    const search = guestSearch.trim().toLowerCase();
    const base = data.guests.filter((g) =>
      guestFilter === 'all' ? true : (g.rsvp_status ?? 'pending') === guestFilter,
    );
    const searched = base.filter((g) => {
      if (!search) return true;
      const name = String(g.name ?? '').toLowerCase();
      const phone = String(g.phone ?? '').toLowerCase();
      return name.includes(search) || phone.includes(search);
    });
    return [...searched].sort((a, b) => {
      const an = String(a.name ?? '').toLowerCase();
      const bn = String(b.name ?? '').toLowerCase();
      return guestSort === 'name_asc' ? an.localeCompare(bn) : bn.localeCompare(an);
    });
  }, [data.guests, guestFilter, guestSearch, guestSort]);
  const filteredVendors = useMemo(() => {
    const search = vendorSearch.trim().toLowerCase();
    const searched = data.vendors.filter((v) => {
      if (!search) return true;
      return `${v.name ?? ''} ${v.category ?? ''}`.toLowerCase().includes(search);
    });
    return [...searched].sort((a, b) => {
      if (vendorSort === 'status') {
        return String(a.status ?? '').localeCompare(String(b.status ?? ''));
      }
      const an = String(a.name ?? '').toLowerCase();
      const bn = String(b.name ?? '').toLowerCase();
      return vendorSort === 'name_asc' ? an.localeCompare(bn) : bn.localeCompare(an);
    });
  }, [data.vendors, vendorSearch, vendorSort]);
  const filteredExpenses = useMemo(() => {
    return data.expenses.filter((x) => {
      if (budgetVendorFilter.trim() && String(x.vendor_id ?? '') !== budgetVendorFilter.trim()) return false;
      if (budgetStatusFilter !== 'all' && String(x.status ?? 'pending') !== budgetStatusFilter) return false;
      return true;
    });
  }, [data.expenses, budgetStatusFilter, budgetVendorFilter]);
  const filteredPayments = useMemo(() => {
    const expenseIds = new Set(filteredExpenses.map((x) => x.id));
    return data.payments.filter((p) => expenseIds.has(p.expense_id));
  }, [data.payments, filteredExpenses]);
  const filteredDocuments = useMemo(() => {
    const search = documentSearch.trim().toLowerCase();
    return data.documents.filter((d) => {
      if (documentReceiptFilterId && String(d.id) !== documentReceiptFilterId) return false;
      if (documentVendorFilter.trim() && String(d.vendor_id ?? '') !== documentVendorFilter.trim()) return false;
      if (documentCategoryFilter.trim() && String(d.category ?? '').toLowerCase() !== documentCategoryFilter.trim().toLowerCase()) return false;
      if (!search) return true;
      return `${d.name ?? ''} ${d.category ?? ''}`.toLowerCase().includes(search);
    });
  }, [data.documents, documentCategoryFilter, documentReceiptFilterId, documentSearch, documentVendorFilter]);
  const documentCategories = useMemo(
    () => Array.from(new Set(data.documents.map((d) => String(d.category ?? 'Outros')).filter(Boolean))),
    [data.documents],
  );
  const paymentReceiptCountByVendor = useMemo(() => {
    const documentsById = new Map<string, any>();
    data.documents.forEach((doc) => {
      documentsById.set(doc.id, doc);
    });
    const receiptByVendor = new Map<string, Set<string>>();
    data.payments.forEach((payment) => {
      const receiptDocId = parsePaymentNote(payment.note).meta.receipt_document_id;
      if (!receiptDocId) return;
      const vendorId = documentsById.get(receiptDocId)?.vendor_id;
      if (!vendorId) return;
      const current = receiptByVendor.get(String(vendorId)) ?? new Set<string>();
      current.add(String(receiptDocId));
      receiptByVendor.set(String(vendorId), current);
    });
    const result = new Map<string, number>();
    receiptByVendor.forEach((value, key) => {
      result.set(key, value.size);
    });
    return result;
  }, [data.documents, data.payments]);
  const visibleTasks = useMemo(() => data.tasks.slice(0, visible.tasks), [data.tasks, visible.tasks]);
  const visibleTimeline = useMemo(() => data.timeline.slice(0, visible.timeline), [data.timeline, visible.timeline]);
  const visibleGuests = useMemo(() => filteredGuests.slice(0, visible.guests), [filteredGuests, visible.guests]);
  const visibleVendors = useMemo(() => filteredVendors.slice(0, visible.vendors), [filteredVendors, visible.vendors]);
  const visibleDocuments = useMemo(() => filteredDocuments.slice(0, visible.documents), [filteredDocuments, visible.documents]);
  const latestCommandVendorStatus = useMemo(() => {
    const map = new Map<string, CommandStatusRow>();
    commandStatuses.forEach((row) => {
      if (!map.has(row.vendor_id)) map.set(row.vendor_id, row);
    });
    return map;
  }, [commandStatuses]);
  const commandSlaAlerts = useMemo<CommandComputedAlert[]>(() => {
    if (!event?.event_date) return [];
    const now = new Date();
    const leadMinutes = (commandConfig.lead_minutes ?? [60, 30, 15])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .sort((a, b) => b - a);
    const lateGrace = Number(commandConfig.late_grace_minutes ?? 10);
    const out: CommandComputedAlert[] = [];

    data.vendors.forEach((vendor) => {
      const currentStatus = latestCommandVendorStatus.get(vendor.id)?.status ?? 'pending';
      const expectedArrival = combineDateTime(event.event_date, vendor.expected_arrival_time ?? null);
      const expectedDone = combineDateTime(event.event_date, vendor.expected_done_time ?? null);

      if (expectedArrival && currentStatus !== 'arrived' && currentStatus !== 'done') {
        leadMinutes.forEach((minutes) => {
          const trigger = new Date(expectedArrival.getTime() - minutes * 60 * 1000);
          if (now >= trigger && now < expectedArrival) {
            const severity: CommandComputedAlert['severity'] =
              minutes <= 15 ? 'critical' : minutes <= 30 ? 'warning' : 'info';
            out.push({
              vendor_id: vendor.id,
              alert_type: 'arrival_pre_alert',
              severity,
              message: `${vendor.name || 'Fornecedor'}: faltam ${minutes} min para a chegada prevista.`,
              dedupe_key: `${event.id}:${vendor.id}:arrival_pre:${minutes}`,
            });
          }
        });
        const lateAt = new Date(expectedArrival.getTime() + lateGrace * 60 * 1000);
        if (now >= lateAt) {
          out.push({
            vendor_id: vendor.id,
            alert_type: 'arrival_late',
            severity: 'critical',
            message: `${vendor.name || 'Fornecedor'}: chegada atrasada (previsto ${vendor.expected_arrival_time ?? '--:--'}).`,
            dedupe_key: `${event.id}:${vendor.id}:arrival_late`,
          });
        }
      }

      if (expectedDone && currentStatus !== 'done') {
        const doneLateAt = new Date(expectedDone.getTime() + lateGrace * 60 * 1000);
        if (now >= doneLateAt) {
          out.push({
            vendor_id: vendor.id,
            alert_type: 'done_late',
            severity: 'warning',
            message: `${vendor.name || 'Fornecedor'}: finalização atrasada (previsto ${vendor.expected_done_time ?? '--:--'}).`,
            dedupe_key: `${event.id}:${vendor.id}:done_late`,
          });
        }
      }
    });

    const seen = new Set<string>();
    return out.filter((item) => {
      if (seen.has(item.dedupe_key)) return false;
      seen.add(item.dedupe_key);
      return true;
    });
  }, [commandConfig.late_grace_minutes, commandConfig.lead_minutes, data.vendors, event?.event_date, event?.id, latestCommandVendorStatus]);
  const incidentStats = useMemo(() => {
    const open = commandIncidents.filter((row) => row.status === 'open').length;
    const resolved = commandIncidents.filter((row) => row.status === 'resolved').length;
    return { open, resolved };
  }, [commandIncidents]);
  const command = useMemo(() => {
    const pendingTasksCount = data.tasks.filter((t) => !t.completed).length;
    const pendingVendors = data.vendors.filter((v) => (v.status ?? 'pending') !== 'confirmed').length;
    const pendingRsvp = data.guests.filter((g) => (g.rsvp_status ?? 'pending') === 'pending').length;
    const negativeBalance = budgetTotal - totalExpenses < 0;
    const criticalTimeline = data.timeline
      .filter((item) => !item.assignee_name || String(item.assignee_name).trim().length === 0)
      .slice(0, 5);
    const overdueCount = data.tasks.filter((item) => !item.completed && isOverdueDate(item.due_date)).length;
    const score = Math.max(
      0,
      100 -
        pendingTasksCount * 2 -
        pendingVendors * 6 -
        Math.round(pendingRsvp * 0.4) -
        (negativeBalance ? 18 : 0) -
        overdueCount * 3 -
        criticalTimeline.length * 4 -
        Math.min(24, incidentStats.open * 8) -
        Math.min(16, commandSlaAlerts.filter((row) => row.severity !== 'info').length * 2),
    );
    return { pendingTasks: pendingTasksCount, pendingVendors, pendingRsvp, negativeBalance, criticalTimeline, score, overdueCount };
  }, [budgetTotal, commandSlaAlerts, data.guests, data.tasks, data.timeline, data.vendors, incidentStats.open, totalExpenses]);

  const smartTimelineSuggestions = useMemo<SmartTimelineSuggestion[]>(() => {
    const out: SmartTimelineSuggestion[] = [];
    const pendingTasks = data.tasks.filter((item) => !item.completed);
    const pendingVendors = data.vendors.filter((item) => (item.status ?? 'pending') !== 'confirmed');
    const pendingGuests = data.guests.filter((item) => (item.rsvp_status ?? 'pending') === 'pending');

    if (pendingTasks.length >= 8) {
      out.push({
        id: 'rules-tasks',
        title: 'Bloco de execução de tarefas',
        reason: 'Muitas tarefas abertas para o evento.',
        activity: 'Reunião de alinhamento da equipe e distribuição de prioridades',
        time: '08:30',
        assignee: 'Assessoria',
        priority: 'high',
        source: 'rules',
      });
    }

    if (pendingVendors.length > 0) {
      out.push({
        id: 'rules-vendors',
        title: 'Checklist com fornecedores',
        reason: 'Existem fornecedores sem confirmação.',
        activity: 'Confirmar chegada e responsavel de todos os fornecedores pendentes',
        time: '09:30',
        assignee: 'Coordenação',
        priority: 'high',
        source: 'rules',
      });
    }

    if (pendingGuests.length >= 10) {
      out.push({
        id: 'rules-rsvp',
        title: 'Virada de RSVP',
        reason: 'Lista de convidados com alto volume pendente.',
        activity: 'Executar disparo final de RSVP e registrar retorno',
        time: '11:00',
        assignee: 'Recepcao',
        priority: 'normal',
        source: 'rules',
      });
    }

    if (data.timeline.length === 0) {
      out.push({
        id: 'rules-base',
        title: 'Estruturar cronograma do dia',
        reason: 'Evento sem itens na timeline.',
        activity: 'Montar cronograma base de operação do evento',
        time: '08:00',
        assignee: 'Assessoria',
        priority: 'high',
        source: 'rules',
      });
    }

    return out;
  }, [data.guests, data.tasks, data.timeline.length, data.vendors]);

  const timelineSuggestions = useMemo(() => {
    const out: SmartTimelineSuggestion[] = [];
    const seen = new Set<string>();
    [...aiTimelineSuggestions, ...smartTimelineSuggestions].forEach((item) => {
      const key = `${item.title}|${item.activity}|${item.time}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(item);
      }
    });
    return out;
  }, [aiTimelineSuggestions, smartTimelineSuggestions]);

  const tableOccupancy = useMemo(() => {
    return data.tables.map((table) => {
      const allocated = data.guests.filter((guest) => guest.table_id === table.id).length;
      const seats = Number(table.seats ?? 0);
      const free = Math.max(0, seats - allocated);
      const ratio = seats > 0 ? Math.min(1, allocated / seats) : 0;
      return { table, allocated, seats, free, ratio };
    });
  }, [data.guests, data.tables]);

  async function createTimelineItem(payload: {
    time: string;
    activity: string;
    assignee: string | null;
  }) {
    const { error: insertError } = await supabase.from('event_timeline').insert({
      event_id: eventId,
      time: payload.time,
      activity: payload.activity,
      assignee_name: payload.assignee,
      position: data.timeline.length,
    });
    if (insertError) throw new Error(insertError.message);
  }

  async function applySmartTimelineSuggestion(suggestion: SmartTimelineSuggestion) {
    await act(async () => {
      await createTimelineItem({
        time: suggestion.time,
        activity: suggestion.activity,
        assignee: suggestion.assignee || null,
      });
      setAiTimelineSuggestions((prev) => prev.filter((item) => item.id !== suggestion.id));
    });
  }

  async function generateHybridTimelineSuggestions() {
    if (!event) return;
    setLoadingAiTimelineSuggestions(true);
    setAiTimelineError(null);
    try {
      const payload = {
        event: {
          id: event.id,
          name: event.name,
          couple: event.couple,
          event_date: event.event_date,
          location: event.location,
        },
        metrics: {
          pending_tasks: data.tasks.filter((item) => !item.completed).length,
          pending_vendors: data.vendors.filter((item) => (item.status ?? 'pending') !== 'confirmed').length,
          pending_rsvp: data.guests.filter((item) => (item.rsvp_status ?? 'pending') === 'pending').length,
        },
        current_timeline: data.timeline.slice(0, 20).map((item) => ({
          time: item.time,
          activity: item.activity,
          assignee: item.assignee_name ?? '',
        })),
        rules_suggestions: smartTimelineSuggestions.map((item) => ({
          title: item.title,
          reason: item.reason,
          activity: item.activity,
          time: item.time,
          assignee: item.assignee,
          priority: item.priority,
        })),
      };

      const { data: aiData, error: invokeError } = await supabase.functions.invoke('timeline-ai', {
        body: payload,
      });
      if (invokeError) {
        throw new Error(invokeError.message);
      }

      const rawJson = aiData as unknown;
      const suggestionsRaw: unknown[] = Array.isArray(rawJson)
        ? rawJson
        : rawJson && typeof rawJson === 'object' && Array.isArray((rawJson as Record<string, unknown>).suggestions)
          ? ((rawJson as Record<string, unknown>).suggestions as unknown[])
          : [];

      const parsed = suggestionsRaw
        .map((raw, index) => normalizeAiSuggestion(raw, index))
        .filter((item): item is SmartTimelineSuggestion => Boolean(item));

      if (parsed.length === 0) {
        setAiTimelineError('A IA não retornou sugestões válidas. Mantendo sugestões locais.');
      }
      setAiTimelineSuggestions(parsed);
      setLastAiTimelineRunAt(new Date().toISOString());
    } catch (aiError: any) {
      setAiTimelineError(aiError?.message ?? 'Falha ao gerar sugestoes da IA.');
      setAiTimelineSuggestions([]);
    } finally {
      setLoadingAiTimelineSuggestions(false);
    }
  }

  async function pickAndUploadDocument() {
    if (uploadingDoc) return;
    setUploadingDoc(true);
    setError('');
    let uploadFileId: string | null = null;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/*',
        ],
      });
      if (result.canceled || result.assets.length === 0) {
        setUploadingDoc(false);
        return;
      }

      const asset = result.assets[0];
      const safeName = asset.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const upload = await uploadPrivateAsset({
        uri: asset.uri,
        fileName: `${eventId}-${Date.now()}-${safeName}`,
        contentType: asset.mimeType ?? 'application/octet-stream',
        byteSize: asset.size ?? null,
        entityType: 'event_document',
        entityId: eventId,
      });
      uploadFileId = upload.fileId;

      const { data: inserted, error: insertError } = await supabase
        .from('event_documents')
        .insert({
          event_id: eventId,
          name: asset.name,
          file_url: upload.objectKey,
          file_id: upload.fileId,
          file_type: asset.mimeType ?? null,
          category: 'Outros',
        })
        .select('id')
        .maybeSingle();
      if (insertError) throw new Error(insertError.message);
      if (inserted?.id) {
        void linkStoredFile(upload.fileId, inserted.id).catch(() => {
          // Best effort only.
        });
      }

      await loadTab('documents', true);
    } catch (uploadError: any) {
      if (uploadFileId) {
        void deleteStoredFile(uploadFileId).catch(() => {
          // Best effort only.
        });
      }
      setError(uploadError?.message ?? 'Erro ao fazer upload do documento.');
    } finally {
      setUploadingDoc(false);
    }
  }

  async function pickAndUploadPhoto() {
    if (uploadingPhoto || !event) return;
    setUploadingPhoto(true);
    setError('');
    let nextFileId: string | null = null;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Permissao de galeria negada.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || result.assets.length === 0) {
        setUploadingPhoto(false);
        return;
      }

      const asset = result.assets[0];
      const ext = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
      const previousFileId = event.couple_photo_file_id ?? null;
      const upload = await uploadPrivateAsset({
        uri: asset.uri,
        fileName: `${eventId}-${Date.now()}.${ext}`,
        contentType: asset.mimeType ?? 'image/jpeg',
        byteSize: asset.fileSize ?? null,
        entityType: 'event_photo',
        entityId: eventId,
      });
      nextFileId = upload.fileId;
      const signedUrl = await getPrivateFileDownloadUrl(upload.fileId);
      const { error: updateError } = await supabase
        .from('events')
        .update({ couple_photo_url: null, couple_photo_file_id: upload.fileId })
        .eq('id', eventId);
      if (updateError) throw new Error(updateError.message);

      if (previousFileId) {
        void deleteStoredFile(previousFileId).catch(() => {
          // Best effort only.
        });
      }
      setEvent((prev) => (prev ? { ...prev, couple_photo_url: signedUrl, couple_photo_file_id: upload.fileId } : prev));
    } catch (photoError: any) {
      if (nextFileId) {
        void deleteStoredFile(nextFileId).catch(() => {
          // Best effort only.
        });
      }
      setError(photoError?.message ?? 'Erro ao fazer upload da foto.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function openDocumentLink(documentRow: any) {
    try {
      if (documentRow.file_id) {
        const signedUrl = await getPrivateFileDownloadUrl(String(documentRow.file_id));
        await Linking.openURL(signedUrl);
        return;
      }

      if (documentRow.file_url) {
        await Linking.openURL(String(documentRow.file_url));
      }
    } catch (openError: any) {
      setError(openError?.message ?? 'Não foi possível abrir o documento.');
    }
  }

  function showMore(key: VisibleKey, step = 30) {
    setVisible((s) => ({ ...s, [key]: s[key] + step }));
  }

  function openModule(tab: Tab) {
    setActiveTab(tab);
  }

  async function reloadTablesModule() {
    await Promise.all([loadKey('tables', 'reset'), loadKey('guests', 'reset')]);
  }

  async function saveBudgetFromCard() {
    const next = Number(budgetCardDraft);
    if (!Number.isFinite(next) || savingBudgetCard) return;
    setSavingBudgetCard(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('events')
        .update({ budget_total: next })
        .eq('id', eventId);
      if (updateError) throw new Error(updateError.message);
      setEvent((prev) => (prev ? { ...prev, budget_total: next } : prev));
      setF((prev) => ({ ...prev, budgetTotal: String(next) }));
      setIsBudgetCardEditing(false);
    } catch (saveError: any) {
      setError(saveError?.message ?? 'Erro ao salvar orçamento.');
    } finally {
      setSavingBudgetCard(false);
    }
  }

  async function saveBasicEventInfo() {
    if (!event || savingBasics) return;
    const nextDate = basicDraft.eventDate.trim() || event.event_date;
    const nextName = basicDraft.name.trim() || event.name;
    const payload = {
      name: nextName,
      couple: basicDraft.couple.trim() || null,
      event_date: nextDate,
      location: basicDraft.location.trim() || null,
    };
    setSavingBasics(true);
    setError('');
    try {
      const { error: updateError } = await supabase.from('events').update(payload).eq('id', eventId);
      if (updateError) throw new Error(updateError.message);
      setEvent((prev) => (prev ? { ...prev, ...payload } : prev));
      setEditingBasics(false);
    } catch (saveError: any) {
      setError(saveError?.message ?? 'Erro ao salvar dados do evento.');
    } finally {
      setSavingBasics(false);
    }
  }

  async function saveCommandRules() {
    const parsedLead = commandLeadInput
      .split(',')
      .map((row) => Number(row.trim()))
      .filter((row) => Number.isFinite(row) && row >= 0);
    const uniqueLead = Array.from(new Set(parsedLead)).sort((a, b) => b - a);
    const grace = Number(commandGraceInput);
    const safeGrace = Number.isFinite(grace) && grace >= 0 ? grace : 10;
    setSavingCommandConfig(true);
    setError('');
    try {
      const { error: upsertError } = await supabase.from('event_command_config').upsert({
        event_id: eventId,
        lead_minutes: uniqueLead.length > 0 ? uniqueLead : [60, 30, 15],
        late_grace_minutes: safeGrace,
        updated_at: new Date().toISOString(),
      });
      if (upsertError) throw new Error(upsertError.message);
      setCommandConfig({
        lead_minutes: uniqueLead.length > 0 ? uniqueLead : [60, 30, 15],
        late_grace_minutes: safeGrace,
      });
    } catch (saveError: any) {
      setError(saveError?.message ?? 'Não foi possível salvar regras da torre.');
    } finally {
      setSavingCommandConfig(false);
    }
  }

  async function updateVendorOperationalStatus(vendorId: string, status: CommandVendorStatus) {
    await act(async () => {
      const { error: insertError } = await supabase.from('event_vendor_status').insert({
        event_id: eventId,
        vendor_id: vendorId,
        status,
        updated_by: 'assessoria',
      });
      if (insertError) throw new Error(insertError.message);
      await loadCommandCenterData();
    }, false);
  }

  async function createCommandIncident() {
    const title = commandIncidentForm.title.trim();
    if (!title || savingCommandIncident) return;
    setSavingCommandIncident(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        event_id: eventId,
        vendor_id: commandIncidentForm.vendor_id || null,
        severity: commandIncidentForm.severity,
        title,
        action_plan: commandIncidentForm.action_plan.trim() || null,
        note: commandIncidentForm.note.trim() || null,
      };
      if (user?.id) {
        payload.created_by = user.id;
      }
      const { error: insertError } = await supabase.from('event_command_incidents').insert(payload);
      if (insertError) throw new Error(insertError.message);
      setCommandIncidentForm({
        vendor_id: '',
        severity: 'warning',
        title: '',
        action_plan: '',
        note: '',
      });
      await loadCommandCenterData();
    } catch (incidentError: any) {
      setError(incidentError?.message ?? 'Não foi possível registrar incidente.');
    } finally {
      setSavingCommandIncident(false);
    }
  }

  async function resolveCommandIncident(incidentId: string) {
    if (resolvingIncidentId) return;
    setResolvingIncidentId(incidentId);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      };
      if (user?.id) {
        payload.resolved_by = user.id;
      }
      const { error: resolveError } = await supabase
        .from('event_command_incidents')
        .update(payload)
        .eq('id', incidentId);
      if (resolveError) throw new Error(resolveError.message);
      await loadCommandCenterData();
    } catch (resolveError: any) {
      setError(resolveError?.message ?? 'Não foi possível resolver incidente.');
    } finally {
      setResolvingIncidentId(null);
    }
  }

  async function toggleTask(taskId: string, completed: boolean) {
    await act(async () => {
      const { error: updateError } = await supabase
        .from('event_tasks')
        .update({ completed: !completed })
        .eq('id', taskId);
      if (updateError) throw new Error(updateError.message);
    });
  }

  if (loadingEvent) return <View style={styles.center}><ActivityIndicator color={colors.primaryStrong} /></View>;

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 140 }]}>
      <Pressable onPress={() => router.push('/eventos')}><Text style={styles.back}>Voltar para eventos</Text></Pressable>
      {!!event && (
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Pressable style={styles.heroAvatar} onPress={() => void pickAndUploadPhoto()}>
              {event.couple_photo_url ? (
                <Image source={{ uri: event.couple_photo_url }} style={styles.heroAvatarImage} />
              ) : (
                <Text style={styles.heroAvatarFallback}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              )}
            </Pressable>
            <View style={styles.heroMetaWrap}>
              <Text style={styles.title}>{displayName}</Text>
              <Text style={styles.meta}>
                {new Date(event.event_date).toLocaleDateString('pt-BR')} | {event.location || 'Sem local'}
              </Text>
              <Text style={styles.caption}>
                {uploadingPhoto ? 'Enviando foto...' : 'Toque na foto para alterar'}
              </Text>
            </View>
          </View>
          <View style={styles.heroActionRow}>
            <Pressable
              style={styles.commandCta}
              onPress={() => router.push(`/eventos/${eventId}/torre`)}
            >
              <Text style={styles.commandCtaText}>Torre de Comando</Text>
            </Pressable>
            <Pressable style={styles.btnGhost} onPress={() => setEditingBasics((prev) => !prev)}>
              <Text style={styles.smallText}>{editingBasics ? 'Fechar edição' : 'Editar evento'}</Text>
            </Pressable>
          </View>
          {editingBasics ? (
            <View style={styles.cardSoft}>
              <TextInput
                style={styles.input}
                value={basicDraft.name}
                onChangeText={(value) => setBasicDraft((prev) => ({ ...prev, name: value }))}
                placeholder="Nome interno do evento"
              />
              <TextInput
                style={styles.input}
                value={basicDraft.couple}
                onChangeText={(value) => setBasicDraft((prev) => ({ ...prev, couple: value }))}
                placeholder="Nome do casal"
              />
              <TextInput
                style={styles.input}
                value={basicDraft.eventDate}
                onChangeText={(value) => setBasicDraft((prev) => ({ ...prev, eventDate: value }))}
                placeholder="Data (YYYY-MM-DD)"
              />
              <TextInput
                style={styles.input}
                value={basicDraft.location}
                onChangeText={(value) => setBasicDraft((prev) => ({ ...prev, location: value }))}
                placeholder="Local"
              />
              <View style={styles.rowBtns}>
                <Pressable style={styles.btnGhost} onPress={() => setEditingBasics(false)}>
                  <Text style={styles.smallText}>Cancelar</Text>
                </Pressable>
                <Pressable style={styles.btn} onPress={() => void saveBasicEventInfo()}>
                  <Text style={styles.btnText}>{savingBasics ? 'Salvando...' : 'Salvar dados'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map((x) => (
            <Pressable key={x.key} onPress={() => setActiveTab(x.key)} style={[styles.tab, activeTab === x.key && styles.tabOn]}>
              <Text style={[styles.tabText, activeTab === x.key && styles.tabTextOn]}>{x.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
            {!!error && <Text style={styles.err}>{error}</Text>}
      {loadingTab ? (
        <View style={styles.loadingModule}>
          <ActivityIndicator color={colors.primaryStrong} />
          <Text style={styles.loadingModuleText}>Carregando dados do modulo...</Text>
        </View>
      ) : null}
              <View style={styles.moduleContent}>
      {activeTab === 'overview' && (
        <View style={styles.overviewStack}>
          {alerts.length > 0 ? (
            <View style={styles.alertsWrap}>
              {alerts.map((alert, index) => (
                <View
                  key={`${alert.type}-${index}`}
                  style={[
                    styles.alertRow,
                    alert.type === 'error'
                      ? styles.alertError
                      : alert.type === 'warning'
                        ? styles.alertWarning
                        : styles.alertInfo,
                  ]}
                >
                  <Text style={styles.alertText}>{alert.message}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.metricGrid}>
            <Pressable style={[styles.metricCard, styles.metricPink]} onPress={() => openModule('history')}>
              <Text style={styles.metricLabel}>Contagem regressiva</Text>
              <Text style={styles.metricValue}>
                {!event?.event_date ? '-' : daysRemaining <= 0 ? 'Hoje' : `${daysRemaining} dias`}
              </Text>
              <Text style={styles.metricSub}>Abrir histórico</Text>
            </Pressable>

            <View style={[styles.metricCard, styles.metricGold]}>
              <Text style={styles.metricLabel}>Orçamento e financeiro</Text>
              {isBudgetCardEditing ? (
                <View style={styles.metricEditWrap}>
                  <TextInput
                    style={styles.input}
                    value={budgetCardDraft}
                    onChangeText={setBudgetCardDraft}
                    placeholder="Orçamento total"
                    keyboardType="numeric"
                  />
                  <View style={styles.rowBtns}>
                    <Pressable
                      style={styles.btnGhost}
                      onPress={() => {
                        setBudgetCardDraft(String(budgetTotal));
                        setIsBudgetCardEditing(false);
                      }}
                    >
                      <Text style={styles.smallText}>Cancelar</Text>
                    </Pressable>
                    <Pressable style={styles.btn} onPress={() => void saveBudgetFromCard()}>
                      <Text style={styles.btnText}>{savingBudgetCard ? 'Salvando...' : 'Salvar'}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.metricValue}>{brl(budgetTotal)}</Text>
                  <Text style={styles.metricSub}>Gasto: {brl(totalExpenses)}</Text>
                  <View style={styles.metricTrack}>
                    <View style={[styles.metricFill, { width: `${Math.max(0, budgetProgress)}%`, backgroundColor: '#D4AF37' }]} />
                  </View>
                  <View style={styles.rowBtns}>
                    <Pressable style={styles.btnGhost} onPress={() => setIsBudgetCardEditing(true)}>
                      <Text style={styles.smallText}>Editar</Text>
                    </Pressable>
                    <Pressable style={styles.btnGhost} onPress={() => openModule('budget')}>
                      <Text style={styles.smallText}>Abrir financeiro</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>

            <Pressable style={[styles.metricCard, styles.metricBlue]} onPress={() => openModule('tasks')}>
              <Text style={styles.metricLabel}>Checklist</Text>
              <Text style={styles.metricValue}>
                {completedTasks}/{data.tasks.length}
              </Text>
              <View style={styles.metricTrack}>
                <View style={[styles.metricFill, { width: `${Math.max(0, tasksProgress)}%`, backgroundColor: '#2563EB' }]} />
              </View>
            </Pressable>

            <Pressable style={[styles.metricCard, styles.metricGreen]} onPress={() => openModule('guests')}>
              <Text style={styles.metricLabel}>Convidados</Text>
              <Text style={styles.metricValue}>
                {guestSummary.confirmed}/{guestSummary.total}
              </Text>
              <Text style={styles.metricSub}>Pendentes: {guestSummary.pending}</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.subtitle}>Gastos por categoria</Text>
              <Text style={styles.caption}>Total gasto: {brl(totalExpenses)}</Text>
            </View>
            {expensesForCharts.length === 0 ? (
              <Text style={styles.caption}>Sem despesas ainda - adicione na aba Orçamento.</Text>
            ) : (
              <View style={styles.chartRows}>
                {expensesForCharts.slice(0, 6).map((row) => {
                  const max = Math.max(...expensesForCharts.map((item) => Number(item.value || 0)), 1);
                  const width = (Number(row.value || 0) / max) * 100;
                  return (
                    <View key={row.id} style={styles.chartRowItem}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.chartLabel}>{row.name}</Text>
                        <Text style={styles.chartValue}>{brl(Number(row.value || 0))}</Text>
                      </View>
                      <View style={styles.chartTrack}>
                        <View style={[styles.chartFill, { width: `${Math.max(8, width)}%`, backgroundColor: row.color || '#D4AF37' }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.subtitle}>Pagamentos por metodo</Text>
              <Text style={styles.caption}>Total pago: {brl(totalPaidByMethod)}</Text>
            </View>
            {paymentsByMethod.length === 0 ? (
              <Text style={styles.caption}>Sem pagamentos ainda - registre na aba Orçamento.</Text>
            ) : (
              <View style={styles.chartRows}>
                {paymentsByMethod.map((row) => {
                  const max = Math.max(...paymentsByMethod.map((item) => Number(item.value || 0)), 1);
                  const width = (Number(row.value || 0) / max) * 100;
                  return (
                    <View key={row.id} style={styles.chartRowItem}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.chartLabel}>{row.label}</Text>
                        <Text style={styles.chartValue}>{brl(Number(row.value || 0))}</Text>
                      </View>
                      <View style={styles.chartTrack}>
                        <View style={[styles.chartFill, { width: `${Math.max(8, width)}%`, backgroundColor: row.color }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.subtitle}>Tarefas pendentes</Text>
              <Text style={styles.caption}>
                {pendingTasks.length} de {data.tasks.length}
              </Text>
            </View>

            <TaskSegment
              title={`Atrasadas (${overdueTasks.length})`}
              tone="error"
              tasks={overdueTasks}
              onToggle={toggleTask}
            />
            <TaskSegment
              title={`Hoje (${todayTasks.length})`}
              tone="warning"
              tasks={todayTasks}
              onToggle={toggleTask}
            />
            <TaskSegment
              title={`Esta semana (${thisWeekTasks.length})`}
              tone="info"
              tasks={thisWeekTasks}
              onToggle={toggleTask}
            />
            <TaskSegment
              title={`Futuro (${futureTasks.length})`}
              tone="neutral"
              tasks={futureTasks}
              onToggle={toggleTask}
              limit={2}
            />

            {pendingTasks.length === 0 ? (
              <Text style={styles.caption}>Nenhuma tarefa pendente.</Text>
            ) : null}

            <Pressable style={styles.btnGhostWide} onPress={() => openModule('tasks')}>
              <Text style={styles.smallText}>Ver checklist completo</Text>
            </Pressable>
          </View>
        </View>
      )}
      {activeTab === 'command' && (
        <Card title="Torre de Comando">
          <Text style={styles.commandTitle}>Status operacional do evento</Text>
          <View style={styles.commandScoreWrap}>
            <Text style={styles.commandScoreLabel}>Score operacional</Text>
            <Text style={styles.commandScoreValue}>{command.score}/100</Text>
            <View style={styles.commandTrack}>
              <View
                style={[
                  styles.commandFill,
                  { width: `${Math.max(8, command.score)}%`, backgroundColor: command.score < 55 ? '#DC2626' : command.score < 75 ? '#D97706' : '#16A34A' },
                ]}
              />
            </View>
          </View>

          <View style={styles.commandRulesCard}>
            <Text style={styles.commandBlockTitle}>Regras de alerta (SLA)</Text>
            <View style={styles.commandRuleGrid}>
              <TextInput
                style={[styles.input, styles.commandRuleInput]}
                value={commandLeadInput}
                onChangeText={setCommandLeadInput}
                placeholder="Pre-alerta (60,30,15)"
              />
              <TextInput
                style={[styles.input, styles.commandRuleInput]}
                value={commandGraceInput}
                onChangeText={setCommandGraceInput}
                placeholder="Tolerância (min)"
                keyboardType="numeric"
              />
            </View>
            <Pressable style={styles.btnGhost} onPress={() => void saveCommandRules()}>
              <Text style={styles.smallText}>{savingCommandConfig ? 'Salvando regras...' : 'Salvar regras'}</Text>
            </Pressable>
          </View>

          {alerts.length > 0 ? (
            <View style={styles.commandBlock}>
              <Text style={styles.commandBlockTitle}>Alertas gerais</Text>
              {alerts.map((alert, index) => (
                <Text key={`${alert.type}-${index}`} style={styles.commandItem}>
                  {alert.message}
                </Text>
              ))}
            </View>
          ) : null}
          {commandSlaAlerts.length > 0 ? (
            <View style={styles.commandBlock}>
              <Text style={styles.commandBlockTitle}>Alertas SLA de fornecedores</Text>
              {commandSlaAlerts.map((alert) => (
                <View key={alert.dedupe_key} style={styles.commandSlaRow}>
                  <Text style={styles.commandItem}>{alert.message}</Text>
                  <Text
                    style={[
                      styles.commandSeverity,
                      alert.severity === 'critical'
                        ? styles.commandSeverityCritical
                        : alert.severity === 'warning'
                          ? styles.commandSeverityWarning
                          : styles.commandSeverityInfo,
                    ]}
                  >
                    {alert.severity.toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.rowBtns}>
            <Small onPress={() => void act(async () => {
              const overdueIds = data.tasks
                .filter((task) => !task.completed && isOverdueDate(task.due_date))
                .map((task) => task.id);
              if (overdueIds.length === 0) return;
              const { error: updateError } = await supabase
                .from('event_tasks')
                .update({ completed: true })
                .in('id', overdueIds);
              if (updateError) throw new Error(updateError.message);
            })}>Concluir atrasadas</Small>
            <Small onPress={() => void act(async () => {
              const vendorIds = data.vendors
                .filter((vendor) => (vendor.status ?? 'pending') !== 'confirmed')
                .map((vendor) => vendor.id);
              if (vendorIds.length === 0) return;
              const { error: updateError } = await supabase
                .from('event_vendors')
                .update({ status: 'confirmed' })
                .in('id', vendorIds);
              if (updateError) throw new Error(updateError.message);
            })}>Confirmar fornecedores</Small>
            <Small onPress={() => openModule('budget')}>Abrir financeiro</Small>
          </View>
          <Text style={styles.caption}>Incidentes: {incidentStats.open} abertos | {incidentStats.resolved} resolvidos</Text>
          <CommandLine
            level={(command.pendingTasks > 10 ? 'high' : 'medium')}
            text={`Tarefas pendentes: ${command.pendingTasks}`}
          />
          <CommandLine
            level={(command.overdueCount > 0 ? 'high' : 'low')}
            text={`Tarefas atrasadas: ${command.overdueCount}`}
          />
          <CommandLine
            level={(command.pendingVendors > 3 ? 'high' : 'medium')}
            text={`Fornecedores pendentes: ${command.pendingVendors}`}
          />
          <CommandLine
            level={(command.pendingRsvp > 20 ? 'medium' : 'low')}
            text={`RSVP pendente: ${command.pendingRsvp}`}
          />
          <CommandLine
            level={(command.negativeBalance ? 'high' : 'low')}
            text={`Saúde financeira: saldo ${brl(budgetTotal - totalExpenses)}`}
          />
          <View style={styles.commandBlock}>
            <Text style={styles.commandBlockTitle}>Itens críticos da timeline (sem responsável)</Text>
            {command.criticalTimeline.length === 0 ? (
              <Text style={styles.commandItem}>Sem pendências críticas.</Text>
            ) : (
              command.criticalTimeline.map((item) => (
                <Text key={item.id} style={styles.commandItem}>
                  {item.time || '--:--'} | {item.activity || 'Atividade'}
                </Text>
              ))
            )}
          </View>
          <View style={styles.commandBlock}>
          <Text style={styles.commandBlockTitle}>Operação de fornecedores</Text>
            {data.vendors.length === 0 ? (
              <Text style={styles.commandItem}>Sem fornecedores cadastrados.</Text>
            ) : (
              data.vendors.slice(0, 12).map((vendor) => {
                const current = latestCommandVendorStatus.get(vendor.id)?.status ?? 'pending';
                return (
                  <View key={vendor.id} style={styles.commandVendorCard}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.commandVendorName}>{vendor.name || 'Fornecedor'}</Text>
                      <Text style={styles.commandVendorStatus}>{labelVendorStatus(current)}</Text>
                    </View>
                    <Text style={styles.caption}>
                      Previsto: {vendor.expected_arrival_time || '--:--'} - {vendor.expected_done_time || '--:--'}
                    </Text>
                    <View style={styles.rowBtns}>
                      <Small onPress={() => void updateVendorOperationalStatus(vendor.id, 'en_route')}>A caminho</Small>
                      <Small onPress={() => void updateVendorOperationalStatus(vendor.id, 'arrived')}>Chegou</Small>
                      <Small onPress={() => void updateVendorOperationalStatus(vendor.id, 'done')}>Finalizado</Small>
                    </View>
                  </View>
                );
              })
            )}
          </View>
          <View style={styles.commandBlock}>
            <Text style={styles.commandBlockTitle}>SOS da assessoria</Text>
            <TextInput
              style={styles.input}
              value={commandIncidentForm.title}
              onChangeText={(value) => setCommandIncidentForm((prev) => ({ ...prev, title: value }))}
              placeholder="Título do incidente"
            />
            <TextInput
              style={styles.input}
              value={commandIncidentForm.action_plan}
              onChangeText={(value) => setCommandIncidentForm((prev) => ({ ...prev, action_plan: value }))}
              placeholder="Plano B / ação imediata"
            />
            <TextInput
              style={[styles.input, styles.area]}
              value={commandIncidentForm.note}
              onChangeText={(value) => setCommandIncidentForm((prev) => ({ ...prev, note: value }))}
              placeholder="Detalhes do incidente"
              multiline
            />
            <View style={styles.rowBtns}>
              <Small onPress={() => setCommandIncidentForm((prev) => ({ ...prev, severity: 'warning' }))}>Severidade warning</Small>
              <Small onPress={() => setCommandIncidentForm((prev) => ({ ...prev, severity: 'critical' }))}>Severidade critical</Small>
            </View>
            <TextInput
              style={styles.input}
              value={commandIncidentForm.vendor_id}
              onChangeText={(value) => setCommandIncidentForm((prev) => ({ ...prev, vendor_id: value }))}
              placeholder="vendor_id (opcional)"
            />
            <Pressable style={styles.btn} onPress={() => void createCommandIncident()}>
              <Text style={styles.btnText}>{savingCommandIncident ? 'Registrando...' : 'Acionar SOS'}</Text>
            </Pressable>

            {commandIncidents.length === 0 ? (
              <Text style={styles.commandItem}>Nenhum incidente registrado.</Text>
            ) : (
              commandIncidents.map((incident) => {
                const vendorInfo = Array.isArray(incident.vendor) ? incident.vendor[0] : incident.vendor;
                return (
                  <View
                    key={incident.id}
                    style={[
                      styles.commandIncidentCard,
                      incident.status === 'open' ? styles.commandIncidentOpen : styles.commandIncidentResolved,
                    ]}
                  >
                    <View style={styles.rowBetween}>
                      <Text style={styles.commandVendorName}>{incident.title}</Text>
                      <Text style={styles.caption}>{incident.severity.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.caption}>
                      {vendorInfo?.name ?? 'Sem fornecedor'} | {new Date(incident.created_at).toLocaleString('pt-BR')}
                    </Text>
                    {incident.action_plan ? <Text style={styles.row}>Plano: {incident.action_plan}</Text> : null}
                    {incident.note ? <Text style={styles.row}>Nota: {incident.note}</Text> : null}
                    {incident.status === 'open' ? (
                      <Pressable style={styles.btnGhost} onPress={() => void resolveCommandIncident(incident.id)}>
                        <Text style={styles.smallText}>
                          {resolvingIncidentId === incident.id ? 'Resolvendo...' : 'Marcar como resolvido'}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.caption}>Resolvido</Text>
                    )}
                  </View>
                );
              })
            )}
          </View>
          <View style={styles.rowBtns}>
            <Small onPress={() => setActiveTab('tasks')}>Abrir tarefas</Small>
            <Small onPress={() => setActiveTab('vendors')}>Abrir fornecedores</Small>
            <Small onPress={() => setActiveTab('invites')}>Abrir convites</Small>
          </View>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card title="Histórico">
          <View style={styles.rowBtns}>
            <Small onPress={() => setHistoryFilter('all')}>Tudo</Small>
            <Small onPress={() => setHistoryFilter('timeline')}>Timeline</Small>
            <Small onPress={() => setHistoryFilter('task')}>Tarefas</Small>
            <Small onPress={() => setHistoryFilter('guest')}>Convidados</Small>
            <Small onPress={() => setHistoryFilter('payment')}>Pagamentos</Small>
            <Small onPress={() => setHistoryFilter('document')}>Documentos</Small>
          </View>

          <View style={styles.historyVisualCard}>
            {historyTimelineNodes.length === 0 ? (
              <Text style={styles.caption}>Ainda não há marcos suficientes para montar a linha do projeto.</Text>
            ) : (
              <>
                <View style={styles.historyTrack}>
                  <View style={[styles.historyTrackFill, { width: `${historyProgress}%` }]} />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyNodeRow}>
                  {historyTimelineNodes.map((item) => {
                    const selected = item.id === selectedHistoryId;
                    return (
                      <Pressable
                        key={item.id}
                        style={[styles.historyNode, selected && styles.historyNodeSelected]}
                        onPress={() => setSelectedHistoryId(item.id)}
                      >
                        <View style={[styles.historyNodeDot, { backgroundColor: getMilestoneColor(item.kind) }]} />
                        <Text style={styles.historyNodeDay}>Dia {item.dayNumber}</Text>
                        <Text style={styles.historyNodeTitle}>{item.title}</Text>
                        <Text style={styles.historyNodeDetail} numberOfLines={2}>{item.detail}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </View>

          <View style={styles.historyList}>
            {history.map((h, i) => (
              <View key={`${h.at}-${i}`} style={styles.historyItemRow}>
                <Text style={styles.historyAt}>{new Date(h.at).toLocaleString('pt-BR')}</Text>
                <Text style={styles.historyText}>{h.text}</Text>
              </View>
            ))}
            {history.length === 0 && <Text style={styles.row}>Sem histórico.</Text>}
          </View>
        </Card>
      )}

      {activeTab === 'tasks' && (
        <Card title="Tarefas">
          <View style={styles.rowBtns}>
            <Small onPress={() => void act(async () => {
              const ids = data.tasks.filter((t) => !t.completed).map((t) => t.id);
              if (ids.length === 0) return;
              const { error: e } = await supabase.from('event_tasks').update({ completed: true }).in('id', ids);
              if (e) throw new Error(e.message);
            })}>Concluir pendentes</Small>
            <Small onPress={() => void act(async () => {
              const ids = data.tasks.filter((t) => t.completed).map((t) => t.id);
              if (ids.length === 0) return;
              const { error: e } = await supabase.from('event_tasks').update({ completed: false }).in('id', ids);
              if (e) throw new Error(e.message);
            })}>Reabrir concluidas</Small>
            <Danger onPress={() => confirmBatchDelete('Excluir todas as tarefas concluídas?', async () => {
              const ids = data.tasks.filter((t) => t.completed).map((t) => t.id);
              if (ids.length === 0) return;
              const { error: e } = await supabase.from('event_tasks').delete().in('id', ids);
              if (e) throw new Error(e.message);
            })}>Excluir concluídas</Danger>
          </View>
          <TextInput style={styles.input} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Nova tarefa" />
          <TextInput style={styles.input} value={newTaskDueDate} onChangeText={setNewTaskDueDate} placeholder="Prazo (YYYY-MM-DD)" />
          <TextInput style={styles.input} value={newTaskAssignee} onChangeText={setNewTaskAssignee} placeholder="Responsável (opcional)" />
          <View style={styles.rowBtns}>
            <Small onPress={() => setNewTaskPriority('low')}>Prioridade baixa</Small>
            <Small onPress={() => setNewTaskPriority('normal')}>Prioridade normal</Small>
            <Small onPress={() => setNewTaskPriority('high')}>Prioridade alta</Small>
            <Small onPress={() => setNewTaskPriority('urgent')}>Urgente</Small>
          </View>
          <Text style={styles.caption}>Prioridade atual: {newTaskPriority.toUpperCase()}</Text>
          <Pressable style={styles.btn} onPress={() => void act(async () => {
            if (!f.a.trim()) return;
            const { error: e } = await supabase.from('event_tasks').insert({
              event_id: eventId,
              text: f.a.trim(),
              completed: false,
              due_date: newTaskDueDate.trim() || null,
              priority: newTaskPriority,
              assignee_name: newTaskAssignee.trim() || null,
              position: data.tasks.length,
            });
            if (e) throw new Error(e.message);
            setF((s) => ({ ...s, a: '' }));
            setNewTaskDueDate('');
            setNewTaskAssignee('');
            setNewTaskPriority('normal');
          })}><Text style={styles.btnText}>Adicionar</Text></Pressable>
          {visibleTasks.map((t) => (
            <Item
              key={t.id}
              text={`${t.text} | ${(t.priority ?? 'normal').toUpperCase()} | ${t.completed ? 'Concluida' : 'Pendente'}${t.due_date ? ` | Prazo: ${new Date(t.due_date).toLocaleDateString('pt-BR')}` : ''}${t.assignee_name ? ` | Resp: ${t.assignee_name}` : ''}`}
            >
              <Small onPress={() => void act(async () => {
                const { error: e } = await supabase.from('event_tasks').update({ completed: !t.completed }).eq('id', t.id);
                if (e) throw new Error(e.message);
              })}>{t.completed ? 'Reabrir' : 'Concluir'}</Small>
              <Small onPress={() => void act(async () => {
                const nextPriority = t.priority === 'urgent'
                  ? 'low'
                  : t.priority === 'high'
                    ? 'urgent'
                    : t.priority === 'normal'
                      ? 'high'
                      : 'normal';
                const { error: e } = await supabase.from('event_tasks').update({ priority: nextPriority }).eq('id', t.id);
                if (e) throw new Error(e.message);
              })}>Prioridade</Small>
              <Danger onPress={() => void act(async () => {
                const { error: e } = await supabase.from('event_tasks').delete().eq('id', t.id);
                if (e) throw new Error(e.message);
              })}>Excluir</Danger>
            </Item>
          ))}
          {data.tasks.length > visible.tasks && (
            <Pressable style={styles.btnGhostWide} onPress={() => showMore('tasks')}>
              <Text style={styles.smallText}>Mostrar mais ({data.tasks.length - visible.tasks} restantes)</Text>
            </Pressable>
          )}
          {paging.tasks.hasMore && (
            <Pressable style={styles.btnGhostWide} onPress={() => void loadMoreKey('tasks')}>
              <Text style={styles.smallText}>{loadingMore === 'tasks' ? 'Carregando...' : 'Carregar mais do servidor'}</Text>
            </Pressable>
          )}
        </Card>
      )}

      {activeTab === 'budget' && (
        <Card title="Orçamento">
          <Text style={styles.caption}>Filtro por fornecedor (ID)</Text>
          <TextInput style={styles.input} value={budgetVendorFilter} onChangeText={setBudgetVendorFilter} placeholder="Filtrar por vendor_id" />
          <View style={styles.rowBtns}>
            <Small onPress={() => setBudgetStatusFilter('all')}>Todos status</Small>
            <Small onPress={() => setBudgetStatusFilter('pending')}>Pendentes</Small>
            <Small onPress={() => setBudgetStatusFilter('confirmed')}>Confirmados</Small>
            <Small onPress={() => setBudgetStatusFilter('paid')}>Pagos</Small>
            <Small onPress={() => setBudgetStatusFilter('cancelled')}>Cancelados</Small>
          </View>
          <Text style={styles.caption}>Status selecionado: {budgetStatusFilter.toUpperCase()}</Text>
          <TextInput style={styles.input} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Despesa" />
          <TextInput style={styles.input} value={f.b} onChangeText={(v) => setF((s) => ({ ...s, b: v }))} placeholder="Valor" keyboardType="numeric" />
          <TextInput style={styles.input} value={budgetVendorInput} onChangeText={setBudgetVendorInput} placeholder="vendor_id da despesa (opcional)" />
          <Pressable style={styles.btn} onPress={() => void act(async () => {
            const val = Number(f.b);
            if (!f.a.trim() || !Number.isFinite(val)) return;
            const { error: e } = await supabase.from('event_expenses').insert({
              event_id: eventId,
              name: f.a.trim(),
              value: val,
              color: '#D4AF37',
              status: 'pending',
              vendor_id: budgetVendorInput.trim() || null,
            });
            if (e) throw new Error(e.message);
            setF((s) => ({ ...s, a: '', b: '' }));
            setBudgetVendorInput('');
          })}><Text style={styles.btnText}>Adicionar despesa</Text></Pressable>
          <Text style={styles.subtitle}>Configuração de pagamento</Text>
          <TextInput style={styles.input} value={budgetPaymentMethod} onChangeText={(v) => setBudgetPaymentMethod((v as PaymentMethod) || 'pix')} placeholder="Método (pix,crédito,débito...)" />
          <TextInput style={styles.input} value={budgetPaymentReceiptDocId} onChangeText={setBudgetPaymentReceiptDocId} placeholder="ID do documento/recibo (opcional)" />
          <TextInput style={styles.input} value={budgetPaymentNote} onChangeText={setBudgetPaymentNote} placeholder="Nota do pagamento (opcional)" />
          {filteredExpenses.map((x) => (
            <Item key={x.id} text={`${x.name} | ${brl(Number(x.value ?? 0))} | ${(x.status ?? 'pending').toUpperCase()} | vendor: ${x.vendor_id ?? '-'}`}>
              <Small onPress={() => void act(async () => {
                const note = composePaymentNote(budgetPaymentNote, {
                  receipt_document_id: budgetPaymentReceiptDocId.trim() || null,
                });
                const method = normalizePaymentMethod(budgetPaymentMethod);
                const { error: e } = await supabase.from('expense_payments').insert({
                  event_id: eventId,
                  expense_id: x.id,
                  amount: Number(x.value ?? 0),
                  method,
                  paid_at: new Date().toISOString(),
                  note,
                });
                if (e) throw new Error(e.message);
                setBudgetPaymentReceiptDocId('');
                setBudgetPaymentNote('');
              })}>Pagar</Small>
              <Small onPress={() => void act(async () => {
                const { error: e } = await supabase
                  .from('event_expenses')
                  .update({ status: x.status === 'confirmed' ? 'paid' : 'confirmed' })
                  .eq('id', x.id);
                if (e) throw new Error(e.message);
              })}>{x.status === 'confirmed' ? 'Marcar pago' : 'Confirmar'}</Small>
              <Small onPress={() => void act(async () => {
                const { error: e } = await supabase
                  .from('event_expenses')
                  .update({ status: 'cancelled' })
                  .eq('id', x.id);
                if (e) throw new Error(e.message);
              })}>Cancelar</Small>
              <Danger onPress={() => void act(async () => {
                await supabase.from('expense_payments').delete().eq('expense_id', x.id);
                const { error: e } = await supabase.from('event_expenses').delete().eq('id', x.id);
                if (e) throw new Error(e.message);
              })}>Excluir</Danger>
            </Item>
          ))}
          <Text style={styles.subtitle}>Pagamentos</Text>
          {filteredPayments.map((p) => (
            <Item key={p.id} text={`${brl(Number(p.amount ?? 0))} | ${fmt(p.paid_at)} | ${String(p.method ?? '-').toUpperCase()}`}>
              <Small onPress={() => {
                const meta = parsePaymentNote(p.note).meta;
                if (!meta.receipt_document_id) return;
                setDocumentReceiptFilterId(meta.receipt_document_id);
                setActiveTab('documents');
              }}>Ver recibo</Small>
              <Danger onPress={() => void act(async () => {
                const { error: e } = await supabase.from('expense_payments').delete().eq('id', p.id);
                if (e) throw new Error(e.message);
              })}>Excluir</Danger>
            </Item>
          ))}
        </Card>
      )}

      {activeTab === 'guests' && (
        <Card title="Convidados">
          <View style={styles.statsRow}>
            <Text style={styles.pill}>Total: {guestSummary.total}</Text>
            <Text style={styles.pill}>Pendentes: {guestSummary.pending}</Text>
            <Text style={styles.pill}>Confirmados: {guestSummary.confirmed}</Text>
            <Text style={styles.pill}>Recusados: {guestSummary.declined}</Text>
          </View>
          <View style={styles.rowBtns}>
            <Small onPress={() => setGuestFilter('all')}>Todos</Small>
            <Small onPress={() => setGuestFilter('pending')}>Pendentes</Small>
            <Small onPress={() => setGuestFilter('confirmed')}>Confirmados</Small>
            <Small onPress={() => setGuestFilter('declined')}>Recusados</Small>
          </View>
          <View style={styles.rowBtns}>
            <Small onPress={() => void act(async () => {
              const ids = filteredGuests
                .filter((g) => (g.rsvp_status ?? 'pending') !== 'confirmed')
                .map((g) => g.id);
              if (ids.length === 0) return;
              const { error: e } = await supabase.from('event_guests').update({ rsvp_status: 'confirmed', confirmed: true }).in('id', ids);
              if (e) throw new Error(e.message);
            })}>Confirmar filtrados</Small>
            <Small onPress={() => void act(async () => {
              const ids = filteredGuests
                .filter((g) => (g.rsvp_status ?? 'pending') !== 'declined')
                .map((g) => g.id);
              if (ids.length === 0) return;
              const { error: e } = await supabase.from('event_guests').update({ rsvp_status: 'declined', confirmed: false }).in('id', ids);
              if (e) throw new Error(e.message);
            })}>Recusar filtrados</Small>
            <Danger onPress={() => confirmBatchDelete('Excluir todos os convidados filtrados?', async () => {
              const ids = filteredGuests.map((g) => g.id);
              if (ids.length === 0) return;
              const { error: e } = await supabase.from('event_guests').delete().in('id', ids);
              if (e) throw new Error(e.message);
            })}>Excluir filtrados</Danger>
          </View>
          <TextInput style={styles.input} value={guestSearch} onChangeText={setGuestSearch} placeholder="Buscar por nome ou telefone" />
          <View style={styles.rowBtns}>
            <Small onPress={() => setGuestSort('name_asc')}>A-Z</Small>
            <Small onPress={() => setGuestSort('name_desc')}>Z-A</Small>
          </View>
          <TextInput style={styles.input} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Nome" />
          <TextInput style={styles.input} value={f.b} onChangeText={(v) => setF((s) => ({ ...s, b: v }))} placeholder="Telefone" />
          <Pressable style={styles.btn} onPress={() => void act(async () => {
            if (!f.a.trim()) return;
            const { error: e } = await supabase.from('event_guests').insert({ event_id: eventId, name: f.a.trim(), phone: f.b.trim() || null, rsvp_status: 'pending', confirmed: false });
            if (e) throw new Error(e.message);
            setF((s) => ({ ...s, a: '', b: '' }));
          })}><Text style={styles.btnText}>Adicionar convidado</Text></Pressable>
          {visibleGuests.map((g) => (
            <Item key={g.id} text={`${g.name} | ${(g.rsvp_status ?? 'pending').toUpperCase()}`}>
              <Small onPress={() => void act(async () => {
                const { error: e } = await supabase.from('event_guests').update({ rsvp_status: 'confirmed', confirmed: true }).eq('id', g.id);
                if (e) throw new Error(e.message);
              })}>Confirmar</Small>
              <Small onPress={() => void act(async () => {
                const { error: e } = await supabase.from('event_guests').update({ rsvp_status: 'declined', confirmed: false }).eq('id', g.id);
                if (e) throw new Error(e.message);
              })}>Recusar</Small>
              <Danger onPress={() => void act(async () => {
                const { error: e } = await supabase.from('event_guests').delete().eq('id', g.id);
                if (e) throw new Error(e.message);
              })}>Excluir</Danger>
            </Item>
          ))}
        </Card>
      )}
      {activeTab === 'timeline' && (
        <Card title="Cronograma">
          <View style={styles.cardSoft}>
            <View style={styles.rowBetween}>
              <View style={styles.grow}>
                <Text style={styles.subtitle}>Cronograma inteligente</Text>
                <Text style={styles.caption}>Sugestões locais + IA para o dia do evento.</Text>
              </View>
              <Pressable style={styles.btnGhost} onPress={() => void generateHybridTimelineSuggestions()}>
                <Text style={styles.smallText}>{loadingAiTimelineSuggestions ? 'Gerando...' : 'Gerar IA'}</Text>
              </Pressable>
            </View>
            {lastAiTimelineRunAt ? (
              <Text style={styles.caption}>Última execução IA: {fmt(lastAiTimelineRunAt)}</Text>
            ) : null}
            {aiTimelineError ? <Text style={styles.err}>{aiTimelineError}</Text> : null}
            {timelineSuggestions.length === 0 ? (
              <Text style={styles.caption}>Sem sugestoes pendentes.</Text>
            ) : (
              timelineSuggestions.map((item) => (
                <View key={item.id} style={styles.item}>
                  <Text style={styles.row}>{item.title}</Text>
                  <Text style={styles.caption}>{item.reason}</Text>
                  <Text style={styles.caption}>{item.time} | {item.activity}</Text>
                  <View style={styles.rowBtns}>
                    <Small onPress={() => void applySmartTimelineSuggestion(item)}>Aplicar</Small>
                  </View>
                </View>
              ))
            )}
          </View>
          <TextInput style={styles.input} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Hora HH:MM" />
          <TextInput style={styles.input} value={f.b} onChangeText={(v) => setF((s) => ({ ...s, b: v }))} placeholder="Atividade" />
          <TextInput style={styles.input} value={f.c} onChangeText={(v) => setF((s) => ({ ...s, c: v }))} placeholder="Responsável" />
          <Pressable style={styles.btn} onPress={() => void act(async () => {
            if (!f.b.trim()) return;
            const { error: e } = await supabase.from('event_timeline').insert({ event_id: eventId, time: f.a.trim() || '00:00', activity: f.b.trim(), assignee_name: f.c.trim() || null, position: data.timeline.length });
            if (e) throw new Error(e.message);
            setF((s) => ({ ...s, a: '', b: '', c: '' }));
          })}><Text style={styles.btnText}>Adicionar item</Text></Pressable>
          {visibleTimeline.map((t) => (
            <Item key={t.id} text={`${t.time || '--:--'} | ${t.activity}`}>
              <Danger onPress={() => void act(async () => {
                const { error: e } = await supabase.from('event_timeline').delete().eq('id', t.id);
                if (e) throw new Error(e.message);
              })}>Excluir</Danger>
            </Item>
          ))}
          {data.timeline.length > visible.timeline && (
            <Pressable style={styles.btnGhostWide} onPress={() => showMore('timeline')}>
              <Text style={styles.smallText}>Mostrar mais ({data.timeline.length - visible.timeline} restantes)</Text>
            </Pressable>
          )}
          {paging.timeline.hasMore && (
            <Pressable style={styles.btnGhostWide} onPress={() => void loadMoreKey('timeline')}>
              <Text style={styles.smallText}>{loadingMore === 'timeline' ? 'Carregando...' : 'Carregar mais do servidor'}</Text>
            </Pressable>
          )}
        </Card>
      )}

      {activeTab === 'vendors' && (
        <Card title="Fornecedores">
          <TextInput style={styles.input} value={vendorSearch} onChangeText={setVendorSearch} placeholder="Buscar por nome/categoria" />
          <View style={styles.rowBtns}>
            <Small onPress={() => setVendorSort('name_asc')}>A-Z</Small>
            <Small onPress={() => setVendorSort('name_desc')}>Z-A</Small>
            <Small onPress={() => setVendorSort('status')}>Por status</Small>
            <Small onPress={() => void act(async () => {
              const ids = filteredVendors.filter((v) => (v.status ?? 'pending') !== 'confirmed').map((v) => v.id);
              if (ids.length === 0) return;
              const { error: e } = await supabase.from('event_vendors').update({ status: 'confirmed' }).in('id', ids);
              if (e) throw new Error(e.message);
            })}>Confirmar filtrados</Small>
            <Danger onPress={() => confirmBatchDelete('Excluir todos os fornecedores filtrados?', async () => {
              const ids = filteredVendors.map((v) => v.id);
              if (ids.length === 0) return;
              const { error: e } = await supabase.from('event_vendors').delete().in('id', ids);
              if (e) throw new Error(e.message);
            })}>Excluir filtrados</Danger>
          </View>
          <TextInput style={styles.input} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Nome" />
          <TextInput style={styles.input} value={f.b} onChangeText={(v) => setF((s) => ({ ...s, b: v }))} placeholder="Categoria" />
          <TextInput style={styles.input} value={newVendorPhone} onChangeText={setNewVendorPhone} placeholder="Telefone (opcional)" />
          <TextInput style={styles.input} value={newVendorEmail} onChangeText={setNewVendorEmail} placeholder="Email (opcional)" />
          <TextInput style={styles.input} value={newVendorArrival} onChangeText={setNewVendorArrival} placeholder="Chegada HH:MM (opcional)" />
          <TextInput style={styles.input} value={newVendorDone} onChangeText={setNewVendorDone} placeholder="Fim HH:MM (opcional)" />
          <Pressable style={styles.btn} onPress={() => void act(async () => {
            if (!f.a.trim() || !f.b.trim()) return;
            const { error: e } = await supabase.from('event_vendors').insert({
              event_id: eventId,
              name: f.a.trim(),
              category: f.b.trim(),
              status: 'pending',
              phone: newVendorPhone.trim() || null,
              email: newVendorEmail.trim() || null,
              expected_arrival_time: newVendorArrival.trim() || null,
              expected_done_time: newVendorDone.trim() || null,
            });
            if (e) throw new Error(e.message);
            setF((s) => ({ ...s, a: '', b: '' }));
            setNewVendorPhone('');
            setNewVendorEmail('');
            setNewVendorArrival('');
            setNewVendorDone('');
          })}><Text style={styles.btnText}>Adicionar fornecedor</Text></Pressable>
          {visibleVendors.map((v) => (
            <Item key={v.id} text={`${v.name} | ${v.category || '-'} | ${(v.status || 'pending').toUpperCase()} | ${v.expected_arrival_time || '--:--'}-${v.expected_done_time || '--:--'} | recibos: ${paymentReceiptCountByVendor.get(String(v.id)) ?? 0}`}>
              <Small onPress={() => void act(async () => {
                const { error: e } = await supabase.from('event_vendors').update({ status: 'confirmed' }).eq('id', v.id);
                if (e) throw new Error(e.message);
              })}>Confirmar</Small>
              <Small onPress={() => void act(async () => {
                const { error: e } = await supabase.from('event_vendors').update({ status: 'paid' }).eq('id', v.id);
                if (e) throw new Error(e.message);
              })}>Pago</Small>
              <Small onPress={() => {
                setBudgetVendorFilter(String(v.id));
                setActiveTab('budget');
              }}>Ver gastos</Small>
              <Small onPress={() => {
                setDocumentVendorFilter(String(v.id));
                setActiveTab('documents');
              }}>Ver docs</Small>
              <Danger onPress={() => void act(async () => {
                const { error: e } = await supabase.from('event_vendors').delete().eq('id', v.id);
                if (e) throw new Error(e.message);
              })}>Excluir</Danger>
            </Item>
          ))}
          {filteredVendors.length > visible.vendors && (
            <Pressable style={styles.btnGhostWide} onPress={() => showMore('vendors')}>
              <Text style={styles.smallText}>Mostrar mais ({filteredVendors.length - visible.vendors} restantes)</Text>
            </Pressable>
          )}
          {paging.vendors.hasMore && (
            <Pressable style={styles.btnGhostWide} onPress={() => void loadMoreKey('vendors')}>
              <Text style={styles.smallText}>{loadingMore === 'vendors' ? 'Carregando...' : 'Carregar mais do servidor'}</Text>
            </Pressable>
          )}
        </Card>
      )}

      {activeTab === 'documents' && (
        <Card title="Documentos">
          {documentReceiptFilterId ? (
            <View style={styles.cardSoft}>
              <Text style={styles.caption}>Filtro ativo de recibo: {documentReceiptFilterId}</Text>
              <Pressable style={styles.btnGhost} onPress={() => setDocumentReceiptFilterId('')}>
                <Text style={styles.smallText}>Limpar filtro de recibo</Text>
              </Pressable>
            </View>
          ) : null}
          <TextInput style={styles.input} value={documentSearch} onChangeText={setDocumentSearch} placeholder="Buscar documento" />
          <TextInput style={styles.input} value={documentVendorFilter} onChangeText={setDocumentVendorFilter} placeholder="Filtrar por vendor_id" />
          <TextInput style={styles.input} value={documentCategoryFilter} onChangeText={setDocumentCategoryFilter} placeholder="Filtrar por categoria" />
          <View style={styles.rowBtns}>
            <Small onPress={() => setDocumentCategoryFilter('')}>Todas categorias</Small>
            {documentCategories.slice(0, 6).map((category) => (
              <Small key={category} onPress={() => setDocumentCategoryFilter(category)}>{category}</Small>
            ))}
            <Small onPress={() => void pickAndUploadDocument()}>
              {uploadingDoc ? 'Enviando arquivo...' : 'Upload do celular'}
            </Small>
            <Small
              onPress={() =>
                void Share.share({
                  message:
                    filteredDocuments
                      .filter((d) => !d.file_id && typeof d.file_url === 'string' && d.file_url.trim())
                      .map((d) => d.file_url)
                      .join('\n') || 'Nenhum link público para compartilhar.',
                })
              }
            >
              Compartilhar links públicos
            </Small>
            <Danger onPress={() => confirmBatchDelete('Excluir todos os documentos filtrados?', async () => {
              const ids = filteredDocuments.map((d) => d.id);
              if (ids.length === 0) return;
              const privateFileIds = filteredDocuments.map((d) => d.file_id).filter(Boolean);
              const { error: e } = await supabase.from('event_documents').delete().in('id', ids);
              if (e) throw new Error(e.message);
              await Promise.all(privateFileIds.map((fileId) => deleteStoredFile(String(fileId)).catch(() => undefined)));
            })}>Excluir filtrados</Danger>
          </View>
          <TextInput style={styles.input} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Nome" />
          <TextInput style={styles.input} value={f.b} onChangeText={(v) => setF((s) => ({ ...s, b: v }))} placeholder="URL" />
          <TextInput style={styles.input} value={f.c} onChangeText={(v) => setF((s) => ({ ...s, c: v }))} placeholder="Categoria" />
          <TextInput style={styles.input} value={documentVendorInput} onChangeText={setDocumentVendorInput} placeholder="ID do fornecedor (opcional)" />
          <Pressable style={styles.btn} onPress={() => void act(async () => {
            if (!f.a.trim() || !f.b.trim()) return;
            const { error: e } = await supabase.from('event_documents').insert({
              event_id: eventId,
              name: f.a.trim(),
              file_url: f.b.trim(),
              category: f.c.trim() || 'Outros',
              vendor_id: documentVendorInput.trim() || null,
            });
            if (e) throw new Error(e.message);
            setF((s) => ({ ...s, a: '', b: '', c: '' }));
            setDocumentVendorInput('');
          })}><Text style={styles.btnText}>Adicionar documento</Text></Pressable>
          {visibleDocuments.map((d) => (
            <Item key={d.id} text={`${d.name} | ${d.category || 'Outros'} | vendor: ${d.vendor_id ?? '-'}`}>
              <Small onPress={() => void openDocumentLink(d)}>Abrir</Small>
              {!d.file_id && d.file_url ? (
                <Small onPress={() => { if (d.file_url) void Share.share({ message: d.file_url }); }}>Compartilhar link</Small>
              ) : null}
              <Danger onPress={() => void act(async () => {
                if (d.file_id) {
                  await deleteStoredFile(String(d.file_id)).catch(() => undefined);
                }
                const { error: e } = await supabase.from('event_documents').delete().eq('id', d.id);
                if (e) throw new Error(e.message);
              })}>Excluir</Danger>
            </Item>
          ))}
          {filteredDocuments.length > visible.documents && (
            <Pressable style={styles.btnGhostWide} onPress={() => showMore('documents')}>
              <Text style={styles.smallText}>Mostrar mais ({filteredDocuments.length - visible.documents} restantes)</Text>
            </Pressable>
          )}
          {paging.documents.hasMore && (
            <Pressable style={styles.btnGhostWide} onPress={() => void loadMoreKey('documents')}>
              <Text style={styles.smallText}>{loadingMore === 'documents' ? 'Carregando...' : 'Carregar mais do servidor'}</Text>
            </Pressable>
          )}
        </Card>
      )}

      {activeTab === 'notes' && (
        <Card title="Notas">
          <TextInput style={[styles.input, styles.area]} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Nota" multiline />
          <Pressable style={styles.btn} onPress={() => void act(async () => {
            if (!f.a.trim()) return;
            const { error: e } = await supabase.from('event_notes').insert({ event_id: eventId, content: f.a.trim(), color: '#FEF3C7' });
            if (e) throw new Error(e.message);
            setF((s) => ({ ...s, a: '' }));
          })}><Text style={styles.btnText}>Adicionar nota</Text></Pressable>
          {data.notes.map((n) => (
            <Item key={n.id} text={n.content}>
              <Danger onPress={() => void act(async () => {
                const { error: e } = await supabase.from('event_notes').delete().eq('id', n.id);
                if (e) throw new Error(e.message);
              })}>Excluir</Danger>
            </Item>
          ))}
          {filteredGuests.length > visible.guests && (
            <Pressable style={styles.btnGhostWide} onPress={() => showMore('guests')}>
              <Text style={styles.smallText}>Mostrar mais ({filteredGuests.length - visible.guests} restantes)</Text>
            </Pressable>
          )}
          {paging.guests.hasMore && (
            <Pressable style={styles.btnGhostWide} onPress={() => void loadMoreKey('guests')}>
              <Text style={styles.smallText}>{loadingMore === 'guests' ? 'Carregando...' : 'Carregar mais do servidor'}</Text>
            </Pressable>
          )}
        </Card>
      )}

      {activeTab === 'team' && (
        <Card title="Equipe">
          <TextInput style={styles.input} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Nome" />
          <TextInput style={styles.input} value={f.b} onChangeText={(v) => setF((s) => ({ ...s, b: v }))} placeholder="Telefone" />
          <TextInput style={styles.input} value={f.c} onChangeText={(v) => setF((s) => ({ ...s, c: v }))} placeholder="Função" />
          <Pressable style={styles.btn} onPress={() => void act(async () => {
            if (!f.a.trim()) return;
            const { error: e } = await supabase.from('event_team_members').insert({ event_id: eventId, name: f.a.trim(), phone: f.b.trim() || null, role: f.c.trim() || 'Cerimonialista' });
            if (e) throw new Error(e.message);
            setF((s) => ({ ...s, a: '', b: '', c: '' }));
          })}><Text style={styles.btnText}>Adicionar membro</Text></Pressable>
          {data.team.map((m) => (
            <Item key={m.id} text={`${m.name} | ${m.role || '-'}`}>
              <Danger onPress={() => void act(async () => {
                const { error: e } = await supabase.from('event_team_members').delete().eq('id', m.id);
                if (e) throw new Error(e.message);
              })}>Excluir</Danger>
            </Item>
          ))}
        </Card>
      )}

      {activeTab === 'tables' && (
        <Card title="Mesas">
          <View style={styles.rowBtns}>
            <Small onPress={() => setTablesViewMode('list')}>Modo lista</Small>
            <Small onPress={() => setTablesViewMode('map')}>Modo visual</Small>
          </View>
          <TextInput style={styles.input} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Nome da mesa" />
          <TextInput style={styles.input} value={f.b} onChangeText={(v) => setF((s) => ({ ...s, b: v }))} placeholder="Lugares" keyboardType="numeric" />
          <Pressable style={styles.btn} onPress={() => void act(async () => {
            const seats = Number(f.b);
            if (!f.a.trim() || !Number.isFinite(seats) || seats < 1) return;
            const { error: e } = await supabase.from('event_tables').insert({ event_id: eventId, name: f.a.trim(), seats, shape: 'round' });
            if (e) throw new Error(e.message);
            setF((s) => ({ ...s, a: '', b: '' }));
          })}><Text style={styles.btnText}>Adicionar mesa</Text></Pressable>
          {tablesViewMode === 'list' ? (
            data.tables.map((t) => (
              <Item key={t.id} text={`${t.name} | ${(data.guests ?? []).filter((g) => g.table_id === t.id).length}/${t.seats}`}>
                <Small onPress={() => void act(async () => {
                  const g = data.guests.find((x) => !x.table_id);
                  if (!g) return;
                  const { error: e } = await supabase.from('event_guests').update({ table_id: t.id }).eq('id', g.id);
                  if (e) throw new Error(e.message);
                })}>Alocar pendente</Small>
                <Danger onPress={() => void act(async () => {
                  await supabase.from('event_guests').update({ table_id: null }).eq('table_id', t.id);
                  const { error: e } = await supabase.from('event_tables').delete().eq('id', t.id);
                  if (e) throw new Error(e.message);
                })}>Excluir</Danger>
              </Item>
            ))
          ) : (
            <EventTablesVisualMap
              eventId={eventId}
              tables={data.tables}
              guests={data.guests}
              onError={setError}
              onReload={reloadTablesModule}
              onTablePositionLocalUpdate={(tableId, x, y) => {
                setData((prev) => ({
                  ...prev,
                  tables: prev.tables.map((table) =>
                    table.id === tableId ? { ...table, posx: x, posy: y } : table,
                  ),
                }));
              }}
            />
          )}
        </Card>
      )}

      {activeTab === 'invites' && (
        <Card title="Convites">
          <View style={styles.statsRow}>
            <Text style={styles.pill}>Pendentes: {guestSummary.pending}</Text>
            <Text style={styles.pill}>Confirmados: {guestSummary.confirmed}</Text>
            <Text style={styles.pill}>Recusados: {guestSummary.declined}</Text>
          </View>
          <View style={styles.rowBtns}>
            <Small onPress={() => setGuestFilter('all')}>Todos</Small>
            <Small onPress={() => setGuestFilter('pending')}>Pendentes</Small>
            <Small onPress={() => setGuestFilter('confirmed')}>Confirmados</Small>
            <Small onPress={() => setGuestFilter('declined')}>Recusados</Small>
          </View>
          <TextInput style={styles.input} value={guestSearch} onChangeText={setGuestSearch} placeholder="Buscar convidado" />
          <TextInput style={[styles.input, styles.area]} value={f.inviteTemplate} onChangeText={(v) => setF((s) => ({ ...s, inviteTemplate: v }))} placeholder="Modelo" multiline />
          <TextInput style={styles.input} value={f.inviteDress} onChangeText={(v) => setF((s) => ({ ...s, inviteDress: v }))} placeholder="Código de vestimenta" />
          <Pressable style={styles.btn} onPress={() => void act(async () => {
            const { error: e } = await supabase.from('events').update({ invite_message_template: f.inviteTemplate.trim() || null, invite_dress_code: f.inviteDress.trim() || null }).eq('id', eventId);
            if (e) throw new Error(e.message);
            setEvent((s) => s ? { ...s, invite_message_template: f.inviteTemplate.trim() || null, invite_dress_code: f.inviteDress.trim() || null } : s);
          }, false)}><Text style={styles.btnText}>Salvar configurações</Text></Pressable>
          <Pressable style={styles.btnGhostWide} onPress={() => void act(async () => {
            const ids = data.guests.filter((g) => (g.rsvp_status ?? 'pending') === 'pending').map((g) => g.id);
            if (ids.length === 0) return;
            const { error: e } = await supabase.from('event_guests').update({ invited_at: new Date().toISOString() }).in('id', ids);
            if (e) throw new Error(e.message);
          })}><Text style={styles.smallText}>Marcar envio para pendentes</Text></Pressable>
          <Pressable style={styles.btnGhostWide} onPress={() => void act(async () => {
            const lines: string[] = [];
            for (const g of filteredGuests) {
              let token = g.invite_token;
              if (!token) {
                token = `${g.id}-${Date.now()}`;
                const { error: e } = await supabase.from('event_guests').update({ invite_token: token }).eq('id', g.id);
                if (e) throw new Error(e.message);
              }
              const base = process.env.EXPO_PUBLIC_BASE_INVITE_URL || 'https://painelprime.com.br/convite';
              const link = `${base}/${token}`;
              const msg = f.inviteTemplate.replaceAll('[Nome do Convidado]', g.name || 'Convidado').replaceAll('[LinkRSVP]', link);
              lines.push(`${g.name}: ${msg}`);
            }
            await Share.share({ message: lines.join('\n\n') || 'Sem convidados filtrados.' });
          })}>
            <Text style={styles.smallText}>Gerar e compartilhar todos filtrados</Text>
          </Pressable>
          {visibleGuests.map((g) => {
            const base = process.env.EXPO_PUBLIC_BASE_INVITE_URL || 'https://painelprime.com.br/convite';
            const link = g.invite_token ? `${base}/${g.invite_token}` : base;
            const msg = f.inviteTemplate.replaceAll('[Nome do Convidado]', g.name || 'Convidado').replaceAll('[LinkRSVP]', link);
            return (
              <Item key={g.id} text={`${g.name} | ${(g.rsvp_status ?? 'pending').toUpperCase()}`}>
                <Small onPress={() => void act(async () => {
                  let token = g.invite_token;
                  if (!token) {
                    token = `${g.id}-${Date.now()}`;
                    const { error: e } = await supabase.from('event_guests').update({ invite_token: token }).eq('id', g.id);
                    if (e) throw new Error(e.message);
                  }
                  const finalLink = `${base}/${token}`;
                  const finalMsg = f.inviteTemplate
                    .replaceAll('[Nome do Convidado]', g.name || 'Convidado')
                    .replaceAll('[LinkRSVP]', finalLink);
                  await Share.share({ message: finalMsg });
                })}>Gerar link e compartilhar</Small>
              </Item>
            );
          })}
          {filteredGuests.length > visible.guests && (
            <Pressable style={styles.btnGhostWide} onPress={() => showMore('guests')}>
              <Text style={styles.smallText}>Mostrar mais ({filteredGuests.length - visible.guests} restantes)</Text>
            </Pressable>
          )}
          {paging.guests.hasMore && (
            <Pressable style={styles.btnGhostWide} onPress={() => void loadMoreKey('guests')}>
              <Text style={styles.smallText}>{loadingMore === 'guests' ? 'Carregando...' : 'Carregar mais do servidor'}</Text>
            </Pressable>
          )}
        </Card>
      )}

      {activeTab === 'catalog' && (
        <Card title="Catálogo de Fornecedores">
          <Text style={styles.p}>Selecione fornecedores do catálogo da sua assessoria para este evento.</Text>
          <Pressable style={styles.btn} onPress={() => setActiveTab('vendors')}>
            <Text style={styles.btnText}>Ver fornecedores do evento</Text>
          </Pressable>
        </Card>
      )}

      {activeTab === 'portal' && (
        <Card title="Portal do Cliente">
          <Text style={styles.p}>Acesse o portal do cliente para compartilhar informações do evento.</Text>
          <Pressable style={styles.btn} onPress={() => router.push(`/portal/${eventId}`)}>
            <Text style={styles.btnText}>Abrir Portal do Cliente</Text>
          </Pressable>
        </Card>
      )}

      {activeTab === 'presentes' && (
        <Card title="Intenções de Presentes">
          <PresentesTabContent eventId={eventId} />
        </Card>
      )}

      {activeTab === 'analytics' && (
        <Card title="Relatório de Encerramento">
          <Text style={styles.p}>Gere um relatório completo com métricas de presença, financeiro e muito mais.</Text>
          <Text style={styles.p}>Disponível em breve.</Text>
        </Card>
      )}
        </View>
          </ScrollView>
  );
}

function PresentesTabContent({ eventId }: { eventId: string }) {
  const [gifts, setGifts] = useState<Array<{ id: string; guest_name: string; guest_phone: string; amount: number; status: string; created_at: string; confirmed_at: string | null }>>([]);
  const [loadingGifts, setLoadingGifts] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoadingGifts(true);
      supabase
        .rpc('get_event_gift_intentions_for_owner', { p_event_id: eventId })
        .then(({ data, error }) => {
          if (!active) return;
          if (!error && data) setGifts(data as typeof gifts);
          setLoadingGifts(false);
        });
      return () => { active = false; };
    }, [eventId]),
  );

  if (loadingGifts) {
    return <ActivityIndicator color={colors.primaryStrong} />;
  }

  if (gifts.length === 0) {
    return <Text style={styles.p}>Nenhuma intenção de presente registrada ainda.</Text>;
  }

  const pending = gifts.filter((g) => g.status === 'pending').length;
  const received = gifts.filter((g) => g.status === 'received').length;
  const totalAmount = gifts.reduce((acc, g) => acc + (g.amount || 0), 0);

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Pendentes</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{pending}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Recebidos</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{received}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Valor total</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
        </View>
      </View>
      <View style={{ gap: 6 }}>
        {gifts.map((g) => (
          <View key={g.id} style={{ backgroundColor: colors.card, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{g.guest_name}</Text>
              <Text style={{ color: g.status === 'received' ? '#16A34A' : '#F59E0B', fontSize: 12, fontWeight: '700' }}>
                {g.status === 'received' ? 'Recebido' : 'Pendente'}
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{g.guest_phone}</Text>
            <Text style={{ color: colors.text, fontSize: 13, marginTop: 4 }}>
              {g.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </Text>
            <Text style={{ color: colors.mutedText, fontSize: 11, marginTop: 2 }}>
              {new Date(g.created_at).toLocaleDateString('pt-BR')}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.card}><Text style={styles.subtitle}>{title}</Text>{children}</View>;
}

function CommandLine({
  level,
  text,
}: {
  level: 'low' | 'medium' | 'high';
  text: string;
}) {
  const tone =
    level === 'high'
      ? styles.commandHigh
      : level === 'medium'
        ? styles.commandMedium
        : styles.commandLow;

  return (
    <View style={[styles.commandLine, tone]}>
      <Text style={styles.commandText}>{text}</Text>
    </View>
  );
}

function Item({ text, children }: { text: string; children: React.ReactNode }) {
  return <View style={styles.item}><Text style={styles.row}>{text}</Text><View style={styles.rowBtns}>{children}</View></View>;
}

function Small({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  return <Pressable style={styles.btnGhost} onPress={onPress}><Text style={styles.smallText}>{children}</Text></Pressable>;
}

function Danger({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  return <Pressable style={styles.btnDelete} onPress={onPress}><Text style={styles.delText}>{children}</Text></Pressable>;
}

function TaskSegment({
  title,
  tone,
  tasks,
  onToggle,
  limit = 3,
}: {
  title: string;
  tone: 'error' | 'warning' | 'info' | 'neutral';
  tasks: any[];
  onToggle: (taskId: string, completed: boolean) => Promise<void>;
  limit?: number;
}) {
  if (tasks.length === 0) return null;

  const toneStyle =
    tone === 'error'
      ? styles.segmentError
      : tone === 'warning'
        ? styles.segmentWarning
        : tone === 'info'
          ? styles.segmentInfo
          : styles.segmentNeutral;

  return (
    <View style={styles.segmentWrap}>
      <Text style={[styles.segmentTitle, toneStyle]}>{title}</Text>
      {tasks.slice(0, limit).map((task) => (
        <View key={task.id} style={styles.segmentItem}>
          <View style={styles.grow}>
            <Text style={styles.row}>{String(task.text ?? 'Tarefa')}</Text>
            <Text style={styles.caption}>{task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR') : 'Sem prazo'}</Text>
          </View>
          <Pressable style={styles.btnGhost} onPress={() => void onToggle(task.id, Boolean(task.completed))}>
            <Text style={styles.smallText}>{task.completed ? 'Reabrir' : 'Concluir'}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const PAYMENT_META_PREFIX = '[[PP_META:';
const PAYMENT_META_SUFFIX = ']]';

function parsePaymentNote(note: string | null | undefined): {
  userNote: string;
  meta: PaymentMeta;
} {
  const raw = (note ?? '').trim();
  if (!raw) return { userNote: '', meta: {} };
  const start = raw.lastIndexOf(PAYMENT_META_PREFIX);
  const hasSuffix = raw.endsWith(PAYMENT_META_SUFFIX);
  if (start < 0 || !hasSuffix) return { userNote: raw, meta: {} };
  const jsonStart = start + PAYMENT_META_PREFIX.length;
  const jsonEnd = raw.length - PAYMENT_META_SUFFIX.length;
  const before = raw.slice(0, start).trim();
  const json = raw.slice(jsonStart, jsonEnd).trim();
  try {
    return {
      userNote: before,
      meta: (JSON.parse(json) as PaymentMeta) ?? {},
    };
  } catch {
    return { userNote: raw, meta: {} };
  }
}

function composePaymentNote(userNote: string | null | undefined, meta: PaymentMeta): string | null {
  const clean = (userNote ?? '').trim();
  const hasMeta = typeof meta.receipt_document_id === 'string' || meta.receipt_document_id === null;
  if (!hasMeta) return clean || null;
  return `${clean}${clean ? '\n' : ''}${PAYMENT_META_PREFIX}${JSON.stringify(meta)}${PAYMENT_META_SUFFIX}`;
}

function normalizePaymentMethod(value: string): PaymentMethod {
  const normalized = value.trim().toLowerCase() as PaymentMethod;
  const allowed: PaymentMethod[] = ['pix', 'dinheiro', 'debito', 'credito', 'boleto', 'transferencia', 'outro'];
  return allowed.includes(normalized) ? normalized : 'pix';
}

function combineDateTime(dateStr: string, timeStr: string | null | undefined) {
  if (!timeStr) return null;
  const [hour, minute] = timeStr.split(':').map((value) => Number(value));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const date = new Date(dateStr);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function labelVendorStatus(status: CommandVendorStatus) {
  switch (status) {
    case 'en_route':
      return 'A caminho';
    case 'arrived':
      return 'Chegou';
    case 'done':
      return 'Finalizado';
    default:
      return 'Aguardando';
  }
}

function sanitizeTimeValue(value: string) {
  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)/);
  if (!match) return '10:00';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function pickString(source: Record<string, unknown>, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return fallback;
}

function normalizeAiSuggestion(raw: unknown, index: number): SmartTimelineSuggestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;

  const title = pickString(candidate, ['title', 'titulo'], `Sugestão IA ${index + 1}`);
  const reason = pickString(candidate, ['reason', 'motivo', 'justificativa'], 'Sugestão gerada pela IA.');
  const activity = pickString(candidate, ['activity', 'atividade', 'task'], '');
  if (!activity) return null;

  const assignee = pickString(candidate, ['assignee', 'responsavel', 'owner'], 'Assessoria');
  const rawPriority = pickString(candidate, ['priority', 'prioridade'], 'normal').toLowerCase();
  const priority: 'high' | 'normal' = rawPriority === 'high' || rawPriority === 'alta' ? 'high' : 'normal';
  const time = sanitizeTimeValue(pickString(candidate, ['time', 'hora'], '10:00'));

  return {
    id: `ai-${index}-${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    reason,
    activity,
    time,
    assignee,
    priority,
    source: 'ai',
  };
}

function paymentMethodLabel(method: PaymentMethod) {
  switch (method) {
    case 'pix':
      return 'PIX';
    case 'dinheiro':
      return 'Dinheiro';
    case 'debito':
      return 'Debito';
    case 'credito':
      return 'Credito';
    case 'boleto':
      return 'Boleto';
    case 'transferencia':
      return 'Transferencia';
    default:
      return 'Outro';
  }
}

function getMilestoneColor(kind: ProjectMilestoneKind) {
  switch (kind) {
    case 'start':
      return '#8B5CF6';
    case 'vendor':
      return '#06B6D4';
    case 'guest':
      return '#22C55E';
    case 'expense':
      return '#F59E0B';
    case 'document':
      return '#D946EF';
    case 'payment':
      return '#16A34A';
    case 'invite':
      return '#0EA5E9';
    case 'rsvp':
      return '#4F46E5';
    default:
      return '#6B7280';
  }
}

function asDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isOverdueDate(value: string | null | undefined) {
  const date = asDate(value);
  if (!date) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return date.getTime() < now.getTime();
}

function isTodayDate(value: string | null | undefined) {
  const date = asDate(value);
  if (!date) return false;
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function isThisWeekDate(value: string | null | undefined) {
  const date = asDate(value);
  if (!date) return false;
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const weekDay = start.getDay();
  start.setDate(start.getDate() - weekDay);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date.getTime() >= start.getTime() && date.getTime() < end.getTime();
}

function brl(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmt(v: string | null | undefined) {
  if (!v) return '-';
  return new Date(v).toLocaleString('pt-BR');
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10, paddingBottom: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  back: { color: colors.mutedText, fontWeight: '600', fontSize: 13 },
  p: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, gap: 8 },
  cardSoft: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 8 },
  heroCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 10 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarImage: { width: '100%', height: '100%' },
  heroAvatarFallback: { color: colors.primaryStrong, fontSize: 28, fontWeight: '800' },
  heroMetaWrap: { flex: 1, gap: 2 },
  heroActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  commandCta: {
    borderRadius: 10,
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
  },
  commandCtaText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  grow: { flex: 1 },
  title: { color: colors.text, fontWeight: '700', fontSize: 22 },
  coverImage: { width: '100%', height: 164, borderRadius: 10 },
  meta: { color: colors.mutedText, fontSize: 13 },
  tabRow: { gap: 8, paddingVertical: 4 },
  tab: { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.card },
  tabOn: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
  tabText: { color: colors.mutedText, fontWeight: '600', fontSize: 12 },
  tabTextOn: { color: colors.primaryStrong },
  err: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 8, textAlign: 'center' },
  loadingModule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  loadingModuleText: { color: '#1D4ED8', fontSize: 12, fontWeight: '600' },
  moduleContent: { gap: 10 },
  subtitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  overviewStack: { gap: 10 },
  alertsWrap: { gap: 6 },
  alertRow: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  alertError: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  alertWarning: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  alertInfo: { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  alertText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 6,
    backgroundColor: colors.card,
  },
  metricPink: { borderColor: '#F9A8D4', backgroundColor: '#FDF2F8' },
  metricGold: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  metricBlue: { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  metricGreen: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  metricLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  metricValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  metricSub: { color: colors.text, fontSize: 12, fontWeight: '600' },
  metricTrack: { height: 8, borderRadius: 999, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  metricFill: { height: '100%', borderRadius: 999 },
  metricEditWrap: { gap: 8 },
  chartRows: { gap: 8 },
  chartRowItem: { gap: 4 },
  chartLabel: { color: colors.text, fontSize: 12, fontWeight: '600' },
  chartValue: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  chartTrack: { height: 8, borderRadius: 999, backgroundColor: '#ECEFF3', overflow: 'hidden' },
  chartFill: { height: '100%', borderRadius: 999 },
  segmentWrap: { gap: 6 },
  segmentTitle: { fontSize: 12, fontWeight: '700' },
  segmentError: { color: '#B91C1C' },
  segmentWarning: { color: '#B45309' },
  segmentInfo: { color: '#1D4ED8' },
  segmentNeutral: { color: '#4B5563' },
  segmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 8,
    backgroundColor: '#FFFFFF',
  },
  commandTitle: { color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 2 },
  commandScoreWrap: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 6 },
  commandScoreLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  commandScoreValue: { color: colors.text, fontSize: 22, fontWeight: '700' },
  commandTrack: { height: 10, borderRadius: 999, backgroundColor: '#ECEFF3', overflow: 'hidden' },
  commandFill: { height: '100%', borderRadius: 999 },
  commandLine: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  commandLow: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  commandMedium: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  commandHigh: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  commandText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  commandRulesCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 8, backgroundColor: '#F8FAFC' },
  commandRuleGrid: { flexDirection: 'row', gap: 8 },
  commandRuleInput: { flex: 1 },
  commandBlock: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 6, backgroundColor: colors.card },
  commandBlockTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
  commandItem: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  commandSlaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  commandSeverity: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
    fontSize: 10,
    fontWeight: '700',
  },
  commandSeverityCritical: { borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#B91C1C' },
  commandSeverityWarning: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB', color: '#92400E' },
  commandSeverityInfo: { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', color: '#1D4ED8' },
  commandVendorCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8, gap: 4, backgroundColor: '#FFFFFF' },
  commandVendorName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  commandVendorStatus: { color: colors.primaryStrong, fontSize: 11, fontWeight: '700' },
  commandIncidentCard: { borderWidth: 1, borderRadius: 10, padding: 8, gap: 4 },
  commandIncidentOpen: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  commandIncidentResolved: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  caption: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  row: { color: colors.text, fontSize: 13 },
  historyVisualCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 10,
    gap: 10,
  },
  historyTrack: { height: 8, borderRadius: 999, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  historyTrackFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#8B5CF6',
  },
  historyNodeRow: { gap: 8, paddingVertical: 2 },
  historyNode: {
    width: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 8,
    gap: 3,
  },
  historyNodeSelected: { borderColor: '#8B5CF6', backgroundColor: '#F5F3FF' },
  historyNodeDot: { width: 10, height: 10, borderRadius: 999 },
  historyNodeDay: { color: colors.mutedText, fontSize: 11, fontWeight: '700' },
  historyNodeTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  historyNodeDetail: { color: colors.mutedText, fontSize: 11 },
  historyList: { gap: 6 },
  historyItemRow: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: '#FFFFFF', padding: 8, gap: 2 },
  historyAt: { color: colors.mutedText, fontSize: 11, fontWeight: '700' },
  historyText: { color: colors.text, fontSize: 13 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.text },
  area: { minHeight: 88, textAlignVertical: 'top' },
  btn: { backgroundColor: colors.primary, borderRadius: 8, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.primaryTextOn, fontWeight: '700' },
  item: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, gap: 6 },
  rowBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { fontSize: 11, color: colors.primaryStrong, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  btnGhost: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, minHeight: 32, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  btnGhostWide: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  smallText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  btnDelete: { borderWidth: 1, borderColor: '#FECACA', backgroundColor: colors.dangerBg, borderRadius: 8, minHeight: 32, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  delText: { color: colors.dangerText, fontWeight: '700' },
  visualMapGrid: { gap: 8 },
  visualTableCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 6, backgroundColor: colors.card },
  visualTableName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  visualTrack: { height: 10, borderRadius: 999, backgroundColor: '#ECEFF3', overflow: 'hidden' },
  visualFill: { height: '100%', borderRadius: 999 },
});
