import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { WalkthroughAnchorTarget } from '../components/WalkthroughAnchors';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { fontSize, fontWeight, radii, shadows, spacing } from '../theme/tokens';

type Stats = {
  events: number;
  clients: number;
  entries: number;
  tasksDone: number;
};

export function MoreScreen() {
  const router = useRouter();
  const { user, signOut, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState<Stats>({ events: 0, clients: 0, entries: 0, tasksDone: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [days, setDays] = useState('90');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    const since = new Date();
    since.setDate(since.getDate() - 365);
    const sinceIso = since.toISOString();

    const [eventsRes, clientsRes, entriesRes] = await Promise.all([
      supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .or('status.is.null,status.neq.deleted'),
      supabase.from('crm_clients').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase
        .from('user_finance_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', sinceIso),
    ]);

    if (eventsRes.error || clientsRes.error || entriesRes.error) {
      setError(eventsRes.error?.message || clientsRes.error?.message || entriesRes.error?.message || 'Falha ao carregar indicadores.');
      setLoading(false);
      return;
    }

    const { data: eventRows } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', user.id)
      .or('status.is.null,status.neq.deleted');
    const eventIds = (eventRows ?? []).map((e) => e.id);

    let doneCount = 0;
    if (eventIds.length > 0) {
      const tasksRes = await supabase
        .from('event_tasks')
        .select('id', { count: 'exact', head: true })
        .in('event_id', eventIds)
        .eq('completed', true)
        .gte('created_at', sinceIso);
      doneCount = tasksRes.count ?? 0;
    }

    setStats({
      events: eventsRes.count ?? 0,
      clients: clientsRes.count ?? 0,
      entries: entriesRes.count ?? 0,
      tasksDone: doneCount,
    });
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function exportSummary() {
    if (!user) return;
    setBusy(true);
    setError('');
    const d = Number(days);
    const safeDays = Number.isFinite(d) && d > 0 ? d : 90;
    const since = new Date();
    since.setDate(since.getDate() - safeDays);
    const sinceIso = since.toISOString();

    const entriesRes = await supabase
      .from('user_finance_entries')
      .select('amount,description,created_at')
      .eq('user_id', user.id)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(120);
    if (entriesRes.error) {
      setError(entriesRes.error.message);
      setBusy(false);
      return;
    }

    const total = (entriesRes.data ?? []).reduce((sum, row: any) => sum + Number(row.amount ?? 0), 0);
    const text = [
      `Resumo Painel Prime (${safeDays} dias)`,
      `Usuário: ${user.email ?? '-'}`,
      `Eventos ativos: ${stats.events}`,
      `Clientes: ${stats.clients}`,
      `Lançamentos financeiros: ${stats.entries}`,
      `Tarefas concluídas: ${stats.tasksDone}`,
      `Total financeiro no período: ${toBRL(total)}`,
    ].join('\n');
    await Share.share({ message: text });
    setBusy(false);
  }

  function confirmCleanup() {
    Alert.alert('Confirmar limpeza', 'Remover registros antigos concluídos/excluídos do período informado?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpar',
        style: 'destructive',
        onPress: () => {
          void runCleanup();
        },
      },
    ]);
  }

  async function runCleanup() {
    if (!user) return;
    setBusy(true);
    setError('');
    const d = Number(days);
    const safeDays = Number.isFinite(d) && d > 0 ? d : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - safeDays);
    const cutoffIso = cutoff.toISOString();

    const eventsRes = await supabase.from('events').select('id').eq('user_id', user.id);
    if (eventsRes.error) {
      setError(eventsRes.error.message);
      setBusy(false);
      return;
    }
    const ids = (eventsRes.data ?? []).map((e) => e.id);
    if (ids.length > 0) {
      await supabase
        .from('event_tasks')
        .delete()
        .in('event_id', ids)
        .eq('completed', true)
        .lt('created_at', cutoffIso);
    }
    await supabase
      .from('events')
      .delete()
      .eq('user_id', user.id)
      .eq('status', 'deleted')
      .lt('created_at', cutoffIso);

    setBusy(false);
    await load();
  }

  type MenuItem = {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    route: string;
  };

  type MenuSection = {
    title: string;
    items: MenuItem[];
  };

  const contaSection: MenuSection = {
    title: 'Conta',
    items: [
      { label: 'Perfil', icon: 'person-outline', route: '/mais/perfil' },
      { label: 'Configurações', icon: 'settings-outline', route: '/mais/configuracoes' },
    ],
  };

  const ferramentasSection: MenuSection = {
    title: 'Ferramentas',
    items: [
      { label: 'Planejamento', icon: 'calendar-outline', route: '/mais/planejamento' },
      { label: 'Saúde Operacional', icon: 'heart-outline', route: '/mais/saude-operacional' },
    ],
  };

  const adminSection: MenuSection = {
    title: 'Admin',
    items: [
      { label: 'Assinaturas', icon: 'shield-checkmark-outline', route: '/mais/assinaturas' },
      { label: 'Relatórios', icon: 'bar-chart-outline', route: '/mais/relatorios' },
    ],
  };

  const sections: MenuSection[] = [contaSection, ferramentasSection, ...(isSuperAdmin ? [adminSection] : [])];

  return (
    <Screen title="Mais" subtitle="Ferramentas administrativas e conta">
      <WalkthroughAnchorTarget id="more.navigation" borderRadius={radii.lg}>
        {sections.map((section, sIdx) => (
          <View key={section.title} style={sIdx > 0 ? styles.sectionGap : undefined}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, iIdx) => (
                <View key={item.route}>
                  {iIdx > 0 ? <View style={styles.separator} /> : null}
                  <Pressable
                    style={styles.menuRow}
                    onPress={() => router.push(item.route as any)}
                  >
                    <Ionicons name={item.icon} size={20} color={colors.mutedText} />
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.mutedText} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ))}
      </WalkthroughAnchorTarget>

      <WalkthroughAnchorTarget id="more.tools" borderRadius={radii.lg}>
        <View style={styles.toolsSection}>
          <View style={styles.card}>
            <Text style={styles.email}>{user?.email ?? '-'}</Text>
            {loading ? (
              <ActivityIndicator color={colors.primaryStrong} />
            ) : (
              <>
                <Text style={styles.menuItem}>Eventos ativos: {stats.events}</Text>
                <Text style={styles.menuItem}>Clientes: {stats.clients}</Text>
                <Text style={styles.menuItem}>Lançamentos financeiros: {stats.entries}</Text>
                <Text style={styles.menuItem}>Tarefas concluídas: {stats.tasksDone}</Text>
              </>
            )}
            {error ? <Text style={styles.err}>{error}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Período (dias)</Text>
            <TextInput style={styles.input} value={days} onChangeText={setDays} keyboardType="numeric" />
            <View style={styles.row}>
              <Pressable style={styles.actionButton} onPress={() => void exportSummary()}>
                <Text style={styles.actionText}>{busy ? 'Processando...' : 'Exportar resumo'}</Text>
              </Pressable>
              <Pressable style={styles.dangerButton} onPress={confirmCleanup}>
                <Text style={styles.dangerText}>Limpar antigos</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </WalkthroughAnchorTarget>

      <WalkthroughAnchorTarget id="more.logout" borderRadius={radii.md}>
        <Pressable onPress={() => void signOut()} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </Pressable>
      </WalkthroughAnchorTarget>
    </Screen>
  );
}

function toBRL(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const styles = StyleSheet.create({
  sectionGap: { marginTop: spacing.lg },
  sectionTitle: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    ...shadows.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  menuLabel: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
    marginRight: spacing.md,
  },
  toolsSection: { gap: spacing.md, marginTop: spacing.lg },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
  email: { color: colors.mutedText, fontSize: fontSize.sm, marginBottom: spacing.xs },
  menuItem: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  err: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: radii.sm, padding: spacing.sm, textAlign: 'center' },
  label: { color: colors.mutedText, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, color: colors.text },
  row: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { flex: 1, minHeight: 42, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  actionText: { color: colors.primaryTextOn, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  dangerButton: { flex: 1, minHeight: 42, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FECACA', backgroundColor: colors.dangerBg },
  dangerText: { color: colors.dangerText, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  logoutButton: { borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, marginTop: spacing.lg },
  logoutText: { color: colors.text, fontWeight: fontWeight.bold, fontSize: fontSize.md },
});
