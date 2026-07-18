import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { getEventPersonaCopy } from '@painel-prime/app/eventPersona';

import { EventTablesVisualMap } from '../components/EventTablesVisualMap';
import { PrimeLogoLoader } from '../components/PrimeLogoLoader';
import { MeetingCenter } from '../features/meetings/MeetingCenter';
import { useAuth } from '../contexts/AuthContext';
import {
  deleteStoredFile,
  getPrivateFileDownloadUrl,
  linkStoredFile,
  uploadPrivateAsset,
} from '../lib/r2FileStorage';
import { supabase } from '../lib/supabase';
import { isEventDetailsInitialTab, EVENT_MODULES } from '../navigation/eventRouteTypes';
import type { EventDetailsInitialTab } from '../navigation/eventRouteTypes';
import { colors } from '../theme/colors';
import { OptionPickerModal } from '../components/ui/OptionPickerModal';
import { MoneyField, PrivacyToggle, PtBrDateField, SensitiveMoney, formatBrlInput, parseBrlInput } from '../components/ui/PremiumInputs';
import {
  EventEmptyState,
  EventFilterChips,
  EventFormSheet,
  EventListCard,
  EventModuleShell,
  EventSectionTitle,
} from '../features/events/EventWorkspace';
import {
  guestStatusLabel,
  priorityLabel,
  summarizeTasks,
  vendorStatusLabel,
} from '../features/events/eventWorkspaceUtils';
import { useEventFilters } from '../features/events/useEventFilters';
import { useEventDetailsData } from '../features/events/useEventDetailsData';
import type { EventDataKey as DataKey, EventDetailsTab } from '../features/events/eventDetailsData';

type VisibleKey = 'tasks' | 'guests' | 'vendors' | 'documents' | 'timeline';

