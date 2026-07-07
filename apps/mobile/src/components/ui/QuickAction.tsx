import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, colors, radii } from '../../theme/colors';

type QuickActionProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient?: keyof typeof gradients;
  onPress: () => void;
  badge?: number;
};

export function QuickAction({ label, icon, gradient = 'gold', onPress, badge }: QuickActionProps) {
  const gradientColors = gradients[gradient] || gradients.gold;

  return (
    <Pressable style={styles.wrap} onPress={onPress}>
      <LinearGradient colors={gradientColors} style={styles.iconWrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Ionicons name={icon} size={22} color="#FFFFFF" />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </LinearGradient>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 6, padding: 8 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.dangerText,
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' },
});
