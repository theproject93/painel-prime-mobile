import { useCallback, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { getEventPersonaCopy, getHumanGreeting, pickMotivationalQuote } from '@painel-prime/app';

import { PrimeLogoLoader } from '../components/PrimeLogoLoader';
import { Screen } from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { eventStatusLabel } from '../features/events/eventPresentation';
import { getPrivateFileDownloadUrl, uploadPrivateAsset } from '../lib/r2FileStorage';
import { supabase } from '../lib/supabase';
import type { EventDetailsInitialTab } from '../navigation/eventRouteTypes';
import { colors } from '../theme/colors';

type EventRow = {
  id: string;
  name: string;
  event_date: string;
  location: string | null;
  status: string | null;
  event_type: string | null;
  couple_photo_url: string | null;
  couple_photo_file_id: string | null;
};
type TaskRow = {
  event_id: string;
  due_date: string | null;
  text: string | null;
  completed: boolean | null;
  priority: string | null;
};
type ProfileRow = { display_name: string | null; avatar_url: string | null; avatar_file_id: string | null };
type Shortcut = { id: string; label: string; description: string; tab: EventDetailsInitialTab; icon: keyof typeof Ionicons.glyphMap };

const SHORTCUTS: Shortcut[] = [
  { id: 'invites', label: 'Confirmar convidados', description: 'Enviar convites e acompanhar respostas.', tab: 'invites', icon: 'mail-open-outline' },
  { id: 'tasks', label: 'Organizar tarefas', description: 'Resolver prazos e combinar responsáveis.', tab: 'tasks', icon: 'checkmark-done-outline' },
  { id: 'timeline', label: 'Montar o grande dia', description: 'Preparar o cronograma do dia do evento.', tab: 'timeline', icon: 'time-outline' },
  { id: 'budget', label: 'Revisar investimento', description: 'Conferir orçamento, despesas e pagamentos.', tab: 'budget', icon: 'wallet-outline' },
];

const EVENT_COVER_FALLBACKS: Readonly<Record<string, string>> = {
  wedding: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=900&q=60',
  birthday: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=900&q=60',
  debutante: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=60',
  corporate: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=60',
  generic: 'https://images.unsplash.com/photo-1507501336603-6e31db2be093?auto=format&fit=crop&w=900&q=60',
};

function isoToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [clientsCount, setClientsCount] = useState(0);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [quote] = useState(() => pickMotivationalQuote(Date.now()));
  const [shortcutModal, setShortcutModal] = useState<{ open: boolean; shortcut: Shortcut | null; eventId: string }>({ open: false, shortcut: null, eventId: '' });
  const [eventPickerSearch, setEventPickerSearch] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    setError('');
    const [eventsRes, clientsRes, profileRes] = await Promise.all([
      supabase.from('events').select('id,name,event_date,location,status,event_type,couple_photo_url,couple_photo_file_id').or('status.is.null,status.neq.deleted').order('event_date', { ascending: true }),
      supabase.from('crm_clients').select('id', { count: 'exact', head: true }).neq('stage', 'closed_lost'),
      supabase.from('user_onboarding_state').select('display_name,avatar_url,avatar_file_id').eq('user_id', user.id).maybeSingle(),
    ]);
    if (eventsRes.error) { setError(eventsRes.error.message); setLoading(false); return; }
    const nextEvents = await Promise.all(
      ((eventsRes.data ?? []) as EventRow[]).map(async (event) => {
        if (!event.couple_photo_file_id) return event;
        try {
          return { ...event, couple_photo_url: await getPrivateFileDownloadUrl(event.couple_photo_file_id) };
        } catch {
          return event;
        }
      }),
    );
    setEvents(nextEvents);
    setClientsCount(clientsRes.count ?? 0);
    const nextProfile = (profileRes.data as ProfileRow | null) ?? null;
    setProfile(nextProfile);
    if (nextProfile?.avatar_file_id) {
      try { setAvatarUrl(await getPrivateFileDownloadUrl(nextProfile.avatar_file_id)); }
      catch { setAvatarUrl(nextProfile.avatar_url); }
    } else {
      setAvatarUrl(nextProfile?.avatar_url ?? (String(user.user_metadata?.avatar_url ?? '') || null));
    }
    const activeIds = nextEvents.filter((item) => !['completed', 'cancelled', 'deleted'].includes(String(item.status ?? 'active').toLowerCase())).map((item) => item.id);
    if (activeIds.length) {
      const tasksRes = await supabase.from('event_tasks').select('event_id,due_date,text,completed,priority').in('event_id', activeIds);
      if (!tasksRes.error) setTasks((tasksRes.data ?? []) as TaskRow[]);
    } else setTasks([]);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const activeEvents = useMemo(() => events.filter((item) => !['completed', 'cancelled', 'deleted'].includes(String(item.status ?? 'active').toLowerCase())), [events]);
  const eventPickerEvents = useMemo(() => {
    const term = eventPickerSearch.trim().toLocaleLowerCase('pt-BR');
    if (!term) return activeEvents;
    return activeEvents.filter((item) => `${item.name} ${item.location ?? ''}`.toLocaleLowerCase('pt-BR').includes(term));
  }, [activeEvents, eventPickerSearch]);
  const today = isoToday();
  const openTasks = tasks.filter((task) => !task.completed);
  const overdueTasks = openTasks.filter((task) => task.due_date && task.due_date < today);
  const doneCount = tasks.filter((task) => task.completed).length;
  const completion = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const nextEvent = activeEvents.find((item) => item.event_date >= today) ?? activeEvents[0] ?? null;
  const daysToNext = nextEvent ? Math.max(0, Math.ceil((new Date(`${nextEvent.event_date}T12:00:00`).getTime() - Date.now()) / 86_400_000)) : null;
  const displayName = profile?.display_name || String(user?.user_metadata?.name ?? '');
  const greeting = getHumanGreeting({ displayName, email: user?.email });

  const nextAction = overdueTasks.length
    ? { title: `Resolver ${overdueTasks.length} tarefa${overdueTasks.length > 1 ? 's' : ''} atrasada${overdueTasks.length > 1 ? 's' : ''}`, detail: 'Comece pelo prazo mais antigo para recuperar o ritmo.', tab: 'tasks' as EventDetailsInitialTab }
    : nextEvent
      ? { title: `Preparar ${nextEvent.name}`, detail: daysToNext === 0 ? 'O evento é hoje. Revise equipe e cronograma.' : `Faltam ${daysToNext} dias. Confira o que precisa avançar.`, tab: 'overview' as EventDetailsInitialTab }
      : { title: 'Criar seu próximo evento', detail: 'Cadastre o evento e o Painel Prime organiza os próximos passos.', tab: 'overview' as EventDetailsInitialTab };

  function goToEventTab(eventId: string, tab: EventDetailsInitialTab) {
    router.push(`/eventos/${eventId}${tab === 'overview' ? '' : `?initialTab=${tab}`}`);
  }

  function openShortcut(shortcut: Shortcut) {
    if (activeEvents.length === 1) { goToEventTab(activeEvents[0].id, shortcut.tab); return; }
    setEventPickerSearch('');
    setShortcutModal({ open: true, shortcut, eventId: activeEvents[0]?.id ?? '' });
  }

  async function pickAvatar() {
    if (!user?.id || uploadingAvatar) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.82 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    setError('');
    try {
      const extension = (asset.fileName?.split('.').pop() || 'jpg').toLowerCase();
      const upload = await uploadPrivateAsset({ uri: asset.uri, fileName: `perfil-${user.id}-${Date.now()}.${extension}`, contentType: asset.mimeType ?? 'image/jpeg', byteSize: asset.fileSize ?? null, entityType: 'user_avatar', entityId: user.id });
      const { error: updateError } = await supabase.from('user_onboarding_state').update({ avatar_file_id: upload.fileId, avatar_url: null }).eq('user_id', user.id);
      if (updateError) throw updateError;
      setAvatarUrl(await getPrivateFileDownloadUrl(upload.fileId));
      setProfile((current) => ({ display_name: current?.display_name ?? displayName, avatar_url: null, avatar_file_id: upload.fileId }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Não foi possível atualizar sua foto.');
    } finally { setUploadingAvatar(false); }
  }

  if (loading) return <PrimeLogoLoader label="Preparando seu dia" />;

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Pressable style={styles.avatarButton} onPress={() => void pickAvatar()} accessibilityLabel="Alterar foto de perfil">
          {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatar} /> : <Ionicons name="camera-outline" size={25} color={colors.primaryStrong} />}
          <View style={styles.avatarBadge}><Ionicons name="pencil" size={11} color="#111318" /></View>
        </Pressable>
        <View style={styles.heroCopy}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.quote}>{quote}</Text>
          {uploadingAvatar ? <Text style={styles.avatarHint}>Atualizando sua foto…</Text> : null}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.nextCard}>
        <View style={styles.nextIcon}><Ionicons name="sparkles" size={20} color="#111318" /></View>
        <View style={styles.nextCopy}>
          <Text style={styles.eyebrow}>POR ONDE COMEÇAR</Text>
          <Text style={styles.nextTitle}>{nextAction.title}</Text>
          <Text style={styles.nextDetail}>{nextAction.detail}</Text>
        </View>
        {nextEvent ? <Pressable style={styles.nextButton} onPress={() => goToEventTab(nextEvent.id, nextAction.tab)}><Ionicons name="arrow-forward" size={20} color="#FFFFFF" /></Pressable> : <Pressable style={styles.nextButton} onPress={() => router.push('/eventos' as never)}><Ionicons name="add" size={22} color="#FFFFFF" /></Pressable>}
      </View>

      <View style={styles.statRow}>
        <View style={[styles.statCard, styles.statLavender]}><Ionicons name="people-outline" size={21} color="#6D54D8" /><Text style={styles.statValue}>{clientsCount}</Text><Text style={styles.statLabel}>Clientes em atendimento</Text></View>
        <View style={[styles.statCard, styles.statMint]}><Ionicons name="calendar-outline" size={21} color="#138866" /><Text style={styles.statValue}>{activeEvents.length}</Text><Text style={styles.statLabel}>Eventos em andamento</Text></View>
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}><View><Text style={styles.cardTitle}>Ritmo da semana</Text><Text style={styles.cardDescription}>{openTasks.length} tarefas abertas · {overdueTasks.length} atrasadas</Text></View><Text style={styles.progressValue}>{completion}%</Text></View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(4, completion)}%` }]} /></View>
      </View>

      <View style={styles.sectionHeader}><Text style={styles.cardTitle}>Ações rápidas</Text><Text style={styles.cardDescription}>Escolha o que você quer avançar agora.</Text></View>
      <View style={styles.shortcutGrid}>{SHORTCUTS.map((shortcut) => <Pressable key={shortcut.id} style={styles.shortcut} onPress={() => openShortcut(shortcut)}><View style={styles.shortcutIcon}><Ionicons name={shortcut.icon} size={21} color={colors.primaryStrong} /></View><Text style={styles.shortcutTitle}>{shortcut.label}</Text><Text style={styles.shortcutDescription}>{shortcut.description}</Text></Pressable>)}</View>

      <Modal visible={shortcutModal.open} animationType="slide" onRequestClose={() => setShortcutModal({ open: false, shortcut: null, eventId: '' })}>
        <View style={styles.eventPickerPage}>
          <View style={styles.eventPickerHeader}>
            <View>
              <Text style={styles.eventPickerTitle}>Eventos</Text>
              <Text style={styles.eventPickerSubtitle}>Escolha onde avançar agora</Text>
            </View>
            <Pressable style={styles.eventPickerClose} onPress={() => setShortcutModal({ open: false, shortcut: null, eventId: '' })} accessibilityLabel="Fechar seleção de eventos">
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
          <TextInput
            style={styles.eventPickerSearch}
            placeholder="Buscar por nome/local"
            placeholderTextColor={colors.mutedText}
            value={eventPickerSearch}
            onChangeText={setEventPickerSearch}
          />
          <ScrollView contentContainerStyle={styles.eventPickerList} showsVerticalScrollIndicator={false}>
              {eventPickerEvents.map((item) => {
                const persona = getEventPersonaCopy(item.event_type);
                const coverUri = item.couple_photo_url?.trim() || EVENT_COVER_FALLBACKS[persona.kind];
                return (
                  <Pressable
                    key={item.id}
                    style={styles.eventPickerCard}
                    onPress={() => {
                      if (shortcutModal.shortcut) goToEventTab(item.id, shortcutModal.shortcut.tab);
                      setShortcutModal({ open: false, shortcut: null, eventId: '' });
                    }}
                  >
                    <Image source={{ uri: coverUri }} style={styles.eventPickerCover} />
                    <Text style={styles.eventPickerName}>{item.name}</Text>
                    <Text style={styles.eventPickerMeta} numberOfLines={2}>
                        {new Date(`${item.event_date}T12:00:00`).toLocaleDateString('pt-BR')}
                        {item.location?.trim() ? ` · ${item.location.trim()}` : ''}
                    </Text>
                    <View style={styles.eventPickerFooter}>
                      <Text style={styles.eventPickerStatus}>{eventStatusLabel(item.status)}</Text>
                      <Text style={styles.eventPickerType}>{persona.eventTypeLabel}</Text>
                    </View>
                  </Pressable>
                );
              })}
              {eventPickerEvents.length === 0 ? (
                <View style={styles.eventPickerEmpty}>
                  <Text style={styles.eventPickerEmptyTitle}>Nenhum evento encontrado</Text>
                  <Text style={styles.cardDescription}>Tente buscar pelo nome ou local do evento.</Text>
                </View>
              ) : null}
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 156, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 24, backgroundColor: '#111318' },
  heroGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -60, top: -95, backgroundColor: '#D6AF42', opacity: 0.28 },
  avatarButton: { width: 72, height: 72, borderRadius: 24, borderWidth: 2, borderColor: '#E7C75E', backgroundColor: '#FFF8DE', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 68, height: 68, borderRadius: 22 },
  avatarBadge: { position: 'absolute', right: -5, bottom: -5, width: 25, height: 25, borderRadius: 13, backgroundColor: '#E7C75E', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#111318' },
  heroCopy: { flex: 1, gap: 7 },
  greeting: { color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
  quote: { color: '#DADDE5', fontSize: 13, lineHeight: 19, fontWeight: '500' },
  avatarHint: { color: '#E7C75E', fontSize: 11, fontWeight: '700' },
  error: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 12, padding: 10 },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 15, backgroundColor: '#F2D875', borderWidth: 1, borderColor: '#E1BD3F' },
  nextIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  nextCopy: { flex: 1, gap: 3 },
  eyebrow: { color: '#72550A', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  nextTitle: { color: '#111318', fontSize: 16, fontWeight: '800' },
  nextDetail: { color: '#5C4A18', fontSize: 12, lineHeight: 17 },
  nextButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#111318', alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, minHeight: 132, borderRadius: 20, padding: 15, gap: 7, justifyContent: 'space-between' },
  statLavender: { backgroundColor: '#EEEAFE', borderWidth: 1, borderColor: '#DCD3FF' },
  statMint: { backgroundColor: '#E5F7F0', borderWidth: 1, borderColor: '#C4EBDD' },
  statValue: { color: '#111318', fontSize: 30, fontWeight: '800' },
  statLabel: { color: '#555A66', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  progressCard: { padding: 16, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 14 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  progressValue: { color: colors.primaryStrong, fontSize: 21, fontWeight: '800' },
  progressTrack: { height: 9, borderRadius: 6, backgroundColor: '#ECE9E1', overflow: 'hidden' },
  progressFill: { height: 9, borderRadius: 6, backgroundColor: '#D3AA32' },
  sectionHeader: { gap: 3, marginTop: 2 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  cardDescription: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shortcut: { width: '48%', minHeight: 144, padding: 14, borderRadius: 19, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 8 },
  shortcutIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  shortcutTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  shortcutDescription: { color: colors.mutedText, fontSize: 11, lineHeight: 16 },
  eventPickerPage: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 42 },
  eventPickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  eventPickerTitle: { color: colors.text, fontSize: 26, fontWeight: '800' },
  eventPickerSubtitle: { color: colors.mutedText, fontSize: 13 },
  eventPickerClose: { width: 42, height: 42, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  eventPickerSearch: { height: 43, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, color: colors.text, backgroundColor: colors.card, marginBottom: 10 },
  eventPickerList: { gap: 10, paddingBottom: 28 },
  eventPickerCard: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 6 },
  eventPickerCover: { width: '100%', height: 120, borderRadius: 10, backgroundColor: colors.primarySoft },
  eventPickerName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  eventPickerMeta: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  eventPickerFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  eventPickerStatus: { alignSelf: 'flex-start', backgroundColor: colors.primarySoft, color: colors.primaryStrong, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  eventPickerType: { color: colors.mutedText, fontSize: 11, fontWeight: '700' },
  eventPickerEmpty: { paddingVertical: 42, alignItems: 'center', gap: 4 },
  eventPickerEmptyTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  ghostButton: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  ghostText: { color: colors.text, fontWeight: '700' },
  primaryButton: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: '#111318', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
});
