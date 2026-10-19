import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { CustomerBillingView } from '../features/billing/CustomerBillingView';
import { SuperAdminBillingView } from '../features/billing/SuperAdminBillingView';
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

export function SuperBillingScreen() {
  const router = useRouter();
  const { isSuperAdmin } = useAuth();
  const [adminTab, setAdminTab] = useState<'my_subscription' | 'platform'>('my_subscription');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const loadPlatformData = useCallback(async () => {
    if (!isSuperAdmin) return;
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
        .select(
          'id,user_id,provider,provider_payment_id,status,amount,currency,payment_method_id,payer_email,processed_at',
        )
        .order('processed_at', { ascending: false })
        .limit(300),
    ]);

    if (subsRes.error || paymentsRes.error) {
      setError(subsRes.error?.message || paymentsRes.error?.message || 'Falha ao carregar dados da plataforma.');
    } else {
      setSubscriptions((subsRes.data ?? []) as SubscriptionRow[]);
      setPayments((paymentsRes.data ?? []) as PaymentRow[]);
    }
    setLoading(false);
  }, [isSuperAdmin]);

  useFocusEffect(
    useCallback(() => {
      if (isSuperAdmin) {
        void loadPlatformData();
      }
    }, [isSuperAdmin, loadPlatformData]),
  );

  async function handleRefreshPlatform() {
    setRefreshing(true);
    await loadPlatformData();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Voltar"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>

        <View style={styles.topHeaderCopy}>
          <Text style={styles.screenTitle}>
            {isSuperAdmin && adminTab === 'platform' ? 'Auditoria de Billing' : 'Assinaturas & Planos'}
          </Text>
          <Text style={styles.screenSubtitle}>
            {isSuperAdmin && adminTab === 'platform'
              ? 'Painel consolidado da plataforma'
              : 'Equilíbrio Prime & Créditos WhatsApp'}
          </Text>
        </View>
      </View>

      {/* Seletor Super Admin (caso usuário seja Super Admin) */}
      {isSuperAdmin ? (
        <View style={styles.adminSelectorWrap}>
          <Pressable
            style={[
              styles.adminTabBtn,
              adminTab === 'my_subscription' ? styles.adminTabBtnActive : null,
            ]}
            onPress={() => setAdminTab('my_subscription')}
          >
            <MaterialCommunityIcons
              name="account-cog-outline"
              size={16}
              color={adminTab === 'my_subscription' ? colors.primaryStrong : colors.mutedText}
            />
            <Text
              style={[
                styles.adminTabText,
                adminTab === 'my_subscription' ? styles.adminTabTextActive : null,
              ]}
            >
              Minha Assinatura
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.adminTabBtn,
              adminTab === 'platform' ? styles.adminTabBtnActive : null,
            ]}
            onPress={() => setAdminTab('platform')}
          >
            <MaterialCommunityIcons
              name="view-dashboard-outline"
              size={16}
              color={adminTab === 'platform' ? colors.primaryStrong : colors.mutedText}
            />
            <Text
              style={[
                styles.adminTabText,
                adminTab === 'platform' ? styles.adminTabTextActive : null,
              ]}
            >
              Visão da Plataforma
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Conteúdo Principal */}
      <View style={styles.contentWrap}>
        {isSuperAdmin && adminTab === 'platform' ? (
          loading && !refreshing ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator size="large" color={colors.primaryStrong} />
              <Text style={styles.loadingText}>Carregando métricas da plataforma...</Text>
            </View>
          ) : (
            <SuperAdminBillingView
              subscriptions={subscriptions}
              payments={payments}
              refreshing={refreshing}
              error={error}
              onRefresh={() => void handleRefreshPlatform()}
            />
          )
        ) : (
          <CustomerBillingView />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  topHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  screenTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  screenSubtitle: {
    fontSize: 11,
    color: colors.mutedText,
    fontWeight: '500',
  },
  adminSelectorWrap: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  adminTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: '#FFFFFF',
  },
  adminTabBtnActive: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.primarySoft,
  },
  adminTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedText,
  },
  adminTabTextActive: {
    color: colors.primaryStrong,
    fontWeight: '800',
  },
  contentWrap: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedText,
    fontWeight: '600',
  },
});
