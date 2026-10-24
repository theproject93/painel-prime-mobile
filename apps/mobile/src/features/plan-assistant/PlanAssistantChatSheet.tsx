import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../contexts/AuthContext';
import { useBiometricAccess } from '../../contexts/BiometricAccessContext';
import { AppHaptics } from '../../lib/haptics';
import { useKeyboardBottomInset } from '../../lib/useKeyboardBottomInset';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { PLAN_FACE_IMAGE } from './assets';
import { PlanComposer } from './PlanComposer';
import { PlanMessageList } from './PlanMessageList';
import { PlanThreadModal } from './PlanThreadModal';
import {
  deleteThread as deleteThreadApi,
  emitThreadEvent,
  listThreads as listThreadsApi,
  renameThread as renameThreadApi,
  resolvePlanTenantId,
  subscribeThreadEvents,
  type PlanAiThread,
} from './planAssistantThreads';
import type { ChatMessage, PendingContractAttachment, PlanHint, PlanIaQuotaInfo } from './types';
import { useVoiceRecorder } from './useVoiceRecorder';

type Props = {
  visible: boolean;
  bottom: number;
  hints: PlanHint[];
  loadingHints: boolean;
  messages: ChatMessage[];
  input: string;
  isReplying: boolean;
  onClose: () => void;
  onOpenHint: (hint: PlanHint) => void;
  onOpenCta: (path: string | undefined) => void;
  onChangeInput: (value: string) => void;
  onSend: (rawText?: string) => void;
  onSendVoice?: (recording: { uri: string; name: string; mimeType: string }) => void;
  onAttachPdf?: () => void;
  pendingContractAttachment?: PendingContractAttachment | null;
  onClearPendingAttachment?: () => void;
  quickQuestions?: readonly string[];
  quota?: PlanIaQuotaInfo | null;
  onNavigateToPlans?: () => void;
  currentEventId?: string | null;
  threads?: PlanAiThread[];
  activeThreadId?: string | null;
  onSelectThread?: (thread: PlanAiThread) => void;
  onCreateNewThread?: () => void;
  onRenameThread?: (threadId: string, newTitle: string) => Promise<void>;
  onDeleteThread?: (threadId: string) => Promise<void>;
};

