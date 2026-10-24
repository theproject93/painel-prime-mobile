import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppHaptics } from '../../lib/haptics';
import { colors } from '../../theme/colors';
import type { PendingContractAttachment, PlanIaQuotaInfo } from './types';

export function PlanComposer(props: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSend: (rawText?: string) => void;
  isRecording?: boolean;
  recordingDuration?: number;
  onVoiceRecord?: () => void;
  onCancelVoice?: () => void;
  onFinishVoice?: () => void;
  onAttachPdf?: () => void;
  pendingContractAttachment?: PendingContractAttachment | null;
  onClearPendingAttachment?: () => void;
  quickQuestions?: readonly string[];
  quota?: PlanIaQuotaInfo | null;
  onNavigateToPlans?: () => void;
  currentEventId?: string | null;
}) {
  const formatTime = (secs = 0) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isQuotaBlocked = Boolean(
    props.quota &&
    !props.quota.is_unlimited &&
    !props.quota.allowed &&
    props.quota.remaining === 0
  );

  const isInputDisabled = props.disabled || isQuotaBlocked;

  // Active recording state
  if (props.isRecording) {
    return (
      <View style={[styles.wrap, styles.recordingWrap]}>
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Gravando áudio...</Text>
          <Text style={styles.recordingTimer}>{formatTime(props.recordingDuration)}</Text>
        </View>
        {props.onCancelVoice && (
          <Pressable
            style={styles.cancelButton}
            onPress={() => {
              void AppHaptics.light();
              props.onCancelVoice?.();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Cancelar gravação de áudio"
          >
            <Ionicons name="trash-outline" size={20} color="#E11D48" />
          </Pressable>
        )}
        <Pressable
          style={[styles.actionButton, styles.recordSendButton]}
          onPress={() => {
            void AppHaptics.light();
            if (props.onFinishVoice) {
              props.onFinishVoice();
            } else {
              props.onSend();
            }
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Concluir e enviar áudio"
        >
          <Ionicons name="send" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Quick Questions Horizontal Pills */}
      {props.quickQuestions && props.quickQuestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsScroll}
          style={styles.pillsContainer}
        >
          {props.quickQuestions.map((question) => (
            <Pressable
              key={question}
              style={styles.pillButton}
              disabled={isInputDisabled}
              onPress={() => {
                void AppHaptics.light();
                props.onSend(question);
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`Pergunta rápida: ${question}`}
            >
              <Text style={styles.pillText}>{question}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Quota Blocked Banner */}
      {isQuotaBlocked && (
        <View style={styles.quotaBanner} testID="plan-quota-blocked-banner">
          <View style={styles.quotaBannerInfo}>
            <Ionicons name="flash" size={15} color="#D97706" />
            <Text style={styles.quotaBannerText} numberOfLines={2}>
              Limite mensal atingido ({props.quota?.used}/{props.quota?.limit}). Faça upgrade para continuar.
            </Text>
          </View>
          {props.onNavigateToPlans && (
            <Pressable
              style={styles.quotaUpgradeBtn}
              onPress={() => {
                void AppHaptics.light();
                props.onNavigateToPlans?.();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Fazer upgrade do plano"
            >
              <Text style={styles.quotaUpgradeText}>Upgrade</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Pending Contract Attachment Chip */}
      {props.pendingContractAttachment && (
        <View style={styles.attachmentChip}>
          <View style={styles.attachmentInfo}>
            <Ionicons name="document-text" size={16} color={colors.primaryStrong} />
            <Text style={styles.attachmentName} numberOfLines={1}>
              {props.pendingContractAttachment.name}
              {props.pendingContractAttachment.eventName ? ` • ${props.pendingContractAttachment.eventName}` : ''}
            </Text>
          </View>
          <Pressable
            style={styles.removeAttachmentBtn}
            disabled={props.disabled}
            onPress={() => {
              void AppHaptics.light();
              props.onClearPendingAttachment?.();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Remover contrato anexado"
          >
            <Ionicons name="close" size={16} color={colors.primaryStrong} />
          </Pressable>
        </View>
      )}

      {/* Input Row: Attachment Button + TextInput + Mic Button (ALWAYS VISIBLE) + Send Button */}
      <View style={styles.inputRow}>
        {props.onAttachPdf && (
          <Pressable
            style={styles.attachButton}
            disabled={isInputDisabled}
            onPress={() => {
              void AppHaptics.light();
              props.onAttachPdf?.();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Anexar contrato PDF"
          >
            <Ionicons
              name="attach"
              size={20}
              color={isInputDisabled ? colors.mutedText : colors.primaryStrong}
            />
          </Pressable>
        )}

        <TextInput
          style={styles.input}
          value={props.value}
          onChangeText={props.onChange}
          placeholder={
            isQuotaBlocked
              ? 'Limite de interações atingido neste ciclo.'
              : 'Pergunte sobre clientes, caixa ou contratos...'
          }
          placeholderTextColor={colors.mutedText}
          editable={!isInputDisabled}
          onSubmitEditing={() => props.onSend()}
          returnKeyType="send"
        />

        {/* The microphone button MUST always be visible right beside the Send button when not recording */}
        {props.onVoiceRecord && (
          <Pressable
            style={[styles.actionButton, styles.micButton]}
            disabled={isInputDisabled}
            onPress={() => {
              void AppHaptics.light();
              props.onVoiceRecord?.();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Gravar mensagem de voz para a Plan IA"
          >
            <Ionicons name="mic" size={18} color="#FFFFFF" />
          </Pressable>
        )}

        <Pressable
          style={[
            styles.actionButton,
            styles.sendButton,
            (isInputDisabled || (!props.value.trim() && !props.pendingContractAttachment)) && styles.sendButtonDisabled,
          ]}
          disabled={isInputDisabled || (!props.value.trim() && !props.pendingContractAttachment)}
          onPress={() => {
            void AppHaptics.light();
            props.onSend();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensagem para o assistente"
        >
          <Ionicons name="send" size={16} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Footer Context Caption */}
      <Text style={styles.footerCaption} numberOfLines={1}>
        {props.currentEventId
          ? 'No contexto deste evento • Análise de contratos em PDF e inteligência com dados reais'
          : 'Você pode anexar contratos em PDF para análise e consultar clientes e caixa'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: colors.card,
    gap: 6,
  },
  wrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
  },
  recordingWrap: {
    backgroundColor: '#FFF1F2',
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E11D48',
  },
  recordingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9F1239',
  },
  recordingTimer: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '500',
    color: '#BE123C',
  },
  cancelButton: {
    height: 44,
    width: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordSendButton: {
    backgroundColor: '#E11D48',
  },
  pillsContainer: {
    maxHeight: 38,
  },
  pillsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  pillButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  quotaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  quotaBannerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quotaBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  quotaUpgradeBtn: {
    backgroundColor: '#D97706',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 30,
    justifyContent: 'center',
  },
  quotaUpgradeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  attachmentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attachmentName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryStrong,
    flex: 1,
  },
  removeAttachmentBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    color: colors.text,
    backgroundColor: '#FFFFFF',
    fontSize: 13,
  },
  actionButton: {
    height: 44,
    width: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    backgroundColor: colors.primaryStrong,
  },
  sendButton: {
    backgroundColor: colors.primaryStrong,
  },
  sendButtonDisabled: {
    opacity: 0.35,
  },
  footerCaption: {
    fontSize: 10,
    color: colors.mutedText,
    textAlign: 'center',
    paddingVertical: 2,
  },
});
