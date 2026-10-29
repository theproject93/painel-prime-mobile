import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { useUserRole, type AssignedEvent } from '../contexts/UserRoleContext';
import { PrimeLogoLoader } from '../components/PrimeLogoLoader';
import { linkStoredFile } from '../lib/r2FileStorage';
import { colors } from '../theme/colors';
import { eventsScreenStyles as styles } from '../features/events/eventsScreenStyles';
import { eventStatusLabel } from '../features/events/eventPresentation';
import { EVENT_TYPE_CARDS, filterEvents, type EventItem } from '../features/events/eventsModel';
import { createEvent } from '../features/events/eventsService';
import { useEventsData } from '../features/events/useEventsData';
import { EmptyState } from '../components/ui/EmptyState';
import { AppHaptics } from '../lib/haptics';
import {
  CreateEventWizardModal,
  type CreateEventFormData,
} from '../features/events/CreateEventWizardModal';
import { EventAccordionCard } from '../features/team-dashboard/EventAccordionCard';

function formatPortariaDateLabel(dateString: string): string {
  try {
    const target = new Date(dateString);
    const now = new Date();
    const isToday =
      target.getDate() === now.getDate() &&
      target.getMonth() === now.getMonth() &&
      target.getFullYear() === now.getFullYear();

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      target.getDate() === tomorrow.getDate() &&
      target.getMonth() === tomorrow.getMonth() &&
      target.getFullYear() === tomorrow.getFullYear();

    const timeStr = target.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const hasTime = timeStr !== '00:00' && !dateString.includes('T00:00:00');

    if (isToday) {
      return hasTime ? `Hoje às ${timeStr}` : 'Hoje';
    }
    if (isTomorrow) {
      return hasTime ? `Amanhã às ${timeStr}` : 'Amanhã';
    }
    return target.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + (hasTime ? ` às ${timeStr}` : '');
  } catch {
    return 'Em breve';
  }
}

