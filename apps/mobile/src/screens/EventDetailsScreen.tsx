import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getEventPersonaCopy } from '@painel-prime/app/eventPersona';

import { PrimeLogoLoader } from '../components/PrimeLogoLoader';
import { MeetingCenter } from '../features/meetings/MeetingCenter';
import { useAuth } from '../contexts/AuthContext';
import {
  deleteStoredFile,
  getPrivateFileDownloadUrl,
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
import { useEventUploads } from '../features/events/useEventUploads';
import { useEventTimeline } from '../features/events/useEventTimeline';
import { useEventCommandCenter } from '../features/events/useEventCommandCenter';
import { useEventGifts } from '../features/events/useEventGifts';
import { useEventSimpleActions } from '../features/events/useEventSimpleActions';
import { SimpleEventTabs } from '../features/events/tabs/SimpleEventTabs';
import { Card, CommandLine, Danger, Item, Small, TaskSegment } from '../features/events/EventDetailsParts';
import { useEventHistory } from '../features/events/useEventHistory';
import { styles } from '../features/events/eventDetailsStyles';
import type { EventDataKey as DataKey, EventDetailsTab } from '../features/events/eventDetailsData';
import type {
  EventRow,
  OverviewAlert,
  PaymentMethod,
  VisibleKey,
} from '../features/events/eventDetailsTypes';
import {
  brl,
  composePaymentNote,
  fmt,
  getMilestoneColor,
  isOverdueDate,
  isThisWeekDate,
  isTodayDate,
  labelVendorStatus,
  normalizePaymentMethod,
  parsePaymentNote,
  paymentMethodLabel,
} from '../features/events/eventDetailsUtils';

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
  const [catalogVendors, setCatalogVendors] = useState<any[]>([]);
  const [loadingCatalogVendors, setLoadingCatalogVendors] = useState(false);
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
  const [editingBasics, setEditingBasics] = useState(false);
  const [savingBasics, setSavingBasics] = useState(false);
  const [basicDraft, setBasicDraft] = useState({
    name: '',
    couple: '',
    eventDate: '',
    location: '',
  });
  const { gifts, loadingGifts } = useEventGifts(eventId, activeTab === 'presentes');
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

  async function act(fn: () => Promise<void>, reload = true) {
    setError('');
    try {
      await fn();
      if (reload) await loadTab(activeTab, true);
    } catch (e: any) {
      setError(e?.message ?? 'Erro');
    }
  }

  const {
    uploadingDoc,
    uploadingPhoto,
    uploadingInviteImage,
    uploadingTeamMemberId,
    pickAndUploadDocument,
    pickAndUploadPhoto,
    pickAndUploadInviteImage,
    pickAndUploadTeamPhoto,
  } = useEventUploads({ eventId, event, setEvent, setData, setError, loadTab });

  const {
    loadingAiTimelineSuggestions,
    aiTimelineError,
    lastAiTimelineRunAt,
    timelineSuggestions,
    applySmartTimelineSuggestion,
    generateHybridTimelineSuggestions,
  } = useEventTimeline({ eventId, event, data, act });

  const simpleActions = useEventSimpleActions({
    activeTab,
    eventId,
    data,
    filteredGuests,
    form: f,
    setForm: setF,
    setEvent,
    setData,
    setComposer,
    act,
    loadTab,
    loadKey,
  });

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

  const {
    setHistoryFilter,
    history,
    historyTimelineNodes,
    selectedHistoryId,
    setSelectedHistoryId,
    historyProgress,
  } = useEventHistory({ activeTab, event, data, displayName });

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
  const {
    commandLeadInput,
    setCommandLeadInput,
    commandGraceInput,
    setCommandGraceInput,
    savingCommandConfig,
    commandIncidentForm,
    setCommandIncidentForm,
    savingCommandIncident,
    resolvingIncidentId,
    commandIncidents,
    latestCommandVendorStatus,
    commandSlaAlerts,
    incidentStats,
    command,
    saveCommandRules,
    updateVendorOperationalStatus,
    createCommandIncident,
    resolveCommandIncident,
  } = useEventCommandCenter({
    eventId,
    activeTab,
    loadingEvent,
    event,
    data,
    userId: user?.id,
    budgetTotal,
    totalExpenses,
    setError,
    act,
  });
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
  const tableOccupancy = useMemo(() => {
    return data.tables.map((table) => {
      const allocated = data.guests.filter((guest) => guest.table_id === table.id).length;
      const seats = Number(table.seats ?? 0);
      const free = Math.max(0, seats - allocated);
      const ratio = seats > 0 ? Math.min(1, allocated / seats) : 0;
      return { table, allocated, seats, free, ratio };
    });
  }, [data.guests, data.tables]);

  async function linkCatalogVendor(vendorId: string) {
    const { error: linkError } = await supabase.rpc('link_catalog_vendor_to_event', { p_event_id: eventId, p_vendor_id: vendorId });
    if (linkError) throw new Error(linkError.message);
    await loadTab('vendors', true);
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

      <SimpleEventTabs
        activeTab={activeTab}
        eventId={eventId}
        event={event}
        data={data}
        form={f}
        setForm={setF}
        composer={composer}
        setComposer={setComposer}
        uploadingTeamMemberId={uploadingTeamMemberId}
        uploadingInviteImage={uploadingInviteImage}
        onUploadTeamPhoto={(member) => void pickAndUploadTeamPhoto(member)}
        onUploadInviteImage={() => void pickAndUploadInviteImage()}
        guestSummary={guestSummary}
        visibleGuests={visibleGuests}
        filteredGuestCount={filteredGuests.length}
        visible={visible}
        guestSearch={guestSearch}
        setGuestSearch={setGuestSearch}
        guestFilter={guestFilter}
        setGuestFilter={setGuestFilter}
        paging={paging}
        loadingMore={loadingMore}
        onShowMoreGuests={() => showMore('guests')}
        onLoadMoreGuests={() => void loadMoreKey('guests')}
        onError={setError}
        onManageDirectory={() => router.push('/mais/equipe' as never)}
        onOpenPortal={() => router.push(`/portal/${eventId}`)}
        onOpenTeam={() => setActiveTab('team')}
        actions={simpleActions}
        gifts={gifts}
        loadingGifts={loadingGifts}
      />
      {activeTab === 'meetings' && <MeetingCenter eventId={eventId} />}
        </View>
          </ScrollView>
    </SafeAreaView>
  );
}
