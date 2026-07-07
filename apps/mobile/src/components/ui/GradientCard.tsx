import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, colors, radii, shadows } from '../../theme/colors';

type GradientCardProps = {
  children: ReactNode;
  gradient?: keyof typeof gradients;
  accentColor?: string;
  gradientPosition?: 'top' | 'background';
  style?: ViewStyle;
};

export function GradientCard({ children, gradient = 'warm', accentColor, gradientPosition = 'top', style }: GradientCardProps) {
  const gradientColors = gradients[gradient] || gradients.warm;

  if (gradientPosition === 'background') {
    return (
      <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, shadows.card, style]}>
        {accentColor ? <View style={[styles.accentBar, { backgroundColor: accentColor }]} /> : null}
        {children}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.card, shadows.card, style]}>
      <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.topBar} />
      {accentColor ? <View style={[styles.accentBar, { backgroundColor: accentColor }]} /> : null}
      {children}
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
  },
  topBar: { height: 4, width: '100%' },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderRadius: 2 },
});
