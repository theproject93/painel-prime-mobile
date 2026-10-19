import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { colors, radii, shadows } from '../../../src/theme/colors';
import { AtaDocumentModal } from '../../../src/features/meetings/AtaDocumentModal';
import {
  formatMeetingDateTime,
  type Meeting,
} from '../../../src/features/meetings/meetingModel';
import {
  fetchMeetingById,
  invokeMeetingAction,
} from '../../../src/features/meetings/meetingService';
import { supabase } from '../../../src/lib/supabase';

export default function MeetingDetailRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const meetingId = Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '';

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [ataModalVisible, setAtaModalVisible] = useState(false);

  const loadMeeting = async () => {
    if (!meetingId) return;
    setLoading(true);
    try {
      const res = await fetchMeetingById(meetingId);
      if (res.data) {
        setMeeting(res.data);
        setNotesDraft(res.data.notes || '');
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMeeting();
  }, [meetingId]);

  const openHostRoom = async () => {
    if (!meeting || busyAction) return;
    setBusyAction('host');
    try {
      const res = await invokeMeetingAction<{ url?: string }>('host-link', {
        meetingId: meeting.id,
      });
      if (!res?.url) throw new Error('A sala não retornou um link de acesso.');
      await WebBrowser.openBrowserAsync(res.url);
      void loadMeeting();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível abrir a sala.';
      Alert.alert('Erro', msg);
    } finally {
      setBusyAction('');
    }
  };

  const shareGuestInvite = async () => {
    if (!meeting?.room_url) {
      Alert.alert('Aviso', 'O link de acesso ainda não está disponível.');
      return;
    }
    await Share.share({
      title: `Reunião: ${meeting.title}`,
      message: `Olá! Segue o link de acesso para a nossa reunião "${meeting.title}":\n${meeting.room_url}\n\nPainel Prime`,
    });
  };

  const saveNotes = async () => {
    if (!meeting) return;
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('event_meetings')
        .update({ notes: notesDraft, updated_at: new Date().toISOString() })
        .eq('id', meeting.id);

      if (error) throw error;
      Alert.alert('Sucesso', 'Anotações salvas com sucesso!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar anotações.';
      Alert.alert('Erro', msg);
    } finally {
      setSavingNotes(false);
    }
  };

  const confirmComplete = () => {
    Alert.alert(
      'Encerrar reunião?',
      'A sala será fechada para todos e a Plan começará a preparar a ata executiva.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
          style: 'destructive',
          onPress: async () => {
            setBusyAction('complete');
            try {
              await invokeMeetingAction('complete', { meetingId });
              await loadMeeting();
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Falha ao encerrar reunião.';
              Alert.alert('Erro', msg);
            } finally {
              setBusyAction('');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold700} />
          <Text style={styles.loadingText}>Carregando detalhes da reunião...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Reunião não encontrada</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasAta = Boolean(meeting.meeting_minutes && meeting.meeting_minutes.length > 0);
  const isCompleted = meeting.status === 'completed';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {meeting.title}
          </Text>
          <Text style={styles.headerSubtitle}>
            {meeting.event?.name || 'Reunião'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* Main Card */}
          <View style={[styles.mainCard, shadows.sm]}>
            <View style={styles.metaRow}>
              <View style={styles.timeWrap}>
                <Ionicons name="calendar-outline" size={15} color={colors.gold700} />
                <Text style={styles.timeText}>
                  {formatMeetingDateTime(meeting.scheduled_at)}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  meeting.status === 'active'
                    ? styles.statusActive
                    : isCompleted
                    ? styles.statusCompleted
                    : styles.statusScheduled,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    meeting.status === 'active'
                      ? styles.statusActiveText
                      : isCompleted
                      ? styles.statusCompletedText
                      : styles.statusScheduledText,
                  ]}
                >
                  {meeting.status === 'active'
                    ? 'Ao Vivo'
                    : isCompleted
                    ? 'Concluída'
                    : 'Agendada'}
                </Text>
              </View>
            </View>

            {/* Room Launcher Buttons */}
            {!isCompleted ? (
              <View style={styles.launcherButtons}>
                <Pressable
                  onPress={openHostRoom}
                  disabled={busyAction === 'host'}
                  style={styles.hostPrimaryBtn}
                >
                  {busyAction === 'host' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="videocam" size={18} color="#FFFFFF" />
                      <Text style={styles.hostPrimaryBtnText}>Entrar na Sala como Anfitrião</Text>
                    </>
                  )}
                </Pressable>

                <Pressable onPress={shareGuestInvite} style={styles.inviteShareBtn}>
                  <Ionicons name="share-social-outline" size={18} color={colors.text} />
                  <Text style={styles.inviteShareBtnText}>Compartilhar Link com Clientes</Text>
                </Pressable>

                <Pressable
                  onPress={confirmComplete}
                  disabled={busyAction === 'complete'}
                  style={styles.completeBtn}
                >
                  {busyAction === 'complete' ? (
                    <ActivityIndicator size="small" color={colors.dangerText} />
                  ) : (
                    <>
                      <Ionicons name="stop-circle-outline" size={18} color={colors.dangerText} />
                      <Text style={styles.completeBtnText}>Encerrar Reunião e Gerar Ata</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Ata Executiva Section if Completed */}
          {isCompleted ? (
            <View style={[styles.ataSectionCard, shadows.sm]}>
              <View style={styles.ataSectionHeader}>
                <View style={styles.ataIconWrap}>
                  <Ionicons name="document-text" size={18} color={colors.gold700} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ataSectionTitle}>Ata Executiva Plan IA</Text>
                  <Text style={styles.ataSectionSub}>
                    {hasAta
                      ? 'Documento estruturado pronto para consulta e envio'
                      : 'A inteligência artificial está gerando o documento'}
                  </Text>
                </View>
              </View>

              {hasAta ? (
                <Pressable
                  onPress={() => setAtaModalVisible(true)}
                  style={styles.viewAtaBtn}
                >
                  <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.viewAtaBtnText}>Visualizar Ata Completa</Text>
                </Pressable>
              ) : (
                <View style={styles.processingBox}>
                  <ActivityIndicator size="small" color={colors.gold700} />
                  <Text style={styles.processingText}>Processando áudio e transcrição...</Text>
                </View>
              )}
            </View>
          ) : null}

          {/* Notes Section */}
          <View style={[styles.notesCard, shadows.sm]}>
            <View style={styles.notesHeader}>
              <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.notesTitle}>Anotações da Assessoria</Text>
            </View>
            <TextInput
              value={notesDraft}
              onChangeText={setNotesDraft}
              multiline
              style={styles.notesInput}
              placeholder="Digite aqui anotações rápidas durante a chamada..."
              placeholderTextColor={colors.mutedText}
            />
            <Pressable
              onPress={saveNotes}
              disabled={savingNotes}
              style={[styles.saveNotesBtn, savingNotes && styles.btnDisabled]}
            >
              {savingNotes ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveNotesBtnText}>Salvar Anotações</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Ata Document Modal */}
      {meeting ? (
        <AtaDocumentModal
          visible={ataModalVisible}
          onClose={() => setAtaModalVisible(false)}
          meeting={meeting}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 1,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  statusCompleted: {
    backgroundColor: colors.gold50,
  },
  statusCompletedText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold700,
  },
  statusScheduled: {
    backgroundColor: '#EFF6FF',
  },
  statusScheduledText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  launcherButtons: {
    gap: 10,
  },
  hostPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryStrong,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  hostPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inviteShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FAF7F1',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  inviteShareBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.danger100,
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  completeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dangerText,
  },
  ataSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  ataSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  ataIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.gold50,
    borderWidth: 1,
    borderColor: colors.gold200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ataSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  ataSectionSub: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 1,
  },
  viewAtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primaryStrong,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  viewAtaBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  processingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FAF7F1',
    borderRadius: radii.md,
  },
  processingText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  notesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  notesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#FAF7F1',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 10,
  },
  saveNotesBtn: {
    backgroundColor: colors.primaryStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveNotesBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
