import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { colors } from '../theme/colors';

type FunnelStage =
  | 'lead'
  | 'contato_inicial'
  | 'proposta_enviada'
  | 'negociacao'
  | 'cliente_fechado'
  | 'cliente_perdido';

type FunnelMetrics = {
  lead: number;
  contato_inicial: number;
  proposta_enviada: number;
  negociacao: number;
  cliente_fechado: number;
  cliente_perdido: number;
  total: number;
};

type PipelineForecastItem = {
  stage: string;
  count: number;
  weighted_value: number;
};

type ClientRow = {
  id: string;
  stage: string | null;
  budget_expected: number | null;
};

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  contato_inicial: 'Contato Inicial',
  proposta_enviada: 'Proposta Enviada',
  negociacao: 'Negociação',
  cliente_fechado: 'Cliente Fechado',
  cliente_perdido: 'Cliente Perdido',
};

const RPC_STAGE_ORDER: FunnelStage[] = [
  'lead',
  'contato_inicial',
  'proposta_enviada',
  'negociacao',
  'cliente_fechado',
];

const FUNNEL_OPACITY: Record<number, number> = {
  0: 1.0,
  1: 0.82,
  2: 0.64,
  3: 0.48,
  4: 0.34,
};

const EMPTY_FUNNEL: FunnelMetrics = {
  lead: 0,
  contato_inicial: 0,
  proposta_enviada: 0,
  negociacao: 0,
  cliente_fechado: 0,
  cliente_perdido: 0,
  total: 0,
};

function toBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

function normalizeRpcStage(raw: string | null | undefined): string {
  if (!raw) return 'lead';
  const cleaned = raw.trim().toLowerCase();
  const validStages: string[] = [
    'lead',
    'contato_inicial',
    'proposta_enviada',
    'negociacao',
    'cliente_fechado',
    'cliente_perdido',
  ];
  if (validStages.includes(cleaned)) return cleaned;

  const mapping: Record<string, string> = {
    conhecendo_cliente: 'lead',
    analisando_orcamento: 'proposta_enviada',
    assinatura_contrato: 'negociacao',
    won: 'cliente_fechado',
    lost: 'cliente_perdido',
  };
  return mapping[cleaned] ?? 'lead';
}

function computeFallbackFunnel(clients: ClientRow[]): FunnelMetrics {
  const metrics: FunnelMetrics = { ...EMPTY_FUNNEL };
  for (const client of clients) {
    const stage = normalizeRpcStage(client.stage);
    const key = stage as keyof FunnelMetrics;
    if (key in metrics) {
      (metrics as Record<string, number>)[key] += 1;
    }
  }
  metrics.total =
    metrics.lead +
    metrics.contato_inicial +
    metrics.proposta_enviada +
    metrics.negociacao +
    metrics.cliente_fechado +
    metrics.cliente_perdido;
  return metrics;
}

function computeFallbackForecast(clients: ClientRow[]): PipelineForecastItem[] {
  const buckets: Record<string, { count: number; value: number }> = {};
  for (const client of clients) {
    const stage = normalizeRpcStage(client.stage);
    if (stage === 'cliente_perdido') continue;
    if (!buckets[stage]) {
      buckets[stage] = { count: 0, value: 0 };
    }
    buckets[stage].count += 1;
    buckets[stage].value += Number(client.budget_expected ?? 0);
  }

  const weights: Record<string, number> = {
    lead: 0.1,
    contato_inicial: 0.25,
    proposta_enviada: 0.45,
    negociacao: 0.7,
    cliente_fechado: 1.0,
  };

  return RPC_STAGE_ORDER.filter((s) => buckets[s]).map((stage) => ({
    stage,
    count: buckets[stage].count,
    weighted_value: (buckets[stage].value || 0) * (weights[stage] ?? 0),
  }));
}

