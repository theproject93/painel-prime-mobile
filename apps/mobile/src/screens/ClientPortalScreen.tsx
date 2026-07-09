import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { colors } from '../theme/colors';

type EventData = {
  id: string;
  name: string;
  slug: string | null;
  event_date: string | null;
};

type PortalAccessData = {
  portal_active: boolean | null;
  portal_slug: string | null;
  allow_guest_list: boolean | null;
  allow_portfolio: boolean | null;
};

type PortalStats = {
  guestCount: number;
  rsvpCount: number;
  messageCount: number;
};

export function ClientPortalScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [portalAccess, setPortalAccess] = useState<PortalAccessData | null>(null);
  const [portalStats, setPortalStats] = useState<PortalStats>({
    guestCount: 0,
    rsvpCount: 0,
    messageCount: 0,
  });

  const load = useCallback(async () => {
    if (!eventId || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    const { data: eventRow, error: eventError } = await supabase
      .from('events')
      .select('id, name, slug, event_date')
      .eq('id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (eventError) {
      setError(eventError.message);
      setLoading(false);
      return;
    }

    if (!eventRow) {
      setError('Evento não encontrado.');
      setLoading(false);
      return;
    }

    setEventData(eventRow as EventData);

    const { data: accessRow } = await supabase
      .from('event_client_access')
      .select('portal_active, portal_slug, allow_guest_list, allow_portfolio')
      .eq('event_id', eventId)
      .maybeSingle();

    setPortalAccess(
      accessRow
        ? (accessRow as PortalAccessData)
        : { portal_active: false, portal_slug: null, allow_guest_list: false, allow_portfolio: false },
    );

    try {
      const [guestRes, rsvpRes] = await Promise.all([
        supabase
          .from('event_guests')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId),
        supabase
          .from('event_guests')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('confirmed', true),
      ]);

      setPortalStats({
        guestCount: guestRes.count ?? 0,
        rsvpCount: rsvpRes.count ?? 0,
        messageCount: 0,
      });
    } catch {
      // Stats are optional; ignore errors silently.
    }

    setLoading(false);
  }, [eventId, user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const portalSlug = portalAccess?.portal_slug || eventData?.slug || eventId;
  const portalUrl = portalSlug
    ? `https://painelprime.com.br/portal/${portalSlug}`
    : null;

  const portalActive = portalAccess?.portal_active ?? false;

  async function handleShareLink() {
    if (!portalUrl) {
      Alert.alert('Link indisponível', 'O portal ainda não foi configurado.');
      return;
    }
    try {
      await Share.share({
        message: `Acesse o portal do evento "${eventData?.name ?? 'Evento'}": ${portalUrl}`,
      });
    } catch {
      // Share cancelled or failed silently.
    }
  }

  async function handleCopyLink() {
    if (!portalUrl) {
      Alert.alert('Link indisponível', 'O portal ainda não foi configurado.');
      return;
    }
    try {
      await Share.share({
        message: portalUrl,
      });
    } catch {
      // Copy/share cancelled or failed silently.
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryStrong} size="large" />
      </View>
    );
  }

  if (error || !eventData) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Evento não encontrado.'}</Text>
        <Button title="Voltar" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Portal do Cliente</Text>
        <Text style={styles.subtitle}>Gerencie o acesso do cliente ao portal</Text>
      </View>

      <Card title={eventData.name} subtitle={eventData.event_date ? new Date(eventData.event_date).toLocaleDateString('pt-BR') : 'Sem data definida'}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status do portal:</Text>
          <View
            style={[
              styles.statusBadge,
              portalActive ? styles.statusActive : styles.statusInactive,
            ]}
          >
            <Text style={portalActive ? styles.statusTextActive : styles.statusTextInactive}>
              {portalActive ? 'Ativo' : 'Inativo'}
            </Text>
          </View>
        </View>

        {portalUrl ? (
          <View style={styles.linkRow}>
            <Text style={styles.linkLabel}>Link do portal</Text>
            <Text style={styles.linkValue} numberOfLines={2}>
              {portalUrl}
            </Text>
            <View style={styles.linkActions}>
              <Button
                title="Copiar link"
                variant="ghost"
                size="sm"
                onPress={handleCopyLink}
              />
              <Button
                title="Compartilhar"
                variant="ghost"
                size="sm"
                onPress={handleShareLink}
              />
            </View>
          </View>
        ) : (
          <Text style={styles.noLink}>Portal ainda não configurado. Acesse as configurações do evento para ativar.</Text>
        )}
      </Card>

      {portalActive && (
        <View style={styles.statsGrid}>
          <StatCard
            label="Convidados"
            value={portalStats.guestCount}
            tone="blue"
          />
          <StatCard
            label="RSVPs"
            value={portalStats.rsvpCount}
            tone="green"
          />
          <StatCard
            label="Mensagens"
            value={portalStats.messageCount}
            tone="amber"
          />
        </View>
      )}

      <Card title="Permissões">
        <View style={styles.permissionItem}>
          <Text style={styles.permissionLabel}>Lista de convidados</Text>
          <Text style={styles.permissionValue}>
            {portalAccess?.allow_guest_list ? 'Habilitada' : 'Desabilitada'}
          </Text>
        </View>
        <View style={styles.permissionItem}>
          <Text style={styles.permissionLabel}>Portfólio</Text>
          <Text style={styles.permissionValue}>
            {portalAccess?.allow_portfolio ? 'Habilitado' : 'Desabilitado'}
          </Text>
        </View>
      </Card>

      <View style={styles.actions}>
        {portalUrl ? (
          <Button
            title="Abrir Portal"
            onPress={() => {
              Share.share({ message: portalUrl });
            }}
          />
        ) : null}
        <Button
          title="Compartilhar Link"
          variant="ghost"
          onPress={handleShareLink}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
  },
  header: {
    marginTop: 10,
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: colors.mutedText,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusActive: {
    backgroundColor: colors.successBg,
  },
  statusInactive: {
    backgroundColor: colors.surfaceSubtle,
  },
  statusTextActive: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.successText,
  },
  statusTextInactive: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedText,
  },
  linkRow: {
    gap: 6,
  },
  linkLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedText,
  },
  linkValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 8,
    padding: 8,
  },
  linkActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  noLink: {
    fontSize: 13,
    color: colors.mutedText,
    fontStyle: 'italic',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  permissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  permissionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  permissionValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedText,
  },
  actions: {
    gap: 10,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.dangerText,
    textAlign: 'center',
  },
});
