import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { AudioMessagePlayer } from './AudioMessagePlayer';
import { PlanActionCard } from './PlanActionCard';
import { PlanActionProposalCard } from './PlanActionProposalCard';
import { PlanMarkdownMessage } from './PlanMarkdownMessage';
import type { ChatMessage } from './types';

export function PlanMessageList(props: {
  messages: ChatMessage[];
  isReplying: boolean;
  onOpenCta: (path: string | undefined) => void;
  onConfirmAction?: (proposalId: string, confirmationToken: string, messageId: string) => Promise<void> | void;
  onCancelAction?: (proposalId: string, messageId: string) => void;
}) {
  return (
    <>
      {props.messages.map((message) => {
        const isUser = message.role === 'user';
        return (
          <View key={message.id} style={[styles.row, isUser ? styles.userRow : styles.botRow]}>
            <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
              {/* Voice badge indicator for user audio */}
              {isUser && message.inputModality === 'audio' && (
                <View style={styles.voiceBadge}>
                  <Ionicons name="mic" size={12} color="#FFFFFF" />
                  <Text style={styles.voiceBadgeText}>Áudio enviado</Text>
                </View>
              )}

              {/* Attachment chip if message has attachment */}
              {message.attachmentName && (
                <View style={[styles.attachmentBadge, isUser ? styles.attachmentBadgeUser : styles.attachmentBadgeBot]}>
                  <Ionicons
                    name="document-text"
                    size={13}
                    color={isUser ? '#FFFFFF' : colors.primaryStrong}
                  />
                  <Text
                    style={[styles.attachmentText, isUser ? styles.attachmentTextUser : styles.attachmentTextBot]}
                    numberOfLines={1}
                  >
                    {message.attachmentName}
                  </Text>
                </View>
              )}

              {/* Rich Markdown Message (Bug #3 Fix) */}
              {message.text ? (
                <PlanMarkdownMessage content={message.text} isUser={isUser} />
              ) : null}

              {/* Audio Message Player (Amazon Polly Camila or User Voice Replay) */}
              {message.audioUrl ? (
                <AudioMessagePlayer
                  src={message.audioUrl}
                  autoPlay={Boolean(message.autoPlayAudio)}
                  isUser={isUser}
                />
              ) : null}

              {/* Document citations badge list */}
              {!isUser && message.citations && message.citations.length > 0 ? (
                <View style={styles.citationsContainer}>
                  <View style={styles.citationsHeader}>
                    <Ionicons name="document-text-outline" size={12} color={colors.primaryStrong} />
                    <Text style={styles.citationsHeaderText}>Fontes consultadas</Text>
                  </View>
                  <View style={styles.citationsBadgeList}>
                    {message.citations.map((cit) => (
                      <View key={cit.id} style={styles.citationBadge}>
                        <Text style={styles.citationBadgeText}>
                          {cit.title} {cit.version ? `(v${cit.version})` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Action Proposal Card from Plan IA */}
              {!isUser && message.actionProposal ? (
                <PlanActionProposalCard
                  proposal={message.actionProposal}
                  isExecuted={message.isActionExecuted}
                  isCancelled={message.isActionCancelled}
                  executionMessage={message.actionExecutionMessage}
                  onConfirm={(proposalId, confirmationToken) =>
                    props.onConfirmAction?.(proposalId, confirmationToken, message.id)
                  }
                  onCancel={(proposalId) =>
                    props.onCancelAction?.(proposalId, message.id)
                  }
                />
              ) : null}

              {/* Action Card for bot messages (WhatsApp & Buffet) */}
              {!isUser && message.text ? (
                <PlanActionCard text={message.text} />
              ) : null}

              {/* Job status banner if processing or uploading */}
              {message.jobStatus && message.jobStatus !== 'done' && (
                <View style={styles.jobStatusRow}>
                  {message.jobStatus === 'failed' ? (
                    <Ionicons name="alert-circle" size={14} color="#E11D48" />
                  ) : (
                    <ActivityIndicator size="small" color={isUser ? '#FFFFFF' : colors.primaryStrong} />
                  )}
                  <Text style={[styles.jobStatusText, isUser && styles.userText]}>
                    {message.jobStatus === 'uploading'
                      ? 'Enviando arquivo...'
                      : message.jobStatus === 'processing'
                      ? 'Processando...'
                      : message.jobStatus === 'failed'
                      ? 'Falha no processamento'
                      : 'Na fila...'}
                  </Text>
                </View>
              )}

              {/* CTA button */}
              {!isUser && message.ctaPath ? (
                <Pressable
                  style={styles.cta}
                  onPress={() => props.onOpenCta(message.ctaPath)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={message.ctaLabel ?? 'Abrir módulo'}
                >
                  <Text style={styles.ctaText}>{message.ctaLabel ?? 'Abrir módulo'}</Text>
                  <Ionicons name="arrow-forward" size={12} color={colors.primaryStrong} />
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}

      {props.isReplying ? (
        <View style={[styles.row, styles.botRow]}>
          <View style={[styles.bubble, styles.botBubble, styles.loading]}>
            <ActivityIndicator size="small" color={colors.primaryStrong} />
            <Text style={styles.loadingText}>Plan está analisando...</Text>
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', flexDirection: 'row' },
  botRow: { justifyContent: 'flex-start' },
  userRow: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '88%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  botBubble: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: colors.border },
  userBubble: { backgroundColor: colors.text },
  userText: { color: '#FFFFFF' },
  voiceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.9 },
  voiceBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  attachmentBadgeBot: {
    backgroundColor: colors.primarySoft,
  },
  attachmentBadgeUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  attachmentText: {
    fontSize: 11,
    fontWeight: '600',
  },
  attachmentTextBot: {
    color: colors.primaryStrong,
  },
  attachmentTextUser: {
    color: '#FFFFFF',
  },
  jobStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  jobStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedText,
  },
  citationsContainer: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  citationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  citationsHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.mutedText,
    textTransform: 'uppercase',
  },
  citationsBadgeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  citationBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  citationBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primaryStrong,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    marginTop: 2,
  },
  ctaText: { color: colors.primaryStrong, fontSize: 11, fontWeight: '700' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
});
