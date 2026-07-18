import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EventEmptyState, EventListCard, EventModuleShell, EventSectionTitle } from '../EventWorkspace';
import { styles } from '../eventDetailsStyles';
import { colors } from '../../../theme/colors';

type ReceptionTabProps = {
  guests: any[];
  team: any[];
  onOpenScanner: () => void;
  onOpenTeam: () => void;
  onSendAccess: (memberId: string) => void;
};

export function ReceptionTab({ guests, team, onOpenScanner, onOpenTeam, onSendAccess }: ReceptionTabProps) {
  const confirmed = guests.filter((guest) => guest.confirmed || guest.rsvp_status === 'confirmed').length;
  const arrived = guests.filter((guest) => Boolean(guest.checked_in_at)).length;

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
      onAction={onOpenScanner}
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
      ) : team.map((member) => (
        <EventListCard
          key={member.id}
          title={String(member.name)}
          subtitle={member.role || 'Equipe'}
          meta={[member.phone || 'WhatsApp não informado']}
          status={member.phone ? 'Pronto' : 'Sem telefone'}
          statusTone={member.phone ? 'success' : 'warning'}
          actions={member.phone ? [{
            label: 'Enviar acesso',
            icon: 'logo-whatsapp',
            onPress: () => onSendAccess(String(member.id)),
          }] : []}
        />
      ))}
    </EventModuleShell>
  );
}
