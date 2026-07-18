import { Pressable, Text, TextInput } from 'react-native';

import { PtBrDateField } from '../../../components/ui/PremiumInputs';
import { EventEmptyState, EventFilterChips, EventFormSheet, EventListCard, EventModuleShell, EventSectionTitle } from '../EventWorkspace';
import { styles } from '../eventDetailsStyles';
import { priorityLabel } from '../eventWorkspaceUtils';

type TasksTabProps = {
  tasks: any[]; filteredCount: number; visibleLimit: number; summary: any;
  view: string; composerOpen: boolean; draftText: string; dueDate: string; notes: string;
  assignee: string; priority: 'low' | 'normal' | 'high' | 'urgent'; assigneeOptions: Array<{ value: string; label: string }>;
  selectedTask: any | null; taskNotes: string; hasMore: boolean; loadingMore: boolean;
  onViewChange: (value: string) => void; onOpenComposer: () => void; onCloseComposer: () => void;
  onDraftTextChange: (value: string) => void; onDueDateChange: (value: string) => void; onNotesChange: (value: string) => void;
  onAssigneeChange: (value: string) => void; onPriorityChange: (value: string) => void;
  onSelectTask: (task: any) => void; onSelectedTaskChange: (task: any) => void; onTaskNotesChange: (value: string) => void;
  onToggle: (task: any) => void; onCyclePriority: (task: any) => void; onDelete: (taskId: string) => void;
  onCreate: () => void; onSaveSelected: () => void; onShowMore: () => void; onLoadMore: () => void;
};

export function TasksTab(props: TasksTabProps) {
  const { tasks, filteredCount, visibleLimit, summary, view, composerOpen, draftText, dueDate, notes, assignee, priority,
    assigneeOptions, selectedTask, taskNotes, hasMore, loadingMore, onViewChange, onOpenComposer, onCloseComposer,
    onDraftTextChange, onDueDateChange, onNotesChange, onAssigneeChange, onPriorityChange, onSelectTask,
    onSelectedTaskChange, onTaskNotesChange, onToggle, onCyclePriority, onDelete, onCreate, onSaveSelected,
    onShowMore, onLoadMore } = props;
  return (
    <EventModuleShell title="Tarefas" description="O que precisa acontecer para este evento avançar." icon="checkbox-outline"
      metrics={[
        { label: 'Urgentes', value: tasks.filter((task) => !task.completed && task.priority === 'urgent').length, tone: 'danger' },
        { label: 'Pendentes', value: summary.pending, tone: summary.pending ? 'gold' : 'neutral' },
        { label: 'Atrasadas', value: summary.overdue, tone: summary.overdue ? 'danger' : 'neutral' },
        { label: 'Concluídas', value: summary.completed, tone: 'success' },
      ]} actionLabel="Nova tarefa" onAction={onOpenComposer}>
      <EventFilterChips selected={view} onSelect={onViewChange} options={[{ value: 'urgent', label: 'Urgentes' }, { value: 'pending', label: 'Pendentes' }, { value: 'overdue', label: 'Atrasadas' }, { value: 'completed', label: 'Concluídas' }]} />
      <EventSectionTitle title={view === 'urgent' ? 'Tarefas urgentes' : view === 'overdue' ? 'Tarefas atrasadas' : view === 'completed' ? 'Tarefas concluídas' : 'Tarefas pendentes'} />
      {tasks.length === 0 ? <EventEmptyState icon="checkmark-done-outline" title="Tudo organizado por aqui" description="Crie a primeira tarefa para acompanhar prazos e responsáveis." actionLabel="Criar tarefa" onAction={onOpenComposer} /> : null}
      {tasks.map((task) => <EventListCard key={task.id} title={String(task.text ?? 'Tarefa')} subtitle={task.notes ? String(task.notes) : 'Toque para ver detalhes e anotações'}
        onPress={() => onSelectTask(task)} status={task.completed ? 'Concluída' : priorityLabel(task.priority)}
        statusTone={task.completed ? 'success' : task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warning' : 'gold'}
        meta={[task.due_date ? `Prazo: ${new Date(task.due_date).toLocaleDateString('pt-BR')}` : 'Sem prazo', task.assignee_name ? `Responsável: ${task.assignee_name}` : 'Sem responsável']}
        actions={[
          { label: task.completed ? 'Reabrir' : 'Concluir', icon: task.completed ? 'refresh-outline' : 'checkmark-outline', onPress: () => onToggle(task) },
          { label: 'Prioridade', icon: 'flag-outline', onPress: () => onCyclePriority(task) },
          { label: 'Excluir', tone: 'danger', icon: 'trash-outline', onPress: () => onDelete(String(task.id)) },
        ]} />)}
      {filteredCount > visibleLimit ? <Pressable style={styles.btnGhostWide} onPress={onShowMore}><Text style={styles.smallText}>Mostrar mais ({filteredCount - visibleLimit} restantes)</Text></Pressable> : null}
      {hasMore ? <Pressable style={styles.btnGhostWide} onPress={onLoadMore}><Text style={styles.smallText}>{loadingMore ? 'Carregando...' : 'Carregar mais do servidor'}</Text></Pressable> : null}
      <EventFormSheet visible={composerOpen} title="Nova tarefa" subtitle="Defina apenas o necessário agora." onClose={onCloseComposer}>
        <Text style={styles.formLabel}>O que precisa ser feito?</Text><TextInput style={styles.input} value={draftText} onChangeText={onDraftTextChange} placeholder="Ex.: Confirmar horário com o buffet" />
        <Text style={styles.formLabel}>Prazo</Text><PtBrDateField value={dueDate} onChange={onDueDateChange} />
        <Text style={styles.formLabel}>Anotações (opcional)</Text><TextInput style={[styles.input, styles.area]} value={notes} onChangeText={onNotesChange} placeholder="Contexto, combinações ou detalhes importantes" multiline />
        <Text style={styles.formLabel}>Responsável (opcional)</Text><EventFilterChips selected={assignee} onSelect={onAssigneeChange} options={assigneeOptions} />
        <TextInput style={styles.input} value={assignee} onChangeText={onAssigneeChange} placeholder="Nome da pessoa" />
        <Text style={styles.formLabel}>Prioridade</Text><EventFilterChips selected={priority} onSelect={onPriorityChange} options={[{ value: 'low', label: 'Baixa' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'Alta' }, { value: 'urgent', label: 'Urgente' }]} />
        <Pressable style={styles.btn} onPress={onCreate}><Text style={styles.btnText}>Adicionar tarefa</Text></Pressable>
      </EventFormSheet>
      <EventFormSheet visible={Boolean(selectedTask)} title={String(selectedTask?.text ?? 'Detalhes da tarefa')} subtitle="Revise as informações sem perder o contexto." onClose={() => onSelectedTaskChange(null)}>
        <Text style={styles.formLabel}>Anotações</Text><TextInput style={[styles.input, styles.area]} value={taskNotes} onChangeText={onTaskNotesChange} placeholder="Adicione informações úteis para quem vai executar" multiline />
        <Text style={styles.formLabel}>Prazo</Text><PtBrDateField value={String(selectedTask?.due_date ?? '').slice(0, 10)} onChange={(value) => onSelectedTaskChange({ ...selectedTask, due_date: value })} />
        <Pressable style={styles.btn} onPress={onSaveSelected}><Text style={styles.btnText}>Salvar alterações</Text></Pressable>
      </EventFormSheet>
    </EventModuleShell>
  );
}
