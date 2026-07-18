import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  EventEmptyState,
  EventFormSheet,
  EventListCard,
  EventModuleShell,
  EventSectionTitle,
} from '../EventWorkspace';
import { styles } from '../eventDetailsStyles';
import { colors } from '../../../theme/colors';

type TeamDraft = { name: string; phone: string; role: string };

type TeamTabProps = {
  members: any[];
  directory: any[];
  composerOpen: boolean;
  draft: TeamDraft;
  uploadingMemberId: string | null;
  onDraftChange: (field: keyof TeamDraft, value: string) => void;
  onOpenComposer: () => void;
  onCloseComposer: () => void;
  onManageDirectory: () => void;
  onAssignDirectoryMembers: (team: any, members: any[]) => void;
  onUploadPhoto: (member: any) => void;
  onDelete: (memberId: string) => void;
  onCreate: () => void;
};

export function TeamTab({
  members,
  directory,
  composerOpen,
  draft,
  uploadingMemberId,
  onDraftChange,
  onOpenComposer,
  onCloseComposer,
  onManageDirectory,
  onAssignDirectoryMembers,
  onUploadPhoto,
  onDelete,
  onCreate,
}: TeamTabProps) {
  return (
    <EventModuleShell
      title="Equipe"
      description="Quem faz o evento acontecer e como entrar em contato."
      icon="people-circle-outline"
      metrics={[{ label: 'Pessoas', value: members.length, tone: 'info' }]}
      actionLabel="Adicionar à equipe"
      onAction={onOpenComposer}
    >
      {directory.length ? (
        <View style={styles.directoryBlock}>
          <View style={styles.rowBetween}>
            <View style={styles.formGrow}>
              <Text style={styles.subtitle}>Sua equipe cadastrada</Text>
              <Text style={styles.caption}>Escale uma equipe completa ou apenas uma pessoa, sem redigitar dados.</Text>
            </View>
            <Pressable onPress={onManageDirectory}><Text style={styles.directoryLink}>Gerenciar</Text></Pressable>
          </View>
          {directory.map((team) => (
            <View key={team.id} style={styles.directoryTeam}>
              <View style={styles.rowBetween}>
                <View style={styles.formGrow}>
                  <Text style={styles.directoryTitle}>{team.name}</Text>
                  <Text style={styles.caption}>{team.members.length} pessoa{team.members.length === 1 ? '' : 's'}</Text>
                </View>
                <Pressable style={styles.directoryAssign} onPress={() => onAssignDirectoryMembers(team, team.members)}>
                  <Text style={styles.directoryAssignText}>Escalar equipe</Text>
                </Pressable>
              </View>
              <View style={styles.directoryPeople}>
                {team.members.map((member: any) => (
                  <Pressable key={member.id} style={styles.directoryPerson} onPress={() => onAssignDirectoryMembers(team, [member])}>
                    <Ionicons name="add-circle-outline" size={16} color={colors.gold700} />
                    <Text style={styles.directoryPersonText}>{member.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Pressable style={styles.directoryEmpty} onPress={onManageDirectory}>
          <Ionicons name="people-circle-outline" size={25} color={colors.gold700} />
          <View style={styles.formGrow}>
            <Text style={styles.directoryTitle}>Cadastre sua equipe fixa</Text>
            <Text style={styles.caption}>Depois, escale as pessoas certas em poucos toques.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
        </Pressable>
      )}

      <EventSectionTitle title="Equipe escalada" />
      {members.length === 0 ? (
        <EventEmptyState
          icon="people-circle-outline"
          title="Equipe ainda não definida"
          description="Adicione cerimonialistas e profissionais responsáveis pela operação."
          actionLabel="Adicionar pessoa"
          onAction={onOpenComposer}
        />
      ) : null}
      {members.map((member) => (
        <View key={member.id} style={styles.teamMemberWrap}>
          <Pressable
            style={styles.teamPhotoButton}
            onPress={() => onUploadPhoto(member)}
            accessibilityLabel={`Adicionar foto de ${member.name}`}
          >
            {member.photo_url ? (
              <Image source={{ uri: String(member.photo_url) }} style={styles.teamPhoto} />
            ) : (
              <Ionicons name="camera-outline" size={24} color={colors.gold700} />
            )}
            <Text style={styles.teamPhotoText}>
              {uploadingMemberId === String(member.id) ? 'Enviando...' : member.photo_url ? 'Trocar foto' : 'Adicionar foto'}
            </Text>
          </Pressable>
          <View style={styles.formGrow}>
            <EventListCard
              title={String(member.name ?? 'Pessoa da equipe')}
              subtitle={member.role || 'Função não informada'}
              meta={[member.phone || 'Telefone não informado']}
              status="Equipe"
              statusTone="info"
              actions={[{
                label: 'Excluir',
                icon: 'trash-outline',
                tone: 'danger',
                onPress: () => onDelete(String(member.id)),
              }]}
            />
          </View>
        </View>
      ))}

      <EventFormSheet visible={composerOpen} title="Adicionar à equipe" onClose={onCloseComposer}>
        <Text style={styles.formLabel}>Nome</Text>
        <TextInput style={styles.input} value={draft.name} onChangeText={(value) => onDraftChange('name', value)} placeholder="Nome completo" />
        <Text style={styles.formLabel}>Telefone</Text>
        <TextInput style={styles.input} value={draft.phone} onChangeText={(value) => onDraftChange('phone', value)} placeholder="(11) 99999-9999" keyboardType="phone-pad" />
        <Text style={styles.formLabel}>Função</Text>
        <TextInput style={styles.input} value={draft.role} onChangeText={(value) => onDraftChange('role', value)} placeholder="Ex.: Cerimonialista" />
        <Pressable style={styles.btn} onPress={onCreate}><Text style={styles.btnText}>Adicionar à equipe</Text></Pressable>
      </EventFormSheet>
    </EventModuleShell>
  );
}
