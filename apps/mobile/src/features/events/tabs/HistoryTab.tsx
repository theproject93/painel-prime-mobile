import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card, Small } from '../EventDetailsParts';
import { getMilestoneColor } from '../eventDetailsUtils';
import { styles } from '../eventDetailsStyles';

export type HistoryTabModel = {
  history: Array<{ at: string; text: string }>;
  timelineNodes: any[];
  selectedId: string | null;
  progress: number;
  onFilterChange: (filter: any) => void;
  onSelect: (id: string) => void;
};

export function HistoryTab({ model: m }: { model: HistoryTabModel }) {
  return (
    <Card title="Histórico">
      <View style={styles.rowBtns}>
        <Small onPress={() => m.onFilterChange('all')}>Tudo</Small><Small onPress={() => m.onFilterChange('timeline')}>Timeline</Small>
        <Small onPress={() => m.onFilterChange('task')}>Tarefas</Small><Small onPress={() => m.onFilterChange('guest')}>Convidados</Small>
        <Small onPress={() => m.onFilterChange('payment')}>Pagamentos</Small><Small onPress={() => m.onFilterChange('document')}>Documentos</Small>
      </View>
      <View style={styles.historyVisualCard}>
        {m.timelineNodes.length === 0 ? <Text style={styles.caption}>Ainda não há marcos suficientes para montar a linha do projeto.</Text> : <>
          <View style={styles.historyTrack}><View style={[styles.historyTrackFill, { width: `${m.progress}%` }]} /></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyNodeRow}>
            {m.timelineNodes.map((item) => <Pressable key={item.id} style={[styles.historyNode, item.id === m.selectedId && styles.historyNodeSelected]} onPress={() => m.onSelect(item.id)}>
              <View style={[styles.historyNodeDot, { backgroundColor: getMilestoneColor(item.kind) }]} />
              <Text style={styles.historyNodeDay}>Dia {item.dayNumber}</Text><Text style={styles.historyNodeTitle}>{item.title}</Text>
              <Text style={styles.historyNodeDetail} numberOfLines={2}>{item.detail}</Text>
            </Pressable>)}
          </ScrollView>
        </>}
      </View>
      <View style={styles.historyList}>
        {m.history.map((item, index) => <View key={`${item.at}-${index}`} style={styles.historyItemRow}>
          <Text style={styles.historyAt}>{new Date(item.at).toLocaleString('pt-BR')}</Text><Text style={styles.historyText}>{item.text}</Text>
        </View>)}
        {m.history.length === 0 ? <Text style={styles.row}>Sem histórico.</Text> : null}
      </View>
    </Card>
  );
}
