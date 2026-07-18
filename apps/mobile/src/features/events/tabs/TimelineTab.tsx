import { Pressable, Text, TextInput, View } from 'react-native';
import { EventEmptyState, EventFilterChips, EventFormSheet, EventListCard, EventModuleShell, EventSectionTitle } from '../EventWorkspace';
import { styles } from '../eventDetailsStyles';
import { fmt } from '../eventDetailsUtils';

export type TimelineTabModel = {
  timeline: any[]; total: number; suggestions: any[]; loadingSuggestions: boolean; error: string | null; lastRunAt: string | null;
  composerOpen: boolean; time: string; activity: string; assignee: string; assigneeOptions: Array<{ value: string; label: string }>;
  hasMore: boolean; loadingMore: boolean; placeholder: string;
  onGenerate: () => void; onApply: (suggestion: any) => void; onDelete: (id: string) => void; onShowMore: () => void; onLoadMore: () => void;
  onOpenComposer: () => void; onCloseComposer: () => void; onTimeChange: (value: string) => void; onActivityChange: (value: string) => void;
  onAssigneeChange: (value: string) => void; onCreate: () => void;
};

export function TimelineTab({ model: m }: { model: TimelineTabModel }) {
  return (
    <EventModuleShell title="Cronograma do dia" description="O roteiro real do evento, do primeiro fornecedor à despedida." icon="calendar-outline"
      metrics={[{ label: 'Atividades', value: m.total, tone: 'gold' }, { label: 'Sugestões', value: m.suggestions.length, tone: 'info' }]}
      actionLabel="Adicionar ação do dia" onAction={m.onOpenComposer}>
      <View style={styles.cardSoft}><View style={styles.rowBetween}><View style={styles.grow}><Text style={styles.subtitle}>Cronograma inteligente</Text><Text style={styles.caption}>Sugestões locais + IA para o dia do evento.</Text></View><Pressable style={styles.btnGhost} onPress={m.onGenerate}><Text style={styles.smallText}>{m.loadingSuggestions ? 'Gerando...' : 'Gerar IA'}</Text></Pressable></View>
        {m.lastRunAt ? <Text style={styles.caption}>Última execução IA: {fmt(m.lastRunAt)}</Text> : null}
        {m.error ? <Text style={styles.err}>{m.error}</Text> : null}
        {m.suggestions.length === 0 ? <Text style={styles.caption}>Sem sugestoes pendentes.</Text> : m.suggestions.map((item) => <EventListCard key={item.id} title={item.title} subtitle={item.reason} meta={[`${item.time} • ${item.activity}`]} status="Sugestão" statusTone="info" actions={[{ label: 'Aplicar', icon: 'sparkles-outline', onPress: () => m.onApply(item) }]} />)}
      </View>
      <EventSectionTitle title="Roteiro do dia" />
      {m.timeline.length === 0 ? <EventEmptyState icon="calendar-outline" title="Cronograma ainda vazio" description="Adicione a primeira atividade ou gere sugestões inteligentes." actionLabel="Adicionar atividade" onAction={m.onOpenComposer} /> : null}
      {m.timeline.map((item) => <EventListCard key={item.id} title={String(item.activity ?? 'Atividade')} subtitle={item.assignee_name ? `Responsável: ${item.assignee_name}` : 'Sem responsável'} status={item.time || '--:--'} statusTone="gold" actions={[{ label: 'Excluir', icon: 'trash-outline', tone: 'danger', onPress: () => m.onDelete(String(item.id)) }]} />)}
      {m.total > m.timeline.length ? <Pressable style={styles.btnGhostWide} onPress={m.onShowMore}><Text style={styles.smallText}>Mostrar mais ({m.total - m.timeline.length} restantes)</Text></Pressable> : null}
      {m.hasMore ? <Pressable style={styles.btnGhostWide} onPress={m.onLoadMore}><Text style={styles.smallText}>{m.loadingMore ? 'Carregando...' : 'Carregar mais do servidor'}</Text></Pressable> : null}
      <EventFormSheet visible={m.composerOpen} title="Adicionar ao cronograma do dia" subtitle="Registre apenas o que acontece no dia deste evento." onClose={m.onCloseComposer}>
        <Text style={styles.formLabel}>Horário</Text><TextInput style={styles.input} value={m.time} onChangeText={m.onTimeChange} placeholder="HH:MM" />
        <Text style={styles.formLabel}>Atividade</Text><TextInput style={styles.input} value={m.activity} onChangeText={m.onActivityChange} placeholder={m.placeholder} />
        <Text style={styles.formLabel}>Responsável (opcional)</Text><EventFilterChips selected={m.assignee} onSelect={m.onAssigneeChange} options={m.assigneeOptions} />
        <TextInput style={styles.input} value={m.assignee} onChangeText={m.onAssigneeChange} placeholder="Ou escreva outro nome" />
        <Pressable style={styles.btn} onPress={m.onCreate}><Text style={styles.btnText}>Adicionar ao cronograma</Text></Pressable>
      </EventFormSheet>
    </EventModuleShell>
  );
}