type EventRow = {
  id: string;
  name: string;
  couple: string | null;
  couple_photo_file_id?: string | null;
  couple_photo_url: string | null;
  event_date: string;
  location: string | null;
  status: string | null;
  event_type: string | null;
  budget_total: number | null;
  invite_message_template: string | null;
  invite_dress_code: string | null;
  whatsapp_image_file_id?: string | null;
  whatsapp_image_url?: string | null;
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

const TABS = EVENT_MODULES;

export function EventDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pageRef = useRef<ScrollView>(null);
  const params = useLocalSearchParams<{ id?: string | string[]; initialTab?: string | string[] }>();
  const eventId = Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '';
  const initialTabParam = Array.isArray(params.initialTab) ? params.initialTab[0] : params.initialTab;
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<EventDetailsTab>('overview');
  const [isModulePickerOpen, setIsModulePickerOpen] = useState(false);
  const activeTabLabel = useMemo(() => TABS.find((x) => x.key === activeTab)?.label || 'Visão Geral', [activeTab]);
  const activeTabIcon = useMemo(() => TABS.find((x) => x.key === activeTab)?.icon || 'grid-outline', [activeTab]);
  const pickerOptions = useMemo(() => {
    return TABS.map((t) => ({
      value: t.key,
      label: t.label,
      group: t.group,
      icon: t.icon,
    }));
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => pageRef.current?.scrollTo({ y: 0, animated: false }));
  }, [activeTab]);
  const [event, setEvent] = useState<EventRow | null>(null);
  const eventPersona = useMemo(() => getEventPersonaCopy(event?.event_type), [event?.event_type]);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const {
    loadingTab,
    loadingMore,
    error,
    setError,
    data,
    setData,
    paging,
    loadKey,
    loadTab,
    loadMoreKey,
  } = useEventDetailsData(eventId, activeTab, loadingEvent);
  const [f, setF] = useState({
    a: '', b: '', c: '', d: '', budgetTotal: '', inviteTemplate: '', inviteDress: '',
  });
  const {
    guestFilter,
    setGuestFilter,
    guestSearch,
    setGuestSearch,
    guestSort,
    setGuestSort,
    vendorSearch,
    setVendorSearch,
    vendorSort,
    setVendorSort,
    budgetVendorFilter,
    setBudgetVendorFilter,
    budgetStatusFilter,
    setBudgetStatusFilter,
    documentSearch,
    setDocumentSearch,
    documentVendorFilter,
    setDocumentVendorFilter,
    documentCategoryFilter,
    setDocumentCategoryFilter,
    documentReceiptFilterId,
    setDocumentReceiptFilterId,
    filteredGuests,
    filteredVendors,
    filteredExpenses,
    filteredPayments,
    filteredDocuments,
    documentCategories,
    taskView,
    setTaskView,
    filteredTasks,
  } = useEventFilters(data, isOverdueDate);
  const [budgetVendorInput, setBudgetVendorInput] = useState('');
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
  const [uploadingInviteImage, setUploadingInviteImage] = useState(false);
  const [uploadingTeamMemberId, setUploadingTeamMemberId] = useState<string | null>(null);
  const [teamDirectory, setTeamDirectory] = useState<any[]>([]);
  const [catalogVendors, setCatalogVendors] = useState<any[]>([]);
  const [loadingCatalogVendors, setLoadingCatalogVendors] = useState(false);
  const [tablesViewMode, setTablesViewMode] = useState<'list' | 'map'>('list');
  const [loadingAiTimelineSuggestions, setLoadingAiTimelineSuggestions] = useState(false);
  const [aiTimelineError, setAiTimelineError] = useState<string | null>(null);
  const [lastAiTimelineRunAt, setLastAiTimelineRunAt] = useState<string | null>(null);
  const [aiTimelineSuggestions, setAiTimelineSuggestions] = useState<SmartTimelineSuggestion[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'all' | HistoryKind>('all');
  const [budgetPaymentMethod, setBudgetPaymentMethod] = useState<PaymentMethod>('pix');
  const [budgetPaymentReceiptDocId, setBudgetPaymentReceiptDocId] = useState('');
  const [budgetPaymentNote, setBudgetPaymentNote] = useState('');
  const [paymentExpenseId, setPaymentExpenseId] = useState<string | null>(null);
  const [newVendorPhone, setNewVendorPhone] = useState('');
  const [newVendorEmail, setNewVendorEmail] = useState('');
  const [newVendorArrival, setNewVendorArrival] = useState('');
  const [newVendorDone, setNewVendorDone] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [taskNotesDraft, setTaskNotesDraft] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [composer, setComposer] = useState<EventDetailsTab | null>(null);
  const [budgetCardDraft, setBudgetCardDraft] = useState('0');
  const [isBudgetCardEditing, setIsBudgetCardEditing] = useState(false);
  const [savingBudgetCard, setSavingBudgetCard] = useState(false);
  const [hideFinancialValues, setHideFinancialValues] = useState(false);
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
        .select('id,name,couple,couple_photo_url,couple_photo_file_id,event_date,location,status,event_type,budget_total,invite_message_template,invite_dress_code,whatsapp_image_file_id,whatsapp_image_url,created_at')
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

  const assigneeOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; group: string }> = [];
    const coupleNames = String(event?.couple ?? '').split(/\s*(?:&|\+|\/|,|\be\b)\s*/i).map((name) => name.trim()).filter(Boolean);
    coupleNames.forEach((name) => options.push({ value: name, label: `Cliente · ${name}`, group: 'Cliente' }));
    options.push({ value: 'Você (assessoria)', label: 'Você · Assessoria', group: 'Assessoria' });
    data.vendors.forEach((vendor) => options.push({ value: String(vendor.name), label: `Fornecedor · ${vendor.name}`, group: 'Fornecedor' }));
    data.team.forEach((member) => options.push({ value: String(member.name), label: `Equipe · ${member.name}`, group: 'Equipe' }));
    return options.filter((option, index) => options.findIndex((candidate) => candidate.value.toLocaleLowerCase('pt-BR') === option.value.toLocaleLowerCase('pt-BR')) === index);
  }, [data.team, data.vendors, event?.couple]);

  useEffect(() => {
    if (activeTab !== 'vendors' || loadingCatalogVendors) return;
    setLoadingCatalogVendors(true);
    void (async () => {
      try {
        const { data: rows, error: catalogError } = await supabase.rpc('get_vendors');
        if (catalogError) setError(catalogError.message);
        else setCatalogVendors((rows as any[]) ?? []);
      } finally { setLoadingCatalogVendors(false); }
    })();
  }, [activeTab, eventId]);

  const teamPhotoSignature = data.team.map((member) => `${member.id}:${member.photo_file_id ?? ''}`).join('|');
  useEffect(() => {
    const pending = data.team.filter((member) => member.photo_file_id);
    if (pending.length === 0) return;
    let cancelled = false;
    void Promise.all(pending.map(async (member) => {
      try { return [member.id, await getPrivateFileDownloadUrl(String(member.photo_file_id))] as const; }
      catch { return [member.id, ''] as const; }
    })).then((entries) => {
      if (cancelled) return;
      const urls = new Map(entries);
      setData((current) => ({ ...current, team: current.team.map((member) => urls.get(member.id) ? { ...member, photo_url: urls.get(member.id) } : member) }));
    });
    return () => { cancelled = true; };
  }, [activeTab, teamPhotoSignature]);

  useEffect(() => {
    if (activeTab !== 'team') return;
    void (async () => {
      const db = supabase as any;
      const [teamsRes, membersRes] = await Promise.all([
        db.from('advisor_teams').select('id,name,leader_member_id').order('created_at'),
        db.from('advisor_team_members').select('id,team_id,name,role,phone,email,photo_file_id,photo_url').order('created_at'),
      ]);
      if (teamsRes.error || membersRes.error) return;
      setTeamDirectory((teamsRes.data ?? []).map((team: any) => ({ ...team, members: (membersRes.data ?? []).filter((member: any) => member.team_id === team.id) })));
    })();
  }, [activeTab]);

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
    setBudgetCardDraft(formatBrlInput(Math.round(Number(event?.budget_total ?? 0) * 100)));
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
  const visibleTasks = useMemo(() => filteredTasks.slice(0, visible.tasks), [filteredTasks, visible.tasks]);
  const taskSummary = useMemo(() => summarizeTasks(data.tasks), [data.tasks]);
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

  async function pickAndUploadInviteImage() {
    if (uploadingInviteImage || !event) return;
    setUploadingInviteImage(true);
    let nextFileId: string | null = null;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Permissão de galeria negada.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82 });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      const extension = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
      const upload = await uploadPrivateAsset({ uri: asset.uri, fileName: `convite-${eventId}-${Date.now()}.${extension}`, contentType: asset.mimeType ?? 'image/jpeg', byteSize: asset.fileSize ?? null, entityType: 'event_invite_whatsapp_image', entityId: eventId });
      nextFileId = upload.fileId;
      const signedUrl = await getPrivateFileDownloadUrl(upload.fileId);
      const { error: updateError } = await supabase.from('events').update({ whatsapp_image_file_id: upload.fileId, whatsapp_image_url: null }).eq('id', eventId);
      if (updateError) throw new Error(updateError.message);
      if (event.whatsapp_image_file_id) void deleteStoredFile(event.whatsapp_image_file_id).catch(() => undefined);
      setEvent((current) => current ? { ...current, whatsapp_image_file_id: upload.fileId, whatsapp_image_url: signedUrl } : current);
    } catch (uploadError: any) {
      if (nextFileId) void deleteStoredFile(nextFileId).catch(() => undefined);
      setError(uploadError?.message ?? 'Não foi possível enviar a imagem do convite.');
    } finally { setUploadingInviteImage(false); }
  }

  async function pickAndUploadTeamPhoto(member: any) {
    if (uploadingTeamMemberId) return;
    setUploadingTeamMemberId(String(member.id));
    let nextFileId: string | null = null;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Permissão de galeria negada.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      const extension = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
      const upload = await uploadPrivateAsset({ uri: asset.uri, fileName: `equipe-${member.id}-${Date.now()}.${extension}`, contentType: asset.mimeType ?? 'image/jpeg', byteSize: asset.fileSize ?? null, entityType: 'event_team_member_photo', entityId: eventId });
      nextFileId = upload.fileId;
      const signedUrl = await getPrivateFileDownloadUrl(upload.fileId);
      const { error: updateError } = await supabase.from('event_team_members').update({ photo_file_id: upload.fileId, photo_url: null }).eq('id', member.id).eq('event_id', eventId);
      if (updateError) throw new Error(updateError.message);
      if (member.photo_file_id) void deleteStoredFile(String(member.photo_file_id)).catch(() => undefined);
      setData((current) => ({ ...current, team: current.team.map((item) => item.id === member.id ? { ...item, photo_file_id: upload.fileId, photo_url: signedUrl } : item) }));
    } catch (uploadError: any) {
      if (nextFileId) void deleteStoredFile(nextFileId).catch(() => undefined);
      setError(uploadError?.message ?? 'Não foi possível enviar a foto da equipe.');
    } finally { setUploadingTeamMemberId(null); }
  }

  async function linkCatalogVendor(vendorId: string) {
    const { error: linkError } = await supabase.rpc('link_catalog_vendor_to_event', { p_event_id: eventId, p_vendor_id: vendorId });
    if (linkError) throw new Error(linkError.message);
    await loadTab('vendors', true);
  }

  async function dispatchWhatsApp(mode: 'bulk' | 'single', guestId?: string) {
    const baseInviteUrl = process.env.EXPO_PUBLIC_BASE_INVITE_URL || 'https://app.painelprime.com.br/convite';
    const { data: response, error: invokeError } = await supabase.functions.invoke('whatsapp-rsvp-dispatch', { body: { action: mode, baseInviteUrl, eventId, guestId } });
    if (invokeError) throw new Error(invokeError.message);
    const summary = (response as any)?.summary;
    const sent = Number(summary?.sent ?? summary?.accepted ?? 0);
    const failed = Number(summary?.failed ?? 0);
    Alert.alert('Disparo concluído', `${sent} convite(s) enviado(s)${failed ? ` e ${failed} falha(s)` : ''}.`);
    await loadTab('invites', true);
  }

  async function sendReceptionAccess(memberId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('Sua sessão expirou. Entre novamente.');
    const { error: invokeError } = await supabase.functions.invoke('send-reception-access-link', { body: { accessToken, eventId, memberId } });
    if (invokeError) throw new Error(invokeError.message);
    Alert.alert('Acesso enviado', 'O link seguro da recepção foi enviado pelo WhatsApp.');
  }

  async function resendGuestQr(guestId: string) {
    const { error: invokeError } = await supabase.functions.invoke('whatsapp-rsvp-review-action', { body: { action: 'resend_qr', eventId, guestId } });
    if (invokeError) throw new Error(invokeError.message);
    Alert.alert('QR Code enviado', 'O QR Code de entrada foi reenviado pelo WhatsApp.');
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

  function openModule(tab: EventDetailsInitialTab) {
    setActiveTab(tab);
  }

  async function reloadTablesModule() {
    await Promise.all([loadKey('tables', 'reset'), loadKey('guests', 'reset')]);
  }

  async function assignDirectoryMembers(team: any, members: any[]) {
    if (!members.length) return;
    const existingIds = new Set(data.team.map((item) => String(item.advisor_team_member_id ?? '')));
    const rows = members.filter((member) => !existingIds.has(String(member.id))).map((member) => ({
      event_id: eventId,
      advisor_team_id: team.id,
      advisor_team_member_id: member.id,
      team_name: team.name,
      is_leader: team.leader_member_id === member.id,
      name: member.name,
      role: member.role || 'Assessoria',
      phone: member.phone || null,
      photo_file_id: member.photo_file_id || null,
      photo_url: null,
    }));
    if (!rows.length) return;
    const { error: insertError } = await (supabase as any).from('event_team_members').insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  async function saveBudgetFromCard() {
    const next = parseBrlInput(budgetCardDraft);
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

  if (loadingEvent) return <PrimeLogoLoader label="Abrindo o evento" />;

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
    <Modal visible={loadingTab} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.loadingOverlay}><PrimeLogoLoader variant="screen" label="Carregando esta área" /></View>
    </Modal>
    <ScrollView ref={pageRef} style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}>
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
                placeholder={eventPersona.principalNamePlaceholder}
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
      <Pressable
        style={styles.compactPickerRow}
        onPress={() => setIsModulePickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Navegar pelas áreas do evento. Área atual: ${activeTabLabel}`}
      >
        <View style={styles.compactPickerIcon}>
          <Ionicons name={activeTabIcon} size={22} color={colors.primaryStrong} accessible={false} />
        </View>
        <View style={styles.compactPickerTextGroup}>
          <Text style={styles.compactPickerLabel}>Área do evento</Text>
          <Text style={styles.compactPickerValue} numberOfLines={1}>{activeTabLabel}</Text>
        </View>
        <View style={styles.compactPickerAction}>
          <Text style={styles.compactPickerActionText}>Ver áreas</Text>
          <Ionicons name="chevron-down" size={18} color={colors.primaryStrong} accessible={false} />
        </View>
      </Pressable>

      <OptionPickerModal
        visible={isModulePickerOpen}
        title="Navegar pelo evento"
        options={pickerOptions}
        selectedValue={activeTab}
        variant="list"
        onSelect={(val) => setActiveTab(val as EventDetailsInitialTab)}
        onClose={() => setIsModulePickerOpen(false)}
      />
      {!!error && <Text style={styles.err}>{error}</Text>}
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

          <View style={styles.overviewFinanceHero}>
            <View style={styles.overviewFinanceHeader}>
              <View style={styles.formGrow}>
                <Text style={styles.overviewEyebrow}>Planejamento financeiro</Text>
                <Text style={styles.overviewFinanceTitle}>{eventPersona.budgetTitle}</Text>
                <Text style={styles.overviewFinanceCopy}>{eventPersona.budgetDescription}</Text>
              </View>
              <PrivacyToggle hidden={hideFinancialValues} onPress={() => setHideFinancialValues((value) => !value)} />
            </View>

            {isBudgetCardEditing ? (
              <View style={styles.metricEditWrap}>
                <Text style={styles.overviewFinanceCopy}>{eventPersona.budgetEditDescription}</Text>
                <MoneyField value={budgetCardDraft} onChangeValue={setBudgetCardDraft} />
                <View style={styles.overviewFinanceActions}>
                  <Pressable
                    style={styles.overviewSecondaryAction}
                    onPress={() => {
                      setBudgetCardDraft(formatBrlInput(Math.round(budgetTotal * 100)));
                      setIsBudgetCardEditing(false);
                    }}
                  >
                    <Text style={styles.overviewSecondaryActionText}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={styles.overviewPrimaryAction} onPress={() => void saveBudgetFromCard()}>
                    <Text style={styles.overviewPrimaryActionText}>{savingBudgetCard ? 'Salvando...' : 'Salvar valor'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <SensitiveMoney value={budgetTotal} hidden={hideFinancialValues} />
                <View style={styles.overviewMoneySplit}>
                  <View style={styles.overviewMoneyItem}>
                    <View style={[styles.overviewMoneyDot, styles.overviewMoneyDotSpent]} />
                    <View style={styles.formGrow}>
                      <Text style={styles.overviewMoneyLabel}>Já investido</Text>
                      <Text style={styles.overviewMoneyValue}>{hideFinancialValues ? 'R$ ••••••' : brl(totalExpenses)}</Text>
                    </View>
                  </View>
                  <View style={styles.overviewMoneyDivider} />
                  <View style={styles.overviewMoneyItem}>
                    <View style={[styles.overviewMoneyDot, styles.overviewMoneyDotAvailable]} />
                    <View style={styles.formGrow}>
                      <Text style={styles.overviewMoneyLabel}>Ainda disponível</Text>
                      <Text style={styles.overviewMoneyValue}>{hideFinancialValues ? 'R$ ••••••' : brl(budgetTotal - totalExpenses)}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.overviewProgressTrack}>
                  <View style={[styles.overviewProgressFill, { width: `${Math.max(0, budgetProgress)}%` }]} />
                </View>
                <View style={styles.overviewFinanceActions}>
                  <Pressable style={styles.overviewSecondaryAction} onPress={() => setIsBudgetCardEditing(true)}>
                    <Ionicons name="pencil-outline" size={16} color={colors.text} accessible={false} />
                    <Text style={styles.overviewSecondaryActionText}>Editar limite</Text>
                  </Pressable>
                  <Pressable style={styles.overviewPrimaryAction} onPress={() => openModule('budget')}>
                    <Text style={styles.overviewPrimaryActionText}>Ver orçamento</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" accessible={false} />
                  </Pressable>
                </View>
              </>
            )}
          </View>

          <View style={styles.overviewSectionHeading}>
            <View>
              <Text style={styles.overviewSectionTitle}>O que merece atenção</Text>
              <Text style={styles.caption}>Atalhos para conduzir o evento sem se perder.</Text>
            </View>
          </View>
          <View style={styles.overviewActionStack}>
            <Pressable style={styles.overviewActionCard} onPress={() => openModule('history')}>
              <View style={[styles.overviewActionIcon, styles.overviewActionIconRose]}><Ionicons name="calendar-outline" size={20} color="#BE185D" accessible={false} /></View>
              <View style={styles.formGrow}><Text style={styles.overviewActionTitle}>Data do evento</Text><Text style={styles.overviewActionCopy}>Acompanhe o histórico e os marcos importantes.</Text></View>
              <View style={styles.overviewActionValueWrap}><Text style={styles.overviewActionValue}>{!event?.event_date ? '-' : daysRemaining <= 0 ? 'Hoje' : daysRemaining}</Text><Text style={styles.overviewActionUnit}>{daysRemaining > 0 ? 'dias' : ''}</Text></View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedText} accessible={false} />
            </Pressable>
            <Pressable style={styles.overviewActionCard} onPress={() => openModule('tasks')}>
              <View style={[styles.overviewActionIcon, styles.overviewActionIconBlue]}><Ionicons name="checkmark-done-outline" size={20} color="#1D4ED8" accessible={false} /></View>
              <View style={styles.formGrow}><Text style={styles.overviewActionTitle}>Tarefas do evento</Text><Text style={styles.overviewActionCopy}>{data.tasks.length - completedTasks} pendente{data.tasks.length - completedTasks === 1 ? '' : 's'} para organizar.</Text></View>
              <Text style={styles.overviewActionCounter}>{completedTasks}/{data.tasks.length}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedText} accessible={false} />
            </Pressable>
            <Pressable style={styles.overviewActionCard} onPress={() => openModule('guests')}>
              <View style={[styles.overviewActionIcon, styles.overviewActionIconGreen]}><Ionicons name="people-outline" size={20} color="#047857" accessible={false} /></View>
              <View style={styles.formGrow}><Text style={styles.overviewActionTitle}>Lista de convidados</Text><Text style={styles.overviewActionCopy}>{guestSummary.pending} aguardando confirmação.</Text></View>
              <Text style={styles.overviewActionCounter}>{guestSummary.confirmed}/{guestSummary.total}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedText} accessible={false} />
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
        <EventModuleShell
          title="Tarefas"
          description="O que precisa acontecer para este evento avançar."
          icon="checkbox-outline"
          metrics={[
            { label: 'Urgentes', value: data.tasks.filter((task) => !task.completed && task.priority === 'urgent').length, tone: 'danger' },
            { label: 'Pendentes', value: taskSummary.pending, tone: taskSummary.pending ? 'gold' : 'neutral' },
            { label: 'Atrasadas', value: taskSummary.overdue, tone: taskSummary.overdue ? 'danger' : 'neutral' },
            { label: 'Concluídas', value: taskSummary.completed, tone: 'success' },
          ]}
          actionLabel="Nova tarefa"
          onAction={() => setComposer('tasks')}
        >
          <EventFilterChips selected={taskView} onSelect={(value) => setTaskView(value as typeof taskView)} options={[{ value: 'urgent', label: 'Urgentes' }, { value: 'pending', label: 'Pendentes' }, { value: 'overdue', label: 'Atrasadas' }, { value: 'completed', label: 'Concluídas' }]} />
          <EventSectionTitle title={taskView === 'urgent' ? 'Tarefas urgentes' : taskView === 'overdue' ? 'Tarefas atrasadas' : taskView === 'completed' ? 'Tarefas concluídas' : 'Tarefas pendentes'} />
          {visibleTasks.length === 0 ? (
            <EventEmptyState
              icon="checkmark-done-outline"
              title="Tudo organizado por aqui"
              description="Crie a primeira tarefa para acompanhar prazos e responsáveis."
              actionLabel="Criar tarefa"
              onAction={() => setComposer('tasks')}
            />
          ) : null}
          {visibleTasks.map((t) => (
            <EventListCard
              key={t.id}
              title={String(t.text ?? 'Tarefa')}
              subtitle={t.notes ? String(t.notes) : 'Toque para ver detalhes e anotações'}
              onPress={() => { setSelectedTask(t); setTaskNotesDraft(String(t.notes ?? '')); }}
              status={t.completed ? 'Concluída' : priorityLabel(t.priority)}
              statusTone={t.completed ? 'success' : t.priority === 'urgent' ? 'danger' : t.priority === 'high' ? 'warning' : 'gold'}
              meta={[
                t.due_date ? `Prazo: ${new Date(t.due_date).toLocaleDateString('pt-BR')}` : 'Sem prazo',
                t.assignee_name ? `Responsável: ${t.assignee_name}` : 'Sem responsável',
              ]}
              actions={[
                {
                  label: t.completed ? 'Reabrir' : 'Concluir',
                  icon: t.completed ? 'refresh-outline' : 'checkmark-outline',
                  onPress: () => void act(async () => {
                    const { error: e } = await supabase.from('event_tasks').update({ completed: !t.completed }).eq('id', t.id);
                    if (e) throw new Error(e.message);
                  }),
                },
                {
                  label: 'Prioridade',
                  icon: 'flag-outline',
                  onPress: () => void act(async () => {
                    const nextPriority = t.priority === 'urgent' ? 'low' : t.priority === 'high' ? 'urgent' : t.priority === 'normal' ? 'high' : 'normal';
                    const { error: e } = await supabase.from('event_tasks').update({ priority: nextPriority }).eq('id', t.id);
                    if (e) throw new Error(e.message);
                  }),
                },
                {
                  label: 'Excluir',
                  tone: 'danger',
                  icon: 'trash-outline',
                  onPress: () => void act(async () => {
                    const { error: e } = await supabase.from('event_tasks').delete().eq('id', t.id);
                    if (e) throw new Error(e.message);
                  }),
                },
              ]}
            />
          ))}
          {filteredTasks.length > visible.tasks && (
            <Pressable style={styles.btnGhostWide} onPress={() => showMore('tasks')}>
              <Text style={styles.smallText}>Mostrar mais ({filteredTasks.length - visible.tasks} restantes)</Text>
            </Pressable>
          )}
          {paging.tasks.hasMore && (
            <Pressable style={styles.btnGhostWide} onPress={() => void loadMoreKey('tasks')}>
              <Text style={styles.smallText}>{loadingMore === 'tasks' ? 'Carregando...' : 'Carregar mais do servidor'}</Text>
            </Pressable>
          )}
          <EventFormSheet visible={composer === 'tasks'} title="Nova tarefa" subtitle="Defina apenas o necessário agora." onClose={() => setComposer(null)}>
            <Text style={styles.formLabel}>O que precisa ser feito?</Text>
            <TextInput style={styles.input} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Ex.: Confirmar horário com o buffet" />
            <Text style={styles.formLabel}>Prazo</Text>
            <PtBrDateField value={newTaskDueDate} onChange={setNewTaskDueDate} />
            <Text style={styles.formLabel}>Anotações (opcional)</Text>
            <TextInput style={[styles.input, styles.area]} value={newTaskNotes} onChangeText={setNewTaskNotes} placeholder="Contexto, combinações ou detalhes importantes" multiline />
            <Text style={styles.formLabel}>Responsável (opcional)</Text>
            <EventFilterChips selected={newTaskAssignee} onSelect={setNewTaskAssignee} options={assigneeOptions.map((option) => ({ value: option.value, label: option.label }))} />
            <TextInput style={styles.input} value={newTaskAssignee} onChangeText={setNewTaskAssignee} placeholder="Nome da pessoa" />
            <Text style={styles.formLabel}>Prioridade</Text>
            <EventFilterChips selected={newTaskPriority} onSelect={(value) => setNewTaskPriority(value as typeof newTaskPriority)} options={[
              { value: 'low', label: 'Baixa' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'Alta' }, { value: 'urgent', label: 'Urgente' },
            ]} />
            <Pressable style={styles.btn} onPress={() => void act(async () => {
              if (!f.a.trim()) return;
              const { error: e } = await supabase.from('event_tasks').insert({ event_id: eventId, text: f.a.trim(), notes: newTaskNotes.trim() || null, completed: false, due_date: newTaskDueDate.trim() || null, priority: newTaskPriority, assignee_name: newTaskAssignee.trim() || null, position: data.tasks.length } as never);
              if (e) throw new Error(e.message);
              setF((s) => ({ ...s, a: '' }));
              setNewTaskDueDate('');
              setNewTaskNotes('');
              setNewTaskAssignee('');
              setNewTaskPriority('normal');
              setComposer(null);
            })}><Text style={styles.btnText}>Adicionar tarefa</Text></Pressable>
          </EventFormSheet>
          <EventFormSheet visible={Boolean(selectedTask)} title={String(selectedTask?.text ?? 'Detalhes da tarefa')} subtitle="Revise as informações sem perder o contexto." onClose={() => setSelectedTask(null)}>
            <Text style={styles.formLabel}>Anotações</Text>
            <TextInput style={[styles.input, styles.area]} value={taskNotesDraft} onChangeText={setTaskNotesDraft} placeholder="Adicione informações úteis para quem vai executar" multiline />
            <Text style={styles.formLabel}>Prazo</Text>
            <PtBrDateField value={String(selectedTask?.due_date ?? '').slice(0, 10)} onChange={(value) => setSelectedTask((current: any) => ({ ...current, due_date: value }))} />
            <Pressable style={styles.btn} onPress={() => void act(async () => {
              if (!selectedTask?.id) return;
              const { error: e } = await supabase.from('event_tasks').update({ notes: taskNotesDraft.trim() || null, due_date: selectedTask.due_date || null } as never).eq('id', selectedTask.id);
              if (e) throw new Error(e.message);
              setSelectedTask(null);
            })}><Text style={styles.btnText}>Salvar alterações</Text></Pressable>
          </EventFormSheet>
        </EventModuleShell>
      )}

      {activeTab === 'budget' && (
        <EventModuleShell
          title="Orçamento do evento"
          description="Despesas e pagamentos ligados a este evento."
          icon="wallet-outline"
          metrics={[
            { label: 'Orçamento disponível', value: hideFinancialValues ? 'R$ ••••••' : brl(budgetTotal), tone: 'gold' },
            { label: 'Investido', value: hideFinancialValues ? 'R$ ••••••' : brl(totalExpenses), tone: 'neutral' },
            { label: 'Ainda disponível', value: hideFinancialValues ? 'R$ ••••••' : brl(budgetTotal - totalExpenses), tone: budgetTotal - totalExpenses < 0 ? 'danger' : 'success' },
          ]}
          actionLabel="Nova despesa"
          onAction={() => setComposer('budget')}
        >
          <View style={styles.financePrivacyRow}><View style={styles.formGrow}><Text style={styles.subtitle}>Dinheiro do evento</Text><Text style={styles.caption}>{eventPersona.budgetContextDescription}</Text></View><PrivacyToggle hidden={hideFinancialValues} onPress={() => setHideFinancialValues((value) => !value)} /></View>
          {budgetVendorFilter ? (
            <Pressable style={styles.activeFilter} onPress={() => setBudgetVendorFilter('')} accessibilityRole="button">
              <Text style={styles.activeFilterText}>Fornecedor: {data.vendors.find((vendor) => String(vendor.id) === budgetVendorFilter)?.name ?? 'selecionado'}</Text>
              <Ionicons name="close" size={16} color={colors.gold700} accessible={false} />
            </Pressable>
          ) : null}
          <EventFilterChips selected={budgetStatusFilter} onSelect={(value) => setBudgetStatusFilter(value as typeof budgetStatusFilter)} options={[
            { value: 'all', label: 'Todas' }, { value: 'pending', label: 'Pendentes' }, { value: 'confirmed', label: 'Confirmadas' }, { value: 'paid', label: 'Pagas' }, { value: 'cancelled', label: 'Canceladas' },
          ]} />
          <EventSectionTitle title="Despesas" />
          {filteredExpenses.length === 0 ? <EventEmptyState icon="wallet-outline" title="Nenhuma despesa neste filtro" description="Adicione um custo do evento para começar o acompanhamento." actionLabel="Adicionar despesa" onAction={() => setComposer('budget')} /> : null}
          {filteredExpenses.map((x) => (
            <EventListCard key={x.id} title={String(x.name ?? 'Despesa')} subtitle={data.vendors.find((vendor) => String(vendor.id) === String(x.vendor_id))?.name || 'Sem fornecedor vinculado'} status={brl(Number(x.value ?? 0))} statusTone={x.status === 'paid' ? 'success' : x.status === 'cancelled' ? 'danger' : 'gold'} meta={[vendorStatusLabel(x.status)]} actions={[
              { label: 'Registrar pagamento', icon: 'card-outline', onPress: () => setPaymentExpenseId(String(x.id)) },
              { label: x.status === 'confirmed' ? 'Marcar paga' : 'Confirmar', icon: 'checkmark-outline', onPress: () => void act(async () => { const { error: e } = await supabase.from('event_expenses').update({ status: x.status === 'confirmed' ? 'paid' : 'confirmed' }).eq('id', x.id); if (e) throw new Error(e.message); }) },
              { label: 'Excluir', icon: 'trash-outline', tone: 'danger', onPress: () => void act(async () => { await supabase.from('expense_payments').delete().eq('expense_id', x.id); const { error: e } = await supabase.from('event_expenses').delete().eq('id', x.id); if (e) throw new Error(e.message); }) },
            ]} />
          ))}
          <EventSectionTitle title="Pagamentos registrados" />
          {filteredPayments.map((p) => (
            <EventListCard key={p.id} title={brl(Number(p.amount ?? 0))} subtitle={`${fmt(p.paid_at)} • ${String(p.method ?? 'outro').toUpperCase()}`} status="Pago" statusTone="success" actions={[
              { label: 'Ver recibo', icon: 'receipt-outline', onPress: () => { const meta = parsePaymentNote(p.note).meta; if (!meta.receipt_document_id) return; setDocumentReceiptFilterId(meta.receipt_document_id); setActiveTab('documents'); } },
              { label: 'Excluir', icon: 'trash-outline', tone: 'danger', onPress: () => void act(async () => { const { error: e } = await supabase.from('expense_payments').delete().eq('id', p.id); if (e) throw new Error(e.message); }) },
            ]} />
          ))}
          <EventFormSheet visible={composer === 'budget'} title="Nova despesa" subtitle="Vincule ao fornecedor quando fizer sentido." onClose={() => setComposer(null)}>
            <Text style={styles.formLabel}>Descrição</Text><TextInput style={styles.input} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Ex.: Buffet" />
            <Text style={styles.formLabel}>Valor</Text><MoneyField value={f.b} onChangeValue={(v) => setF((s) => ({ ...s, b: v }))} />
            {data.vendors.length ? <><Text style={styles.formLabel}>Fornecedor (opcional)</Text><EventFilterChips selected={budgetVendorInput} onSelect={setBudgetVendorInput} options={[{ value: '', label: 'Sem vínculo' }, ...data.vendors.map((vendor) => ({ value: String(vendor.id), label: String(vendor.name) }))]} /></> : null}
            <Pressable style={styles.btn} onPress={() => void act(async () => { const val = parseBrlInput(f.b); if (!f.a.trim() || !Number.isFinite(val) || val <= 0) return; const { error: e } = await supabase.from('event_expenses').insert({ event_id: eventId, name: f.a.trim(), value: val, color: '#D4AF37', status: 'pending', vendor_id: budgetVendorInput || null }); if (e) throw new Error(e.message); setF((s) => ({ ...s, a: '', b: '' })); setBudgetVendorInput(''); setComposer(null); })}><Text style={styles.btnText}>Adicionar despesa</Text></Pressable>
          </EventFormSheet>
          <EventFormSheet visible={Boolean(paymentExpenseId)} title="Registrar pagamento" subtitle={filteredExpenses.find((expense) => String(expense.id) === paymentExpenseId)?.name} onClose={() => setPaymentExpenseId(null)}>
            <Text style={styles.formLabel}>Forma de pagamento</Text><EventFilterChips selected={budgetPaymentMethod} onSelect={(value) => setBudgetPaymentMethod(value as PaymentMethod)} options={[{ value: 'pix', label: 'Pix' }, { value: 'dinheiro', label: 'Dinheiro' }, { value: 'credito', label: 'Crédito' }, { value: 'debito', label: 'Débito' }, { value: 'transferencia', label: 'Transferência' }]} />
            <Text style={styles.formLabel}>Observação (opcional)</Text><TextInput style={styles.input} value={budgetPaymentNote} onChangeText={setBudgetPaymentNote} placeholder="Detalhes do pagamento" />
            <Pressable style={styles.btn} onPress={() => void act(async () => { const expense = filteredExpenses.find((item) => String(item.id) === paymentExpenseId); if (!expense) return; const note = composePaymentNote(budgetPaymentNote, { receipt_document_id: budgetPaymentReceiptDocId.trim() || null }); const { error: e } = await supabase.from('expense_payments').insert({ event_id: eventId, expense_id: expense.id, amount: Number(expense.value ?? 0), method: normalizePaymentMethod(budgetPaymentMethod), paid_at: new Date().toISOString(), note }); if (e) throw new Error(e.message); setBudgetPaymentReceiptDocId(''); setBudgetPaymentNote(''); setPaymentExpenseId(null); })}><Text style={styles.btnText}>Confirmar pagamento</Text></Pressable>
          </EventFormSheet>
        </EventModuleShell>
      )}

      {activeTab === 'guests' && (
        <EventModuleShell
          title="Convidados"
          description="Confirmações claras, sem planilha no caminho."
          icon="people-outline"
          metrics={[
            { label: 'Total', value: guestSummary.total, tone: 'neutral' },
            { label: 'Confirmados', value: guestSummary.confirmed, tone: 'success' },
            { label: 'Aguardando', value: guestSummary.pending, tone: 'warning' },
          ]}
          actionLabel="Adicionar convidado"
          onAction={() => setComposer('guests')}
        >
          <TextInput style={styles.input} value={guestSearch} onChangeText={setGuestSearch} placeholder="Buscar por nome ou telefone" />
          <EventFilterChips selected={guestFilter} onSelect={(value) => setGuestFilter(value as typeof guestFilter)} options={[
            { value: 'all', label: 'Todos' }, { value: 'pending', label: 'Aguardando' }, { value: 'confirmed', label: 'Confirmados' }, { value: 'declined', label: 'Não vão' },
          ]} />
          <EventSectionTitle title="Lista de convidados" actionLabel={guestSort === 'name_asc' ? 'A–Z' : 'Z–A'} onAction={() => setGuestSort((value) => value === 'name_asc' ? 'name_desc' : 'name_asc')} />
          {visibleGuests.length === 0 ? (
            <EventEmptyState icon="people-outline" title="Nenhum convidado aqui" description="Adicione pessoas ou altere o filtro para acompanhar as confirmações." actionLabel="Adicionar convidado" onAction={() => setComposer('guests')} />
          ) : null}
          {visibleGuests.map((g) => (
            <EventListCard
              key={g.id}
              title={String(g.name ?? 'Convidado')}
              subtitle={g.phone || 'Telefone não informado'}
              status={guestStatusLabel(g.rsvp_status)}
              statusTone={g.rsvp_status === 'confirmed' ? 'success' : g.rsvp_status === 'declined' ? 'danger' : 'warning'}
              actions={[
                { label: 'Confirmar', icon: 'checkmark-outline', onPress: () => void act(async () => { const { error: e } = await supabase.from('event_guests').update({ rsvp_status: 'confirmed', confirmed: true }).eq('id', g.id); if (e) throw new Error(e.message); }) },
                { label: 'Não vai', icon: 'close-outline', onPress: () => void act(async () => { const { error: e } = await supabase.from('event_guests').update({ rsvp_status: 'declined', confirmed: false }).eq('id', g.id); if (e) throw new Error(e.message); }) },
                { label: 'Excluir', icon: 'trash-outline', tone: 'danger', onPress: () => void act(async () => { const { error: e } = await supabase.from('event_guests').delete().eq('id', g.id); if (e) throw new Error(e.message); }) },
              ]}
            />
          ))}
          <EventFormSheet visible={composer === 'guests'} title="Adicionar convidado" subtitle="Você pode completar os detalhes depois." onClose={() => setComposer(null)}>
            <Text style={styles.formLabel}>Nome</Text>
            <TextInput style={styles.input} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Nome do convidado" />
            <Text style={styles.formLabel}>Telefone (opcional)</Text>
            <TextInput style={styles.input} value={f.b} onChangeText={(v) => setF((s) => ({ ...s, b: v }))} placeholder="(11) 99999-9999" keyboardType="phone-pad" />
            <Pressable style={styles.btn} onPress={() => void act(async () => {
              if (!f.a.trim()) return;
              const { error: e } = await supabase.from('event_guests').insert({ event_id: eventId, name: f.a.trim(), phone: f.b.trim() || null, rsvp_status: 'pending', confirmed: false });
              if (e) throw new Error(e.message);
              setF((s) => ({ ...s, a: '', b: '' }));
              setComposer(null);
            })}><Text style={styles.btnText}>Adicionar convidado</Text></Pressable>
          </EventFormSheet>
        </EventModuleShell>
      )}
      {activeTab === 'timeline' && (
        <EventModuleShell title="Cronograma do dia" description="O roteiro real do evento, do primeiro fornecedor à despedida." icon="calendar-outline" metrics={[
          { label: 'Atividades', value: data.timeline.length, tone: 'gold' },
          { label: 'Sugestões', value: timelineSuggestions.length, tone: 'info' },
        ]} actionLabel="Adicionar ação do dia" onAction={() => setComposer('timeline')}>
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
                <EventListCard key={item.id} title={item.title} subtitle={item.reason} meta={[`${item.time} • ${item.activity}`]} status="Sugestão" statusTone="info" actions={[{ label: 'Aplicar', icon: 'sparkles-outline', onPress: () => void applySmartTimelineSuggestion(item) }]} />
              ))
            )}
          </View>
          <EventSectionTitle title="Roteiro do dia" />
          {visibleTimeline.length === 0 ? <EventEmptyState icon="calendar-outline" title="Cronograma ainda vazio" description="Adicione a primeira atividade ou gere sugestões inteligentes." actionLabel="Adicionar atividade" onAction={() => setComposer('timeline')} /> : null}
          {visibleTimeline.map((t) => (
            <EventListCard key={t.id} title={String(t.activity ?? 'Atividade')} subtitle={t.assignee_name ? `Responsável: ${t.assignee_name}` : 'Sem responsável'} status={t.time || '--:--'} statusTone="gold" actions={[
              { label: 'Excluir', icon: 'trash-outline', tone: 'danger', onPress: () => void act(async () => { const { error: e } = await supabase.from('event_timeline').delete().eq('id', t.id); if (e) throw new Error(e.message); }) },
            ]} />
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
          <EventFormSheet visible={composer === 'timeline'} title="Adicionar ao cronograma do dia" subtitle="Registre apenas o que acontece no dia deste evento." onClose={() => setComposer(null)}>
            <Text style={styles.formLabel}>Horário</Text><TextInput style={styles.input} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="HH:MM" />
            <Text style={styles.formLabel}>Atividade</Text><TextInput style={styles.input} value={f.b} onChangeText={(v) => setF((s) => ({ ...s, b: v }))} placeholder={eventPersona.timelineActivityPlaceholder} />
            <Text style={styles.formLabel}>Responsável (opcional)</Text>
            <EventFilterChips selected={f.c} onSelect={(value) => setF((state) => ({ ...state, c: value }))} options={assigneeOptions.map((option) => ({ value: option.value, label: option.label }))} />
            <TextInput style={styles.input} value={f.c} onChangeText={(v) => setF((s) => ({ ...s, c: v }))} placeholder="Ou escreva outro nome" />
            <Pressable style={styles.btn} onPress={() => void act(async () => { if (!f.b.trim()) return; const { error: e } = await supabase.from('event_timeline').insert({ event_id: eventId, time: f.a.trim() || '00:00', activity: f.b.trim(), assignee_name: f.c.trim() || null, position: data.timeline.length }); if (e) throw new Error(e.message); setF((s) => ({ ...s, a: '', b: '', c: '' })); setComposer(null); })}><Text style={styles.btnText}>Adicionar ao cronograma</Text></Pressable>
          </EventFormSheet>
        </EventModuleShell>
      )}

      {activeTab === 'vendors' && (
        <EventModuleShell
          title="Fornecedores"
          description="Contatos, confirmação e operação em um só lugar."
          icon="storefront-outline"
          metrics={[
            { label: 'Total', value: data.vendors.length, tone: 'neutral' },
            { label: 'Confirmados', value: data.vendors.filter((vendor) => ['confirmed', 'paid'].includes(vendor.status)).length, tone: 'success' },
            { label: 'A confirmar', value: data.vendors.filter((vendor) => !vendor.status || vendor.status === 'pending').length, tone: 'warning' },
          ]}
          actionLabel="Vincular fornecedor"
          onAction={() => setComposer('vendors')}
        >
          <View style={styles.cardSoft}>
            <Text style={styles.subtitle}>Seus fornecedores de confiança</Text>
            <Text style={styles.caption}>Escolha alguém já cadastrado na aba Fornecedores. Os contatos entram neste evento sem você digitar tudo novamente.</Text>
            {loadingCatalogVendors ? <PrimeLogoLoader label="Carregando fornecedores..." /> : catalogVendors.filter((vendor) => !data.vendors.some((linked) => String(linked.catalog_vendor_id ?? '') === String(vendor.id))).slice(0, 8).map((vendor) => (
              <EventListCard key={vendor.id} title={String(vendor.name)} subtitle={String(vendor.category || 'Sem categoria')} meta={[vendor.whatsapp || vendor.email || 'Contato não informado']} status="Disponível" statusTone="info" actions={[{ label: 'Usar neste evento', icon: 'add-circle-outline', onPress: () => void act(() => linkCatalogVendor(String(vendor.id)))}]} />
            ))}
            {!loadingCatalogVendors && catalogVendors.length === 0 ? <Text style={styles.caption}>Cadastre parceiros na aba Fornecedores para reutilizá-los em todos os eventos.</Text> : null}
          </View>
          <TextInput style={styles.input} value={vendorSearch} onChangeText={setVendorSearch} placeholder="Buscar por nome/categoria" />
          <EventFilterChips selected={vendorSort} onSelect={(value) => setVendorSort(value as typeof vendorSort)} options={[
            { value: 'name_asc', label: 'A–Z' }, { value: 'name_desc', label: 'Z–A' }, { value: 'status', label: 'Por status' },
          ]} />
          <EventSectionTitle title="Equipe de fornecedores" />
          {visibleVendors.length === 0 ? (
            <EventEmptyState icon="storefront-outline" title="Nenhum fornecedor encontrado" description="Vincule o primeiro parceiro deste evento ou altere sua busca." actionLabel="Vincular fornecedor" onAction={() => setComposer('vendors')} />
          ) : null}
          {visibleVendors.map((v) => (
            <EventListCard
              key={v.id}
              title={String(v.name ?? 'Fornecedor')}
              subtitle={v.category || 'Categoria não informada'}
              status={vendorStatusLabel(v.status)}
              statusTone={v.status === 'paid' || v.status === 'confirmed' ? 'success' : v.status === 'cancelled' ? 'danger' : 'warning'}
              meta={[
                v.phone || v.email || 'Contato não informado',
                v.expected_arrival_time ? `Chegada: ${v.expected_arrival_time}` : 'Horário a combinar',
                `${paymentReceiptCountByVendor.get(String(v.id)) ?? 0} recibo(s)`,
              ]}
              actions={[
                { label: v.status === 'confirmed' ? 'Marcar pago' : 'Confirmar', icon: 'checkmark-outline', onPress: () => void act(async () => { const { error: e } = await supabase.from('event_vendors').update({ status: v.status === 'confirmed' ? 'paid' : 'confirmed' }).eq('id', v.id); if (e) throw new Error(e.message); }) },
                { label: 'Gastos', icon: 'wallet-outline', onPress: () => { setBudgetVendorFilter(String(v.id)); setActiveTab('budget'); } },
                { label: 'Documentos', icon: 'document-text-outline', onPress: () => { setDocumentVendorFilter(String(v.id)); setActiveTab('documents'); } },
                { label: 'Excluir', icon: 'trash-outline', tone: 'danger', onPress: () => void act(async () => { const { error: e } = await supabase.from('event_vendors').delete().eq('id', v.id); if (e) throw new Error(e.message); }) },
              ]}
            />
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
          <EventFormSheet visible={composer === 'vendors'} title="Outro fornecedor" subtitle="Não encontrou na sua lista? Cadastre manualmente para este evento." onClose={() => setComposer(null)}>
            <Text style={styles.formLabel}>Nome</Text>
            <TextInput style={styles.input} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Nome do fornecedor" />
            <Text style={styles.formLabel}>Categoria</Text>
            <TextInput style={styles.input} value={f.b} onChangeText={(v) => setF((s) => ({ ...s, b: v }))} placeholder="Ex.: Buffet" />
            <Text style={styles.formLabel}>Contato</Text>
            <TextInput style={styles.input} value={newVendorPhone} onChangeText={setNewVendorPhone} placeholder="Telefone (opcional)" keyboardType="phone-pad" />
            <TextInput style={styles.input} value={newVendorEmail} onChangeText={setNewVendorEmail} placeholder="E-mail (opcional)" keyboardType="email-address" autoCapitalize="none" />
            <Text style={styles.formLabel}>Operação no dia</Text>
            <View style={styles.formRow}>
              <TextInput style={[styles.input, styles.formGrow]} value={newVendorArrival} onChangeText={setNewVendorArrival} placeholder="Chegada HH:MM" />
              <TextInput style={[styles.input, styles.formGrow]} value={newVendorDone} onChangeText={setNewVendorDone} placeholder="Fim HH:MM" />
            </View>
            <Pressable style={styles.btn} onPress={() => void act(async () => {
              if (!f.a.trim() || !f.b.trim()) return;
              const { error: e } = await supabase.from('event_vendors').insert({ event_id: eventId, name: f.a.trim(), category: f.b.trim(), status: 'pending', phone: newVendorPhone.trim() || null, email: newVendorEmail.trim() || null, expected_arrival_time: newVendorArrival.trim() || null, expected_done_time: newVendorDone.trim() || null });
              if (e) throw new Error(e.message);
              setF((s) => ({ ...s, a: '', b: '' })); setNewVendorPhone(''); setNewVendorEmail(''); setNewVendorArrival(''); setNewVendorDone(''); setComposer(null);
            })}><Text style={styles.btnText}>Vincular fornecedor</Text></Pressable>
          </EventFormSheet>
        </EventModuleShell>
      )}

      {activeTab === 'documents' && (
        <EventModuleShell title="Documentos" description="Contratos, recibos e arquivos importantes do evento." icon="document-text-outline" metrics={[
          { label: 'Arquivos', value: data.documents.length, tone: 'gold' },
          { label: 'Categorias', value: documentCategories.length, tone: 'neutral' },
        ]} actionLabel="Adicionar documento" onAction={() => setComposer('documents')}>
          {documentReceiptFilterId ? (
            <Pressable style={styles.activeFilter} onPress={() => setDocumentReceiptFilterId('')}><Text style={styles.activeFilterText}>Exibindo o recibo selecionado</Text><Ionicons name="close" size={16} color={colors.gold700} accessible={false} /></Pressable>
          ) : null}
          {documentVendorFilter ? (
            <Pressable style={styles.activeFilter} onPress={() => setDocumentVendorFilter('')}><Text style={styles.activeFilterText}>Fornecedor: {data.vendors.find((vendor) => String(vendor.id) === documentVendorFilter)?.name ?? 'selecionado'}</Text><Ionicons name="close" size={16} color={colors.gold700} accessible={false} /></Pressable>
          ) : null}
          <TextInput style={styles.input} value={documentSearch} onChangeText={setDocumentSearch} placeholder="Buscar documento" />
          <EventFilterChips selected={documentCategoryFilter} onSelect={setDocumentCategoryFilter} options={[{ value: '', label: 'Todos' }, ...documentCategories.slice(0, 6).map((category) => ({ value: category, label: category }))]} />
          <EventSectionTitle title="Arquivos do evento" actionLabel="Compartilhar links" onAction={() => void Share.share({ message: filteredDocuments.filter((d) => !d.file_id && typeof d.file_url === 'string' && d.file_url.trim()).map((d) => d.file_url).join('\n') || 'Nenhum link público para compartilhar.' })} />
          {visibleDocuments.length === 0 ? <EventEmptyState icon="document-text-outline" title="Nenhum documento encontrado" description="Envie um arquivo ou adicione um link para centralizar os documentos." actionLabel="Adicionar documento" onAction={() => setComposer('documents')} /> : null}
          {visibleDocuments.map((d) => (
            <EventListCard key={d.id} title={String(d.name ?? 'Documento')} subtitle={data.vendors.find((vendor) => String(vendor.id) === String(d.vendor_id))?.name || 'Documento geral'} status={d.category || 'Outros'} statusTone="info" actions={[
              { label: 'Abrir', icon: 'open-outline', onPress: () => void openDocumentLink(d) },
              ...(!d.file_id && d.file_url ? [{ label: 'Compartilhar', icon: 'share-outline' as const, onPress: () => { if (d.file_url) void Share.share({ message: d.file_url }); } }] : []),
              { label: 'Excluir', icon: 'trash-outline', tone: 'danger', onPress: () => void act(async () => { if (d.file_id) await deleteStoredFile(String(d.file_id)).catch(() => undefined); const { error: e } = await supabase.from('event_documents').delete().eq('id', d.id); if (e) throw new Error(e.message); }) },
            ]} />
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
          <EventFormSheet visible={composer === 'documents'} title="Adicionar documento" subtitle="Envie um arquivo do celular ou salve um link." onClose={() => setComposer(null)}>
            <Pressable style={styles.uploadAction} onPress={() => void pickAndUploadDocument()} accessibilityRole="button"><Ionicons name="cloud-upload-outline" size={22} color={colors.gold700} accessible={false} /><View style={styles.formGrow}><Text style={styles.uploadTitle}>{uploadingDoc ? 'Enviando arquivo...' : 'Escolher arquivo do celular'}</Text><Text style={styles.uploadSubtitle}>PDF, imagem ou documento</Text></View></Pressable>
            <Text style={styles.formDivider}>ou adicione um link</Text>
            <Text style={styles.formLabel}>Nome</Text><TextInput style={styles.input} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Ex.: Contrato do buffet" />
            <Text style={styles.formLabel}>Link</Text><TextInput style={styles.input} value={f.b} onChangeText={(v) => setF((s) => ({ ...s, b: v }))} placeholder="https://" autoCapitalize="none" keyboardType="url" />
            <Text style={styles.formLabel}>Categoria</Text><TextInput style={styles.input} value={f.c} onChangeText={(v) => setF((s) => ({ ...s, c: v }))} placeholder="Ex.: Contratos" />
            {data.vendors.length ? <><Text style={styles.formLabel}>Fornecedor (opcional)</Text><EventFilterChips selected={documentVendorInput} onSelect={setDocumentVendorInput} options={[{ value: '', label: 'Geral' }, ...data.vendors.map((vendor) => ({ value: String(vendor.id), label: String(vendor.name) }))]} /></> : null}
            <Pressable style={styles.btn} onPress={() => void act(async () => { if (!f.a.trim() || !f.b.trim()) return; const { error: e } = await supabase.from('event_documents').insert({ event_id: eventId, name: f.a.trim(), file_url: f.b.trim(), category: f.c.trim() || 'Outros', vendor_id: documentVendorInput || null }); if (e) throw new Error(e.message); setF((s) => ({ ...s, a: '', b: '', c: '' })); setDocumentVendorInput(''); setComposer(null); })}><Text style={styles.btnText}>Salvar link</Text></Pressable>
          </EventFormSheet>
        </EventModuleShell>
      )}

      {activeTab === 'notes' && (
        <EventModuleShell title="Notas" description="Lembretes rápidos que ficam junto do evento." icon="create-outline" metrics={[{ label: 'Anotações', value: data.notes.length, tone: 'gold' }]} actionLabel="Nova nota" onAction={() => setComposer('notes')}>
          <EventSectionTitle title="Anotações do evento" />
          {data.notes.length === 0 ? <EventEmptyState icon="create-outline" title="Nenhuma nota ainda" description="Registre uma observação importante para a equipe." actionLabel="Criar nota" onAction={() => setComposer('notes')} /> : null}
          {data.notes.map((n) => (
            <EventListCard key={n.id} title={String(n.content ?? 'Nota')} status="Nota" statusTone="gold" actions={[
              { label: 'Excluir', icon: 'trash-outline', tone: 'danger', onPress: () => void act(async () => { const { error: e } = await supabase.from('event_notes').delete().eq('id', n.id); if (e) throw new Error(e.message); }) },
            ]} />
          ))}
          <EventFormSheet visible={composer === 'notes'} title="Nova nota" onClose={() => setComposer(null)}>
            <Text style={styles.formLabel}>Observação</Text>
            <TextInput style={[styles.input, styles.area]} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Escreva o que a equipe precisa lembrar" multiline />
            <Pressable style={styles.btn} onPress={() => void act(async () => { if (!f.a.trim()) return; const { error: e } = await supabase.from('event_notes').insert({ event_id: eventId, content: f.a.trim(), color: '#FEF3C7' }); if (e) throw new Error(e.message); setF((s) => ({ ...s, a: '' })); setComposer(null); })}><Text style={styles.btnText}>Salvar nota</Text></Pressable>
          </EventFormSheet>
        </EventModuleShell>
      )}

      {activeTab === 'team' && (
        <EventModuleShell title="Equipe" description="Quem faz o evento acontecer e como entrar em contato." icon="people-circle-outline" metrics={[{ label: 'Pessoas', value: data.team.length, tone: 'info' }]} actionLabel="Adicionar à equipe" onAction={() => setComposer('team')}>
          {teamDirectory.length ? <View style={styles.directoryBlock}><View style={styles.rowBetween}><View style={styles.formGrow}><Text style={styles.subtitle}>Sua equipe cadastrada</Text><Text style={styles.caption}>Escale uma equipe completa ou apenas uma pessoa, sem redigitar dados.</Text></View><Pressable onPress={() => router.push('/mais/equipe' as never)}><Text style={styles.directoryLink}>Gerenciar</Text></Pressable></View>{teamDirectory.map((team) => <View key={team.id} style={styles.directoryTeam}><View style={styles.rowBetween}><View style={styles.formGrow}><Text style={styles.directoryTitle}>{team.name}</Text><Text style={styles.caption}>{team.members.length} pessoa{team.members.length === 1 ? '' : 's'}</Text></View><Pressable style={styles.directoryAssign} onPress={() => void act(() => assignDirectoryMembers(team, team.members))}><Text style={styles.directoryAssignText}>Escalar equipe</Text></Pressable></View><View style={styles.directoryPeople}>{team.members.map((member: any) => <Pressable key={member.id} style={styles.directoryPerson} onPress={() => void act(() => assignDirectoryMembers(team, [member]))}><Ionicons name="add-circle-outline" size={16} color={colors.gold700} /><Text style={styles.directoryPersonText}>{member.name}</Text></Pressable>)}</View></View>)}</View> : <Pressable style={styles.directoryEmpty} onPress={() => router.push('/mais/equipe' as never)}><Ionicons name="people-circle-outline" size={25} color={colors.gold700} /><View style={styles.formGrow}><Text style={styles.directoryTitle}>Cadastre sua equipe fixa</Text><Text style={styles.caption}>Depois, escale as pessoas certas em poucos toques.</Text></View><Ionicons name="chevron-forward" size={18} color={colors.mutedText} /></Pressable>}
          <EventSectionTitle title="Equipe escalada" />
          {data.team.length === 0 ? <EventEmptyState icon="people-circle-outline" title="Equipe ainda não definida" description="Adicione cerimonialistas e profissionais responsáveis pela operação." actionLabel="Adicionar pessoa" onAction={() => setComposer('team')} /> : null}
          {data.team.map((m) => (
            <View key={m.id} style={styles.teamMemberWrap}>
              <Pressable style={styles.teamPhotoButton} onPress={() => void pickAndUploadTeamPhoto(m)} accessibilityLabel={`Adicionar foto de ${m.name}`}>
                {m.photo_url ? <Image source={{ uri: String(m.photo_url) }} style={styles.teamPhoto} /> : <Ionicons name="camera-outline" size={24} color={colors.gold700} />}
                <Text style={styles.teamPhotoText}>{uploadingTeamMemberId === String(m.id) ? 'Enviando...' : m.photo_url ? 'Trocar foto' : 'Adicionar foto'}</Text>
              </Pressable>
              <View style={styles.formGrow}><EventListCard title={String(m.name ?? 'Pessoa da equipe')} subtitle={m.role || 'Função não informada'} meta={[m.phone || 'Telefone não informado']} status="Equipe" statusTone="info" actions={[
                { label: 'Excluir', icon: 'trash-outline', tone: 'danger', onPress: () => void act(async () => { const { error: e } = await supabase.from('event_team_members').delete().eq('id', m.id); if (e) throw new Error(e.message); }) },
              ]} /></View>
            </View>
          ))}
          <EventFormSheet visible={composer === 'team'} title="Adicionar à equipe" onClose={() => setComposer(null)}>
            <Text style={styles.formLabel}>Nome</Text><TextInput style={styles.input} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Nome completo" />
            <Text style={styles.formLabel}>Telefone</Text><TextInput style={styles.input} value={f.b} onChangeText={(v) => setF((s) => ({ ...s, b: v }))} placeholder="(11) 99999-9999" keyboardType="phone-pad" />
            <Text style={styles.formLabel}>Função</Text><TextInput style={styles.input} value={f.c} onChangeText={(v) => setF((s) => ({ ...s, c: v }))} placeholder="Ex.: Cerimonialista" />
            <Pressable style={styles.btn} onPress={() => void act(async () => { if (!f.a.trim()) return; const { error: e } = await supabase.from('event_team_members').insert({ event_id: eventId, name: f.a.trim(), phone: f.b.trim() || null, role: f.c.trim() || 'Cerimonialista' }); if (e) throw new Error(e.message); setF((s) => ({ ...s, a: '', b: '', c: '' })); setComposer(null); })}><Text style={styles.btnText}>Adicionar à equipe</Text></Pressable>
          </EventFormSheet>
        </EventModuleShell>
      )}

      {activeTab === 'tables' && (
        <EventModuleShell title="Mesas" description="Organize lugares e acompanhe a ocupação do salão." icon="restaurant-outline" metrics={[
          { label: 'Mesas', value: data.tables.length, tone: 'gold' },
          { label: 'Lugares', value: data.tables.reduce((sum, table) => sum + Number(table.seats ?? 0), 0), tone: 'neutral' },
          { label: 'Alocados', value: data.guests.filter((guest) => guest.table_id).length, tone: 'success' },
        ]} actionLabel="Adicionar mesa" onAction={() => setComposer('tables')}>
          <EventFilterChips selected={tablesViewMode} onSelect={(value) => setTablesViewMode(value as typeof tablesViewMode)} options={[{ value: 'list', label: 'Lista' }, { value: 'map', label: 'Mapa visual' }]} />
          {tablesViewMode === 'list' ? (
            <>{data.tables.length === 0 ? <EventEmptyState icon="restaurant-outline" title="Mapa de mesas vazio" description="Crie as mesas para começar a distribuir os convidados." actionLabel="Criar mesa" onAction={() => setComposer('tables')} /> : null}{data.tables.map((t) => (
              <EventListCard key={t.id} title={String(t.name ?? 'Mesa')} status={`${(data.guests ?? []).filter((g) => g.table_id === t.id).length}/${t.seats} lugares`} statusTone="gold" actions={[
                { label: 'Alocar próximo', icon: 'person-add-outline', onPress: () => void act(async () => { const g = data.guests.find((x) => !x.table_id); if (!g) return; const { error: e } = await supabase.from('event_guests').update({ table_id: t.id }).eq('id', g.id); if (e) throw new Error(e.message); }) },
                { label: 'Excluir', icon: 'trash-outline', tone: 'danger', onPress: () => void act(async () => { await supabase.from('event_guests').update({ table_id: null }).eq('table_id', t.id); const { error: e } = await supabase.from('event_tables').delete().eq('id', t.id); if (e) throw new Error(e.message); }) },
              ]} />
            ))}</>
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
          <EventFormSheet visible={composer === 'tables'} title="Adicionar mesa" subtitle="Você poderá posicioná-la depois no mapa visual." onClose={() => setComposer(null)}>
            <Text style={styles.formLabel}>Nome da mesa</Text><TextInput style={styles.input} value={f.a} onChangeText={(v) => setF((s) => ({ ...s, a: v }))} placeholder="Ex.: Mesa 01" />
            <Text style={styles.formLabel}>Quantidade de lugares</Text><TextInput style={styles.input} value={f.b} onChangeText={(v) => setF((s) => ({ ...s, b: v }))} placeholder="8" keyboardType="numeric" />
            <Pressable style={styles.btn} onPress={() => void act(async () => { const seats = Number(f.b); if (!f.a.trim() || !Number.isFinite(seats) || seats < 1) return; const { error: e } = await supabase.from('event_tables').insert({ event_id: eventId, name: f.a.trim(), seats, shape: 'round' }); if (e) throw new Error(e.message); setF((s) => ({ ...s, a: '', b: '' })); setComposer(null); })}><Text style={styles.btnText}>Adicionar mesa</Text></Pressable>
          </EventFormSheet>
        </EventModuleShell>
      )}

      {activeTab === 'invites' && (
        <EventModuleShell title="Convites" description="Envie o RSVP certo para cada convidado." icon="mail-outline" metrics={[
          { label: 'Aguardando', value: guestSummary.pending, tone: 'warning' },
          { label: 'Confirmados', value: guestSummary.confirmed, tone: 'success' },
          { label: 'Não vão', value: guestSummary.declined, tone: 'danger' },
        ]} actionLabel="Configurar convite" onAction={() => setComposer('invites')}>
          <View style={styles.inviteHero}>
            {event?.whatsapp_image_url ? <Image source={{ uri: event.whatsapp_image_url }} style={styles.inviteHeroImage} /> : <View style={styles.inviteHeroPlaceholder}><Ionicons name="image-outline" size={34} color={colors.gold700} /><Text style={styles.caption}>Imagem de destaque do WhatsApp</Text></View>}
            <View style={styles.inviteHeroActions}>
              <Pressable style={styles.btnGhost} onPress={() => void pickAndUploadInviteImage()}><Text style={styles.smallText}>{uploadingInviteImage ? 'Enviando...' : event?.whatsapp_image_file_id ? 'Trocar imagem' : 'Adicionar imagem'}</Text></Pressable>
              <Pressable style={styles.btn} onPress={() => void act(() => dispatchWhatsApp('bulk'), false)}><Text style={styles.btnText}>Disparar pendentes no WhatsApp</Text></Pressable>
            </View>
          </View>
          <TextInput style={styles.input} value={guestSearch} onChangeText={setGuestSearch} placeholder="Buscar convidado" />
          <EventFilterChips selected={guestFilter} onSelect={(value) => setGuestFilter(value as typeof guestFilter)} options={[{ value: 'all', label: 'Todos' }, { value: 'pending', label: 'Aguardando' }, { value: 'confirmed', label: 'Confirmados' }, { value: 'declined', label: 'Não vão' }]} />
          <EventSectionTitle title="Convidados" actionLabel="Compartilhar lista" onAction={() => void act(async () => {
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
          })} />
          {visibleGuests.map((g) => {
            const base = process.env.EXPO_PUBLIC_BASE_INVITE_URL || 'https://painelprime.com.br/convite';
            const link = g.invite_token ? `${base}/${g.invite_token}` : base;
            const msg = f.inviteTemplate.replaceAll('[Nome do Convidado]', g.name || 'Convidado').replaceAll('[LinkRSVP]', link);
            return (
              <EventListCard key={g.id} title={String(g.name ?? 'Convidado')} subtitle={g.phone || 'Telefone não informado'} status={guestStatusLabel(g.rsvp_status)} statusTone={g.rsvp_status === 'confirmed' ? 'success' : g.rsvp_status === 'declined' ? 'danger' : 'warning'} actions={[
                { label: 'Enviar WhatsApp', icon: 'logo-whatsapp', onPress: () => void act(() => dispatchWhatsApp('single', String(g.id)), false) },
                ...(g.rsvp_status === 'confirmed' ? [{ label: 'Reenviar QR Code', icon: 'qr-code-outline' as const, onPress: () => void act(() => resendGuestQr(String(g.id)), false) }] : []),
                { label: 'Compartilhar convite', icon: 'share-outline', onPress: () => void act(async () => {
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
                }) },
              ]} />
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
          <EventFormSheet visible={composer === 'invites'} title="Configurar convite" subtitle="Personalize a mensagem enviada aos convidados." onClose={() => setComposer(null)}>
            <Text style={styles.formLabel}>Mensagem</Text><TextInput style={[styles.input, styles.area]} value={f.inviteTemplate} onChangeText={(v) => setF((s) => ({ ...s, inviteTemplate: v }))} placeholder="Use [Nome do Convidado] e [LinkRSVP]" multiline />
            <Text style={styles.formLabel}>Código de vestimenta (opcional)</Text><TextInput style={styles.input} value={f.inviteDress} onChangeText={(v) => setF((s) => ({ ...s, inviteDress: v }))} placeholder="Ex.: Esporte fino" />
            <Pressable style={styles.btn} onPress={() => void act(async () => { const { error: e } = await supabase.from('events').update({ invite_message_template: f.inviteTemplate.trim() || null, invite_dress_code: f.inviteDress.trim() || null }).eq('id', eventId); if (e) throw new Error(e.message); setEvent((s) => s ? { ...s, invite_message_template: f.inviteTemplate.trim() || null, invite_dress_code: f.inviteDress.trim() || null } : s); setComposer(null); }, false)}><Text style={styles.btnText}>Salvar configuração</Text></Pressable>
          </EventFormSheet>
        </EventModuleShell>
      )}

      {activeTab === 'reception' && (
        <EventModuleShell title="Recepção e QR Code" description="Controle a entrada dos convidados, mesmo quando a internet estiver instável." icon="qr-code-outline" metrics={[
          { label: 'Confirmados', value: data.guests.filter((guest) => guest.confirmed || guest.rsvp_status === 'confirmed').length, tone: 'info' },
          { label: 'Já chegaram', value: data.guests.filter((guest) => Boolean(guest.checked_in_at)).length, tone: 'success' },
          { label: 'Aguardados', value: Math.max(data.guests.filter((guest) => guest.confirmed || guest.rsvp_status === 'confirmed').length - data.guests.filter((guest) => Boolean(guest.checked_in_at)).length, 0), tone: 'gold' },
        ]} actionLabel="Abrir scanner" onAction={() => void Linking.openURL(`https://app.painelprime.com.br/recepcao/${eventId}`)}>
          <View style={styles.receptionHero}><Ionicons name="shield-checkmark-outline" size={38} color={colors.gold700} /><Text style={styles.subtitle}>Scanner offline pronto para a porta</Text><Text style={styles.caption}>A equipe escaneia o QR Code do convidado e as entradas sincronizam assim que a conexão voltar.</Text></View>
          <EventSectionTitle title="Enviar acesso seguro à equipe" />
          {data.team.length === 0 ? <EventEmptyState icon="people-outline" title="Adicione a equipe da recepção" description="Cadastre nome e WhatsApp na área Equipe antes de liberar o scanner." actionLabel="Abrir equipe" onAction={() => setActiveTab('team')} /> : data.team.map((member) => <EventListCard key={member.id} title={String(member.name)} subtitle={member.role || 'Equipe'} meta={[member.phone || 'WhatsApp não informado']} status={member.phone ? 'Pronto' : 'Sem telefone'} statusTone={member.phone ? 'success' : 'warning'} actions={member.phone ? [{ label: 'Enviar acesso', icon: 'logo-whatsapp', onPress: () => void act(() => sendReceptionAccess(String(member.id)), false) }] : []} />)}
        </EventModuleShell>
      )}

      {activeTab === 'portal' && (
        <EventModuleShell title="Portal do cliente" description="O espaço compartilhado com os responsáveis pelo evento." icon="person-circle-outline" actionLabel="Abrir portal do cliente" onAction={() => router.push(`/portal/${eventId}`)}>
          <EventEmptyState icon="person-circle-outline" title="Tudo pronto para compartilhar" description="Abra o portal para revisar informações, documentos e aprovações visíveis ao cliente." />
        </EventModuleShell>
      )}

      {activeTab === 'meetings' && <MeetingCenter eventId={eventId} />}

      {activeTab === 'presentes' && (
        <EventModuleShell title="Presentes" description="Acompanhe intenções e recebimentos ligados ao evento." icon="gift-outline">
          <PresentesTabContent eventId={eventId} />
        </EventModuleShell>
      )}

      {activeTab === 'analytics' && (
        <EventModuleShell title="Relatório final" description="Presença, financeiro e aprendizados depois do evento." icon="bar-chart-outline">
          <EventEmptyState icon="bar-chart-outline" title="Relatório disponível após o encerramento" description="Quando o evento terminar, este espaço reunirá os principais resultados." />
        </EventModuleShell>
      )}
        </View>
          </ScrollView>
    </SafeAreaView>
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
  financeTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  financePrivacyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border },
  directoryBlock: { gap: 10, padding: 14, borderRadius: 17, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border },
  directoryTeam: { gap: 9, padding: 12, borderRadius: 14, backgroundColor: colors.card },
  directoryTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  directoryLink: { color: colors.primaryStrong, fontSize: 12, fontWeight: '800' },
  directoryAssign: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#111318' },
  directoryAssignText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  directoryPeople: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  directoryPerson: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  directoryPersonText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  directoryEmpty: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderRadius: 16, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border },
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
  loadingOverlay: { flex: 1, backgroundColor: colors.background, alignItems: 'stretch', justifyContent: 'center' },
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
  overviewFinanceHero: {
    gap: 14,
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#E8C75A',
    borderWidth: 1,
    borderColor: '#D2AC31',
    shadowColor: '#8A6812',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
    overflow: 'hidden',
  },
  overviewFinanceHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  overviewEyebrow: { color: '#6F5310', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  overviewFinanceTitle: { color: '#15120B', fontSize: 18, lineHeight: 23, fontWeight: '900' },
  overviewFinanceCopy: { color: '#5D4B20', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  overviewMoneySplit: { flexDirection: 'row', padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.62)' },
  overviewMoneyItem: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  overviewMoneyDivider: { width: 1, marginHorizontal: 10, backgroundColor: 'rgba(63,48,11,0.16)' },
  overviewMoneyDot: { width: 9, height: 9, borderRadius: 5 },
  overviewMoneyDotSpent: { backgroundColor: '#E11D48' },
  overviewMoneyDotAvailable: { backgroundColor: '#059669' },
  overviewMoneyLabel: { color: '#6B5A31', fontSize: 10, fontWeight: '700' },
  overviewMoneyValue: { color: '#17140C', fontSize: 12, fontWeight: '900' },
  overviewProgressTrack: { height: 7, overflow: 'hidden', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.62)' },
  overviewProgressFill: { height: '100%', borderRadius: 999, backgroundColor: '#111318' },
  overviewFinanceActions: { flexDirection: 'row', gap: 10 },
  overviewSecondaryAction: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(31,26,13,0.18)', backgroundColor: 'rgba(255,255,255,0.62)' },
  overviewSecondaryActionText: { color: '#17140C', fontSize: 12, fontWeight: '800' },
  overviewPrimaryAction: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#111318' },
  overviewPrimaryActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  overviewSectionHeading: { marginTop: 6, paddingHorizontal: 2 },
  overviewSectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  overviewActionStack: { gap: 8 },
  overviewActionCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 17, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  overviewActionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  overviewActionIconRose: { backgroundColor: '#FCE7F3' },
  overviewActionIconBlue: { backgroundColor: '#DBEAFE' },
  overviewActionIconGreen: { backgroundColor: '#D1FAE5' },
  overviewActionTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  overviewActionCopy: { color: colors.mutedText, fontSize: 11, lineHeight: 15 },
  overviewActionValueWrap: { alignItems: 'flex-end' },
  overviewActionValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
  overviewActionUnit: { color: colors.mutedText, fontSize: 9, fontWeight: '700' },
  overviewActionCounter: { color: colors.text, fontSize: 14, fontWeight: '900' },
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
  formLabel: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  formRow: { flexDirection: 'row', gap: 10 },
  formGrow: { flex: 1 },
  formDivider: { color: colors.mutedText, fontSize: 12, textAlign: 'center', marginVertical: 2 },
  activeFilter: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.gold200, backgroundColor: colors.gold50, paddingHorizontal: 12 },
  activeFilterText: { flex: 1, color: colors.gold700, fontSize: 12, fontWeight: '700' },
  uploadAction: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.gold200, backgroundColor: colors.gold50, padding: 14 },
  uploadTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  uploadSubtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  teamMemberWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  teamPhotoButton: { width: 82, minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 14, borderWidth: 1, borderColor: colors.gold200, backgroundColor: colors.gold50, overflow: 'hidden' },
  teamPhoto: { width: 82, height: 64, resizeMode: 'cover' },
  teamPhotoText: { color: colors.gold700, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  inviteHero: { overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: colors.gold200, backgroundColor: colors.gold50 },
  inviteHeroImage: { width: '100%', height: 170, resizeMode: 'cover' },
  inviteHeroPlaceholder: { height: 130, alignItems: 'center', justifyContent: 'center', gap: 8 },
  inviteHeroActions: { gap: 10, padding: 12 },
  receptionHero: { alignItems: 'center', gap: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.gold200, backgroundColor: colors.gold50, padding: 20 },
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
  compactPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  compactPickerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginRight: 10,
  },
  compactPickerTextGroup: {
    flex: 1,
    marginRight: 12,
  },
  compactPickerLabel: {
    fontSize: 11,
    color: colors.mutedText,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 2,
  },
  compactPickerValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  compactPickerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  compactPickerActionText: {
    color: colors.primaryStrong,
    fontSize: 12,
    fontWeight: '700',
  },
});
