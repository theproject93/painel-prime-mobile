import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, radii, shadows, fontSize, fontWeight } from '../../theme/tokens';

type CardProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
};

export function Card({ title, subtitle, children, style, footer }: CardProps) {
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.body}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: fontSize.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: spacing.md },
});
