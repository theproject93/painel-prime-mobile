import { useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { colors } from '../theme/colors';
import { ANALYTICS_STAGE_ORDER as RPC_STAGE_ORDER, FUNNEL_OPACITY, STAGE_LABELS, analyticsPresentation, toBRL } from '../features/client-analytics/analyticsModel';
import { useClientAnalytics } from '../features/client-analytics/useClientAnalytics';
import { clientAnalyticsStyles as styles } from '../features/client-analytics/clientAnalyticsStyles';

export function ClientsAnalyticsScreen() {
  const { user } = useAuth();
  const analytics = useClientAnalytics(user?.id);
  useFocusEffect(useCallback(() => { void analytics.load(); }, [analytics.load]));
  const funnelMetrics = analytics.funnel, pipelineForecast = analytics.forecast, loading = analytics.loading, error = analytics.error;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primaryStrong} />
      </View>
    );
  }

  const { maxFunnelValue, totalWeighted, conversionLeadToClosed, perStageRates } = analyticsPresentation(funnelMetrics, pipelineForecast);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Funil de Vendas</Text>

      <View style={styles.statsRow}>
        <StatCard label="Total" value={`${funnelMetrics.total}`} tone="blue" />
        <StatCard label="Leads" value={`${funnelMetrics.lead}`} tone="blue" />
        <StatCard
          label="Em Negociação"
          value={`${funnelMetrics.negociacao}`}
          tone="amber"
        />
      </View>
      <View style={styles.statsRow}>
        <StatCard
          label="Fechados"
          value={`${funnelMetrics.cliente_fechado}`}
          tone="green"
        />
        <StatCard
          label="Perdidos"
          value={`${funnelMetrics.cliente_perdido}`}
          tone="red"
        />
        <View style={styles.statPlaceholder} />
      </View>

      <Card style={styles.funnelCard}>
        <Text style={styles.cardTitle}>Visualização do Funil</Text>
        <View style={styles.funnelBars}>
          {RPC_STAGE_ORDER.map((stage, index) => {
            const count = funnelMetrics[stage];
            const widthPct = maxFunnelValue > 0 ? (count / maxFunnelValue) * 100 : 0;
            return (
              <View key={stage} style={styles.funnelRow}>
                <Text style={styles.funnelLabel}>{STAGE_LABELS[stage]}</Text>
                <View style={styles.funnelBarTrack}>
                  <View
                    style={[
                      styles.funnelBar,
                      {
                        width: `${widthPct}%`,
                        opacity: FUNNEL_OPACITY[index] ?? 0.34,
                        backgroundColor: colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.funnelCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Pipeline Financeiro</Text>

      <Card style={styles.pipelineCard}>
        <View style={styles.pipelineTotalRow}>
          <Text style={styles.pipelineTotalLabel}>Valor Total Ponderado</Text>
          <Text style={styles.pipelineTotalValue}>{toBRL(totalWeighted)}</Text>
        </View>

        {pipelineForecast.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum dado de pipeline disponível.</Text>
        ) : (
          <View style={styles.pipelineStages}>
            {pipelineForecast.map((item) => (
              <View key={item.stage} style={styles.pipelineStageRow}>
                <View style={styles.pipelineStageInfo}>
                  <View style={styles.pipelineStageDot} />
                  <View>
                    <Text style={styles.pipelineStageLabel}>
                      {STAGE_LABELS[item.stage] ?? item.stage}
                    </Text>
                    <Text style={styles.pipelineStageCount}>
                      {item.count} cliente{item.count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                <Text style={styles.pipelineStageValue}>
                  {toBRL(item.weighted_value)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Taxa de Conversão</Text>

      <Card style={styles.conversionCard}>
        <View style={styles.conversionMainRow}>
          <View>
            <Text style={styles.conversionMainLabel}>
              Lead → Cliente Fechado
            </Text>
            <Text style={styles.conversionMainHint}>
              {funnelMetrics.cliente_fechado} de {funnelMetrics.lead} leads
            </Text>
          </View>
          <Text style={styles.conversionMainRate}>{conversionLeadToClosed}%</Text>
        </View>

        <View style={styles.conversionDivider} />

        <Text style={styles.conversionSubtitle}>Taxas por Etapa</Text>

        {perStageRates.map((item) => (
          <View key={`${item.from}-${item.to}`} style={styles.conversionStageRow}>
            <Text style={styles.conversionStageLabel}>
              {STAGE_LABELS[item.from]} → {STAGE_LABELS[item.to]}
            </Text>
            <View style={styles.conversionStageBarTrack}>
              <View
                style={[
                  styles.conversionStageBar,
                  {
                    width: `${Math.min(Number(item.rate), 100)}%`,
                    backgroundColor:
                      Number(item.rate) >= 50
                        ? colors.successText
                        : Number(item.rate) >= 25
                          ? colors.warningText
                          : colors.dangerText,
                  },
                ]}
              />
            </View>
            <Text style={styles.conversionStageRate}>{item.rate}%</Text>
          </View>
        ))}

        {perStageRates.length === 0 ? (
          <Text style={styles.emptyText}>
            Dados insuficientes para calcular taxas de conversão.
          </Text>
        ) : null}
      </Card>
    </ScrollView>
  );
}
