import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  EventFilterChips,
  EventFormSheet,
  EventListCard,
  EventModuleShell,
  EventSectionTitle,
} from '../EventWorkspace';
import { styles } from '../eventDetailsStyles';
import { guestStatusLabel } from '../eventWorkspaceUtils';
import type { EventRow } from '../eventDetailsTypes';
import { colors } from '../../../theme/colors';

type InviteDraft = { template: string; dressCode: string };

type InvitesTabProps = {
  event: EventRow | null;
  summary: { pending: number; confirmed: number; declined: number };
  guests: any[];
  filteredCount: number;
  visibleLimit: number;
  search: string;
  filter: string;
  composerOpen: boolean;
  draft: InviteDraft;
  uploadingImage: boolean;
  hasMoreServer: boolean;
  loadingMore: boolean;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onDraftChange: (field: keyof InviteDraft, value: string) => void;
  onOpenComposer: () => void;
  onCloseComposer: () => void;
  onUploadImage: () => void;
  onDispatchBulk: () => void;
  onDispatchSingle: (guestId: string) => void;
  onResendQr: (guestId: string) => void;
  onShareFiltered: () => void;
  onShareGuest: (guest: any) => void;
  onShowMore: () => void;
  onLoadMore: () => void;
  onSaveConfig: () => void;
};

export function InvitesTab({
  event,
  summary,
  guests,
  filteredCount,
  visibleLimit,
  search,
  filter,
  composerOpen,
  draft,
  uploadingImage,
  hasMoreServer,
  loadingMore,
  onSearchChange,
  onFilterChange,
  onDraftChange,
  onOpenComposer,
  onCloseComposer,
  onUploadImage,
  onDispatchBulk,
  onDispatchSingle,
  onResendQr,
  onShareFiltered,
  onShareGuest,
  onShowMore,
  onLoadMore,
  onSaveConfig,
}: InvitesTabProps) {
  return (
    <EventModuleShell
      title="Convites"
      description="Envie o RSVP certo para cada convidado."
      icon="mail-outline"
      metrics={[
        { label: 'Aguardando', value: summary.pending, tone: 'warning' },
        { label: 'Confirmados', value: summary.confirmed, tone: 'success' },
        { label: 'Não vão', value: summary.declined, tone: 'danger' },
      ]}
      actionLabel="Configurar convite"
      onAction={onOpenComposer}
    >
      <View style={styles.inviteHero}>
        {event?.whatsapp_image_url ? (
          <Image source={{ uri: event.whatsapp_image_url }} style={styles.inviteHeroImage} />
        ) : (
          <View style={styles.inviteHeroPlaceholder}>
            <Ionicons name="image-outline" size={34} color={colors.gold700} />
            <Text style={styles.caption}>Imagem de destaque do WhatsApp</Text>
          </View>
        )}
        <View style={styles.inviteHeroActions}>
          <Pressable style={styles.btnGhost} onPress={onUploadImage}>
            <Text style={styles.smallText}>
              {uploadingImage ? 'Enviando...' : event?.whatsapp_image_file_id ? 'Trocar imagem' : 'Adicionar imagem'}
            </Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={onDispatchBulk}>
            <Text style={styles.btnText}>Disparar pendentes no WhatsApp</Text>
          </Pressable>
        </View>
      </View>

      <TextInput style={styles.input} value={search} onChangeText={onSearchChange} placeholder="Buscar convidado" />
      <EventFilterChips
        selected={filter}
        onSelect={onFilterChange}
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'pending', label: 'Aguardando' },
          { value: 'confirmed', label: 'Confirmados' },
          { value: 'declined', label: 'Não vão' },
        ]}
      />
      <EventSectionTitle title="Convidados" actionLabel="Compartilhar lista" onAction={onShareFiltered} />
      {guests.map((guest) => (
        <EventListCard
          key={guest.id}
          title={String(guest.name ?? 'Convidado')}
          subtitle={guest.phone || 'Telefone não informado'}
          status={guestStatusLabel(guest.rsvp_status)}
          statusTone={guest.rsvp_status === 'confirmed' ? 'success' : guest.rsvp_status === 'declined' ? 'danger' : 'warning'}
          actions={[
            { label: 'Enviar WhatsApp', icon: 'logo-whatsapp', onPress: () => onDispatchSingle(String(guest.id)) },
            ...(guest.rsvp_status === 'confirmed'
              ? [{ label: 'Reenviar QR Code', icon: 'qr-code-outline' as const, onPress: () => onResendQr(String(guest.id)) }]
              : []),
            { label: 'Compartilhar convite', icon: 'share-outline', onPress: () => onShareGuest(guest) },
          ]}
        />
      ))}
      {filteredCount > visibleLimit ? (
        <Pressable style={styles.btnGhostWide} onPress={onShowMore}>
          <Text style={styles.smallText}>Mostrar mais ({filteredCount - visibleLimit} restantes)</Text>
        </Pressable>
      ) : null}
      {hasMoreServer ? (
        <Pressable style={styles.btnGhostWide} onPress={onLoadMore}>
          <Text style={styles.smallText}>{loadingMore ? 'Carregando...' : 'Carregar mais do servidor'}</Text>
        </Pressable>
      ) : null}

      <EventFormSheet
        visible={composerOpen}
        title="Configurar convite"
        subtitle="Personalize a mensagem enviada aos convidados."
        onClose={onCloseComposer}
      >
        <Text style={styles.formLabel}>Mensagem</Text>
        <TextInput
          style={[styles.input, styles.area]}
          value={draft.template}
          onChangeText={(value) => onDraftChange('template', value)}
          placeholder="Use [Nome do Convidado] e [LinkRSVP]"
          multiline
        />
        <Text style={styles.formLabel}>Código de vestimenta (opcional)</Text>
        <TextInput
          style={styles.input}
          value={draft.dressCode}
          onChangeText={(value) => onDraftChange('dressCode', value)}
          placeholder="Ex.: Esporte fino"
        />
        <Pressable style={styles.btn} onPress={onSaveConfig}><Text style={styles.btnText}>Salvar configuração</Text></Pressable>
      </EventFormSheet>
    </EventModuleShell>
  );
}
