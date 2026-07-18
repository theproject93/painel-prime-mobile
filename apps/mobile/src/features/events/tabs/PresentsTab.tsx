import { ActivityIndicator, Text, View } from 'react-native';

import { EventModuleShell } from '../EventWorkspace';
import type { EventGift } from '../useEventGifts';
import { styles } from '../eventDetailsStyles';
import { colors } from '../../../theme/colors';

type PresentsTabProps = { gifts: EventGift[]; loading: boolean };

export function PresentsTab({ gifts, loading }: PresentsTabProps) {
  if (loading) {
    return (
      <EventModuleShell title="Presentes" description="Acompanhe intenções e recebimentos ligados ao evento." icon="gift-outline">
        <ActivityIndicator color={colors.primaryStrong} />
      </EventModuleShell>
    );
  }

  if (gifts.length === 0) {
    return (
      <EventModuleShell title="Presentes" description="Acompanhe intenções e recebimentos ligados ao evento." icon="gift-outline">
        <Text style={styles.p}>Nenhuma intenção de presente registrada ainda.</Text>
      </EventModuleShell>
    );
  }

  const pending = gifts.filter((gift) => gift.status === 'pending').length;
  const received = gifts.filter((gift) => gift.status === 'received').length;
  const totalAmount = gifts.reduce((total, gift) => total + (gift.amount || 0), 0);

  return (
    <EventModuleShell title="Presentes" description="Acompanhe intenções e recebimentos ligados ao evento." icon="gift-outline">
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Pendentes</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{pending}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Recebidos</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{received}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Valor total</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
            {totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </Text>
        </View>
      </View>
      <View style={{ gap: 6 }}>
        {gifts.map((gift) => (
          <View key={gift.id} style={{ backgroundColor: colors.card, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{gift.guest_name}</Text>
              <Text style={{ color: gift.status === 'received' ? '#16A34A' : '#F59E0B', fontSize: 12, fontWeight: '700' }}>
                {gift.status === 'received' ? 'Recebido' : 'Pendente'}
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{gift.guest_phone}</Text>
            <Text style={{ color: colors.text, fontSize: 13, marginTop: 4 }}>
              {gift.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </Text>
            <Text style={{ color: colors.mutedText, fontSize: 11, marginTop: 2 }}>
              {new Date(gift.created_at).toLocaleDateString('pt-BR')}
            </Text>
          </View>
        ))}
      </View>
    </EventModuleShell>
  );
}
