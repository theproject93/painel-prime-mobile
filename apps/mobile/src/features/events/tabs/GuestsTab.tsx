import { Pressable, Text, TextInput } from 'react-native';
import { EventEmptyState, EventFilterChips, EventFormSheet, EventListCard, EventModuleShell, EventSectionTitle } from '../EventWorkspace';
import { guestStatusLabel } from '../eventWorkspaceUtils';
import { styles } from '../eventDetailsStyles';

export type GuestsTabModel = {
  summary: any; guests: any[]; search: string; filter: string; sort: string; composerOpen: boolean; name: string; phone: string;
  onSearchChange: (value: string) => void; onFilterChange: (value: string) => void; onToggleSort: () => void;
  onOpenComposer: () => void; onCloseComposer: () => void; onNameChange: (value: string) => void; onPhoneChange: (value: string) => void;
  onConfirm: (id: string) => void; onDecline: (id: string) => void; onDelete: (id: string) => void; onCreate: () => void;
};

export function GuestsTab({ model: m }: { model: GuestsTabModel }) {
  return (
    <EventModuleShell title="Convidados" description="Confirmações claras, sem planilha no caminho." icon="people-outline"
      metrics={[{ label: 'Total', value: m.summary.total, tone: 'neutral' }, { label: 'Confirmados', value: m.summary.confirmed, tone: 'success' }, { label: 'Aguardando', value: m.summary.pending, tone: 'warning' }]}
      actionLabel="Adicionar convidado" onAction={m.onOpenComposer}>
      <TextInput style={styles.input} value={m.search} onChangeText={m.onSearchChange} placeholder="Buscar por nome ou telefone" />
      <EventFilterChips selected={m.filter} onSelect={m.onFilterChange} options={[{ value: 'all', label: 'Todos' }, { value: 'pending', label: 'Aguardando' }, { value: 'confirmed', label: 'Confirmados' }, { value: 'declined', label: 'Não vão' }]} />
      <EventSectionTitle title="Lista de convidados" actionLabel={m.sort === 'name_asc' ? 'A–Z' : 'Z–A'} onAction={m.onToggleSort} />
      {m.guests.length === 0 ? <EventEmptyState icon="people-outline" title="Nenhum convidado aqui" description="Adicione pessoas ou altere o filtro para acompanhar as confirmações." actionLabel="Adicionar convidado" onAction={m.onOpenComposer} /> : null}
      {m.guests.map((guest) => <EventListCard key={guest.id} title={String(guest.name ?? 'Convidado')} subtitle={guest.phone || 'Telefone não informado'} status={guestStatusLabel(guest.rsvp_status)} statusTone={guest.rsvp_status === 'confirmed' ? 'success' : guest.rsvp_status === 'declined' ? 'danger' : 'warning'} actions={[
        { label: 'Confirmar', icon: 'checkmark-outline', onPress: () => m.onConfirm(String(guest.id)) },
        { label: 'Não vai', icon: 'close-outline', onPress: () => m.onDecline(String(guest.id)) },
        { label: 'Excluir', icon: 'trash-outline', tone: 'danger', onPress: () => m.onDelete(String(guest.id)) },
      ]} />)}
      <EventFormSheet visible={m.composerOpen} title="Adicionar convidado" subtitle="Você pode completar os detalhes depois." onClose={m.onCloseComposer}>
        <Text style={styles.formLabel}>Nome</Text><TextInput style={styles.input} value={m.name} onChangeText={m.onNameChange} placeholder="Nome do convidado" />
        <Text style={styles.formLabel}>Telefone (opcional)</Text><TextInput style={styles.input} value={m.phone} onChangeText={m.onPhoneChange} placeholder="(11) 99999-9999" keyboardType="phone-pad" />
        <Pressable style={styles.btn} onPress={m.onCreate}><Text style={styles.btnText}>Adicionar convidado</Text></Pressable>
      </EventFormSheet>
    </EventModuleShell>
  );
}
