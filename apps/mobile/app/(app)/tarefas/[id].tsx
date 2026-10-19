import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Badge } from '../../../src/components/ui/Badge';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { AppHaptics } from '../../../src/lib/haptics';
import { supabase } from '../../../src/lib/supabase';
import { colors, radii, shadows } from '../../../src/theme/colors';

interface TaskDetail {
  id: string;
  event_id?: string | null;
  text: string;
  notes?: string | null;
  due_date?: string | null;
  completed: boolean;
  priority?: 'low' | 'normal' | 'high' | 'urgent' | string | null;
  assignee_name?: string | null;
  position?: number | null;
  created_at?: string | null;
  event_name?: string | null;
}

function formatDueDate(dueDateStr: string | null | undefined): {
  text: string;
  isOverdue: boolean;
  isToday: boolean;
} {
  if (!dueDateStr) {
    return { text: 'Sem data de vencimento', isOverdue: false, isToday: false };
  }

  const cleanDate = dueDateStr.slice(0, 10);
  const parts = cleanDate.split('-');
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const targetDate = new Date(year, month, day);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const formatted = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;

    if (diffDays === 0) return { text: `Hoje (${formatted})`, isOverdue: false, isToday: true };
    if (diffDays === 1) return { text: `Amanhã (${formatted})`, isOverdue: false, isToday: false };
    if (diffDays === -1) return { text: `Ontem (${formatted})`, isOverdue: true, isToday: false };
    if (diffDays < -1) return { text: `${formatted} (Atrasada)`, isOverdue: true, isToday: false };

    return { text: formatted, isOverdue: false, isToday: false };
  }

  return { text: dueDateStr, isOverdue: false, isToday: false };
}

