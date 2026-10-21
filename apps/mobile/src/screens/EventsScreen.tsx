import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
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
    }, [data.reset]),
  );

  const filteredEvents = useMemo(() => {
    return filterEvents(events, search, statusFilter);
  }, [events, search, statusFilter]);

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
          <Text style={styles.subtitle}>Acesse e gerencie seus eventos</Text>
        </View>
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
      </View>

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