export function EventsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isOwner, isTeamMemberOnly, assignedEvents, refreshAssignedEvents } = useUserRole();
  const insets = useSafeAreaInsets();
  const userId = user?.id;
  const data = useEventsData(userId);
  const { events, loading, refreshing, loadingMore, error, setError, hasMore } = data;
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isOwner && data.shouldRefresh()) void data.reset();
      void refreshAssignedEvents();
    }, [isOwner, data.reset, refreshAssignedEvents]),
  );

  const filteredEvents = useMemo(() => {
    return filterEvents(events, search, statusFilter);
  }, [events, search, statusFilter]);

  const filteredAssignedEvents = useMemo(() => {
    if (!search.trim()) return assignedEvents;
    const q = search.toLowerCase();
    return assignedEvents.filter(
      (ev) =>
        ev.name.toLowerCase().includes(q) ||
        (ev.location && ev.location.toLowerCase().includes(q)) ||
        (ev.team_name && ev.team_name.toLowerCase().includes(q)) ||
        (ev.role && ev.role.toLowerCase().includes(q)),
    );
  }, [assignedEvents, search]);

  // Busca o próximo evento ativo nas próximas 48h para o atalho rápido da Portaria Prime
  const upcomingPortariaEvent = useMemo(() => {
    if (!isOwner || events.length === 0) return null;
    const now = Date.now();
    const limit48h = now + 48 * 60 * 60 * 1000;
    const marginPast = now - 12 * 60 * 60 * 1000; // Margem para evento de hoje

    const candidates = events.filter((ev) => {
      const status = (ev.status || '').toLowerCase();
      if (
        status === 'cancelado' ||
        status === 'cancelled' ||
        status === 'concluido' ||
        status === 'completed'
      ) {
        return false;
      }
      const evTime = new Date(ev.event_date).getTime();
      return evTime >= marginPast && evTime <= limit48h;
    });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    return candidates[0];
  }, [isOwner, events]);

  async function handleCreateEvent(form: CreateEventFormData) {
    if (!userId || creating) return;
    setCreating(true);
    setError('');

    const { data: created, error: createError } = await createEvent(userId, {
      name: form.name,
      eventDate: form.eventDate,
      location: form.location,
      eventType: form.eventType,
      coverExternalUrl: form.coverExternalUrl,
      coverFileId: form.coverFileId,
      budgetTotal: form.budgetTotal,
      guestsPlanned: form.guestsPlanned,
    });

    if (createError) {
      setError(createError.message);
      setCreating(false);
      throw createError;
    }

    if (form.coverFileId && created?.id) {
      void linkStoredFile(form.coverFileId, created.id).catch(() => {});
    }

    setCreating(false);
    if (created) await data.insert(created as EventItem);
    setIsCreateModalOpen(false);
  }

  if (loading && isOwner) {
    return <PrimeLogoLoader label="Organizando seus eventos" />;
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {isTeamMemberOnly ? 'Seus Eventos' : 'Eventos'}
          </Text>
          <Text style={styles.subtitle}>
            {isTeamMemberOnly
              ? 'Eventos escalados para você'
              : 'Acesse e gerencie seus eventos'}
          </Text>
        </View>
        {!isTeamMemberOnly ? (
          <Pressable
            style={styles.newButton}
            onPress={() => {
              void AppHaptics.light();
              setIsCreateModalOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Criar novo evento"
          >
            <Text style={styles.newButtonText}>Novo</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Atalho Portaria Prime para a assessora caso haja evento nas próximas 48h */}
      {!isTeamMemberOnly && upcomingPortariaEvent ? (
        <View style={screenLocalStyles.portariaShortcutCard}>
          <View style={screenLocalStyles.portariaShortcutHeader}>
            <View style={screenLocalStyles.portariaShortcutBadge}>
              <Ionicons name="qr-code-outline" size={16} color={colors.gold700} />
              <Text style={screenLocalStyles.portariaShortcutBadgeText}>Portaria Prime</Text>
            </View>
            <Text style={screenLocalStyles.portariaShortcutTiming}>
              {formatPortariaDateLabel(upcomingPortariaEvent.event_date)}
            </Text>
          </View>
          <Text style={screenLocalStyles.portariaShortcutEventName} numberOfLines={1}>
            {upcomingPortariaEvent.name}
          </Text>
          <Pressable
            style={screenLocalStyles.portariaShortcutButton}
            onPress={() => {
              void AppHaptics.medium();
              router.push(`/eventos/${upcomingPortariaEvent.id}/portaria`);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Abrir Scanner da Portaria Prime para o evento ${upcomingPortariaEvent.name}`}
          >
            <Text style={screenLocalStyles.portariaShortcutButtonText}>Abrir Scanner</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primaryTextOn} />
          </Pressable>
        </View>
      ) : null}

      {refreshing ? (
        <View style={styles.refreshRow}>
          <ActivityIndicator color={colors.primaryStrong} size="small" />
          <Text style={styles.refreshText}>Atualizando eventos...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.filtersWrap}>
        <TextInput
          style={styles.input}
          placeholder="Buscar por nome/local"
          placeholderTextColor={colors.mutedText}
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Buscar eventos por nome ou local"
        />
        {!isTeamMemberOnly ? (
          <View style={styles.typeRow}>
            <Pill
              label="Todos"
              selected={statusFilter === 'all'}
              onPress={() => {
                setStatusFilter('all');
                void AppHaptics.selection();
              }}
            />
            <Pill
              label="Ativos"
              selected={statusFilter === 'active'}
              onPress={() => {
                setStatusFilter('active');
                void AppHaptics.selection();
              }}
            />
            <Pill
              label="Concluídos"
              selected={statusFilter === 'completed'}
              onPress={() => {
                setStatusFilter('completed');
                void AppHaptics.selection();
              }}
            />
          </View>
        ) : null}
      </View>

      {!isTeamMemberOnly ? (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              style={styles.eventCard}
              onPress={() => router.push(`/eventos/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir evento ${item.name}`}
            >
              <Image
                source={{
                  uri:
                    item.couple_photo_url?.trim() ||
                    EVENT_TYPE_CARDS[(item.event_type as keyof typeof EVENT_TYPE_CARDS) || 'wedding'].image,
                }}
                style={styles.eventCover}
              />
              <Text style={styles.eventName}>{item.name}</Text>
              <Text style={styles.eventMeta}>
                {new Date(item.event_date).toLocaleDateString('pt-BR')} | {item.location}
              </Text>
              <Text style={styles.eventStatus}>{eventStatusLabel(item.status)}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              iconName="calendar-outline"
              title="Nenhum evento encontrado"
              message={
                search.trim() || statusFilter !== 'all'
                  ? 'Nenhum evento corresponde aos filtros selecionados. Tente ajustar a busca.'
                  : 'Crie seu primeiro evento para começar a gerenciar sua assessoria com maestria.'
              }
              actionLabel="Criar Primeiro Evento"
              onAction={() => {
                void AppHaptics.medium();
                setIsCreateModalOpen(true);
              }}
            />
          }
          ListFooterComponent={
            hasMore ? (
              <Pressable style={styles.loadMore} onPress={() => void data.append()}>
                {loadingMore ? (
                  <ActivityIndicator color={colors.primaryStrong} />
                ) : (
                  <Text style={styles.loadMoreText}>Carregar mais do servidor</Text>
                )}
              </Pressable>
            ) : null
          }
        />
      ) : (
        <FlatList
          data={filteredAssignedEvents}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }: { item: AssignedEvent; index: number }) => (
            <EventAccordionCard
              event={item}
              isFirst={index === 0}
              onOpenPortaria={(eventId) => {
                void AppHaptics.medium();
                router.push(`/eventos/${eventId}/portaria`);
              }}
              onOpenBriefing={(eventId) => {
                void AppHaptics.light();
                router.push(`/eventos/${eventId}`);
              }}
              onOpenTimeline={(eventId) => {
                void AppHaptics.light();
                router.push(`/eventos/${eventId}?initialTab=timeline`);
              }}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              iconName="people-outline"
              title="Nenhuma escala encontrada"
              message={
                search.trim()
                  ? 'Nenhum evento escalado corresponde à busca.'
                  : 'Você não possui escalas ativas de equipe no momento. Assim que a assessoria incluir você em um evento, ele aparecerá aqui com acesso direto à Portaria Prime.'
              }
              actionLabel="Atualizar Escalas"
              onAction={() => {
                void AppHaptics.medium();
                void refreshAssignedEvents();
              }}
            />
          }
        />
      )}

      <CreateEventWizardModal
        visible={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateEvent}
        creating={creating}
        error={error}
        onClearError={() => setError('')}
      />
    </View>
  );
}

function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={`Filtrar por ${label}`}
      style={[styles.typePill, selected ? styles.typePillSelected : null]}
    >
      <Text style={styles.typePillText}>{label}</Text>
    </Pressable>
  );
}

const screenLocalStyles = StyleSheet.create({
  portariaShortcutCard: {
    backgroundColor: '#0A1E32',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  portariaShortcutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  portariaShortcutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  portariaShortcutBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  portariaShortcutTiming: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E0E7FF',
  },
  portariaShortcutEventName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  portariaShortcutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryStrong,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 6,
  },
  portariaShortcutButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryTextOn,
  },
  assignedCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  assignedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  assignedRoleBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  assignedRoleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  assignedTeamText: {
    fontSize: 12,
    color: colors.mutedText,
  },
  assignedActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  portariaPrimaryCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryStrong,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    shadowColor: colors.primaryStrong,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  portariaPrimaryCTAText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryTextOn,
  },
});
