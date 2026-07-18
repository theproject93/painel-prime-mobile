import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { getPrivateFileDownloadUrl } from '../../lib/r2FileStorage';
import { colors } from '../../theme/colors';
import { ActionButton, EmptyMeetingCopy, MeetingCard, MeetingSection, StatusPill } from './MeetingPresentation';
import { meetingStyles as styles } from './meetingStyles';
import { groupMeetings, parseBrazilianDateTime, shouldOfferAtaRetry } from './meetingUtils';
import { defaultMeetingSchedule, formatMeetingDateTime, meetingError, type Meeting } from './meetingModel';
import { invokeMeetingAction } from './meetingService';
import { useMeetingsData } from './useMeetingsData';

type MeetingCenterProps = {
  eventId: string;
};

export function MeetingCenter({ eventId }: MeetingCenterProps) {
  const data = useMeetingsData(eventId);
  const { meetings, loading, refreshing, error, setError, fetchMeetings, patchFields } = data;
  const [busyAction, setBusyAction] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [title, setTitle] = useState('Alinhamento com o cliente');
  const [scheduledAt, setScheduledAt] = useState(defaultMeetingSchedule);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setNotesDraft((current) => { const next = { ...current }; for (const meeting of meetings) if (next[meeting.id] === undefined) next[meeting.id] = meeting.notes ?? ''; return next; });
  }, [meetings]);

  const grouped = useMemo(() => groupMeetings(meetings), [meetings]);

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
      setError(meetingError(dateError, 'Informe uma data válida.'));
      return;
    }

    setBusyAction('create');
    setError('');
    try {
      await invokeMeetingAction('create', {
        eventId,
        title: cleanTitle,
        scheduledAt: date.toISOString(),
      });
      setScheduleOpen(false);
      setTitle('Alinhamento com o cliente');
      setScheduledAt(defaultMeetingSchedule());
      await fetchMeetings(true);
    } catch (createError) {
      setError(meetingError(createError, 'Não foi possível agendar a reunião.'));
    } finally {
      setBusyAction('');
    }
  }

  async function openHostRoom(meeting: Meeting) {
    if (busyAction) return;
    setBusyAction(`host:${meeting.id}`);
    setError('');
    try {
      const response = await invokeMeetingAction<{ url?: string }>('host-link', { meetingId: meeting.id });
      if (!response?.url) throw new Error('A sala não retornou um link de acesso.');
      await WebBrowser.openBrowserAsync(response.url);
    } catch (hostError) {
      setError(meetingError(hostError, 'Não foi possível abrir a sala.'));
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
      await invokeMeetingAction('save-notes', {
        meetingId: meeting.id,
        notes: notesDraft[meeting.id] ?? '',
      });
      patchFields(meeting.id, { notes: notesDraft[meeting.id] ?? '', updated_at: new Date().toISOString() });
    } catch (notesError) {
      setError(meetingError(notesError, 'Não foi possível salvar as anotações.'));
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
      await invokeMeetingAction('complete', { meetingId: meeting.id });
      patchFields(meeting.id, { status: 'completed', updated_at: new Date().toISOString() });
    } catch (completeError) {
      setError(meetingError(completeError, 'Não foi possível encerrar a reunião.'));
    } finally {
      setBusyAction('');
    }
  }

  async function retryAta(meeting: Meeting) {
    if (busyAction) return;
    setBusyAction(`retry:${meeting.id}`);
    setError('');
    try {
      await invokeMeetingAction('retry-ata', { meetingId: meeting.id });
      await fetchMeetings(true);
    } catch (retryError) {
      setError(meetingError(retryError, 'Não foi possível reprocessar a ata.'));
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
      setError(meetingError(pdfError, 'Não foi possível abrir a ata.'));
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
                    <Text style={styles.muted}>{formatMeetingDateTime(meeting.scheduled_at)}</Text>
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
