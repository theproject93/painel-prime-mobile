import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Screen } from '../components/Screen';
import { WalkthroughAnchorTarget } from '../components/WalkthroughAnchors';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { EventDetailsInitialTab } from '../navigation/eventRouteTypes';
import { colors } from '../theme/colors';

type EventRow = {
  id: string;
  name: string;
  event_date: string;
  status: string | null;
};
type TaskRow = {
  event_id: string;
  due_date: string | null;
  text: string | null;
  completed: boolean | null;
};
type GuestRow = {
  event_id: string;
  confirmed: boolean | null;
  rsvp_status: string | null;
};
type VendorRow = {
  event_id: string;
  category: string | null;
};
type ExpenseRow = {
  event_id: string;
  value: number | null;
  status: string | null;
};

type Shortcut = {
  id: string;
  label: string;
  description: string;
  tab: EventDetailsInitialTab;
};

type Pendency = {
  id: string;
  eventId: string;
  eventName: string;
  title: string;
  description: string;
  score: number;
  tab: EventDetailsInitialTab;
};

type AgendaItem = {
  id: string;
  eventId: string;
  eventName: string;
  title: string;
  dueAt: Date;
};

type DashboardStats = {
  activeCount: number;
  completedCount: number;
  nextEvent: EventRow | null;
  daysToNext: number;
  totalBudget: number;
};

const SHORTCUTS: Shortcut[] = [
  {
    id: 'mass-rsvp',
    label: 'Envio de RSVP em massa',
    description: 'Abrir Convites e acelerar confirmações pendentes.',
    tab: 'invites',
  },
  {
    id: 'vendors',
    label: 'Ajustar fornecedores',
    description: 'Revisar categorias e status dos fornecedores.',
    tab: 'vendors',
  },
  {
    id: 'timeline',
    label: 'Revisar cronograma',
    description: 'Organizar operação do dia do evento.',
    tab: 'timeline',
  },
  {
    id: 'event-finance',
    label: 'Financeiro do evento',
    description: 'Conferir despesas e pagamentos do evento.',
    tab: 'budget',
  },
];

