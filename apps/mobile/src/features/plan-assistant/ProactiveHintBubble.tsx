import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { PLAN_FACE_IMAGE } from './assets';
import type { PlanHint } from './types';

export function ProactiveHintBubble(props: {
  hint: PlanHint;
  bottom: number;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  return (
    <View style={[styles.card, { bottom: props.bottom }]}>
      <View style={styles.top}>
        <View style={styles.lead}>
          <Image source={PLAN_FACE_IMAGE} style={styles.avatar} resizeMode="cover" />
          <View style={styles.content}>
            <Text style={styles.badge}>Plan dica rápida</Text>
            <Text style={styles.title}>{props.hint.title}</Text>
            <Text style={styles.text}>{props.hint.message}</Text>
          </View>
        </View>
        <Pressable onPress={props.onDismiss} hitSlop={8}>
          <Ionicons name="close" size={16} color={colors.mutedText} />
        </Pressable>
      </View>
      <Pressable onPress={props.onOpen}>
        <Text style={styles.action}>Resolver agora</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    right: 14,
    width: 310,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 7,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  lead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, flex: 1 },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', marginTop: 2 },
  content: { flex: 1, gap: 2 },
  badge: { color: colors.primaryStrong, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  text: { color: colors.mutedText, fontSize: 12, lineHeight: 18 },
  action: { color: colors.primaryStrong, fontSize: 12, fontWeight: '700' },
});
