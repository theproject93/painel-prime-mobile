import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Screen } from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

type HealthSummary = {
  total_events: number;
  page_views: number;
  rpc_errors: number;
  frontend_errors: number;
};

type TopErrorByScreen = {
  screen: string;
  count: number;
};

type TopRpcFailure = {
  scope: string;
  action: string;
  count: number;
};

type TopPageView = {
  path: string;
  count: number;
};

type HealthDashboardPayload = {
  window_days: number;
  generated_at: string;
  summary: HealthSummary;
  top_errors_by_screen: TopErrorByScreen[];
  top_rpc_failures: TopRpcFailure[];
  top_page_views: TopPageView[];
};

const EMPTY_PAYLOAD: HealthDashboardPayload = {
  window_days: 7,
  generated_at: '',
  summary: {
    total_events: 0,
    page_views: 0,
    rpc_errors: 0,
    frontend_errors: 0,
  },
  top_errors_by_screen: [],
  top_rpc_failures: [],
  top_page_views: [],
};

function normalizePayload(raw: unknown): HealthDashboardPayload {
  const source = (raw as Record<string, any> | null) ?? {};
  return {
    window_days: Number(source.window_days ?? 7),
    generated_at: String(source.generated_at ?? ''),
    summary: {
      total_events: Number(source.summary?.total_events ?? 0),
      page_views: Number(source.summary?.page_views ?? 0),
      rpc_errors: Number(source.summary?.rpc_errors ?? 0),
      frontend_errors: Number(source.summary?.frontend_errors ?? 0),
    },
    top_errors_by_screen: Array.isArray(source.top_errors_by_screen)
      ? source.top_errors_by_screen.map((item: any) => ({
          screen: String(item.screen ?? 'desconhecida'),
          count: Number(item.count ?? 0),
        }))
      : [],
    top_rpc_failures: Array.isArray(source.top_rpc_failures)
      ? source.top_rpc_failures.map((item: any) => ({
          scope: String(item.scope ?? 'desconhecido'),
          action: String(item.action ?? 'ação desconhecida'),
          count: Number(item.count ?? 0),
        }))
      : [],
    top_page_views: Array.isArray(source.top_page_views)
      ? source.top_page_views.map((item: any) => ({
          path: String(item.path ?? 'sem_path'),
          count: Number(item.count ?? 0),
        }))
      : [],
  };
}

