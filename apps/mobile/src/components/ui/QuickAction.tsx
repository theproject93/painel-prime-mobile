import { useId } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { gradients, colors, radii } from '../../theme/colors';

type QuickActionProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient?: keyof typeof gradients;
  onPress: () => void;
  badge?: number;
};

export function QuickAction({ label, icon, gradient = 'gold', onPress, badge }: QuickActionProps) {
  const id = useId();
  const [startColor, endColor] = gradients[gradient] || gradients.gold;

  return (
    <Pressable style={styles.wrap} onPress={onPress}>
      <View style={styles.iconWrap}>
        <Svg width={52} height={52}>
          <Defs>
            <LinearGradient id={`qa-icn-${id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={startColor} />
              <Stop offset="1" stopColor={endColor} />
            </LinearGradient>
          </Defs>
          <Rect width={52} height={52} rx={radii.lg} ry={radii.lg} fill={`url(#qa-icn-${id})`} />
        </Svg>
        <Ionicons name={icon} size={22} color="#FFFFFF" style={styles.iconContent} />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
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
    overflow: 'hidden',
  },
  iconContent: { position: 'absolute' },
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
