import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Screen } from '../components/Screen';
import { WalkthroughAnchorTarget } from '../components/WalkthroughAnchors';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

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

function formatCurrency(value: number | null | undefined, currency = 'BRL') {
  if (value == null || Number.isNaN(value)) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency });
}

export function SuperBillingScreen() {
  const router = useRouter();
  const { isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const metrics = useMemo(() => {
    const totalAssinantes = subscriptions.length;
    const ativos = subscriptions.filter((row) => row.status === 'active').length;
    const pendentes = subscriptions.filter((row) => ['pending_checkout', 'pending_payment', 'pending_pix', 'pending'].includes(row.status)).length;
    const receitaAprovada = payments
      .filter((row) => row.status === 'approved')
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    return { totalAssinantes, ativos, pendentes, receitaAprovada };
  }, [payments, subscriptions]);

  const load = useCallback(async () => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    const [subsRes, paymentsRes] = await Promise.all([
      supabase
        .from('billing_subscriptions')
        .select('user_id,provider,status,plan_id,amount_cents,last_payment_status,updated_at')
        .order('updated_at', { ascending: false })
        .limit(300),
      supabase
        .from('billing_payments')
        .select('id,user_id,provider,provider_payment_id,status,amount,currency,payment_method_id,payer_email,processed_at')
        .order('processed_at', { ascending: false })
        .limit(300),
    ]);

    if (subsRes.error || paymentsRes.error) {
      setError(subsRes.error?.message || paymentsRes.error?.message || 'Falha ao carregar assinaturas.');
      setLoading(false);
      return;
    }

    setSubscriptions((subsRes.data ?? []) as SubscriptionRow[]);
    setPayments((paymentsRes.data ?? []) as PaymentRow[]);
    setLoading(false);
  }, [isSuperAdmin]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function refreshNow() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!isSuperAdmin) {
    return (
      <Screen title="Assinaturas" subtitle="Acesso restrito">
        <Pressable onPress={() => router.push('/mais')}>
          <Text style={styles.back}>Voltar</Text>
        </Pressable>
        <View style={styles.card}>
          <Text style={styles.item}>Você não possui permissão de super admin.</Text>
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryStrong} />
      </View>
    );
  }

  return (
    <Screen title="Assinaturas" subtitle="Painel administrativo de billing">
      <Pressable onPress={() => router.push('/mais')}>
        <Text style={styles.back}>Voltar</Text>
      </Pressable>
      {error ? <Text style={styles.err}>{error}</Text> : null}

      <View style={styles.rowBtns}>
        <Pressable style={styles.btnGhost} onPress={() => void refreshNow()}>
          <Text style={styles.smallText}>{refreshing ? 'Atualizando...' : 'Atualizar'}</Text>
        </Pressable>
      </View>

      <WalkthroughAnchorTarget id="billing.metrics" borderRadius={12}>
        <View style={styles.billingTopSection}>
          <View style={styles.metricsRow}>
            <Metric label="Assinantes" value={metrics.totalAssinantes} />
            <Metric label="Ativos" value={metrics.ativos} />
            <Metric label="Pendentes" value={metrics.pendentes} />
            <Metric label="Receita aprovada" value={formatCurrency(metrics.receitaAprovada)} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Assinaturas</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.tableWrap}>
                {subscriptions.map((row) => (
                  <View key={row.user_id} style={styles.tableRow}>
                    <Text style={[styles.cell, styles.cellId]}>{row.user_id}</Text>
                    <Text style={styles.cell}>{row.plan_id ?? '-'}</Text>
                    <Text style={styles.cell}>{formatCurrency(row.amount_cents != null ? row.amount_cents / 100 : null)}</Text>
                    <Text style={styles.cell}>{row.status}</Text>
                    <Text style={styles.cell}>{row.last_payment_status ?? '-'}</Text>
                  </View>
                ))}
                {subscriptions.length === 0 ? <Text style={styles.caption}>Nenhuma assinatura encontrada.</Text> : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </WalkthroughAnchorTarget>

      <WalkthroughAnchorTarget id="billing.history" borderRadius={12}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pagamentos recentes</Text>
          {payments.slice(0, 40).map((row) => (
            <View key={row.id} style={styles.paymentCard}>
              <Text style={styles.item}>{new Date(row.processed_at).toLocaleString('pt-BR')}</Text>
              <Text style={styles.item}>Status: {row.status}</Text>
              <Text style={styles.item}>Valor: {formatCurrency(row.amount, row.currency ?? 'BRL')}</Text>
              <Text style={styles.item}>Metodo: {row.payment_method_id ?? '-'}</Text>
              <Text style={styles.item}>Pagador: {row.payer_email ?? '-'}</Text>
            </View>
          ))}
          {payments.length === 0 ? <Text style={styles.caption}>Nenhum pagamento encontrado.</Text> : null}
        </View>
      </WalkthroughAnchorTarget>
    </Screen>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  back: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  err: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 8 },
  rowBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btnGhost: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  smallText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  billingTopSection: { gap: 14 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCard: { flexBasis: '48%', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, padding: 10, gap: 4 },
  metricLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '600' },
  metricValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, gap: 8 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  tableWrap: { gap: 6 },
  tableRow: { flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8, minWidth: 900 },
  cell: { width: 150, color: colors.text, fontSize: 12 },
  cellId: { width: 260, color: colors.mutedText },
  item: { color: colors.text, fontSize: 12, fontWeight: '600' },
  paymentCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8, gap: 3 },
  caption: { color: colors.mutedText, fontSize: 12 },
});