export function OperationalHealthScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [windowDays, setWindowDays] = useState<1 | 7>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<HealthDashboardPayload>(EMPTY_PAYLOAD);

  const loadFallback = useCallback(async () => {
    if (!user) return;
    const { data: events } = await supabase.from('events').select('id').eq('user_id', user.id);
    const eventIds = (events ?? []).map((item) => item.id);

    const [tasksRes, guestsRes, vendorsRes] =
      eventIds.length > 0
        ? await Promise.all([
            supabase.from('event_tasks').select('id', { count: 'exact', head: true }).in('event_id', eventIds).eq('completed', false),
            supabase.from('event_guests').select('id', { count: 'exact', head: true }).in('event_id', eventIds).or('rsvp_status.eq.pending,rsvp_status.is.null'),
            supabase.from('event_vendors').select('id', { count: 'exact', head: true }).in('event_id', eventIds).neq('status', 'confirmed'),
          ])
        : [
            { count: 0 } as any,
            { count: 0 } as any,
            { count: 0 } as any,
          ];

    setPayload({
      window_days: windowDays,
      generated_at: new Date().toISOString(),
      summary: {
        total_events: eventIds.length,
        page_views: Number(events?.length ?? 0),
        rpc_errors: Number(vendorsRes.count ?? 0),
        frontend_errors: Number(tasksRes.count ?? 0) + Number(guestsRes.count ?? 0),
      },
      top_errors_by_screen: [
        { screen: 'event_tasks', count: Number(tasksRes.count ?? 0) },
        { screen: 'event_guests', count: Number(guestsRes.count ?? 0) },
      ],
      top_rpc_failures: [
        { scope: 'event_vendors', action: 'status_not_confirmed', count: Number(vendorsRes.count ?? 0) },
      ],
      top_page_views: [{ path: '/dashboard/eventos', count: Number(events?.length ?? 0) }],
    });
  }, [user, windowDays]);

  const loadDashboard = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: rpcError } = await supabase.rpc('get_operational_health_dashboard', {
      p_window_days: windowDays,
    });

    if (rpcError) {
      await loadFallback();
      setError(`RPC indisponível agora (${rpcError.message}). Exibindo fallback local.`);
      setLoading(false);
      return;
    }

    setPayload(normalizePayload(data));
    setLoading(false);
  }, [loadFallback, user, windowDays]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  const generatedAtLabel = useMemo(() => {
    if (!payload.generated_at) return '-';
    const date = new Date(payload.generated_at);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('pt-BR');
  }, [payload.generated_at]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryStrong} />
      </View>
    );
  }

  return (
    <Screen title="Saúde Operacional" subtitle="Erros por tela, RPC failures e page views">
      <Pressable onPress={() => router.push('/mais')}>
        <Text style={styles.back}>Voltar</Text>
      </Pressable>

      <View style={styles.rowBtns}>
        <Pressable style={[styles.btnGhost, windowDays === 1 && styles.btnOn]} onPress={() => setWindowDays(1)}>
          <Text style={styles.smallText}>Últimas 24h</Text>
        </Pressable>
        <Pressable style={[styles.btnGhost, windowDays === 7 && styles.btnOn]} onPress={() => setWindowDays(7)}>
          <Text style={styles.smallText}>Últimos 7 dias</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => void loadDashboard()}>
          <Text style={styles.btnText}>Atualizar</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Text style={styles.caption}>Gerado em: {generatedAtLabel}</Text>

              <View style={styles.metricGrid}>
          <Metric label="Eventos" value={payload.summary.total_events} tone="default" />
          <Metric label="Page views" value={payload.summary.page_views} tone="blue" />
          <Metric label="Falhas RPC" value={payload.summary.rpc_errors} tone="amber" />
          <Metric label="Erros front" value={payload.summary.frontend_errors} tone="red" />
        </View>

              <View style={styles.detailsStack}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top erros por tela</Text>
            {payload.top_errors_by_screen.length === 0 ? <Text style={styles.caption}>Sem erros no período.</Text> : null}
            {payload.top_errors_by_screen.map((item) => (
              <View key={item.screen} style={styles.lineRow}>
                <Text style={styles.lineLabel}>{item.screen}</Text>
                <Text style={styles.lineValue}>{item.count}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Falhas RPC por ação</Text>
            {payload.top_rpc_failures.length === 0 ? <Text style={styles.caption}>Sem falhas RPC no período.</Text> : null}
            {payload.top_rpc_failures.map((item) => (
              <View key={`${item.scope}-${item.action}`} style={styles.lineRow}>
                <Text style={styles.lineLabel}>{item.scope} / {item.action}</Text>
                <Text style={styles.lineValue}>{item.count}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top page views</Text>
            {payload.top_page_views.length === 0 ? <Text style={styles.caption}>Sem page views no período.</Text> : null}
            {payload.top_page_views.map((item) => (
              <View key={item.path} style={styles.lineRow}>
                <Text style={styles.lineLabel}>{item.path}</Text>
                <Text style={styles.lineValue}>{item.count}</Text>
              </View>
            ))}
          </View>
        </View>
          </Screen>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'default' | 'blue' | 'amber' | 'red' }) {
  const toneStyle =
    tone === 'blue' ? styles.metricBlue : tone === 'amber' ? styles.metricAmber : tone === 'red' ? styles.metricRed : null;

  return (
    <View style={[styles.metric, toneStyle]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  back: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  rowBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { minHeight: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnText: { color: colors.primaryTextOn, fontSize: 12, fontWeight: '700' },
  btnGhost: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, backgroundColor: colors.card },
  btnOn: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
  smallText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  err: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 8 },
  caption: { color: colors.mutedText, fontSize: 12 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailsStack: { gap: 14 },
  metric: { flexBasis: '48%', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, padding: 10 },
  metricBlue: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  metricAmber: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
  metricRed: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  metricLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '600' },
  metricValue: { color: colors.text, fontSize: 22, fontWeight: '700' },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, padding: 10, gap: 6 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  lineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8 },
  lineLabel: { color: colors.text, fontSize: 12, flex: 1 },
  lineValue: { color: colors.primaryStrong, fontWeight: '700', fontSize: 12 },
});
