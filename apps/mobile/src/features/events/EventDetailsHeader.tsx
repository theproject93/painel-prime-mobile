import { Image, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PrimeLogoLoader } from '../../components/PrimeLogoLoader';
import { OptionPickerModal } from '../../components/ui/OptionPickerModal';
import { colors } from '../../theme/colors';
import type { EventRow } from './eventDetailsTypes';
import { styles } from './eventDetailsStyles';

export type EventBasicsDraft = {
  name: string;
  couple: string;
  eventDate: string;
  location: string;
};

type Props = {
  loadingTab: boolean;
  event: EventRow | null;
  displayName: string;
  uploadingPhoto: boolean;
  editingBasics: boolean;
  setEditingBasics: (value: boolean | ((current: boolean) => boolean)) => void;
  basicDraft: EventBasicsDraft;
  setBasicDraft: (value: EventBasicsDraft | ((current: EventBasicsDraft) => EventBasicsDraft)) => void;
  principalNamePlaceholder: string;
  savingBasics: boolean;
  activeTabLabel: string;
  activeTabIcon: any;
  modulePickerOpen: boolean;
  pickerOptions: any[];
  activeTab: string;
  error: string;
  onBack: () => void;
  onUploadPhoto: () => void;
  onSaveBasics: () => void;
  onOpenModulePicker: () => void;
  onSelectTab: (value: string) => void;
  onCloseModulePicker: () => void;
};

export function EventDetailsHeader(props: Props) {
  const { event, basicDraft } = props;
  return (
    <>
      <Modal visible={props.loadingTab} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.loadingOverlay}><PrimeLogoLoader variant="screen" label="Carregando esta área" /></View>
      </Modal>
      <Pressable onPress={props.onBack}><Text style={styles.back}>Voltar para eventos</Text></Pressable>
      {event ? (
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Pressable style={styles.heroAvatar} onPress={props.onUploadPhoto}>
              {event.couple_photo_url ? <Image source={{ uri: event.couple_photo_url }} style={styles.heroAvatarImage} />
                : <Text style={styles.heroAvatarFallback}>{props.displayName.charAt(0).toUpperCase()}</Text>}
            </Pressable>
            <View style={styles.heroMetaWrap}>
              <Text style={styles.title}>{props.displayName}</Text>
              <Text style={styles.meta}>{new Date(event.event_date).toLocaleDateString('pt-BR')} | {event.location || 'Sem local'}</Text>
              <Text style={styles.caption}>{props.uploadingPhoto ? 'Enviando foto...' : 'Toque na foto para alterar'}</Text>
            </View>
          </View>
          <View style={styles.heroActionRow}>
            <Pressable style={styles.btnGhost} onPress={() => props.setEditingBasics((current) => !current)}>
              <Text style={styles.smallText}>{props.editingBasics ? 'Fechar edição' : 'Editar evento'}</Text>
            </Pressable>
          </View>
          {props.editingBasics ? <View style={styles.cardSoft}>
            <TextInput style={styles.input} value={basicDraft.name} onChangeText={(name) => props.setBasicDraft((current) => ({ ...current, name }))} placeholder="Nome interno do evento" />
            <TextInput style={styles.input} value={basicDraft.couple} onChangeText={(couple) => props.setBasicDraft((current) => ({ ...current, couple }))} placeholder={props.principalNamePlaceholder} />
            <TextInput style={styles.input} value={basicDraft.eventDate} onChangeText={(eventDate) => props.setBasicDraft((current) => ({ ...current, eventDate }))} placeholder="Data (YYYY-MM-DD)" />
            <TextInput style={styles.input} value={basicDraft.location} onChangeText={(location) => props.setBasicDraft((current) => ({ ...current, location }))} placeholder="Local" />
            <View style={styles.rowBtns}>
              <Pressable style={styles.btnGhost} onPress={() => props.setEditingBasics(false)}><Text style={styles.smallText}>Cancelar</Text></Pressable>
              <Pressable style={styles.btn} onPress={props.onSaveBasics}><Text style={styles.btnText}>{props.savingBasics ? 'Salvando...' : 'Salvar dados'}</Text></Pressable>
            </View>
          </View> : null}
        </View>
      ) : null}
      <Pressable style={styles.compactPickerRow} onPress={props.onOpenModulePicker} accessibilityRole="button"
        accessibilityLabel={`Navegar pelas áreas do evento. Área atual: ${props.activeTabLabel}`}>
        <View style={styles.compactPickerIcon}><Ionicons name={props.activeTabIcon} size={22} color={colors.primaryStrong} accessible={false} /></View>
        <View style={styles.compactPickerTextGroup}><Text style={styles.compactPickerLabel}>Área do evento</Text><Text style={styles.compactPickerValue} numberOfLines={1}>{props.activeTabLabel}</Text></View>
        <View style={styles.compactPickerAction}><Text style={styles.compactPickerActionText}>Ver áreas</Text><Ionicons name="chevron-down" size={18} color={colors.primaryStrong} accessible={false} /></View>
      </Pressable>
      <OptionPickerModal visible={props.modulePickerOpen} title="Navegar pelo evento" options={props.pickerOptions}
        selectedValue={props.activeTab} variant="list" onSelect={props.onSelectTab} onClose={props.onCloseModulePicker} />
      {props.error ? <Text style={styles.err}>{props.error}</Text> : null}
    </>
  );
}
