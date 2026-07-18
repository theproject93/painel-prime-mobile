import { Pressable, Text, TextInput } from 'react-native';

import {
  EventEmptyState,
  EventFormSheet,
  EventListCard,
  EventModuleShell,
  EventSectionTitle,
} from '../EventWorkspace';
import { styles } from '../eventDetailsStyles';

type NotesTabProps = {
  notes: any[];
  composerOpen: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onOpenComposer: () => void;
  onCloseComposer: () => void;
  onCreate: () => void;
  onDelete: (noteId: string) => void;
};

export function NotesTab({
  notes,
  composerOpen,
  draft,
  onDraftChange,
  onOpenComposer,
  onCloseComposer,
  onCreate,
  onDelete,
}: NotesTabProps) {
  return (
    <EventModuleShell
      title="Notas"
      description="Lembretes rápidos que ficam junto do evento."
      icon="create-outline"
      metrics={[{ label: 'Anotações', value: notes.length, tone: 'gold' }]}
      actionLabel="Nova nota"
      onAction={onOpenComposer}
    >
      <EventSectionTitle title="Anotações do evento" />
      {notes.length === 0 ? (
        <EventEmptyState
          icon="create-outline"
          title="Nenhuma nota ainda"
          description="Registre uma observação importante para a equipe."
          actionLabel="Criar nota"
          onAction={onOpenComposer}
        />
      ) : null}
      {notes.map((note) => (
        <EventListCard
          key={note.id}
          title={String(note.content ?? 'Nota')}
          status="Nota"
          statusTone="gold"
          actions={[{
            label: 'Excluir',
            icon: 'trash-outline',
            tone: 'danger',
            onPress: () => onDelete(String(note.id)),
          }]}
        />
      ))}
      <EventFormSheet visible={composerOpen} title="Nova nota" onClose={onCloseComposer}>
        <Text style={styles.formLabel}>Observação</Text>
        <TextInput
          style={[styles.input, styles.area]}
          value={draft}
          onChangeText={onDraftChange}
          placeholder="Escreva o que a equipe precisa lembrar"
          multiline
        />
        <Pressable style={styles.btn} onPress={onCreate}>
          <Text style={styles.btnText}>Salvar nota</Text>
        </Pressable>
      </EventFormSheet>
    </EventModuleShell>
  );
}
