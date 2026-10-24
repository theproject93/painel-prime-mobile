import { useId, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, radii, shadows } from '../../theme/colors';
import { RsvpFamilyGroupBar } from './RsvpFamilyGroupBar';
import { RsvpMessageBubble } from './RsvpMessageBubble';
import {
  format24hRemaining,
  isWithin24hWindow,
  threadStateLabel,
  type ConversationReviewThread,
  type GuestStatus,
  type ReviewSelectionStatus,
} from './rsvpInboxModel';
import { useKeyboardBottomInset } from '../../lib/useKeyboardBottomInset';

type Props = {
  thread: ConversationReviewThread;
  onBack: () => void;
  selections: Record<string, ReviewSelectionStatus>;
  onSelectStatus: (guestId: string, status: GuestStatus) => void;
  onApplyAttendance: (replyText?: string) => Promise<unknown>;
  onSendClarification: (replyText: string) => Promise<unknown>;
  onMarkHandoff: (reason?: string) => Promise<unknown>;
  onSendFreeFormMessage: (text: string) => Promise<unknown>;
  onResendQr: (guestId: string) => Promise<unknown>;
};

export function RsvpChatView({
  thread,
  onBack,
  selections,
  onSelectStatus,
  onApplyAttendance,
  onSendClarification,
  onMarkHandoff,
  onSendFreeFormMessage,
  onResendQr,
}: Props) {
  const id = useId();
  const keyboardHeight = useKeyboardBottomInset();
  const [inputText, setInputText] = useState('');
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [resendingGuestId, setResendingGuestId] = useState<string | null>(null);

  const windowOpen = isWithin24hWindow(thread.last_inbound_at);
  const windowGradId = `window-grad-${id}`;

  const handleApply = async () => {
    setSubmittingAction('apply');
    try {
      await onApplyAttendance(inputText.trim() || undefined);
      setInputText('');
      Alert.alert('Sucesso', 'Presenças aplicadas com sucesso!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao aplicar presença.';
      Alert.alert('Erro', msg);
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleClarify = async () => {
    if (!inputText.trim()) {
      Alert.alert('Atenção', 'Digite o texto de esclarecimento que deseja enviar ao convidado.');
      return;
    }
    setSubmittingAction('clarify');
    try {
      await onSendClarification(inputText.trim());
      setInputText('');
      Alert.alert('Sucesso', 'Esclarecimento enviado com sucesso!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao enviar esclarecimento.';
      Alert.alert('Erro', msg);
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleHandoff = async () => {
    setSubmittingAction('handoff');
    try {
      await onMarkHandoff('Intervenção manual da assessoria');
      Alert.alert('Sucesso', 'Conversa transferida para atendimento humano.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao marcar transbordo.';
      Alert.alert('Erro', msg);
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    setSubmittingAction('send');
    try {
      await onSendFreeFormMessage(inputText.trim());
      setInputText('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao enviar mensagem.';
      Alert.alert('Erro', msg);
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleResendQr = async (guestId: string, guestName: string) => {
    setResendingGuestId(guestId);
    try {
      await onResendQr(guestId);
      Alert.alert('QR Code Enviado', `O QR Code oficial de check-in foi reenviado para ${guestName}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao reenviar QR Code.';
      Alert.alert('Erro', msg);
    } finally {
      setResendingGuestId(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        Platform.OS === 'android' && keyboardHeight > 0 && { paddingBottom: keyboardHeight },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Contact Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.contactName} numberOfLines={1}>
            {thread.leader_name || 'Convidado WhatsApp'}
          </Text>
          <Text style={styles.contactPhone}>
            {thread.phone_normalized || thread.leader_phone || 'Sem telefone'}
          </Text>
        </View>
        <View style={styles.statusChip}>
          <Text style={styles.statusChipText}>{threadStateLabel(thread.state)}</Text>
        </View>
      </View>

      {/* 24-Hour Meta Window Banner */}
      <View style={styles.windowBannerWrap}>
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={windowGradId} x1="0" y1="0" x2="1" y2="1">
              <Stop
                offset="0"
                stopColor={windowOpen ? '#DCFCE7' : '#FEF3C7'}
              />
              <Stop
                offset="1"
                stopColor={windowOpen ? '#BBF7D0' : '#FDE68A'}
              />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${windowGradId})`} />
        </Svg>
        <Ionicons
          name={windowOpen ? 'shield-checkmark' : 'lock-closed'}
          size={16}
          color={windowOpen ? '#15803D' : '#B45309'}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.windowBannerTitle,
              { color: windowOpen ? '#15803D' : '#B45309' },
            ]}
          >
            {windowOpen
              ? `Janela 24h aberta (${format24hRemaining(thread.last_inbound_at)})`
              : 'Janela de 24h Meta Fechada'}
          </Text>
          <Text
            style={[
              styles.windowBannerSub,
              { color: windowOpen ? '#166534' : '#92400E' },
            ]}
          >
            {windowOpen
              ? 'Mensagens livres e respostas manuais sem custo adicional.'
              : 'Disparos restritos aos templates oficiais homologados.'}
          </Text>
        </View>
      </View>

      {/* Messages List */}
      <FlatList
        data={thread.messages || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RsvpMessageBubble message={item} />}
        contentContainerStyle={styles.messagesContent}
        inverted={false}
      />

      {/* Sticky Family Group Presence Toggles */}
      <RsvpFamilyGroupBar
        guests={thread.guests || []}
        selections={selections}
        onSelectStatus={onSelectStatus}
        onResendQr={handleResendQr}
        resendingGuestId={resendingGuestId}
      />

      {/* Actions & Composer Footer */}
      <View style={[styles.footerComposer, shadows.card]}>
        {/* Quick Review Buttons */}
        <View style={styles.quickActionsRow}>
          <Pressable
            onPress={handleApply}
            disabled={submittingAction !== null}
            style={[styles.actionBtn, styles.actionBtnApply]}
          >
            {submittingAction === 'apply' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={14} color="#FFFFFF" />
                <Text style={styles.actionBtnTextApply}>Aplicar Presença</Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={handleClarify}
            disabled={submittingAction !== null}
            style={[styles.actionBtn, styles.actionBtnClarify]}
          >
            {submittingAction === 'clarify' ? (
              <ActivityIndicator size="small" color={colors.gold700} />
            ) : (
              <>
                <Ionicons name="help-circle-outline" size={14} color={colors.gold700} />
                <Text style={styles.actionBtnTextClarify}>Pedir Esclarecimento</Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={handleHandoff}
            disabled={submittingAction !== null}
            style={[styles.actionBtn, styles.actionBtnHandoff]}
          >
            <Ionicons name="person" size={13} color={colors.textSecondary} />
            <Text style={styles.actionBtnTextHandoff}>Transbordo</Text>
          </Pressable>
        </View>

        {/* Input composer (enabled if 24h window is open or for clarification note) */}
        <View style={styles.inputRow}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder={
              windowOpen
                ? 'Digite a resposta da assessoria...'
                : 'Mensagem para esclarecer ou aplicar...'
            }
            placeholderTextColor={colors.mutedText}
            style={styles.textInput}
            multiline
          />
          {windowOpen ? (
            <Pressable
              onPress={handleSendText}
              disabled={submittingAction === 'send' || !inputText.trim()}
              accessibilityRole="button"
              accessibilityLabel="Enviar mensagem"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[
                styles.sendBtn,
                (!inputText.trim() || submittingAction === 'send') &&
                  styles.sendBtnDisabled,
              ]}
            >
              {submittingAction === 'send' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={16} color="#FFFFFF" />
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  backButton: {
    padding: 6,
    borderRadius: radii.full,
    backgroundColor: '#F4F1EA',
  },
  contactName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  contactPhone: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 1,
  },
  statusChip: {
    backgroundColor: colors.gold50,
    borderWidth: 1,
    borderColor: colors.gold200,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold700,
  },
  windowBannerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  windowBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  windowBannerSub: {
    fontSize: 11,
    marginTop: 1,
  },
  messagesContent: {
    paddingVertical: 12,
  },
  footerComposer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 10,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  actionBtnApply: {
    backgroundColor: '#16A34A',
  },
  actionBtnTextApply: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionBtnClarify: {
    backgroundColor: colors.gold50,
    borderWidth: 1,
    borderColor: colors.gold200,
  },
  actionBtnTextClarify: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold700,
  },
  actionBtnHandoff: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionBtnTextHandoff: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F4F1EA',
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
