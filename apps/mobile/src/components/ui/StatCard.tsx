import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, radii, shadows, fontSize, fontWeight } from '../../theme/tokens';

type StatCardProps = {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'default' | 'blue' | 'amber' | 'red' | 'green';
};

const toneColors = {
  default: { bg: colors.surface, text: colors.text, accent: colors.primary },
  blue: { bg: '#eff6ff', text: '#1e40af', accent: '#3b82f6' },
  amber: { bg: '#fffbeb', text: '#92400e', accent: '#f59e0b' },
  red: { bg: '#fef2f2', text: '#991b1b', accent: '#ef4444' },
  green: { bg: '#f0fdf4', text: '#166534', accent: '#22c55e' },
};

export function StatCard({ label, value, sub, tone = 'default' }: StatCardProps) {
  const c = toneColors[tone];
  return (
    <View style={[styles.card, { backgroundColor: c.bg, borderColor: c.accent + '30' }]}>
      <Text style={[styles.label, { color: c.accent }]}>{label}</Text>
      <Text style={[styles.value, { color: c.text }]}>{value}</Text>
      {sub ? <Text style={[styles.sub, { color: c.accent }]}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '30%',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: 2,
    ...shadows.sm,
  },
  label: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold },
  sub: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginTop: 2 },
});
