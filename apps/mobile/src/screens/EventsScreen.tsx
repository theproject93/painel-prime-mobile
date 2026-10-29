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
import { useOperatingMode, type AssignedEvent } from '../contexts/OperatingModeContext';
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

export function EventsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { mode, setMode, assignedEvents, refreshAssignedEvents } = useOperatingMode();
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
      if (data.shouldRefresh()) void data.reset();
      void refreshAssignedEvents();
    }, [data.reset, refreshAssignedEvents]),
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

  if (loading) {
    return <PrimeLogoLoader label="Organizando seus eventos" />;
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Eventos</Text>
          <Text style={styles.subtitle}>
            {mode === 'assessoria'
              ? 'Acesse e gerencie seus eventos'
              : 'Eventos escalados para sua equipe'}
          </Text>
        </View>
        {mode === 'assessoria' ? (
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

      <View style={screenLocalStyles.modeSwitcherWrap}>
        <Pressable
          style={[
            screenLocalStyles.modeTab,
            mode === 'assessoria' && screenLocalStyles.modeTabActive,
          ]}
          onPress={() => {
            void AppHaptics.selection();
            setMode('assessoria');
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'assessoria' }}
          accessibilityLabel="Modo Assessoria"
        >
          <Ionicons
            name="briefcase-outline"
            size={16}
            color={mode === 'assessoria' ? colors.primaryTextOn : colors.mutedText}
          />
          <Text
            style={[
              screenLocalStyles.modeTabText,
              mode === 'assessoria' && screenLocalStyles.modeTabTextActive,
            ]}
          >
            Modo Assessoria
          </Text>
        </Pressable>

        <Pressable
          style={[
            screenLocalStyles.modeTab,
            mode === 'equipe' && screenLocalStyles.modeTabActive,
          ]}
          onPress={() => {
            void AppHaptics.selection();
            setMode('equipe');
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'equipe' }}
          accessibilityLabel="Modo Equipe"
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={mode === 'equipe' ? colors.primaryTextOn : colors.mutedText}
          />
          <Text
            style={[
              screenLocalStyles.modeTabText,
              mode === 'equipe' && screenLocalStyles.modeTabTextActive,
            ]}
          >
            Modo Equipe
          </Text>
          {assignedEvents.length > 0 ? (
            <View
              style={[
                screenLocalStyles.badgeCount,
                mode === 'equipe' && screenLocalStyles.badgeCountActive,
              ]}
            >
              <Text
                style={[
                  screenLocalStyles.badgeCountText,
                  mode === 'equipe' && screenLocalStyles.badgeCountTextActive,
                ]}
              >
                {assignedEvents.length}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

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
        {mode === 'assessoria' ? (
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

      {mode === 'assessoria' ? (
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
          renderItem={({ item }: { item: AssignedEvent }) => (
            <Pressable
              style={screenLocalStyles.assignedCard}
              onPress={() => router.push(`/eventos/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir evento ${item.name}`}
            >
              <View style={screenLocalStyles.assignedHeader}>
                <Text style={styles.eventName}>{item.name}</Text>
                <View style={screenLocalStyles.assignedRoleBadge}>
                  <Text style={screenLocalStyles.assignedRoleText}>
                    {item.role || 'Equipe'}
                  </Text>
                </View>
              </View>

              <Text style={styles.eventMeta}>
                {new Date(item.event_date).toLocaleDateString('pt-BR')} | {item.location || item.location_city || 'Local a confirmar'}
              </Text>

              {item.team_name ? (
                <Text style={screenLocalStyles.assignedTeamText}>
                  Equipe: {item.team_name}
                </Text>
              ) : null}

              <View style={screenLocalStyles.assignedActionRow}>
                <Text style={styles.eventStatus}>{eventStatusLabel(item.status)}</Text>
                <Pressable
                  style={screenLocalStyles.portariaButton}
                  onPress={() => router.push(`/eventos/${item.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir Portaria do evento ${item.name}`}
                >
                  <Ionicons name="qr-code-outline" size={16} color={colors.primaryStrong} />
                  <Text style={screenLocalStyles.portariaButtonText}>Portaria Prime</Text>
                </Pressable>
              </View>
            </Pressable>
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
  modeSwitcherWrap: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    marginBottom: 12,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  modeTabActive: {
    backgroundColor: colors.primary,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedText,
  },
  modeTabTextActive: {
    color: colors.primaryTextOn,
    fontWeight: '700',
  },
  badgeCount: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  badgeCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  badgeCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryStrong,
  },
  badgeCountTextActive: {
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
  portariaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  portariaButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryStrong,
  },
});
