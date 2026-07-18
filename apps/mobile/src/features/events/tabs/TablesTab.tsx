import { useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';

import { EventTablesVisualMap } from '../../../components/EventTablesVisualMap';
import {
  EventEmptyState,
  EventFilterChips,
  EventFormSheet,
  EventListCard,
  EventModuleShell,
} from '../EventWorkspace';
import { styles } from '../eventDetailsStyles';

type TablesDraft = { name: string; seats: string };

type TablesTabProps = {
  eventId: string;
  tables: any[];
  guests: any[];
  composerOpen: boolean;
  draft: TablesDraft;
  onDraftChange: (field: keyof TablesDraft, value: string) => void;
  onOpenComposer: () => void;
  onCloseComposer: () => void;
  onCreate: () => void;
  onAllocateNext: (tableId: string) => void;
  onDelete: (tableId: string) => void;
  onError: (message: string) => void;
  onReload: () => Promise<void>;
  onTablePositionLocalUpdate: (tableId: string, x: number, y: number) => void;
};

export function TablesTab({
  eventId,
  tables,
  guests,
  composerOpen,
  draft,
  onDraftChange,
  onOpenComposer,
  onCloseComposer,
  onCreate,
  onAllocateNext,
  onDelete,
  onError,
  onReload,
  onTablePositionLocalUpdate,
}: TablesTabProps) {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  return (
    <EventModuleShell
      title="Mesas"
      description="Organize lugares e acompanhe a ocupação do salão."
      icon="restaurant-outline"
      metrics={[
        { label: 'Mesas', value: tables.length, tone: 'gold' },
        { label: 'Lugares', value: tables.reduce((sum, table) => sum + Number(table.seats ?? 0), 0), tone: 'neutral' },
        { label: 'Alocados', value: guests.filter((guest) => guest.table_id).length, tone: 'success' },
      ]}
      actionLabel="Adicionar mesa"
      onAction={onOpenComposer}
    >
      <EventFilterChips
        selected={viewMode}
        onSelect={(value) => setViewMode(value as typeof viewMode)}
        options={[{ value: 'list', label: 'Lista' }, { value: 'map', label: 'Mapa visual' }]}
      />
      {viewMode === 'list' ? (
        <>
          {tables.length === 0 ? (
            <EventEmptyState
              icon="restaurant-outline"
              title="Mapa de mesas vazio"
              description="Crie as mesas para começar a distribuir os convidados."
              actionLabel="Criar mesa"
              onAction={onOpenComposer}
            />
          ) : null}
          {tables.map((table) => (
            <EventListCard
              key={table.id}
              title={String(table.name ?? 'Mesa')}
              status={`${guests.filter((guest) => guest.table_id === table.id).length}/${table.seats} lugares`}
              statusTone="gold"
              actions={[
                { label: 'Alocar próximo', icon: 'person-add-outline', onPress: () => onAllocateNext(String(table.id)) },
                { label: 'Excluir', icon: 'trash-outline', tone: 'danger', onPress: () => onDelete(String(table.id)) },
              ]}
            />
          ))}
        </>
      ) : (
        <EventTablesVisualMap
          eventId={eventId}
          tables={tables}
          guests={guests}
          onError={onError}
          onReload={onReload}
          onTablePositionLocalUpdate={onTablePositionLocalUpdate}
        />
      )}
      <EventFormSheet
        visible={composerOpen}
        title="Adicionar mesa"
        subtitle="Você poderá posicioná-la depois no mapa visual."
        onClose={onCloseComposer}
      >
        <Text style={styles.formLabel}>Nome da mesa</Text>
        <TextInput style={styles.input} value={draft.name} onChangeText={(value) => onDraftChange('name', value)} placeholder="Ex.: Mesa 01" />
        <Text style={styles.formLabel}>Quantidade de lugares</Text>
        <TextInput style={styles.input} value={draft.seats} onChangeText={(value) => onDraftChange('seats', value)} placeholder="8" keyboardType="numeric" />
        <Pressable style={styles.btn} onPress={onCreate}><Text style={styles.btnText}>Adicionar mesa</Text></Pressable>
      </EventFormSheet>
    </EventModuleShell>
  );
}