export function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    activeCount: 0,
    completedCount: 0,
    nextEvent: null,
    daysToNext: 0,
    totalBudget: 0,
  });
  const [leadsCount, setLeadsCount] = useState(0);
  const [shortcutModal, setShortcutModal] = useState<{
    open: boolean;
    shortcut: Shortcut | null;
    eventId: string;
  }>({
    open: false,
    shortcut: null,
    eventId: '',
  });

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    const { data: eventData, error: eventsError } = await supabase
      .from('events')
      .select('id,name,event_date,status')
      .eq('user_id', user.id)
      .or('status.is.null,status.neq.deleted')
      .order('event_date', { ascending: true });

    if (eventsError) {
      setError(eventsError.message);
      setLoading(false);
      return;
    }

    const allEvents = (eventData ?? []) as EventRow[];
    setEvents(allEvents);

    const active = allEvents.filter((eventItem) => {
      const status = (eventItem.status ?? 'active').toLowerCase().trim();
      return status === 'active' || status === 'draft';
    });
    const completed = allEvents.filter((eventItem) => {
      const status = (eventItem.status ?? '').toLowerCase().trim();
      return status === 'completed';
    });
    const activeIds = active.map((eventItem) => eventItem.id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = active.find((eventItem) => {
      const eventDate = new Date(`${eventItem.event_date}T12:00:00`);
      return eventDate >= today;
    });
    const daysToNext = next
      ? Math.ceil((new Date(next.event_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (activeIds.length === 0) {
      setTasks([]);
      setGuests([]);
      setVendors([]);
      setStats({
        activeCount: active.length,
        completedCount: completed.length,
        nextEvent: next ?? null,
        daysToNext,
        totalBudget: 0,
      });
      setLoading(false);
      return;
    }

    const { count: leadCount, error: leadError } = await supabase
      .from('crm_clients')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .neq('stage', 'closed_won');
    if (!leadError) setLeadsCount(leadCount ?? 0);

    const [expensesRes, tasksRes, guestsRes, vendorsRes] = await Promise.all([
      supabase.from('event_expenses').select('event_id,value,status').in('event_id', activeIds),
      supabase.from('event_tasks').select('event_id,due_date,text,completed').in('event_id', activeIds),
      supabase.from('event_guests').select('event_id,confirmed,rsvp_status').in('event_id', activeIds),
      supabase.from('event_vendors').select('event_id,category').in('event_id', activeIds),
    ]);

    if (expensesRes.error || tasksRes.error || guestsRes.error || vendorsRes.error) {
      setError(
        expensesRes.error?.message ||
          tasksRes.error?.message ||
          guestsRes.error?.message ||
          vendorsRes.error?.message ||
          'Falha ao carregar dashboard.',
      );
      setLoading(false);
      return;
    }

    const totalBudget = (expensesRes.data as ExpenseRow[]).reduce((acc, current) => {
      const status = (current.status ?? 'pending').toLowerCase().trim();
      if (status === 'cancelled') return acc;
      return acc + Number(current.value ?? 0);
    }, 0);

    setTasks((tasksRes.data ?? []) as TaskRow[]);
    setGuests((guestsRes.data ?? []) as GuestRow[]);
    setVendors((vendorsRes.data ?? []) as VendorRow[]);
    setStats({
      activeCount: active.length,
      completedCount: completed.length,
      nextEvent: next ?? null,
      daysToNext,
      totalBudget,
    });
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const activeEvents = useMemo(() => {
    return events.filter((eventItem) => {
      const status = (eventItem.status ?? 'active').toLowerCase().trim();
      return status === 'active' || status === 'draft';
    });
  }, [events]);

  const topPendencies = useMemo<Pendency[]>(() => {
    const taskByEvent = new Map<string, TaskRow[]>();
    for (const task of tasks) {
      const current = taskByEvent.get(task.event_id) ?? [];
      current.push(task);
      taskByEvent.set(task.event_id, current);
    }

    const guestByEvent = new Map<string, GuestRow[]>();
    for (const guest of guests) {
      const current = guestByEvent.get(guest.event_id) ?? [];
      current.push(guest);
      guestByEvent.set(guest.event_id, current);
    }

    const vendorsByEvent = new Map<string, VendorRow[]>();
    for (const vendor of vendors) {
      const current = vendorsByEvent.get(vendor.event_id) ?? [];
      current.push(vendor);
      vendorsByEvent.set(vendor.event_id, current);
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const pendencies: Pendency[] = [];

    for (const eventItem of activeEvents) {
      const eventTasks = taskByEvent.get(eventItem.id) ?? [];
      const overdueTasks = eventTasks.filter((task) => {
        if (task.completed || !task.due_date) return false;
        const due = new Date(task.due_date);
        due.setHours(0, 0, 0, 0);
        return due < now;
      }).length;

      if (overdueTasks > 0) {
        pendencies.push({
          id: `${eventItem.id}-tasks`,
          eventId: eventItem.id,
          eventName: eventItem.name,
          title: `${overdueTasks} tarefa(s) atrasada(s)`,
          description: 'Priorize o cronograma para reduzir risco operacional.',
          score: 80 + overdueTasks,
          tab: 'timeline',
        });
      }

      const eventGuests = guestByEvent.get(eventItem.id) ?? [];
      const pendingRsvp = eventGuests.filter((guest) => {
        const status = normalizeText(guest.rsvp_status ?? '');
        if (status === 'pending') return true;
        if (status === 'confirmed' || status === 'declined') return false;
        return !guest.confirmed;
      }).length;

      if (pendingRsvp >= 8) {
        pendencies.push({
          id: `${eventItem.id}-rsvp`,
          eventId: eventItem.id,
          eventName: eventItem.name,
          title: `${pendingRsvp} RSVP pendente(s)`,
          description: 'Faça envio em massa para acelerar confirmações.',
          score: 70 + pendingRsvp,
          tab: 'invites',
        });
      }

      const eventVendors = vendorsByEvent.get(eventItem.id) ?? [];
      const hasBuffet = eventVendors.some((vendor) =>
        normalizeText(vendor.category ?? '').includes('buffet'),
      );
      if (!hasBuffet) {
        pendencies.push({
          id: `${eventItem.id}-buffet`,
          eventId: eventItem.id,
          eventName: eventItem.name,
          title: 'Fornecedor buffet não encontrado',
          description: 'Cadastre buffet para evitar lacuna critica.',
          score: 95,
          tab: 'vendors',
        });
      }
    }

    return pendencies.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [activeEvents, guests, tasks, vendors]);

  const agendaNextDays = useMemo<AgendaItem[]>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const sevenDays = new Date(now);
    sevenDays.setDate(now.getDate() + 7);

    const eventNameById = new Map(activeEvents.map((eventItem) => [eventItem.id, eventItem.name]));
    return tasks
      .filter((task) => !task.completed && task.due_date)
      .map((task) => ({
        id: `${task.event_id}-${task.text}-${task.due_date}`,
        eventId: task.event_id,
        eventName: eventNameById.get(task.event_id) ?? 'Evento',
        title: task.text?.trim() || 'Tarefa pendente',
        dueAt: new Date(task.due_date as string),
      }))
      .filter((item) => item.dueAt >= now && item.dueAt <= sevenDays)
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
      .slice(0, 6);
  }, [activeEvents, tasks]);

  function goToEventTab(eventId: string, tab: EventDetailsInitialTab) {
    const search = tab === 'overview' ? '' : `?initialTab=${tab}`;
    router.push(`/eventos/${eventId}${search}`);
  }

  function openShortcut(shortcut: Shortcut) {
    if (activeEvents.length === 1) {
      goToEventTab(activeEvents[0].id, shortcut.tab);
      return;
    }
    setShortcutModal({
      open: true,
      shortcut,
      eventId: activeEvents[0]?.id ?? '',
    });
  }

  function confirmShortcut() {
    if (!shortcutModal.shortcut || !shortcutModal.eventId) return;
    goToEventTab(shortcutModal.eventId, shortcutModal.shortcut.tab);
    setShortcutModal({ open: false, shortcut: null, eventId: '' });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryStrong} />
      </View>
    );
  }

  return (
    <Screen title="Painel Prime" subtitle="Operação central da assessoria">
      {error ? <Text style={styles.err}>{error}</Text> : null}

      {/* Pipeline Comercial */}
      <WalkthroughAnchorTarget id="dashboard.pipeline" borderRadius={14}>
        <View style={styles.card}>
          <Text style={styles.pipelineEyebrow}>Pipeline Comercial</Text>
          <View style={styles.pipelineRow}>
            <View style={styles.pipelineStat}>
              <Text style={styles.pipelineValue}>{leadsCount}</Text>
              <Text style={styles.pipelineLabel}>Lead(s) ativo(s)</Text>
            </View>
            <View style={styles.pipelineStat}>
              <Text style={styles.pipelineValue}>{stats.activeCount}</Text>
              <Text style={styles.pipelineLabel}>Evento(s) ativo(s)</Text>
            </View>
            <View style={styles.pipelineStat}>
              <Text style={styles.pipelineValue}>{toBRL(stats.totalBudget)}</Text>
              <Text style={styles.pipelineLabel}>Orçamento total</Text>
            </View>
          </View>
        </View>
      </WalkthroughAnchorTarget>

      <WalkthroughAnchorTarget id="dashboard.metrics" borderRadius={16}>
        <View style={styles.metricsSection}>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Eventos em andamento</Text>
              <Text style={styles.metricValue}>{stats.activeCount}</Text>
              <Text style={styles.metricHint}>+{stats.completedCount} realizados</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Próximo evento</Text>
              {stats.nextEvent ? (
                <>
                  <Text style={styles.metricValueSm} numberOfLines={1}>
                    {stats.nextEvent.name}
                  </Text>
                  <Text style={styles.metricHintGold}>Faltam {stats.daysToNext} dias</Text>
                </>
              ) : (
                <Text style={styles.metricHint}>Nenhum evento futuro.</Text>
              )}
            </View>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Orçamento gerenciado</Text>
            <Text style={styles.metricValueSm}>{toBRL(stats.totalBudget)}</Text>
            <Text style={styles.metricHint}>Soma das despesas dos eventos ativos.</Text>
          </View>
        </View>
      </WalkthroughAnchorTarget>

      <WalkthroughAnchorTarget id="dashboard.pendencies" borderRadius={14}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top pendências</Text>
          {topPendencies.length === 0 ? (
            <Text style={styles.cardSub}>Sem pendências críticas agora.</Text>
          ) : (
            topPendencies.map((pendency) => (
              <View key={pendency.id} style={styles.item}>
                <View style={styles.itemMain}>
                  <Text style={styles.itemTitle}>{pendency.title}</Text>
                  <Text style={styles.itemSub}>{pendency.eventName}</Text>
                  <Text style={styles.itemSub}>{pendency.description}</Text>
                </View>
                <Pressable
                  style={styles.itemAction}
                  onPress={() => goToEventTab(pendency.eventId, pendency.tab)}
                >
                  <Text style={styles.itemActionText}>Resolver</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </WalkthroughAnchorTarget>

      <WalkthroughAnchorTarget id="dashboard.shortcuts" borderRadius={14}>
        <View style={styles.shortcutsSection}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Atalhos inteligentes</Text>
            <Text style={styles.cardSub}>Ações rápidas da operação.</Text>
            <View style={styles.shortcutGrid}>
              {SHORTCUTS.map((shortcut) => (
                <Pressable
                  key={shortcut.id}
                  style={styles.shortcutButton}
                  onPress={() => openShortcut(shortcut)}
                >
                  <Text style={styles.shortcutTitle}>{shortcut.label}</Text>
                  <Text style={styles.shortcutSub}>{shortcut.description}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Próximos 7 dias</Text>
            <Text style={styles.cardSub}>Itens com prazo curto no checklist.</Text>
            {agendaNextDays.length === 0 ? (
              <Text style={styles.cardSub}>Sem tarefas previstas para os próximos 7 dias.</Text>
            ) : (
              agendaNextDays.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.agendaItem}
                  onPress={() => goToEventTab(item.eventId, 'timeline')}
                >
                  <Text style={styles.itemSub}>{item.dueAt.toLocaleDateString('pt-BR')}</Text>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemSub}>{item.eventName}</Text>
                </Pressable>
              ))
            )}
          </View>
        </View>
      </WalkthroughAnchorTarget>

      <Modal visible={shortcutModal.open} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecione o evento</Text>
            <Text style={styles.modalSub}>Este atalho depende do contexto de um evento.</Text>
            {activeEvents.length === 0 ? (
              <Text style={styles.cardSub}>Nenhum evento ativo disponível.</Text>
            ) : (
              activeEvents.map((eventItem) => (
                <Pressable
                  key={eventItem.id}
                  style={[
                    styles.eventChoice,
                    shortcutModal.eventId === eventItem.id ? styles.eventChoiceOn : null,
                  ]}
                  onPress={() =>
                    setShortcutModal((prev) => ({
                      ...prev,
                      eventId: eventItem.id,
                    }))
                  }
                >
                  <Text style={styles.eventChoiceText}>{eventItem.name}</Text>
                </Pressable>
              ))
            )}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalGhost}
                onPress={() => setShortcutModal({ open: false, shortcut: null, eventId: '' })}
              >
                <Text style={styles.modalGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.modalPrimary}
                onPress={confirmShortcut}
                disabled={!shortcutModal.eventId}
              >
                <Text style={styles.modalPrimaryText}>Continuar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function toBRL(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  err: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 8, textAlign: 'center' },
  pipelineEyebrow: { color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  pipelineRow: { flexDirection: 'row', gap: 8 },
  pipelineStat: { flex: 1, gap: 2 },
  pipelineValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  pipelineLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '600' },
  metricsSection: { gap: 10 },
  metricsRow: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 6 },
  metricLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  metricValue: { color: colors.text, fontSize: 30, fontWeight: '700' },
  metricValueSm: { color: colors.text, fontSize: 20, fontWeight: '700' },
  metricHint: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  metricHintGold: { color: colors.primaryStrong, fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardSub: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  item: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 8 },
  itemMain: { gap: 2 },
  itemTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  itemSub: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  itemAction: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  itemActionText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  shortcutGrid: { gap: 8 },
  shortcutsSection: { gap: 10 },
  shortcutButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 4, backgroundColor: colors.card },
  shortcutTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  shortcutSub: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  agendaItem: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  modalSub: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  eventChoice: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 },
  eventChoiceOn: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
  eventChoiceText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  modalGhost: { flex: 1, minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalGhostText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  modalPrimary: { flex: 1, minHeight: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalPrimaryText: { color: colors.primaryTextOn, fontWeight: '700', fontSize: 13 },
});
