import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useId } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../../theme/colors';
import { formatCurrencyFromCents } from './constants';
import type { BillingCycle, PlanDefinition } from './types';

type Props = {
  plan: PlanDefinition;
  cycle: BillingCycle;
  isCurrentPlan: boolean;
  loading: boolean;
  onSelect: (planId: string) => void;
};

export function PlanCard({ plan, cycle, isCurrentPlan, loading, onSelect }: Props) {
  const gradientId = `plan-badge-grad-${useId().replace(/:/g, '')}`;

  const isAnnual = cycle === 'annual';
  // Valor mensal equivalente se anual (com 20% OFF)
  const monthlyEquivalentCents = isAnnual
    ? Math.round(plan.annualAmountCents / 12)
    : plan.monthlyAmountCents;

  const priceFormatted = formatCurrencyFromCents(monthlyEquivalentCents);
  const annualTotalFormatted = formatCurrencyFromCents(plan.annualAmountCents);

  return (
    <View
      style={[
        styles.card,
        plan.popular ? styles.cardPopular : null,
        isCurrentPlan ? styles.cardCurrent : null,
      ]}
    >
      {/* Badge Superior: Mais Escolhido ou Sem Limites */}
      {plan.badge || plan.popular ? (
        <View style={styles.badgeWrap}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.primaryStrong} stopOpacity="1" />
                <Stop offset="1" stopColor="#3B82F6" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" rx={10} fill={`url(#${gradientId})`} />
          </Svg>
          <View style={styles.badgeContent}>
            <MaterialCommunityIcons name="star-outline" size={12} color="#FFFFFF" />
            <Text style={styles.badgeText}>{plan.badge || 'Mais Escolhido'}</Text>
          </View>
        </View>
      ) : null}

      {/* Header do Plano */}
      <View style={styles.header}>
        <Text style={styles.planName}>{plan.name}</Text>
        <Text style={styles.planTagline}>{plan.tagline}</Text>
      </View>

      {/* Preço */}
      <View style={styles.priceRow}>
        <View style={styles.priceValueGroup}>
          <Text style={styles.priceNumber}>{priceFormatted}</Text>
          <Text style={styles.pricePeriod}>/mês</Text>
        </View>
        {isAnnual ? (
          <Text style={styles.annualSubtitle}>
            Faturado anualmente em {annualTotalFormatted}/ano (20% OFF)
          </Text>
        ) : (
          <Text style={styles.annualSubtitle}>Cobrança mensal recorrente via Pix ou Cartão</Text>
        )}
      </View>

      {/* Metas Principais: Eventos e Usuários */}
      <View style={styles.limitsRow}>
        <View style={styles.limitChip}>
          <MaterialCommunityIcons name="calendar-check" size={14} color={colors.primaryStrong} />
          <Text style={styles.limitChipText}>
            {plan.maxEvents === null ? 'Eventos Ilimitados' : `Até ${plan.maxEvents} eventos ativos`}
          </Text>
        </View>
        <View style={styles.limitChip}>
          <MaterialCommunityIcons name="account-group" size={14} color={colors.primaryStrong} />
          <Text style={styles.limitChipText}>
            {plan.maxUsers === 1 ? '1 usuário' : `Até ${plan.maxUsers} usuários`}
          </Text>
        </View>
      </View>

      {/* Divisor */}
      <View style={styles.divider} />

      {/* Lista de Recursos */}
      <View style={styles.featuresList}>
        {plan.features.map((feature, idx) => (
          <View key={idx} style={styles.featureItem}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {/* Botão de Ação CTA */}
      <Pressable
        style={[
          styles.ctaBtn,
          plan.popular ? styles.ctaBtnPopular : null,
          isCurrentPlan ? styles.ctaBtnCurrent : null,
          loading ? styles.ctaBtnDisabled : null,
        ]}
        disabled={loading || isCurrentPlan}
        onPress={() => onSelect(plan.id)}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : isCurrentPlan ? (
          <Text style={styles.ctaBtnCurrentText}>Plano Vigente</Text>
        ) : (
          <Text style={styles.ctaBtnText}>
            {plan.trialDays > 0 ? `Testar ${plan.trialDays} dias grátis` : 'Assinar este plano'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 20,
    gap: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardPopular: {
    borderColor: colors.primaryStrong,
    borderWidth: 2,
    backgroundColor: '#FAFDFD',
  },
  cardCurrent: {
    borderColor: '#10B981',
    borderWidth: 2,
    backgroundColor: '#F0FDF4',
  },
  badgeWrap: {
    position: 'absolute',
    top: -12,
    right: 20,
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 24,
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  header: {
    gap: 4,
    marginTop: 4,
  },
  planName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  planTagline: {
    fontSize: 12,
    color: colors.mutedText,
    lineHeight: 16,
  },
  priceRow: {
    gap: 2,
  },
  priceValueGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  priceNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
  },
  pricePeriod: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedText,
  },
  annualSubtitle: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  limitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  limitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  limitChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryStrong,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  featuresList: {
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
    flex: 1,
  },
  ctaBtn: {
    backgroundColor: colors.text,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  ctaBtnPopular: {
    backgroundColor: colors.primaryStrong,
  },
  ctaBtnCurrent: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  ctaBtnDisabled: {
    opacity: 0.6,
  },
  ctaBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  ctaBtnCurrentText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '800',
  },
});
