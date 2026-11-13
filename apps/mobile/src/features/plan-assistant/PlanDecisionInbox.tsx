import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import type { PlanAiThread } from './planAssistantThreads';
import {
  effectiveDecisionStatus,
  type PlanDecision,
  type PlanDecisionStatus,
} from './planDecisionModel';

type StatusFilter = 'all' | 'pending' | 'executed' | 'failed';

const STATUS_LABELS: Record<PlanDecisionStatus, string> = {
  pending: 'Aguardando confirmação',
  executed: 'Executada',
  failed: 'Resultado não verificado',
  cancelled: 'Descartada neste aparelho',
  expired: 'Expirada',
};

export function PlanDecisionInbox(props: {
  visible: boolean;
  decisions: PlanDecision[];
  threads: PlanAiThread[];
  currentEventId: string | null;
  onClose: () => void;
  onOpenConversation: (thread: PlanAiThread) => void;
}) {
  const insets = useSafeAreaInsets();
  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [nowMs, setNowMs] = useState(Date.now());
  const [eventNames, setEventNames] = useState<Record<string, string>>({});
  const [loadingEvents, setLoadingEvents] = useState(false);
  const eventIds = useMemo(() => [...new Set(props.decisions.map((item) => item.eventId).filter((id): id is string => Boolean(id)))], [props.decisions]);
  const eventKey = eventIds.join(',');

  useEffect(() => {
    if (props.visible) {
      setEventFilter(props.currentEventId);
      setStatusFilter('all');
      setNowMs(Date.now());
    }
  }, [props.visible, props.currentEventId]);

  useEffect(() => {
    if (!props.visible) return;
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [props.visible]);

  useEffect(() => {
    if (!props.visible || eventIds.length === 0) return;
    let active = true;
    setLoadingEvents(true);
    void supabase.from('events').select('id,name').in('id', eventIds).limit(100).then(({ data, error }) => {
      if (!active) return;
      if (!error && data) {
        setEventNames(Object.fromEntries(data.map((item) => [item.id, item.name])));
      }
      setLoadingEvents(false);
    });
    return () => { active = false; };
  }, [props.visible, eventKey]);

  const visibleDecisions = props.decisions.filter((decision) => {
    if (eventFilter === 'none' && decision.eventId) return false;
    if (eventFilter && eventFilter !== 'none' && decision.eventId !== eventFilter) return false;
    const status = effectiveDecisionStatus(decision, nowMs);
    return statusFilter === 'all' || status === statusFilter;
  });
  const threadById = new Map(props.threads.map((thread) => [thread.id, thread]));

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Ionicons name="file-tray-full-outline" size={23} color={colors.primaryStrong} />
            <View>
              <Text style={styles.title}>Caixa de decisões</Text>
              <Text style={styles.subtitle}>Propostas da Plan IA neste aparelho</Text>
            </View>
          </View>
          <Pressable onPress={props.onClose} accessibilityRole="button" accessibilityLabel="Fechar caixa de decisões" hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>EVENTO</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <FilterChip label="Todos" active={!eventFilter} onPress={() => setEventFilter(null)} />
            {eventIds.map((id) => <FilterChip key={id} label={eventNames[id] || (loadingEvents ? 'Carregando…' : 'Evento')} active={eventFilter === id} onPress={() => setEventFilter(id)} />)}
            {props.decisions.some((item) => !item.eventId) ? <FilterChip label="Sem evento" active={eventFilter === 'none'} onPress={() => setEventFilter('none')} /> : null}
          </ScrollView>

          <Text style={styles.sectionLabel}>SITUAÇÃO</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <FilterChip label="Todas" active={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
            <FilterChip label="Pendentes" active={statusFilter === 'pending'} onPress={() => setStatusFilter('pending')} />
            <FilterChip label="Executadas" active={statusFilter === 'executed'} onPress={() => setStatusFilter('executed')} />
            <FilterChip label="Falhas" active={statusFilter === 'failed'} onPress={() => setStatusFilter('failed')} />
          </ScrollView>

          <View style={styles.listHeader}>
            <Text style={styles.sectionLabel}>DECISÕES ({visibleDecisions.length})</Text>
            {loadingEvents ? <ActivityIndicator size="small" color={colors.primaryStrong} /> : null}
          </View>
          {visibleDecisions.length === 0 ? (
            <View style={styles.empty}><Ionicons name="checkmark-circle-outline" size={30} color={colors.mutedText} /><Text style={styles.emptyText}>Nenhuma decisão neste filtro.</Text></View>
          ) : visibleDecisions.map((decision) => {
            const status = effectiveDecisionStatus(decision, nowMs);
            const thread = decision.threadId ? threadById.get(decision.threadId) : undefined;
            return <View key={decision.proposalId} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.eventName} numberOfLines={1}>{decision.eventId ? eventNames[decision.eventId] || 'Evento' : 'Sem evento'}</Text>
                <Text style={styles.date}>{new Date(decision.createdAt).toLocaleDateString('pt-BR')}</Text>
              </View>
              <Text style={styles.cardTitle}>{decision.title}</Text>
              {decision.description ? <Text style={styles.description} numberOfLines={3}>{decision.description}</Text> : null}
              <Text style={[styles.status, status === 'failed' && styles.failed, status === 'executed' && styles.executed]}>{STATUS_LABELS[status]}</Text>
              {decision.result ? <Text style={styles.result} numberOfLines={3}>{decision.result}</Text> : null}
              {(status === 'pending' || status === 'failed') && thread ? <Text style={styles.guidance}>Confira a conversa antes de tentar novamente. Se o cartão não aparecer, peça uma nova proposta à Plan IA.</Text> : null}
              {thread ? <Pressable style={styles.openButton} onPress={() => props.onOpenConversation(thread)} accessibilityRole="button" accessibilityLabel={`Abrir conversa de ${decision.title}`}>
                <Text style={styles.openText}>Abrir conversa</Text><Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </Pressable> : <Text style={styles.unavailable}>Conversa não encontrada no histórico recente.</Text>}
            </View>;
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

function FilterChip(props: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable style={[styles.chip, props.active && styles.chipActive]} onPress={props.onPress} accessibilityRole="button" accessibilityState={{ selected: props.active }}><Text style={[styles.chipText, props.active && styles.chipTextActive]} numberOfLines={1}>{props.label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8FA' },
  header: { paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 19, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 11, color: colors.mutedText, marginTop: 2 },
  content: { padding: 20, paddingBottom: 36, gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.mutedText },
  filters: { gap: 8, paddingBottom: 8 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#FFFFFF', maxWidth: 190 },
  chipActive: { backgroundColor: colors.primaryStrong, borderColor: colors.primaryStrong },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.text },
  chipTextActive: { color: '#FFFFFF' },
  listHeader: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empty: { alignItems: 'center', gap: 9, padding: 36 },
  emptyText: { color: colors.mutedText, fontSize: 13 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 16, gap: 8, marginBottom: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  eventName: { fontSize: 11, fontWeight: '700', color: colors.primaryStrong, flex: 1 },
  date: { fontSize: 11, color: colors.mutedText },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  description: { fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  status: { fontSize: 11, fontWeight: '800', color: '#A16207' },
  failed: { color: '#B91C1C' },
  executed: { color: '#047857' },
  result: { fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  guidance: { fontSize: 11, lineHeight: 16, color: colors.mutedText },
  openButton: { alignSelf: 'flex-start', flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 9, backgroundColor: colors.primaryStrong },
  openText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  unavailable: { fontSize: 11, color: colors.mutedText },
});
