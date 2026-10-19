import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { formatCurrencyValue } from './constants';
import type { BillingPayment } from './types';

type Props = {
  payments: BillingPayment[];
};

function formatDate(iso: string): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function BillingHistorySection({ payments }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Histórico de Pagamentos</Text>
        <Text style={styles.subtitle}>Recibos de faturas e compras de créditos</Text>
      </View>

      {payments.length === 0 ? (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="receipt-text-outline" size={32} color={colors.mutedText} />
          <Text style={styles.emptyTitle}>Nenhum pagamento registrado ainda</Text>
          <Text style={styles.emptySubtitle}>
            Assim que você assinar um plano ou recarregar créditos, seus comprovantes aparecerão aqui.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {payments.map((p) => {
            const isApproved = p.status === 'approved' || p.status === 'confirmed';
            const isPending = p.status === 'pending';

            return (
              <View key={p.id} style={styles.paymentCard}>
                <View style={styles.paymentLeft}>
                  <View
                    style={[
                      styles.iconWrap,
                      isApproved ? styles.iconWrapApproved : isPending ? styles.iconWrapPending : styles.iconWrapOther,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isApproved ? 'check-bold' : isPending ? 'clock-outline' : 'alert-circle-outline'}
                      size={16}
                      color={isApproved ? '#059669' : isPending ? '#D97706' : '#DC2626'}
                    />
                  </View>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentDate}>{formatDate(p.processed_at)}</Text>
                    <Text style={styles.paymentMethod}>
                      {p.payment_method_id ? p.payment_method_id.toUpperCase() : 'PIX'} • {p.provider || 'InfinitePay'}
                    </Text>
                  </View>
                </View>

                <View style={styles.paymentRight}>
                  <Text style={styles.paymentAmount}>{formatCurrencyValue(p.amount)}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      isApproved ? styles.statusBadgeApproved : isPending ? styles.statusBadgePending : styles.statusBadgeOther,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isApproved ? styles.statusBadgeTextApproved : isPending ? styles.statusBadgeTextPending : styles.statusBadgeTextOther,
                      ]}
                    >
                      {isApproved ? 'Aprovado' : isPending ? 'Pendente' : p.status}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  header: {
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.mutedText,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 16,
  },
  list: {
    gap: 8,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapApproved: {
    backgroundColor: '#ECFDF5',
  },
  iconWrapPending: {
    backgroundColor: '#FEF3C7',
  },
  iconWrapOther: {
    backgroundColor: '#FEE2E2',
  },
  paymentInfo: {
    gap: 2,
  },
  paymentDate: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  paymentMethod: {
    fontSize: 11,
    color: colors.mutedText,
  },
  paymentRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeApproved: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeOther: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadgeTextApproved: {
    color: '#059669',
  },
  statusBadgeTextPending: {
    color: '#D97706',
  },
  statusBadgeTextOther: {
    color: '#DC2626',
  },
});
