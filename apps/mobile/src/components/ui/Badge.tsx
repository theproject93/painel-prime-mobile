import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'gold' | 'royal';
type BadgeSize = 'sm' | 'md';

const VARIANT_CONFIG: Record<BadgeVariant, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { bg: colors.successBg, fg: colors.successText, icon: 'checkmark-circle' },
  warning: { bg: colors.warningBg, fg: colors.warningText, icon: 'time' },
  danger: { bg: colors.dangerBg, fg: colors.dangerText, icon: 'alert-circle' },
  info: { bg: colors.infoBg, fg: colors.infoText, icon: 'information-circle' },
  gold: { bg: colors.gold100, fg: colors.gold600, icon: 'star' },
  royal: { bg: colors.royal50, fg: colors.royal600, icon: 'sparkles' },
};

export function Badge({ label, variant = 'gold', size = 'sm', icon }: {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const config = VARIANT_CONFIG[variant];
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, size === 'md' && styles.badgeMd]}>
      {icon ? (
        <Ionicons name={icon} size={iconSize} color={config.fg} style={styles.icon} />
      ) : (
        <Ionicons name={config.icon} size={iconSize} color={config.fg} style={styles.icon} />
      )}
      <Text style={[styles.text, { color: config.fg }, size === 'md' && styles.textMd]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeMd: { paddingHorizontal: 10, paddingVertical: 5 },
  icon: { marginRight: 4 },
  text: { fontWeight: '700', fontSize: 11 },
  textMd: { fontSize: 13 },
});
