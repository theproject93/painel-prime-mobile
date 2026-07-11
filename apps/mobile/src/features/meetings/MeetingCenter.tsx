import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { getPrivateFileDownloadUrl } from '../../lib/r2FileStorage';
import { supabase } from '../../lib/supabase';
import { colors, shadows } from '../../theme/colors';
import { groupMeetings, parseBrazilianDateTime, shouldOfferAtaRetry } from './meetingUtils';

type MeetingMinute = {
  id: string;
  pdf_url: string | null;
  summary_markdown: string | null;
};

type Meeting = {
  id: string;
  event_id: string;
  title: string;
  room_url: string | null;
  status: string;
  notes: string | null;
  scheduled_at: string | null;
  updated_at: string | null;
  created_at: string;
  meeting_minutes: MeetingMinute[] | null;
};

type MeetingCenterProps = {
  eventId: string;
};

function defaultScheduleValue() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const part = (value: number) => String(value).padStart(2, '0');
  return `${part(date.getDate())}/${part(date.getMonth() + 1)}/${date.getFullYear()} ${part(date.getHours())}:${part(date.getMinutes())}`;
}

function formatDateTime(value: string | null) {
  if (!value) return 'Horário não informado';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function MeetingCenter({ eventId }: MeetingCenterProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [title, setTitle] = useState('Alinhamento com o cliente');
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleValue);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const fetchMeetings = useCallback(async (background = false) => {
    if (!eventId) return;
    background ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('event_meetings')
        .select(
          'id, event_id, title, room_url, status, notes, scheduled_at, updated_at, created_at, meeting_minutes(id, pdf_url, summary_markdown)'
        )
        .eq('event_id', eventId)
        .order('scheduled_at', { ascending: false });
      if (fetchError) throw new Error(fetchError.message);
      const rows = (data ?? []) as Meeting[];
      setMeetings(rows);
      setNotesDraft((current) => {
        const next = { ...current };
        for (const meeting of rows) {
          if (next[meeting.id] === undefined) next[meeting.id] = meeting.notes ?? '';
        }
        return next;
      });
    } catch (fetchError) {
      setError(errorMessage(fetchError, 'Não foi possível carregar as reuniões.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    void fetchMeetings();
  }, [fetchMeetings]);

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`mobile-meetings:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_meetings', filter: `event_id=eq.${eventId}` },
        () => void fetchMeetings(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meeting_minutes' },
        () => void fetchMeetings(true)
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, fetchMeetings]);

  const grouped = useMemo(() => groupMeetings(meetings), [meetings]);

  async function invokeAction<T>(action: string, payload: Record<string, unknown>) {
    const { data, error: invokeError } = await supabase.functions.invoke('meeting-management', {
      body: { action, ...payload },
    });
    if (invokeError) throw new Error(invokeError.message || `Falha na ação ${action}`);
    return data as T;
  }

  async function createMeeting() {
    if (busyAction) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Informe o assunto da reunião.');
      return;
    }
    let date: Date;
    try {
      date = parseBrazilianDateTime(scheduledAt);
    } catch (dateError) {
      setError(errorMessage(dateError, 'Informe uma data válida.'));
      return;
    }

    setBusyAction('create');
    setError('');
    try {
      await invokeAction('create', {
        eventId,
        title: cleanTitle,
        scheduledAt: date.toISOString(),
      });
      setScheduleOpen(false);
      setTitle('Alinhamento com o cliente');
      setScheduledAt(defaultScheduleValue());
      await fetchMeetings(true);
    } catch (createError) {
      setError(errorMessage(createError, 'Não foi possível agendar a reunião.'));
    } finally {
      setBusyAction('');
    }
  }

  async function openHostRoom(meeting: Meeting) {
    if (busyAction) return;
    setBusyAction(`host:${meeting.id}`);
    setError('');
    try {
      const response = await invokeAction<{ url?: string }>('host-link', { meetingId: meeting.id });
      if (!response?.url) throw new Error('A sala não retornou um link de acesso.');
      await WebBrowser.openBrowserAsync(response.url);
      await fetchMeetings(true);
    } catch (hostError) {
      setError(errorMessage(hostError, 'Não foi possível abrir a sala.'));
    } finally {
      setBusyAction('');
    }
  }

  async function shareInvite(meeting: Meeting) {
    if (!meeting.room_url) {
      setError('O convite desta reunião ainda não está disponível.');
      return;
    }
    await Share.share({
      title: meeting.title,
      message: `Olá! Você foi convidado(a) para a reunião “${meeting.title}”.\n\nAcesse a sala: ${meeting.room_url}`,
      url: meeting.room_url,
    });
  }

  async function saveNotes(meeting: Meeting) {
    if (busyAction) return;
    setBusyAction(`notes:${meeting.id}`);
    setError('');
    try {
      await invokeAction('save-notes', {
        meetingId: meeting.id,
        notes: notesDraft[meeting.id] ?? '',
      });
      await fetchMeetings(true);
    } catch (notesError) {
      setError(errorMessage(notesError, 'Não foi possível salvar as anotações.'));
    } finally {
      setBusyAction('');
    }
  }

  function confirmComplete(meeting: Meeting) {
    Alert.alert(
      'Encerrar reunião?',
      'A sala será fechada para todos e a Plan começará a preparar a ata.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
          style: 'destructive',
          onPress: () => void completeMeeting(meeting),
        },
      ]
    );
  }

  async function completeMeeting(meeting: Meeting) {
    if (busyAction) return;
    setBusyAction(`complete:${meeting.id}`);
    setError('');
    try {
      await invokeAction('complete', { meetingId: meeting.id });
      await fetchMeetings(true);
    } catch (completeError) {
      setError(errorMessage(completeError, 'Não foi possível encerrar a reunião.'));
    } finally {
      setBusyAction('');
    }
  }

  async function retryAta(meeting: Meeting) {
    if (busyAction) return;
    setBusyAction(`retry:${meeting.id}`);
    setError('');
    try {
      await invokeAction('retry-ata', { meetingId: meeting.id });
      await fetchMeetings(true);
    } catch (retryError) {
      setError(errorMessage(retryError, 'Não foi possível reprocessar a ata.'));
    } finally {
      setBusyAction('');
    }
  }

  async function openMinutes(meeting: Meeting) {
    const fileId = meeting.meeting_minutes?.find((minute) => minute.pdf_url)?.pdf_url;
    if (!fileId || busyAction) return;
    setBusyAction(`pdf:${meeting.id}`);
    setError('');
    try {
      const url = await getPrivateFileDownloadUrl(fileId);
      await WebBrowser.openBrowserAsync(url);
    } catch (pdfError) {
      setError(errorMessage(pdfError, 'Não foi possível abrir a ata.'));
    } finally {
      setBusyAction('');
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={colors.primaryStrong} />
        <Text style={styles.muted}>Carregando reuniões...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="videocam" size={24} color={colors.primaryStrong} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Reuniões do evento</Text>
          <Text style={styles.heroText}>
            Converse com clientes, compartilhe o convite e mantenha as atas organizadas.
          </Text>
        </View>
        <Pressable
          style={styles.scheduleButton}
          onPress={() => {
            setError('');
            setScheduleOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Agendar uma conversa"
        >
          <Ionicons name="add" size={18} color={colors.primaryTextOn} />
          <Text style={styles.scheduleButtonText}>Agendar</Text>
        </Pressable>
      </View>

      {refreshing ? (
        <View style={styles.refreshRow}>
          <ActivityIndicator size="small" color={colors.primaryStrong} />
          <Text style={styles.muted}>Atualizando...</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {grouped.active.length > 0 ? (
        <MeetingSection title="Em andamento" tone="live">
          {grouped.active.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              busyAction={busyAction}
              notes={notesDraft[meeting.id] ?? ''}
              onNotesChange={(value) => setNotesDraft((current) => ({ ...current, [meeting.id]: value }))}
              onHost={() => void openHostRoom(meeting)}
              onShare={() => void shareInvite(meeting)}
              onSaveNotes={() => void saveNotes(meeting)}
              onComplete={() => confirmComplete(meeting)}
            />
          ))}
        </MeetingSection>
      ) : null}

      <MeetingSection title="Próximas conversas">
        {grouped.scheduled.length > 0 ? (
          grouped.scheduled.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              busyAction={busyAction}
              notes={notesDraft[meeting.id] ?? ''}
              onNotesChange={(value) => setNotesDraft((current) => ({ ...current, [meeting.id]: value }))}
              onHost={() => void openHostRoom(meeting)}
              onShare={() => void shareInvite(meeting)}
              onSaveNotes={() => void saveNotes(meeting)}
              onComplete={() => confirmComplete(meeting)}
            />
          ))
        ) : (
          <EmptyMeetingCopy text="Nenhuma conversa agendada para este evento." />
        )}
      </MeetingSection>

      <MeetingSection title="Histórico e atas">
        {grouped.history.length > 0 ? (
          grouped.history.map((meeting) => {
            const hasPdf = Boolean(meeting.meeting_minutes?.some((minute) => minute.pdf_url));
            const retryable = shouldOfferAtaRetry(meeting);
            return (
              <View key={meeting.id} style={styles.historyCard}>
                <View style={styles.historyTop}>
                  <View style={styles.historyCopy}>
                    <Text style={styles.cardTitle}>{meeting.title}</Text>
                    <Text style={styles.muted}>{formatDateTime(meeting.scheduled_at)}</Text>
                  </View>
                  <StatusPill
                    label={hasPdf ? 'Ata pronta' : meeting.status === 'ata_failed' ? 'Falha na ata' : 'Processando ata'}
                    danger={meeting.status === 'ata_failed'}
                  />
                </View>
                {hasPdf ? (
                  <ActionButton
                    label="Abrir ata"
                    icon="document-text-outline"
                    onPress={() => void openMinutes(meeting)}
                    loading={busyAction === `pdf:${meeting.id}`}
                  />
                ) : retryable ? (
                  <ActionButton
                    label="Tentar gerar ata novamente"
                    icon="refresh-outline"
                    onPress={() => void retryAta(meeting)}
                    loading={busyAction === `retry:${meeting.id}`}
                  />
                ) : (
                  <Text style={styles.processingText}>A Plan está preparando o documento. Isso pode levar alguns minutos.</Text>
                )}
              </View>
            );
          })
        ) : (
          <EmptyMeetingCopy text="As reuniões encerradas e suas atas aparecerão aqui." />
        )}
      </MeetingSection>

      <Pressable style={styles.refreshButton} onPress={() => void fetchMeetings(true)}>
        <Ionicons name="refresh-outline" size={17} color={colors.primaryStrong} />
        <Text style={styles.refreshButtonText}>Atualizar reuniões</Text>
      </Pressable>

      <Modal visible={scheduleOpen} transparent animationType="fade" onRequestClose={() => setScheduleOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Agendar conversa</Text>
                <Text style={styles.muted}>Crie a sala e envie o convite quando quiser.</Text>
              </View>
              <Pressable onPress={() => setScheduleOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalContent}
            >
              {error ? <Text style={styles.modalErrorText}>{error}</Text> : null}
              <Text style={styles.inputLabel}>Assunto</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Ex.: Alinhamento final"
                placeholderTextColor={colors.mutedText}
              />
              <Text style={styles.inputLabel}>Data e hora</Text>
              <TextInput
                style={styles.input}
                value={scheduledAt}
                onChangeText={setScheduledAt}
                placeholder="DD/MM/AAAA HH:mm"
                placeholderTextColor={colors.mutedText}
                keyboardType="numbers-and-punctuation"
              />
              <Text style={styles.helperText}>Exemplo: 25/07/2026 14:30</Text>
              <View style={styles.modalActions}>
                <Pressable style={styles.cancelButton} onPress={() => setScheduleOpen(false)}>
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.confirmButton, busyAction === 'create' ? styles.disabled : null]}
                  disabled={busyAction === 'create'}
                  onPress={() => void createMeeting()}
                >
                  {busyAction === 'create' ? (
                    <ActivityIndicator size="small" color={colors.primaryTextOn} />
                  ) : (
                    <Text style={styles.confirmButtonText}>Criar sala</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function MeetingSection({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: 'live';
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        {tone === 'live' ? <View style={styles.liveDot} /> : null}
        <Text style={[styles.sectionTitle, tone === 'live' ? styles.liveTitle : null]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function MeetingCard({
  meeting,
  busyAction,
  notes,
  onNotesChange,
  onHost,
  onShare,
  onSaveNotes,
  onComplete,
}: {
  meeting: Meeting;
  busyAction: string;
  notes: string;
  onNotesChange: (value: string) => void;
  onHost: () => void;
  onShare: () => void;
  onSaveNotes: () => void;
  onComplete: () => void;
}) {
  const isActive = meeting.status === 'active';
  return (
    <View style={[styles.meetingCard, isActive ? styles.meetingCardLive : null]}>
      <View style={styles.cardHeading}>
        <View style={styles.cardHeadingCopy}>
          <Text style={styles.cardTitle}>{meeting.title}</Text>
          <Text style={styles.muted}>{formatDateTime(meeting.scheduled_at)}</Text>
        </View>
        <StatusPill label={isActive ? 'Em andamento' : 'Agendada'} danger={isActive} />
      </View>
      <View style={styles.actionRow}>
        <ActionButton
          label={isActive ? 'Voltar à sala' : 'Entrar como anfitriã'}
          icon="videocam-outline"
          onPress={onHost}
          primary
          loading={busyAction === `host:${meeting.id}`}
        />
        <ActionButton label="Enviar convite" icon="share-social-outline" onPress={onShare} />
      </View>
      {isActive ? (
        <View style={styles.notesBox}>
          <Text style={styles.inputLabel}>Anotações da assessoria</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={onNotesChange}
            placeholder="Registre decisões e próximos passos..."
            placeholderTextColor={colors.mutedText}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.actionRow}>
            <ActionButton
              label="Salvar anotações"
              icon="save-outline"
              onPress={onSaveNotes}
              loading={busyAction === `notes:${meeting.id}`}
            />
            <ActionButton
              label="Encerrar reunião"
              icon="stop-circle-outline"
              onPress={onComplete}
              danger
              loading={busyAction === `complete:${meeting.id}`}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function StatusPill({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <View style={[styles.statusPill, danger ? styles.statusPillDanger : null]}>
      <Text style={[styles.statusText, danger ? styles.statusTextDanger : null]}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  primary,
  danger,
  loading,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.actionButton,
        primary ? styles.actionButtonPrimary : null,
        danger ? styles.actionButtonDanger : null,
        loading ? styles.disabled : null,
      ]}
      disabled={loading}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator size="small" color={primary ? colors.primaryTextOn : colors.primaryStrong} />
      ) : (
        <>
          <Ionicons
            name={icon}
            size={16}
            color={primary ? colors.primaryTextOn : danger ? colors.dangerText : colors.primaryStrong}
          />
          <Text
            style={[
              styles.actionButtonText,
              primary ? styles.actionButtonTextPrimary : null,
              danger ? styles.actionButtonTextDanger : null,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function EmptyMeetingCopy({ text }: { text: string }) {
  return (
    <View style={styles.emptyBox}>
      <Ionicons name="calendar-outline" size={22} color={colors.mutedText} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  loadingBox: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hero: {
    backgroundColor: colors.ink950,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadows.card,
  },
  heroIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.gold50, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, gap: 3 },
  heroTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  heroText: { color: '#D1D5DB', fontSize: 12, lineHeight: 17 },
  scheduleButton: { minHeight: 38, paddingHorizontal: 11, borderRadius: 11, backgroundColor: colors.primaryStrong, flexDirection: 'row', alignItems: 'center', gap: 4 },
  scheduleButtonText: { color: colors.primaryTextOn, fontSize: 12, fontWeight: '800' },
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 10, padding: 10, fontSize: 13, fontWeight: '600' },
  section: { gap: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  liveTitle: { color: colors.dangerText },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.dangerText },
  meetingCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, gap: 12, ...shadows.sm },
  meetingCardLive: { borderColor: '#F3B4B4', backgroundColor: '#FFFDFD' },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardHeadingCopy: { flex: 1, gap: 3 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  statusPill: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusPillDanger: { backgroundColor: colors.dangerBg },
  statusText: { color: colors.primaryStrong, fontSize: 10, fontWeight: '800' },
  statusTextDanger: { color: colors.dangerText },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: { minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexGrow: 1 },
  actionButtonPrimary: { borderColor: colors.primaryStrong, backgroundColor: colors.primaryStrong },
  actionButtonDanger: { borderColor: '#F3B4B4', backgroundColor: colors.dangerBg },
  actionButtonText: { color: colors.primaryStrong, fontSize: 12, fontWeight: '800' },
  actionButtonTextPrimary: { color: colors.primaryTextOn },
  actionButtonTextDanger: { color: colors.dangerText },
  disabled: { opacity: 0.55 },
  notesBox: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12, gap: 8 },
  inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  notesInput: { minHeight: 92 },
  historyCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 13, gap: 11 },
  historyTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  historyCopy: { flex: 1, gap: 3 },
  processingText: { color: colors.mutedText, fontSize: 12, lineHeight: 18 },
  emptyBox: { minHeight: 86, backgroundColor: colors.surfaceSubtle, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 7 },
  emptyText: { color: colors.mutedText, fontSize: 12, textAlign: 'center' },
  refreshButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  refreshButtonText: { color: colors.primaryStrong, fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,17,21,0.55)', justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { maxHeight: '84%', backgroundColor: colors.card, borderRadius: 18, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
  modalContent: { padding: 18, gap: 9 },
  modalErrorText: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 10, padding: 10, fontSize: 12, fontWeight: '600' },
  helperText: { color: colors.mutedText, fontSize: 11 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelButton: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  confirmButton: { flex: 1, minHeight: 44, backgroundColor: colors.primaryStrong, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  confirmButtonText: { color: colors.primaryTextOn, fontSize: 14, fontWeight: '800' },
});
