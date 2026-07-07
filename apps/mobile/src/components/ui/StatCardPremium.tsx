import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, colors, radii, shadows } from '../../theme/colors';

type StatCardPremiumProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient?: keyof typeof gradients;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
};

const GRADIENT_BG: Record<string, readonly string[]> = {
  gold: gradients.warm,
  royal: ['#F4F2FF', '#E8E4FF'] as const,
  success: ['#EAF8F0', '#D1F5E0'] as const,
  info: ['#EFF6FF', '#DBEAFE'] as const,
  danger: ['#FDECEC', '#FBD5D5'] as const,
};

const GRADIENT_ICON: Record<string, readonly string[]> = {
  gold: gradients.gold,
  royal: gradients.royal,
  success: gradients.success,
  info: gradients.info,
  danger: gradients.danger,
};

export function StatCardPremium({ title, value, subtitle, icon, gradient = 'gold', trend, trendValue }: StatCardPremiumProps) {
  const bgColors = GRADIENT_BG[gradient] || GRADIENT_BG.gold;
  const iconColors = GRADIENT_ICON[gradient] || GRADIENT_ICON.gold;
  const trendColor = trend === 'up' ? colors.successText : trend === 'down' ? colors.dangerText : colors.mutedText;
  const trendIcon = trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove';

  return (
    <LinearGradient colors={bgColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, shadows.sm]}>
      <View style={styles.top}>
        <LinearGradient colors={iconColors} style={styles.iconWrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      </View>
      <View style={styles.bottom}>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        {trend && trendValue ? (
          <View style={styles.trendWrap}>
            <Ionicons name={trendIcon as any} size={12} color={trendColor} />
            <Text style={[styles.trendText, { color: trendColor }]}>{trendValue}</Text>
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: radii.lg, padding: 14, minWidth: 100 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  value: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 2 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  subtitle: { fontSize: 11, color: colors.mutedText, flex: 1 },
  trendWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  trendText: { fontSize: 11, fontWeight: '700' },
});
