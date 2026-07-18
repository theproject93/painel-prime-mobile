import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { styles } from './eventDetailsStyles';

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.card}><Text style={styles.subtitle}>{title}</Text>{children}</View>;
}

export function CommandLine({ level, text }: { level: 'low' | 'medium' | 'high'; text: string }) {
  const tone = level === 'high'
    ? styles.commandHigh
    : level === 'medium'
      ? styles.commandMedium
      : styles.commandLow;

  return <View style={[styles.commandLine, tone]}><Text style={styles.commandText}>{text}</Text></View>;
}

export function Item({ text, children }: { text: string; children: ReactNode }) {
  return <View style={styles.item}><Text style={styles.row}>{text}</Text><View style={styles.rowBtns}>{children}</View></View>;
}

export function Small({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  return <Pressable style={styles.btnGhost} onPress={onPress}><Text style={styles.smallText}>{children}</Text></Pressable>;
}

export function Danger({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  return <Pressable style={styles.btnDelete} onPress={onPress}><Text style={styles.delText}>{children}</Text></Pressable>;
}

export function TaskSegment({
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
  const toneStyle = tone === 'error'
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
