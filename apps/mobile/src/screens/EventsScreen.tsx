import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { PrimeLogoLoader } from '../components/PrimeLogoLoader';
import {
  deleteStoredFile,
  getPrivateFileDownloadUrl,
  linkStoredFile,
  uploadPrivateAsset,
} from '../lib/r2FileStorage';
import { colors } from '../theme/colors';
import { eventsScreenStyles as styles } from '../features/events/eventsScreenStyles';
import { eventStatusLabel } from '../features/events/eventPresentation';
import { EVENT_TYPE_CARDS, filterEvents, type EventItem, type EventType } from '../features/events/eventsModel';
import { createEvent } from '../features/events/eventsService';
import { useEventsData } from '../features/events/useEventsData';

export function EventsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const userId = user?.id;
  const data = useEventsData(userId);
  const { events, loading, refreshing, loadingMore, error, setError, hasMore } = data;
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [coverExternalUrl, setCoverExternalUrl] = useState('');
  const [coverUpload, setCoverUpload] = useState<{
    fileId: string;
    objectKey: string;
    previewUrl: string;
  } | null>(null);
  const [eventType, setEventType] = useState<EventType>(
    'wedding',
  );
  const [uploadingCover, setUploadingCover] = useState(false);

  function resetCreateForm() {
    const pendingCover = coverUpload;
    setName('');
    setEventDate('');
    setLocation('');
    setCoverExternalUrl('');
    setCoverUpload(null);
    setEventType('wedding');
    setIsCreateModalOpen(false);

    if (pendingCover?.fileId) {
      void deleteStoredFile(pendingCover.fileId).catch(() => {
        // Best effort cleanup only.
      });
    }
  }

  function handleCoverUrlChange(value: string) {
    const pendingCover = coverUpload;
    setCoverExternalUrl(value);
    if (pendingCover) {
      setCoverUpload(null);
      void deleteStoredFile(pendingCover.fileId).catch(() => {
        // Best effort cleanup only.
      });
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (data.shouldRefresh()) void data.reset();
    }, [data.reset]),
  );

  const filteredEvents = useMemo(() => {
    return filterEvents(events, search, statusFilter);
  }, [events, search, statusFilter]);

  async function handleCreateEvent() {
    if (!userId || creating) return;
    if (!name.trim() || !eventDate.trim() || !location.trim()) {
      setError('Preencha nome, data e local do evento.');
      return;
    }

    setCreating(true);
    setError('');
    const pendingCover = coverUpload;
    const { data: created, error: createError } = await createEvent(userId, { name, eventDate, location, eventType, coverExternalUrl, coverFileId: pendingCover?.fileId });

    if (createError) {
      setError(createError.message);
      if (pendingCover?.fileId) {
        void deleteStoredFile(pendingCover.fileId).catch(() => {
          // Best effort cleanup only.
        });
      }
      setCoverUpload(null);
      setCreating(false);
      return;
    }

    if (pendingCover?.fileId && created?.id) {
      void linkStoredFile(pendingCover.fileId, created.id).catch(() => {
        // Best effort only.
      });
    }

    setName('');
    setEventDate('');
    setLocation('');
    setCoverExternalUrl('');
    setCoverUpload(null);
    setEventType('wedding');
    setIsCreateModalOpen(false);
    setCreating(false);
    if (created) await data.insert(created as EventItem);
  }

  async function pickCoverFromGallery() {
    if (uploadingCover) return;
    setUploadingCover(true);
    setError('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Permissao da galeria negada.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || result.assets.length === 0) {
        setUploadingCover(false);
        return;
      }
      const asset = result.assets[0];
      const ext = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
      const previousCover = coverUpload;
      const upload = await uploadPrivateAsset({
        uri: asset.uri,
        fileName: `cover-${Date.now()}.${ext}`,
        contentType: asset.mimeType ?? 'image/jpeg',
        byteSize: asset.fileSize ?? null,
        entityType: 'event_photo',
      });
      const signedUrl = await getPrivateFileDownloadUrl(upload.fileId);
      if (previousCover?.fileId) {
        void deleteStoredFile(previousCover.fileId).catch(() => {
          // Best effort only.
        });
      }
      setCoverExternalUrl('');
      setCoverUpload({
        fileId: upload.fileId,
        objectKey: upload.objectKey,
        previewUrl: signedUrl,
      });
    } catch (pickError: any) {
      setError(pickError?.message ?? 'Não foi possível carregar a imagem.');
    } finally {
      setUploadingCover(false);
    }
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
                  <Pressable style={styles.newButton} onPress={() => setIsCreateModalOpen(true)}>
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
          />
          <View style={styles.typeRow}>
            <Pill label="Todos" selected={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
            <Pill label="Ativos" selected={statusFilter === 'active'} onPress={() => setStatusFilter('active')} />
            <Pill label="Concluídos" selected={statusFilter === 'completed'} onPress={() => setStatusFilter('completed')} />
          </View>
        </View>

              <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              style={styles.eventCard}
              onPress={() => router.push(`/eventos/${item.id}`)}
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
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Nenhum evento encontrado</Text>
              <Text style={styles.emptyText}>Crie seu primeiro evento para comecar.</Text>
            </View>
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

      <Modal visible={isCreateModalOpen} transparent animationType="fade" onRequestClose={resetCreateForm}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalCard, { maxHeight: windowHeight * 0.85 }]}>
            <Text style={styles.modalTitle}>Novo evento</Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalFormContent}
            >
              <TextInput style={styles.input} placeholder="Nome do evento" value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Data (AAAA-MM-DD)" value={eventDate} onChangeText={setEventDate} />
              <TextInput style={styles.input} placeholder="Local" value={location} onChangeText={setLocation} />
              <Text style={styles.previewLabel}>Capa do evento (preview)</Text>
              <Image source={{ uri: coverUpload?.previewUrl || coverExternalUrl.trim() || EVENT_TYPE_CARDS[eventType].image }} style={styles.previewImage} />
              <TextInput style={styles.input} placeholder="URL da capa (opcional)" value={coverExternalUrl} onChangeText={handleCoverUrlChange} />
              <Pressable style={styles.ghostButton} onPress={() => void pickCoverFromGallery()}>
                <Text style={styles.ghostButtonText}>
                  {uploadingCover ? 'Enviando imagem...' : 'Selecionar imagem do celular'}
                </Text>
              </Pressable>
              <View style={styles.typeGrid}>
                {(['wedding', 'birthday', 'debutante', 'corporate'] as const).map((typeOption) => (
                  <Pressable
                    key={typeOption}
                    onPress={() => setEventType(typeOption)}
                    style={[styles.typeCard, eventType === typeOption ? styles.typeCardOn : null]}
                  >
                    <Image source={{ uri: EVENT_TYPE_CARDS[typeOption].image }} style={styles.typeImage} />
                    <View style={styles.typeOverlay} />
                    <Text style={styles.typeCardText}>{EVENT_TYPE_CARDS[typeOption].label}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.modalActions}>
                <Pressable style={styles.ghostButton} onPress={resetCreateForm}>
                  <Text style={styles.ghostButtonText}>Cancelar</Text>
                </Pressable>
                <Pressable style={styles.primaryButton} onPress={() => void handleCreateEvent()}>
                  {creating ? <ActivityIndicator color={colors.primaryTextOn} /> : <Text style={styles.primaryButtonText}>Criar</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.typePill, selected ? styles.typePillSelected : null]}>
      <Text style={styles.typePillText}>{label}</Text>
    </Pressable>
  );
}