export function ClientsAnalyticsScreen() {
  const { user } = useAuth();
  const [funnelMetrics, setFunnelMetrics] = useState<FunnelMetrics>(EMPTY_FUNNEL);
  const [pipelineForecast, setPipelineForecast] = useState<PipelineForecastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    const [funnelRes, forecastRes] = await Promise.all([
      supabase.rpc('get_crm_funnel_metrics'),
      supabase.rpc('get_crm_pipeline_forecast'),
    ]);

    if (funnelRes.error || forecastRes.error) {
      const { data: clientsData, error: clientsError } = await supabase
        .from('crm_clients')
        .select('id,stage,budget_expected')
        .eq('user_id', user.id);

      if (clientsError) {
        setError(clientsError.message);
        setLoading(false);
        return;
      }

      const clients = (clientsData ?? []) as ClientRow[];
      setFunnelMetrics(computeFallbackFunnel(clients));
      setPipelineForecast(computeFallbackForecast(clients));
      setLoading(false);
      return;
    }

    const rawFunnel = (funnelRes.data ?? {}) as Record<string, unknown>;
    setFunnelMetrics({
      lead: Number(rawFunnel.lead ?? 0),
      contato_inicial: Number(rawFunnel.contato_inicial ?? 0),
      proposta_enviada: Number(rawFunnel.proposta_enviada ?? 0),
      negociacao: Number(rawFunnel.negociacao ?? 0),
      cliente_fechado: Number(rawFunnel.cliente_fechado ?? 0),
      cliente_perdido: Number(rawFunnel.cliente_perdido ?? 0),
      total: Number(rawFunnel.total ?? 0),
    });

    const rawForecast = (forecastRes.data ?? []) as Array<Record<string, unknown>>;
    setPipelineForecast(
      rawForecast.map((item) => ({
        stage: String(item.stage ?? ''),
        count: Number(item.count ?? 0),
        weighted_value: Number(item.weighted_value ?? 0),
      })),
    );

    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primaryStrong} />
      </View>
    );
  }

  const maxFunnelValue = Math.max(
    funnelMetrics.lead,
    funnelMetrics.contato_inicial,
    funnelMetrics.proposta_enviada,
    funnelMetrics.negociacao,
    funnelMetrics.cliente_fechado,
    1,
  );

  const totalWeighted = pipelineForecast.reduce(
    (sum, item) => sum + Number(item.weighted_value ?? 0),
    0,
  );

  const conversionLeadToClosed =
    funnelMetrics.lead > 0
      ? ((funnelMetrics.cliente_fechado / funnelMetrics.lead) * 100).toFixed(1)
      : '0,0';

  const perStageRates: Array<{ from: FunnelStage; to: FunnelStage; rate: string }> = [];
  for (let i = 0; i < RPC_STAGE_ORDER.length - 1; i++) {
    const from = RPC_STAGE_ORDER[i];
    const to = RPC_STAGE_ORDER[i + 1];
    const fromCount =
      funnelMetrics[from as keyof FunnelMetrics] as number;
    const toCount =
      funnelMetrics[to as keyof FunnelMetrics] as number;
    const rate = fromCount > 0 ? ((toCount / fromCount) * 100).toFixed(1) : '0,0';
    perStageRates.push({ from, to, rate });
  }

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
            const count = funnelMetrics[stage as keyof FunnelMetrics] as number;
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

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statPlaceholder: {
    flex: 1,
  },
  funnelCard: {
    gap: 10,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  funnelBars: {
    gap: 8,
  },
  funnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  funnelLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
    width: 100,
  },
  funnelBarTrack: {
    flex: 1,
    height: 18,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  funnelBar: {
    height: '100%',
    borderRadius: 4,
  },
  funnelCount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    width: 32,
    textAlign: 'right',
  },
  pipelineCard: {
    gap: 10,
  },
  pipelineTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pipelineTotalLabel: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: '600',
  },
  pipelineTotalValue: {
    color: colors.primaryStrong,
    fontSize: 20,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
  },
  pipelineStages: {
    gap: 8,
  },
  pipelineStageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.surfaceSubtle,
  },
  pipelineStageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pipelineStageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  pipelineStageLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  pipelineStageCount: {
    color: colors.mutedText,
    fontSize: 11,
  },
  pipelineStageValue: {
    color: colors.primaryStrong,
    fontSize: 13,
    fontWeight: '700',
  },
  conversionCard: {
    gap: 10,
  },
  conversionMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversionMainLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  conversionMainHint: {
    color: colors.mutedText,
    fontSize: 12,
    marginTop: 2,
  },
  conversionMainRate: {
    color: colors.successText,
    fontSize: 26,
    fontWeight: '800',
  },
  conversionDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  conversionSubtitle: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
  },
  conversionStageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conversionStageLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
    width: 130,
  },
  conversionStageBarTrack: {
    flex: 1,
    height: 14,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  conversionStageBar: {
    height: '100%',
    borderRadius: 3,
  },
  conversionStageRate: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    width: 44,
    textAlign: 'right',
  },
  errorBanner: {
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    color: colors.dangerText,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
