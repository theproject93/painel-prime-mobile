import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../../theme/colors';

type SubscriptionRow = {
  user_id: string;
  provider: string;
  status: string;
  plan_id: string | null;
  amount_cents: number | null;
  last_payment_status: string | null;
  updated_at: string;
};

type PaymentRow = {
  id: string;
  user_id: string | null;
  provider: string;
  provider_payment_id: string;
  status: string;
  amount: number | null;
  currency: string | null;
  payment_method_id: string | null;
  payer_email: string | null;
  processed_at: string;
};

type Props = {
  subscriptions: SubscriptionRow[];
  payments: PaymentRow[];
  refreshing: boolean;
  error?: string;
  onRefresh: () => void;
};

function formatCurrency(value: number | null | undefined, currency = 'BRL') {
  if (value == null || Number.isNaN(value)) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency });
}

export function SuperAdminBillingView({
  subscriptions,
  payments,
  refreshing,
  error,
  onRefresh,
}: Props) {
  const metrics = useMemo(() => {
    const totalAssinantes = subscriptions.length;
    const ativos = subscriptions.filter((row) => row.status === 'active').length;
    const pendentes = subscriptions.filter((row) =>
      ['pending_checkout', 'pending_payment', 'pending_pix', 'pending'].includes(row.status),
    ).length;
    const receitaAprovada = payments
      .filter((row) => row.status === 'approved')
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    return { totalAssinantes, ativos, pendentes, receitaAprovada };
  }, [payments, subscriptions]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {error ? <Text style={styles.err}>{error}</Text> : null}

      <View style={styles.topRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Visão Geral da Plataforma</Text>
          <Text style={styles.subtitle}>Métricas globais de assinantes e receita</Text>
        </View>
        <Pressable style={styles.btnGhost} onPress={onRefresh} disabled={refreshing}>
          <Text style={styles.smallText}>{refreshing ? 'Atualizando...' : 'Atualizar'}</Text>
        </Pressable>
      </View>

      <View style={styles.metricsRow}>
        <Metric label="Assinantes" value={metrics.totalAssinantes} />
        <Metric label="Ativos" value={metrics.ativos} />
        <Metric label="Pendentes" value={metrics.pendentes} />
        <Metric label="Receita aprovada" value={formatCurrency(metrics.receitaAprovada)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Assinaturas Ativas e Recentes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tableWrap}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.cell, styles.cellId, styles.cellHead]}>User ID</Text>
              <Text style={[styles.cell, styles.cellHead]}>Plano</Text>
              <Text style={[styles.cell, styles.cellHead]}>Valor</Text>
              <Text style={[styles.cell, styles.cellHead]}>Status</Text>
              <Text style={[styles.cell, styles.cellHead]}>Último Pagamento</Text>
            </View>
            {subscriptions.map((row) => (
              <View key={row.user_id} style={styles.tableRow}>
                <Text style={[styles.cell, styles.cellId]}>{row.user_id}</Text>
                <Text style={styles.cell}>{row.plan_id ?? '-'}</Text>
                <Text style={styles.cell}>
                  {formatCurrency(row.amount_cents != null ? row.amount_cents / 100 : null)}
                </Text>
                <Text style={styles.cell}>{row.status}</Text>
                <Text style={styles.cell}>{row.last_payment_status ?? '-'}</Text>
              </View>
            ))}
            {subscriptions.length === 0 ? (
              <Text style={styles.caption}>Nenhuma assinatura encontrada.</Text>
            ) : null}
          </View>
        </ScrollView>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pagamentos Recentes da Plataforma</Text>
        {payments.slice(0, 40).map((row) => (
          <View key={row.id} style={styles.paymentCard}>
            <Text style={styles.item}>{new Date(row.processed_at).toLocaleString('pt-BR')}</Text>
            <Text style={styles.item}>Status: {row.status}</Text>
            <Text style={styles.item}>
              Valor: {formatCurrency(row.amount, row.currency ?? 'BRL')}
            </Text>
            <Text style={styles.item}>Método: {row.payment_method_id ?? '-'}</Text>
            <Text style={styles.item}>Pagador: {row.payer_email ?? '-'}</Text>
          </View>
        ))}
        {payments.length === 0 ? (
          <Text style={styles.caption}>Nenhum pagamento encontrado.</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  err: {
    color: colors.dangerText,
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    padding: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headingCopy: {
    gap: 2,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.mutedText,
  },
  btnGhost: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  smallText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    flexBasis: '48%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    padding: 12,
    gap: 4,
  },
  metricLabel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '600',
  },
  metricValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  tableWrap: {
    gap: 6,
  },
  tableRow: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 8,
    minWidth: 900,
    backgroundColor: '#FFFFFF',
  },
  tableHeader: {
    backgroundColor: '#F8FAFC',
  },
  cell: {
    width: 150,
    color: colors.text,
    fontSize: 12,
  },
  cellHead: {
    fontWeight: '800',
    color: colors.text,
  },
  cellId: {
    width: 260,
    color: colors.mutedText,
  },
  item: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  paymentCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 3,
    backgroundColor: '#FFFFFF',
  },
  caption: {
    color: colors.mutedText,
    fontSize: 12,
    padding: 8,
  },
});
