import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, radii, shadows, fontSize, fontWeight } from '../../theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
};

const variantStyles: Record<ButtonVariant, { bg: string; text: string; border: string }> = {
  primary: { bg: colors.primary, text: colors.primaryTextOn, border: colors.primary },
  secondary: { bg: colors.surface, text: colors.text, border: colors.border },
  ghost: { bg: 'transparent', text: colors.text, border: 'transparent' },
  danger: { bg: colors.dangerBg, text: colors.dangerText, border: '#FECACA' },
  outline: { bg: 'transparent', text: colors.primary, border: colors.primary },
};

const sizeStyles: Record<ButtonSize, { h: number; fs: number; px: number; br: number }> = {
  sm: { h: 36, fs: fontSize.sm, px: spacing.md, br: radii.sm },
  md: { h: 44, fs: fontSize.md, px: spacing.lg, br: radii.md },
  lg: { h: 52, fs: fontSize.lg, px: spacing.lg, br: radii.md },
};

export function Button({ title, onPress, variant = 'primary', size = 'md', disabled, loading, fullWidth, style, textStyle, icon }: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          height: s.h,
          paddingHorizontal: s.px,
          borderRadius: s.br,
          borderWidth: variant === 'ghost' ? 0 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        variant !== 'ghost' && shadows.sm,
        fullWidth && { width: '100%' },
        style as ViewStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[{ color: v.text, fontSize: s.fs, fontWeight: fontWeight.bold }, textStyle as TextStyle]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
