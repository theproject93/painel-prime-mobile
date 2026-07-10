import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

type EventRef = {
  id: string;
  name: string;
  event_date: string;
  status: string | null;
};

type TaskItem = {
  id: string;
  event_id: string;
  text: string;
  completed: boolean;
  due_date: string | null;
  created_at: string | null;
};

const PAGE_SIZE = 40;

export function PlanningScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [eventsById, setEventsById] = useState<Record<string, EventRef>>({});
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [page, setPage] = useState(-1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  const fetchTasks = useCallback(
    async (mode: 'reset' | 'append' = 'reset') => {
      if (!user) {
        setLoading(false);
        return;
      }
      if (mode === 'append' && (!hasMore || loadingMore)) return;
      if (mode === 'reset') {
        setLoading(true);
        setPage(-1);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }
      setError('');

      const nextPage = mode === 'reset' ? 0 : page + 1;
      const from = nextPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id,name,event_date,status')
        .eq('user_id', user.id)
        .or('status.is.null,status.neq.deleted')
        .order('event_date', { ascending: true });
      if (eventsError) {
        setError(eventsError.message);
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      const evRows = (events ?? []) as EventRef[];
      const eventIds = evRows.map((e) => e.id);
      setEventsById(Object.fromEntries(evRows.map((e) => [e.id, e])));

      if (eventIds.length === 0) {
        setTasks([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const { data, error: tasksError } = await supabase
        .from('event_tasks')
        .select('id,event_id,text,completed,due_date,created_at')
        .in('event_id', eventIds)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (tasksError) {
        setError(tasksError.message);
      } else {
        const rows = (data ?? []) as TaskItem[];
        setTasks((prev) => {
          if (mode === 'reset') return rows;
          const ids = new Set(prev.map((t) => t.id));
          return [...prev, ...rows.filter((r) => !ids.has(r.id))];
        });
        setPage(nextPage);
        setHasMore(rows.length === PAGE_SIZE);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [hasMore, loadingMore, page, user],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchTasks('reset');
    }, [fetchTasks]),
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter === 'pending' && task.completed) return false;
      if (statusFilter === 'completed' && !task.completed) return false;
      if (!term) return true;
      const eventName = eventsById[task.event_id]?.name ?? '';
      return `${task.text} ${eventName}`.toLowerCase().includes(term);
    });
  }, [eventsById, search, statusFilter, tasks]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed).length;
    return { total, completed, pending: total - completed };
  }, [tasks]);

  function confirmBatch(action: 'complete' | 'reopen' | 'delete') {
    const message =
      action === 'complete'
        ? 'Concluir tarefas filtradas?'
        : action === 'reopen'
          ? 'Reabrir tarefas filtradas?'
          : 'Excluir tarefas filtradas?';
    Alert.alert('Confirmar', message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: action === 'delete' ? 'Excluir' : 'Confirmar',
        style: action === 'delete' ? 'destructive' : 'default',
        onPress: () => {
          void (async () => {
            const ids = filtered.map((t) => t.id);
            if (ids.length === 0) return;
            if (action === 'delete') {
              const { error: updateError } = await supabase.from('event_tasks').delete().in('id', ids);
              if (updateError) {
                setError(updateError.message);
                return;
              }
            } else {
              const { error: updateError } = await supabase
                .from('event_tasks')
                .update({ completed: action === 'complete' })
                .in('id', ids);
              if (updateError) {
                setError(updateError.message);
                return;
              }
            }
            await fetchTasks('reset');
          })();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryStrong} />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Planejamento</Text>
        <Pressable style={styles.btnGhost} onPress={() => void fetchTasks('reset')}>
          <Text style={styles.btnGhostText}>Atualizar</Text>
        </Pressable>
      </View>
      <Text style={styles.subtitle}>Tarefas reais dos seus eventos</Text>

      {error ? <Text style={styles.err}>{error}</Text> : null}

              <View style={styles.filtersBlock}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>Total: {stats.total}</Text>
            <Text style={styles.summaryText}>Pendentes: {stats.pending}</Text>
            <Text style={styles.summaryText}>Concluidas: {stats.completed}</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Buscar tarefa ou evento"
            placeholderTextColor={colors.mutedText}
            value={search}
            onChangeText={setSearch}
          />

          <View style={styles.row}>
            <Pill label="Pendentes" selected={statusFilter === 'pending'} onPress={() => setStatusFilter('pending')} />
            <Pill label="Concluidas" selected={statusFilter === 'completed'} onPress={() => setStatusFilter('completed')} />
            <Pill label="Todas" selected={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
          </View>

          <View style={styles.row}>
            <Pressable style={styles.btnGhost} onPress={() => confirmBatch('complete')}>
              <Text style={styles.btnGhostText}>Concluir filtradas</Text>
            </Pressable>
            <Pressable style={styles.btnGhost} onPress={() => confirmBatch('reopen')}>
              <Text style={styles.btnGhostText}>Reabrir filtradas</Text>
            </Pressable>
            <Pressable style={styles.btnDanger} onPress={() => confirmBatch('delete')}>
              <Text style={styles.btnDangerText}>Excluir filtradas</Text>
            </Pressable>
          </View>
        </View>

              <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const event = eventsById[item.event_id];
            return (
              <View style={styles.item}>
                <Text style={styles.itemText}>{item.text}</Text>
                <Text style={styles.itemMeta}>Evento: {event?.name ?? item.event_id}</Text>
                <Text style={styles.itemMeta}>
                  {item.completed ? 'Concluida' : 'Pendente'} | {item.due_date || 'Sem prazo'}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Nenhuma tarefa encontrada.</Text>}
          ListFooterComponent={
            hasMore ? (
              <Pressable style={styles.loadMore} onPress={() => void fetchTasks('append')}>
                {loadingMore ? (
                  <ActivityIndicator color={colors.primaryStrong} />
                ) : (
                  <Text style={styles.loadMoreText}>Carregar mais do servidor</Text>
                )}
              </Pressable>
            ) : null
          }
        />

    </View>
  );
}

function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.pill, selected ? styles.pillOn : null]} onPress={onPress}>
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background, padding: 16 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  subtitle: { color: colors.mutedText, fontSize: 13, marginTop: 2, marginBottom: 8 },
  err: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 8, marginBottom: 8, textAlign: 'center' },
  filtersBlock: { gap: 8 },
  summaryCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, gap: 2, marginBottom: 8 },
  summaryText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: colors.text, backgroundColor: colors.card },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  btnGhost: { minHeight: 36, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, backgroundColor: colors.card },
  btnGhostText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  btnDanger: { minHeight: 36, borderWidth: 1, borderColor: '#FECACA', backgroundColor: colors.dangerBg, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  btnDangerText: { color: colors.dangerText, fontWeight: '700', fontSize: 12 },
  pill: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.card },
  pillOn: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
  pillText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  listWrap: { flex: 1 },
  list: { gap: 8, paddingTop: 8, paddingBottom: 20 },
  item: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, gap: 2 },
  itemText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  itemMeta: { color: colors.mutedText, fontSize: 12 },
  empty: { textAlign: 'center', color: colors.mutedText, marginTop: 20 },
  loadMore: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  loadMoreText: { color: colors.text, fontWeight: '600', fontSize: 13 },
});
