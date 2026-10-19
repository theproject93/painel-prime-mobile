import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../../theme/colors';
import { BillingCycleToggle } from './BillingCycleToggle';
import { BillingHistorySection } from './BillingHistorySection';
import { PLANS_CATALOG } from './constants';
import { PlanCard } from './PlanCard';
import { useBillingState } from './useBillingState';
import { WhatsappCreditsSection } from './WhatsappCreditsSection';

export function CustomerBillingView() {
  const {
    billingCycle,
    setBillingCycle,
    subscription,
    payments,
    whatsappCredits,
    loading,
    refreshing,
    checkoutLoading,
    error,
    setError,
    refresh,
    handleCheckout,
  } = useBillingState();

  const currentPlanId = subscription?.plan_id?.toLowerCase() || '';

  const onSelectPlan = useCallback(
    async (planId: string) => {
      try {
        await handleCheckout(planId, billingCycle);
      } catch {
        // error já manipulado no hook
      }
    },
    [billingCycle, handleCheckout],
  );

  const onBuyPackage = useCallback(
    async (packageId: string) => {
      try {
        await handleCheckout(packageId, 'monthly');
      } catch {
        // error já manipulado no hook
      }
    },
    [handleCheckout],
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={colors.primaryStrong} />
        <Text style={styles.loadingText}>Carregando informações de assinatura...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Alerta de erro */}
      {error ? (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons name="alert-circle" size={18} color="#B91C1C" />
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
          <Pressable onPress={() => setError('')}>
            <MaterialCommunityIcons name="close" size={16} color="#B91C1C" />
          </Pressable>
        </View>
      ) : null}

      {/* Banner da Assinatura Atual */}
      {subscription ? (
        <View style={styles.subscriptionBanner}>
          <View style={styles.subBannerHeader}>
            <View style={styles.subIconWrap}>
              <MaterialCommunityIcons name="shield-check" size={22} color={colors.primaryStrong} />
            </View>
            <View style={styles.subInfo}>
              <Text style={styles.subTitle}>
                Plano {subscription.plan_id ? subscription.plan_id.toUpperCase() : 'ATIVO'}
              </Text>
              <Text style={styles.subSubtitle}>
                {subscription.status === 'active'
                  ? 'Assinatura ativa e regularizada'
                  : subscription.status === 'trialing'
                  ? 'Período de avaliação gratuita'
                  : `Status: ${subscription.status}`}
              </Text>
            </View>
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>
                {subscription.status === 'active' ? 'Ativo' : 'Em teste'}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.noSubBanner}>
          <View style={styles.noSubHeader}>
            <MaterialCommunityIcons name="creation" size={22} color="#D97706" />
            <View style={styles.noSubCopy}>
              <Text style={styles.noSubTitle}>Escolha seu plano Equilíbrio Prime</Text>
              <Text style={styles.noSubSubtitle}>
                Desbloqueie todo o potencial da assessoria com inteligência artificial cognitiva.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Seletor de Ciclo Mensal vs Anual com desconto */}
      <BillingCycleToggle cycle={billingCycle} onChange={setBillingCycle} />

      {/* Grid de Planos Equilíbrio Prime */}
      <View style={styles.plansSection}>
        {PLANS_CATALOG.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            cycle={billingCycle}
            isCurrentPlan={currentPlanId.includes(plan.id)}
            loading={checkoutLoading}
            onSelect={onSelectPlan}
          />
        ))}
      </View>

      {/* Seção de Créditos do WhatsApp */}
      <WhatsappCreditsSection
        currentCredits={whatsappCredits}
        loading={checkoutLoading}
        onBuyPackage={onBuyPackage}
      />

      {/* Histórico de Pagamentos */}
      <BillingHistorySection payments={payments} />

      {/* Botão de Atualizar Dados */}
      <Pressable
        style={styles.refreshBtn}
        disabled={refreshing}
        onPress={() => void refresh()}
      >
        <MaterialCommunityIcons
          name="refresh"
          size={16}
          color={colors.primaryStrong}
        />
        <Text style={styles.refreshBtnText}>
          {refreshing ? 'Atualizando...' : 'Atualizar faturamento'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedText,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
  },
  subscriptionBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    padding: 16,
  },
  subBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subInfo: {
    flex: 1,
    gap: 2,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  subSubtitle: {
    fontSize: 12,
    color: colors.mutedText,
  },
  activePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  activePillText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '800',
  },
  noSubBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
  },
  noSubHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  noSubCopy: {
    flex: 1,
    gap: 2,
  },
  noSubTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
  },
  noSubSubtitle: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 16,
  },
  plansSection: {
    gap: 16,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryStrong,
  },
});
