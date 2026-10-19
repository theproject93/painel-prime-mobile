import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../../theme/colors';
import type { ConversationMessageItem } from './rsvpInboxModel';

type Props = {
  message: ConversationMessageItem;
};

export function RsvpMessageBubble({ message }: Props) {
  const isOutbound = message.direction === 'outbound';
  const isAudio = message.is_audio || message.message_type === 'audio' || message.message_type === 'voice';

  const timeFormatted = message.created_at
    ? new Date(message.created_at).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <View
      style={[
        styles.bubbleContainer,
        isOutbound ? styles.outboundContainer : styles.inboundContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isOutbound ? styles.outboundBubble : styles.inboundBubble,
        ]}
      >
        {/* Template Badge */}
        {message.template_name ? (
          <View style={styles.templateBadge}>
            <Ionicons name="bookmark" size={11} color={colors.gold700} />
            <Text style={styles.templateBadgeText}>Template: {message.template_name}</Text>
          </View>
        ) : null}

        {/* Advisor Manual Badge */}
        {message.interactive_kind === 'advisor_manual_message' ? (
          <View style={styles.advisorBadge}>
            <Ionicons name="person" size={11} color="#2563EB" />
            <Text style={styles.advisorBadgeText}>Mensagem da Assessoria</Text>
          </View>
        ) : null}

        {/* Audio Player Indicator */}
        {isAudio ? (
          <View style={styles.audioRow}>
            <View style={styles.playIconWrap}>
              <Ionicons name="play" size={16} color="#FFFFFF" />
            </View>
            <View style={styles.waveformWrap}>
              <View style={styles.waveformBar} />
              <View style={[styles.waveformBar, { height: 16 }]} />
              <View style={[styles.waveformBar, { height: 10 }]} />
              <View style={[styles.waveformBar, { height: 20 }]} />
              <View style={[styles.waveformBar, { height: 14 }]} />
              <View style={[styles.waveformBar, { height: 8 }]} />
            </View>
            <Text style={styles.audioLabel}>Áudio do convidado</Text>
          </View>
        ) : null}

        {/* Text Body */}
        {message.text_body ? (
          <Text style={[styles.messageText, isOutbound && styles.messageTextOutbound]}>
            {message.text_body}
          </Text>
        ) : null}

        {/* Time Stamp */}
        <View style={styles.footerRow}>
          <Text style={styles.timestamp}>{timeFormatted}</Text>
          {isOutbound ? (
            <Ionicons name="checkmark-done" size={13} color="#16A34A" />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleContainer: {
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  inboundContainer: {
    alignItems: 'flex-start',
  },
  outboundContainer: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderWidth: 1,
  },
  inboundBubble: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderTopLeftRadius: 4,
  },
  outboundBubble: {
    backgroundColor: '#FDF8ED',
    borderColor: '#E8D5A0',
    borderTopRightRadius: 4,
  },
  templateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF7F1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  templateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold700,
  },
  advisorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  advisorBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  playIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  waveformBar: {
    width: 3,
    height: 12,
    borderRadius: 1.5,
    backgroundColor: colors.gold600,
  },
  audioLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  messageText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  messageTextOutbound: {
    color: '#17181D',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  timestamp: {
    fontSize: 10,
    color: colors.mutedText,
  },
});
