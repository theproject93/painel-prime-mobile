import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { AppHaptics } from '../../lib/haptics';
import { colors } from '../../theme/colors';

type ButtonVariant = 'primary' | 'ghost';
type ButtonSize = 'sm' | 'md';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
}: ButtonProps) {
  const handlePress = () => {
    AppHaptics.light();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled ?? loading}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.base,
        size === 'md' ? styles.sizeMd : null,
        variant === 'primary' ? styles.primary : null,
        variant === 'ghost' ? styles.ghost : null,
        disabled || loading ? styles.disabled : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size={size === 'sm' ? 14 : 18}
          color={variant === 'ghost' ? colors.primaryStrong : '#FFFFFF'}
        />
      ) : (
        <Text
          style={[
            styles.text,
            size === 'md' ? styles.textMd : null,
            variant === 'ghost' ? styles.textGhost : null,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  sizeMd: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    minHeight: 48,
  },
  primary: {
    backgroundColor: colors.primaryStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.75,
  },
  text: {
    fontWeight: '700',
    fontSize: 13,
    color: '#FFFFFF',
  },
  textMd: {
    fontSize: 14,
  },
  textGhost: {
    color: colors.primaryStrong,
  },
});
