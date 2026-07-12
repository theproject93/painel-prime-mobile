import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import {
  deleteStoredFile,
  getPrivateFileDownloadUrl,
  linkStoredFile,
  uploadPrivateAsset,
} from '../lib/r2FileStorage';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { eventStatusLabel } from '../features/events/eventPresentation';

type EventItem = {
  id: string;
  name: string;
  event_date: string;
  location: string;
  status: string | null;
  event_type: string | null;
  couple_photo_file_id?: string | null;
  couple_photo_url: string | null;
};

const PAGE_SIZE = 30;
const EVENT_TYPE_CARDS: Record<
  'wedding' | 'birthday' | 'debutante' | 'corporate',
  { label: string; image: string }
> = {
  wedding: {
    label: 'Casamento',
    image:
      'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=900&q=60',
  },
  birthday: {
    label: 'Aniversario',
    image:
      'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=900&q=60',
  },
  debutante: {
    label: 'Debutante',
    image:
      'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=60',
  },
  corporate: {
    label: 'Corporativo',
    image:
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=60',
  },
};

export function EventsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const userId = user?.id;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [page, setPage] = useState(-1);
  const [hasMore, setHasMore] = useState(true);

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
  const [eventType, setEventType] = useState<'wedding' | 'birthday' | 'debutante' | 'corporate'>(
    'wedding',
  );
  const [uploadingCover, setUploadingCover] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const inFlightResetRef = useRef(false);
  const lastLoadedAtRef = useRef(0);

  const hydrateEventCoverUrls = useCallback(async (rows: EventItem[]) => {
    return Promise.all(
      rows.map(async (row) => {
        if (!row.couple_photo_file_id) return row;

        try {
          const signedUrl = await getPrivateFileDownloadUrl(row.couple_photo_file_id);
          return {
            ...row,
            couple_photo_url: signedUrl,
          };
        } catch {
          return row;
        }
      }),
    );
  }, []);

  const fetchEventsReset = useCallback(async (options?: { blocking?: boolean; force?: boolean }) => {
    const blocking = options?.blocking ?? !hasLoadedOnceRef.current;
    const force = options?.force ?? false;
    if (!userId) {
      setLoading(false);
      return;
    }

    if (inFlightResetRef.current && !force) {
      return;
    }
    inFlightResetRef.current = true;

    if (blocking) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('events')
        .select('id, name, event_date, location, status, event_type, couple_photo_url, couple_photo_file_id')
        .eq('user_id', userId)
        .or('status.is.null,status.neq.deleted')
        .order('event_date', { ascending: true })
        .range(0, PAGE_SIZE - 1);

      if (fetchError) {
        setError(fetchError.message);
      } else {
        const rows = await hydrateEventCoverUrls((data ?? []) as EventItem[]);
        setEvents(rows);
        setPage(0);
        setHasMore(rows.length === PAGE_SIZE);
        lastLoadedAtRef.current = Date.now();
        hasLoadedOnceRef.current = true;
      }
    } finally {
      inFlightResetRef.current = false;
      if (blocking) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, [hydrateEventCoverUrls, userId]);

  const fetchEventsAppend = useCallback(async () => {
    if (!userId || !hasMore || loadingMore) return;
    setLoadingMore(true);
    setError('');
    const nextPage = page + 1;
    const from = nextPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error: fetchError } = await supabase
      .from('events')
      .select('id, name, event_date, location, status, event_type, couple_photo_url, couple_photo_file_id')
      .eq('user_id', userId)
      .or('status.is.null,status.neq.deleted')
      .order('event_date', { ascending: true })
      .range(from, to);

    if (fetchError) {
      setError(fetchError.message);
    } else {
      const rows = await hydrateEventCoverUrls((data ?? []) as EventItem[]);
      setEvents((prev) => {
        const ids = new Set(prev.map((item) => item.id));
        return [...prev, ...rows.filter((item) => !ids.has(item.id))];
      });
      setPage(nextPage);
      setHasMore(rows.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [hasMore, hydrateEventCoverUrls, loadingMore, page, userId]);

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
      const shouldBlockingLoad = !hasLoadedOnceRef.current;
      const isStale = Date.now() - lastLoadedAtRef.current > 15000;

      if (shouldBlockingLoad || isStale) {
        void fetchEventsReset({ blocking: shouldBlockingLoad });
      }
    }, [fetchEventsReset]),
  );

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((item) => {
      const itemStatus = (item.status ?? 'active') as 'active' | 'completed' | string;
      if (statusFilter !== 'all' && itemStatus !== statusFilter) return false;
      if (!term) return true;
      return `${item.name} ${item.location}`.toLowerCase().includes(term);
    });
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
    const payload = {
      user_id: userId,
      name: name.trim(),
      event_date: eventDate,
      location: location.trim(),
      event_type: eventType,
      couple_photo_url: pendingCover ? null : coverExternalUrl.trim() || null,
      couple_photo_file_id: pendingCover?.fileId ?? null,
      status: 'active',
    };
    const { data, error: createError } = await supabase
      .from('events')
      .insert([payload])
      .select('id')
      .maybeSingle();

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

    if (pendingCover?.fileId && data?.id) {
      void linkStoredFile(pendingCover.fileId, data.id).catch(() => {
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
    await fetchEventsReset({ blocking: false, force: true });
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
    return (
      <View style={styles.centerPage}>
        <ActivityIndicator color={colors.primaryStrong} size="large" />
      </View>
    );
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
              <Pressable style={styles.loadMore} onPress={() => void fetchEventsAppend()}>
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

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingBottom: 20 },
  centerPage: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.mutedText, fontSize: 14 },
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  refreshText: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  newButton: { height: 42, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  newButtonText: { color: colors.primaryTextOn, fontWeight: '700', fontSize: 14 },
  filtersWrap: { gap: 8, marginBottom: 4 },
  listWrap: { flex: 1 },
  listContent: { gap: 10, paddingBottom: 20 },
  eventCard: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 6 },
  eventCover: { width: '100%', height: 120, borderRadius: 10 },
  eventName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  eventMeta: { color: colors.mutedText, fontSize: 13 },
  eventStatus: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: colors.primarySoft, color: colors.primaryStrong, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  emptyState: { paddingVertical: 40, alignItems: 'center', gap: 4 },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  emptyText: { color: colors.mutedText, fontSize: 13 },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: 10, marginBottom: 10 },
  errorText: { color: colors.dangerText, fontSize: 13, textAlign: 'center', fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', padding: 20, justifyContent: 'center' },
  modalCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  modalFormContent: { gap: 10, paddingBottom: 8 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  previewLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  previewImage: { width: '100%', height: 130, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.text },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2, marginBottom: 8 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2, marginBottom: 8 },
  typeCard: {
    width: '48%',
    height: 92,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'flex-end',
  },
  typeCardOn: {
    borderColor: colors.primaryStrong,
    borderWidth: 2,
  },
  typeImage: {
    ...StyleSheet.absoluteFillObject,
  },
  typeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  typeCardText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    padding: 8,
  },
  typePill: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.card },
  typePillSelected: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
  typePillText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  dangerPill: { borderWidth: 1, borderColor: '#FECACA', backgroundColor: colors.dangerBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  dangerPillText: { color: colors.dangerText, fontSize: 12, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  ghostButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center', height: 44 },
  ghostButtonText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  primaryButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center', height: 44 },
  primaryButtonText: { color: colors.primaryTextOn, fontWeight: '700', fontSize: 14 },
  loadMore: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  loadMoreText: { color: colors.text, fontWeight: '600', fontSize: 13 },
});