export function PlanAssistantChatSheet(props: Props) {
  const listRef = useRef<ScrollView | null>(null);
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [isThreadModalOpen, setIsThreadModalOpen] = useState(false);
  const [internalThreads, setInternalThreads] = useState<PlanAiThread[]>(props.threads ?? []);
  const [internalTenantId, setInternalTenantId] = useState<string | null>(null);

  const voiceRecorder = useVoiceRecorder();

  let isCurtainActive = false;
  try {
    const biometric = useBiometricAccess();
    isCurtainActive = biometric?.isCurtainActive ?? false;
  } catch {
    // Fallback when rendered outside BiometricAccessProvider
  }

  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardBottomInset();
  const isKeyboardOpen = keyboardHeight > 0;

  // Auto-scroll on new messages
  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [props.isReplying, props.messages, props.visible]);

  // Auto-scroll to bottom when keyboard opens
  useEffect(() => {
    if (isKeyboardOpen) {
      const timer = setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isKeyboardOpen]);

  // Load threads when opening thread modal
  const loadThreads = useCallback(async () => {
    if (!userId) return;
    try {
      const tenant = internalTenantId ?? (await resolvePlanTenantId(supabase, userId));
      if (tenant) {
        setInternalTenantId(tenant);
        const data = await listThreadsApi(supabase, tenant);
        setInternalThreads(data);
      }
    } catch (err) {
      console.warn('Failed to load threads in PlanAssistantChatSheet:', err);
    }
  }, [internalTenantId, userId]);

  useEffect(() => {
    if (isThreadModalOpen) {
      void loadThreads();
    }
  }, [isThreadModalOpen, loadThreads]);

  // Sync internal threads with external props if provided
  useEffect(() => {
    if (props.threads) {
      setInternalThreads(props.threads);
    }
  }, [props.threads]);

  // Listen to thread updates across components
  useEffect(() => {
    return subscribeThreadEvents((event) => {
      if (event.type === 'THREADS_UPDATED') {
        void loadThreads();
      }
    });
  }, [loadThreads]);

  const handleSelectThread = useCallback(
    (thread: PlanAiThread) => {
      emitThreadEvent({ type: 'SELECT_THREAD', thread });
      props.onSelectThread?.(thread);
    },
    [props]
  );

  const handleCreateNewThread = useCallback(() => {
    emitThreadEvent({ type: 'NEW_THREAD' });
    props.onCreateNewThread?.();
  }, [props]);

  const handleRenameThread = useCallback(
    async (threadId: string, newTitle: string) => {
      if (props.onRenameThread) {
        await props.onRenameThread(threadId, newTitle);
        return;
      }
      if (internalTenantId) {
        await renameThreadApi(supabase, internalTenantId, threadId, newTitle);
        emitThreadEvent({ type: 'THREADS_UPDATED' });
        setInternalThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, title: newTitle } : t))
        );
      }
    },
    [internalTenantId, props]
  );

  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      if (props.onDeleteThread) {
        await props.onDeleteThread(threadId);
        return;
      }
      if (internalTenantId) {
        await deleteThreadApi(supabase, internalTenantId, threadId);
        emitThreadEvent({ type: 'THREADS_UPDATED' });
        setInternalThreads((prev) => prev.filter((t) => t.id !== threadId));
      }
    },
    [internalTenantId, props]
  );

  const handleFinishVoice = useCallback(async () => {
    const recording = await voiceRecorder.stopRecording();
    if (recording && props.onSendVoice) {
      props.onSendVoice(recording);
    }
  }, [props, voiceRecorder]);

  return (
    <>
      <Modal
        visible={props.visible && !isCurtainActive}
        animationType="fade"
        transparent
        onRequestClose={props.onClose}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={props.onClose} />
          <KeyboardAvoidingView
            style={[
              styles.modalContent,
              { paddingTop: Math.max(insets.top, 8) },
              isKeyboardOpen && { paddingBottom: keyboardHeight },
            ]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <View
              style={[
                styles.panel,
                isKeyboardOpen
                  ? { marginBottom: 0, flex: 1, height: undefined, maxHeight: '100%' }
                  : { marginBottom: props.bottom, height: '86%', maxHeight: '92%' },
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleWrap}>
                  <Image source={PLAN_FACE_IMAGE} style={styles.avatar} resizeMode="cover" />
                  <View>
                    <View style={styles.titleRow}>
                      <Text style={styles.title}>Plan</Text>
                      {props.quota && !props.quota.is_unlimited && (
                        <View style={styles.quotaHeaderBadge}>
                          <Ionicons name="flash" size={10} color="#DEC479" />
                          <Text style={styles.quotaHeaderText}>
                            {props.quota.used}/{props.quota.limit}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.subtitle}>Assistente da plataforma</Text>
                  </View>
                </View>
                <View style={styles.headerActions}>
                  <Pressable
                    onPress={() => {
                      void AppHaptics.light();
                      setIsThreadModalOpen(true);
                    }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Histórico de conversas"
                    style={styles.headerIconBtn}
                  >
                    <Ionicons name="chatbubbles-outline" size={20} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    onPress={props.onClose}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Fechar assistente"
                    style={styles.headerIconBtn}
                  >
                    <Ionicons name="close" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>

              {/* Hints wrap */}
              {!isKeyboardOpen ? (
                <View style={styles.hintsWrap}>
                  <Text style={styles.hintsTitle}>Alertas proativos</Text>
                  {props.loadingHints ? <Text style={styles.hintsCaption}>Analisando operação...</Text> : null}
                  {!props.loadingHints && props.hints.length === 0 ? (
                    <Text style={styles.hintsCaption}>Sem pendências urgentes agora.</Text>
                  ) : null}
                  {!props.loadingHints && props.hints.length > 0 ? (
                    <View style={styles.hintsRow}>
                      {props.hints.slice(0, 3).map((hint) => (
                        <Pressable key={hint.id} style={styles.hintChip} onPress={() => props.onOpenHint(hint)}>
                          <Text style={styles.hintChipText} numberOfLines={1}>{hint.title}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Messages */}
              <ScrollView ref={listRef} style={styles.messagesArea} contentContainerStyle={styles.messagesContent}>
                <PlanMessageList
                  messages={props.messages}
                  isReplying={props.isReplying}
                  onOpenCta={props.onOpenCta}
                />
              </ScrollView>

              {/* Composer */}
              <PlanComposer
                value={props.input}
                disabled={props.isReplying}
                onChange={props.onChangeInput}
                onSend={props.onSend}
                isRecording={voiceRecorder.isRecording}
                recordingDuration={voiceRecorder.duration}
                onVoiceRecord={() => void voiceRecorder.startRecording()}
                onCancelVoice={voiceRecorder.cancelRecording}
                onFinishVoice={() => void handleFinishVoice()}
                onAttachPdf={props.onAttachPdf}
                pendingContractAttachment={props.pendingContractAttachment}
                onClearPendingAttachment={props.onClearPendingAttachment}
                quickQuestions={props.quickQuestions}
                quota={props.quota}
                onNavigateToPlans={props.onNavigateToPlans}
                currentEventId={props.currentEventId}
                isKeyboardOpen={isKeyboardOpen}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Plan Thread Modal */}
      <PlanThreadModal
        visible={isThreadModalOpen}
        onClose={() => setIsThreadModalOpen(false)}
        threads={internalThreads}
        activeThreadId={props.activeThreadId ?? null}
        onSelectThread={handleSelectThread}
        onCreateNewThread={handleCreateNewThread}
        onRenameThread={handleRenameThread}
        onDeleteThread={handleDeleteThread}
      />
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 17, 21, 0.75)' },
  modalContent: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 12 },
  panel: { width: '100%', height: '86%', maxHeight: '92%', backgroundColor: colors.card, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  header: { backgroundColor: colors.primaryStrong, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  avatar: { height: 34, width: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  subtitle: { color: '#FFFFFF', fontSize: 11, opacity: 0.85, fontWeight: '500' },
  quotaHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(222, 196, 121, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(222, 196, 121, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  quotaHeaderText: {
    color: '#DEC479',
    fontSize: 10,
    fontWeight: '700',
  },
  hintsWrap: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 6, backgroundColor: '#FCFCFD' },
  hintsTitle: { color: colors.mutedText, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  hintsCaption: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  hintsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hintChip: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '100%' },
  hintChipText: { color: colors.primaryStrong, fontSize: 11, fontWeight: '700' },
  messagesArea: { flex: 1, backgroundColor: colors.card },
  messagesContent: { paddingHorizontal: 10, paddingVertical: 10, gap: 8 },
});
