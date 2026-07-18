import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import type { ChatMessage } from './types';

export function PlanMessageList(props: {
  messages: ChatMessage[];
  isReplying: boolean;
  onOpenCta: (path: string | undefined) => void;
}) {
  return (
    <>
      {props.messages.map((message) => (
        <View key={message.id} style={[styles.row, message.role === 'user' ? styles.userRow : styles.botRow]}>
          <View style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.botBubble]}>
            <Text style={[styles.text, message.role === 'user' ? styles.userText : null]}>{message.text}</Text>
            {message.role === 'bot' && message.ctaPath ? (
              <Pressable style={styles.cta} onPress={() => props.onOpenCta(message.ctaPath)}>
                <Text style={styles.ctaText}>{message.ctaLabel ?? 'Abrir módulo'}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
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
  bubble: { maxWidth: '88%', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
  botBubble: { backgroundColor: '#F4F6F8', borderWidth: 1, borderColor: colors.border },
  userBubble: { backgroundColor: colors.text },
  text: { color: colors.text, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  userText: { color: '#FFFFFF' },
  cta: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  ctaText: { color: colors.primaryStrong, fontSize: 11, fontWeight: '700' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
});
