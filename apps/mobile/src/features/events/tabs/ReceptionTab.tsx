import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { EventEmptyState, EventListCard, EventModuleShell, EventSectionTitle } from '../EventWorkspace';
import { styles } from '../eventDetailsStyles';
import { colors } from '../../../theme/colors';

type ReceptionTabProps = {
  eventId?: string;
  guests: any[];
  team: any[];
  onOpenScanner?: () => void;
  onOpenTeam: () => void;
  onSendAccess: (memberId: string) => void;
};

function getMemberAccessStatusInfo(status?: string | null, phone?: string | null): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
} {
  if (!phone) {
    return {
      label: 'Sem telefone',
      tone: 'warning',
    };
  }

  const normalized = status ? String(status).toLowerCase().trim() : '';

  switch (normalized) {
    case 'active':
      return {
        label: 'Acesso ativo',
        tone: 'success',
      };
    case 'invited':
      return {
        label: 'Convite enviado, aguardando',
        tone: 'warning',
      };
    case 'revoked':
      return {
        label: 'Acesso revogado',
        tone: 'danger',
      };
    case 'not_granted':
    default:
      return {
        label: 'Acesso não enviado',
        tone: 'neutral',
      };
  }
}

export function ReceptionTab({
  eventId,
  guests,
  team,
  onOpenScanner,
  onOpenTeam,
  onSendAccess,
}: ReceptionTabProps) {
  const router = useRouter();
  const confirmed = guests.filter((guest) => guest.confirmed || guest.rsvp_status === 'confirmed').length;
  const arrived = guests.filter((guest) => Boolean(guest.checked_in_at)).length;

  const handleOpenScanner = () => {
    if (onOpenScanner) {
      onOpenScanner();
    } else if (eventId) {
      router.push(`/eventos/${eventId}/portaria` as any);
    }
  };

  return (
    <EventModuleShell
      title="Recepção e QR Code"
      description="Controle a entrada dos convidados, mesmo quando a internet estiver instável."
      icon="qr-code-outline"
      metrics={[
        { label: 'Confirmados', value: confirmed, tone: 'info' },
        { label: 'Já chegaram', value: arrived, tone: 'success' },
        { label: 'Aguardados', value: Math.max(confirmed - arrived, 0), tone: 'gold' },
      ]}
      actionLabel="Abrir scanner"
      onAction={handleOpenScanner}
    >
      <View style={styles.receptionHero}>
        <Ionicons name="shield-checkmark-outline" size={38} color={colors.gold700} />
        <Text style={styles.subtitle}>Scanner offline pronto para a porta</Text>
        <Text style={styles.caption}>A equipe escaneia o QR Code do convidado e as entradas sincronizam assim que a conexão voltar.</Text>
      </View>
      <EventSectionTitle title="Enviar acesso seguro à equipe" />
      {team.length === 0 ? (
        <EventEmptyState
          icon="people-outline"
          title="Adicione a equipe da recepção"
          description="Cadastre nome e WhatsApp na área Equipe antes de liberar o scanner."
          actionLabel="Abrir equipe"
          onAction={onOpenTeam}
        />
      ) : team.map((member) => {
        const rawStatus =
          member.access_status ||
          member.advisor_team_members?.access_status ||
          (Array.isArray(member.advisor_team_members) && member.advisor_team_members[0]?.access_status);
        const accessInfo = getMemberAccessStatusInfo(rawStatus, member.phone);

        return (
          <EventListCard
            key={member.id}
            title={String(member.name)}
            subtitle={member.role || 'Equipe'}
            meta={[member.phone || 'WhatsApp não informado']}
            status={accessInfo.label}
            statusTone={accessInfo.tone}
            actions={member.phone ? [{
              label: rawStatus === 'active' ? 'Reenviar acesso' : 'Enviar acesso',
              icon: 'logo-whatsapp',
              onPress: () => onSendAccess(String(member.id)),
            }] : []}
          />
        );
      })}
    </EventModuleShell>
  );
}
