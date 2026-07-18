import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getEventPersonaCopy } from '@painel-prime/app/eventPersona';

import { PrimeLogoLoader } from '../components/PrimeLogoLoader';
import { MeetingCenter } from '../features/meetings/MeetingCenter';
import { useAuth } from '../contexts/AuthContext';
import { getPrivateFileDownloadUrl } from '../lib/r2FileStorage';
import { supabase } from '../lib/supabase';
import { isEventDetailsInitialTab, EVENT_MODULES } from '../navigation/eventRouteTypes';
import type { EventDetailsInitialTab } from '../navigation/eventRouteTypes';
import { formatBrlInput, parseBrlInput } from '../components/ui/PremiumInputs';
import { summarizeTasks } from '../features/events/eventWorkspaceUtils';
import { useEventFilters } from '../features/events/useEventFilters';
import { useEventDetailsData } from '../features/events/useEventDetailsData';
import { useEventUploads } from '../features/events/useEventUploads';
import { useEventTimeline } from '../features/events/useEventTimeline';
import { useEventCommandCenter } from '../features/events/useEventCommandCenter';
import { useEventGifts } from '../features/events/useEventGifts';
import { useEventSimpleActions } from '../features/events/useEventSimpleActions';
import { useEventOperationalActions } from '../features/events/useEventOperationalActions';
import { SimpleEventTabs } from '../features/events/tabs/SimpleEventTabs';
import { OperationalEventTabs } from '../features/events/tabs/OperationalEventTabs';
import { CoreEventTabs } from '../features/events/tabs/CoreEventTabs';
import { EventDetailsHeader } from '../features/events/EventDetailsHeader';
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
  isOverdueDate,
  isThisWeekDate,
  isTodayDate,
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
  const [visible, setVisible] = useState<Record<VisibleKey, number>>({
    tasks: 40,
    guests: 40,
    vendors: 40,
    documents: 40,
    timeline: 40,
  });
  const [catalogVendors, setCatalogVendors] = useState<any[]>([]);
  const [loadingCatalogVendors, setLoadingCatalogVendors] = useState(false);
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

  const operationalActions = useEventOperationalActions({
    eventId,
    data,
    form: f,
    setForm: setF,
    filteredExpenses,
    setComposer,
    setError,
    act,
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
    completeOverdueTasks,
    confirmPendingVendors,
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
    <ScrollView ref={pageRef} style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}>
      <EventDetailsHeader
        {...{ event, displayName, uploadingPhoto, editingBasics, setEditingBasics, basicDraft, setBasicDraft, savingBasics,
          activeTabLabel, activeTabIcon, pickerOptions, activeTab }}
        loadingTab={loadingTab}
        principalNamePlaceholder={eventPersona.principalNamePlaceholder}
        modulePickerOpen={isModulePickerOpen}
        error={error}
        onBack={() => router.push('/eventos')}
        onUploadPhoto={() => void pickAndUploadPhoto()}
        onSaveBasics={() => void saveBasicEventInfo()}
        onOpenModulePicker={() => setIsModulePickerOpen(true)}
        onSelectTab={(value) => setActiveTab(value as EventDetailsInitialTab)}
        onCloseModulePicker={() => setIsModulePickerOpen(false)}
      />
              <View style={styles.moduleContent}>
      <CoreEventTabs
        activeTab={activeTab}
        overview={{
          alerts, budgetTitle: eventPersona.budgetTitle, budgetDescription: eventPersona.budgetDescription,
          budgetEditDescription: eventPersona.budgetEditDescription, hideFinancialValues, editingBudget: isBudgetCardEditing,
          budgetDraft: budgetCardDraft, budgetTotal, totalExpenses, budgetProgress, savingBudget: savingBudgetCard,
          hasEventDate: Boolean(event?.event_date), daysRemaining, completedTasks, totalTasks: data.tasks.length, guestSummary,
          expensesForCharts, paymentsByMethod, totalPaidByMethod, pendingTasks, overdueTasks, todayTasks, thisWeekTasks, futureTasks,
          onTogglePrivacy: () => setHideFinancialValues((value) => !value), onBudgetDraftChange: setBudgetCardDraft,
          onCancelBudgetEdit: () => { setBudgetCardDraft(formatBrlInput(Math.round(budgetTotal * 100))); setIsBudgetCardEditing(false); },
          onStartBudgetEdit: () => setIsBudgetCardEditing(true), onSaveBudget: () => void saveBudgetFromCard(),
          onOpenModule: openModule, onToggleTask: toggleTask,
        }}
        command={{
          command, commandLeadInput, commandGraceInput, savingCommandConfig, alerts, commandSlaAlerts, incidentStats,
          budgetBalance: budgetTotal - totalExpenses, vendors: data.vendors, latestCommandVendorStatus, commandIncidentForm,
          savingCommandIncident, commandIncidents, resolvingIncidentId, onLeadInputChange: setCommandLeadInput,
          onGraceInputChange: setCommandGraceInput, onSaveRules: () => void saveCommandRules(),
          onCompleteOverdueTasks: () => void completeOverdueTasks(), onConfirmVendors: () => void confirmPendingVendors(),
          onOpenModule: setActiveTab, onUpdateVendorStatus: (id, status) => void updateVendorOperationalStatus(id, status),
          onIncidentFormChange: setCommandIncidentForm, onCreateIncident: () => void createCommandIncident(),
          onResolveIncident: (id) => void resolveCommandIncident(id),
        }}
        history={{
          history, timelineNodes: historyTimelineNodes, selectedId: selectedHistoryId, progress: historyProgress,
          onFilterChange: setHistoryFilter, onSelect: setSelectedHistoryId,
        }}
      />

      <OperationalEventTabs
        {...{
          activeTab, data, form: f, setForm: setF, composer, setComposer, visible, paging, loadingMore,
          taskView, setTaskView, visibleTasks, filteredTasks, taskSummary, assigneeOptions,
          budgetTotal, totalExpenses, hideFinancialValues, setHideFinancialValues, filteredExpenses, filteredPayments,
          budgetVendorFilter, setBudgetVendorFilter, budgetStatusFilter, setBudgetStatusFilter,
          guestSummary, visibleGuests, guestSearch, setGuestSearch, guestFilter, setGuestFilter, guestSort, setGuestSort,
          timelineSuggestions, loadingAiTimelineSuggestions, lastAiTimelineRunAt, aiTimelineError,
          applySmartTimelineSuggestion, generateHybridTimelineSuggestions, visibleTimeline,
          catalogVendors, loadingCatalogVendors, filteredVendors, visibleVendors, vendorSearch, setVendorSearch,
          vendorSort, setVendorSort, paymentReceiptCountByVendor, setActiveTab, visibleDocuments, filteredDocuments,
          documentCategories, documentReceiptFilterId, setDocumentReceiptFilterId, documentVendorFilter,
          setDocumentVendorFilter, documentSearch, setDocumentSearch, documentCategoryFilter, setDocumentCategoryFilter,
          uploadingDoc, pickAndUploadDocument, showMore, loadMoreKey,
        }}
        actions={operationalActions}
        personaDescription={eventPersona.budgetDescription}
        timelinePlaceholder={eventPersona.timelineActivityPlaceholder}
      />

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