export default function TaskDetailRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const taskId = Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '';

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;
    let isMounted = true;

    async function loadTask() {
      setLoading(true);
      setError(null);
      try {
        const { data: rawTask, error: fetchErr } = await supabase
          .from('event_tasks')
          .select('id, event_id, text, completed, due_date, priority, position, notes, assignee_name, created_at')
          .eq('id', taskId)
          .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!isMounted) return;

        if (rawTask) {
          let eventName: string | null = null;
          if (rawTask.event_id) {
            const { data: eventData } = await supabase
              .from('events')
              .select('name')
              .eq('id', rawTask.event_id)
              .maybeSingle();

            if (eventData?.name) {
              eventName = eventData.name;
            }
          }

          setTask({
            id: rawTask.id,
            event_id: rawTask.event_id,
            text: rawTask.text || 'Tarefa',
            notes: rawTask.notes,
            due_date: rawTask.due_date,
            completed: Boolean(rawTask.completed),
            priority: rawTask.priority || 'normal',
            assignee_name: rawTask.assignee_name,
            position: rawTask.position,
            created_at: rawTask.created_at,
            event_name: eventName,
          });
        } else {
          setTask(null);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || 'Falha ao carregar os detalhes da tarefa.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadTask();

    return () => {
      isMounted = false;
    };
  }, [taskId]);

  const toggleTaskCompletion = async () => {
    if (!task || updating) return;
    setUpdating(true);

    const newCompleted = !task.completed;
    try {
      if (newCompleted) {
        AppHaptics.success();
      } else {
        AppHaptics.light();
      }

      const { error: updateErr } = await supabase
        .from('event_tasks')
        .update({
          completed: newCompleted,
        })
        .eq('id', task.id);

      if (updateErr) throw updateErr;

      setTask((prev) => (prev ? { ...prev, completed: newCompleted } : prev));
    } catch {
      AppHaptics.error();
    } finally {
      setUpdating(false);
    }
  };

  const dueInfo = formatDueDate(task?.due_date);

  const priorityVariant =
    task?.priority === 'urgent'
      ? 'danger'
      : task?.priority === 'high'
      ? 'warning'
      : task?.priority === 'low'
      ? 'info'
      : 'gold';

  const priorityText =
    task?.priority === 'urgent'
      ? 'Urgente'
      : task?.priority === 'high'
      ? 'Alta'
      : task?.priority === 'low'
      ? 'Baixa'
      : 'Normal';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            AppHaptics.light();
            router.back();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Detalhes da Tarefa
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {task?.event_name || 'Painel Prime'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando detalhes da tarefa...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={42} color={colors.dangerText} />
          <Text style={styles.errorTitle}>Não foi possível carregar</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={() => {
              AppHaptics.light();
              router.back();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.retryBtn}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Text style={styles.retryBtnText}>Voltar</Text>
          </Pressable>
        </View>
      ) : !task ? (
        <EmptyState
          iconName="alert-circle-outline"
          title="Tarefa não encontrada"
          message="Esta tarefa pode ter sido removida ou o identificador é inválido."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Main Card */}
          <View style={[styles.card, shadows.card]}>
            {/* Badges Row */}
            <View style={styles.badgesRow}>
              <Badge
                variant={task.completed ? 'success' : 'warning'}
                label={task.completed ? 'Concluída' : 'Pendente'}
                icon={task.completed ? 'checkmark-circle' : 'time'}
                size="md"
              />
              <Badge
                variant={priorityVariant}
                label={priorityText}
                icon={task.priority === 'urgent' ? 'flame' : 'flag'}
                size="md"
              />
              {dueInfo.isOverdue && !task.completed ? (
                <Badge variant="danger" label="Atrasada" icon="alert-circle" size="md" />
              ) : null}
            </View>

            {/* Title */}
            <Text
              style={[styles.taskTitle, task.completed && styles.taskTitleCompleted]}
              accessibilityRole="header"
            >
              {task.text}
            </Text>

            {/* Info Grid */}
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primaryStrong} />
                </View>
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoLabel}>Data de vencimento</Text>
                  <Text
                    style={[
                      styles.infoValue,
                      dueInfo.isOverdue && !task.completed && styles.infoValueOverdue,
                    ]}
                  >
                    {dueInfo.text}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="person-outline" size={18} color={colors.primaryStrong} />
                </View>
                <View style={styles.infoTextWrap}>
                  <Text style={styles.infoLabel}>Responsável</Text>
                  <Text style={styles.infoValue}>
                    {task.assignee_name || 'Não atribuído'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Description / Notes Section */}
            <View style={styles.notesSection}>
              <View style={styles.notesHeader}>
                <Ionicons name="document-text-outline" size={18} color={colors.primaryStrong} />
                <Text style={styles.notesHeaderTitle}>Descrição e Anotações</Text>
              </View>
              <Text style={styles.notesContent}>
                {task.notes && task.notes.trim().length > 0
                  ? task.notes
                  : 'Nenhuma anotação adicional informada para esta tarefa.'}
              </Text>
            </View>

            {/* Toggle Completion Button */}
            <Pressable
              onPress={toggleTaskCompletion}
              disabled={updating}
              style={({ pressed }) => [
                styles.actionBtn,
                task.completed ? styles.actionBtnIncomplete : styles.actionBtnComplete,
                pressed && styles.actionBtnPressed,
              ]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={task.completed ? 'Reabrir tarefa' : 'Marcar como concluída'}
            >
              {updating ? (
                <ActivityIndicator
                  size="small"
                  color={task.completed ? colors.primaryStrong : '#FFFFFF'}
                />
              ) : (
                <>
                  <Ionicons
                    name={task.completed ? 'refresh-outline' : 'checkmark-done-outline'}
                    size={20}
                    color={task.completed ? colors.primaryStrong : '#FFFFFF'}
                  />
                  <Text
                    style={[
                      styles.actionBtnText,
                      task.completed
                        ? styles.actionBtnTextIncomplete
                        : styles.actionBtnTextComplete,
                    ]}
                  >
                    {task.completed ? 'Reabrir Tarefa' : 'Marcar como Concluída'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Event Shortcut Card */}
          {task.event_id ? (
            <View style={[styles.eventCard, shadows.sm]}>
              <View style={styles.eventInfoWrap}>
                <View style={styles.eventIconContainer}>
                  <Ionicons name="calendar" size={22} color={colors.primaryStrong} />
                </View>
                <View style={styles.eventTextWrap}>
                  <Text style={styles.eventCardLabel}>Evento correspondente</Text>
                  <Text style={styles.eventCardName} numberOfLines={1}>
                    {task.event_name || 'Abrir evento'}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  AppHaptics.light();
                  router.push(`/(app)/eventos/${task.event_id}?initialTab=tasks` as any);
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={({ pressed }) => [
                  styles.openEventBtn,
                  pressed && styles.openEventBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Abrir tarefas deste evento"
              >
                <Text style={styles.openEventBtnText}>Ver no evento</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primaryStrong} />
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
    marginTop: 40,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  errorText: {
    fontSize: 14,
    color: colors.dangerText,
    textAlign: 'center',
  },
  retryBtn: {
    minHeight: 44,
    paddingHorizontal: 24,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  taskTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 26,
    marginBottom: 20,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  infoGrid: {
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  infoValueOverdue: {
    color: colors.dangerText,
  },
  notesSection: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 22,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  notesHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  notesContent: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
  },
  actionBtnComplete: {
    backgroundColor: colors.primaryStrong,
  },
  actionBtnIncomplete: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  actionBtnPressed: {
    opacity: 0.85,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionBtnTextComplete: {
    color: '#FFFFFF',
  },
  actionBtnTextIncomplete: {
    color: colors.primaryStrong,
  },
  eventCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eventInfoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  eventIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTextWrap: {
    flex: 1,
  },
  eventCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  openEventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  openEventBtnPressed: {
    opacity: 0.7,
  },
  openEventBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryStrong,
  },
});
