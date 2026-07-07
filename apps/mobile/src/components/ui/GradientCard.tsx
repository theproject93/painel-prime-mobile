import { ReactNode, useId } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { gradients, colors, radii, shadows } from '../../theme/colors';

type GradientCardProps = {
  children: ReactNode;
  gradient?: keyof typeof gradients;
  accentColor?: string;
  gradientPosition?: 'top' | 'background';
  style?: ViewStyle;
};

export function GradientCard({ children, gradient = 'warm', accentColor, gradientPosition = 'top', style }: GradientCardProps) {
  const id = useId();
  const [startColor, endColor] = gradients[gradient] || gradients.warm;
  const bgGradId = `gc-bg-${id}`;
  const topGradId = `gc-top-${id}`;

  if (gradientPosition === 'background') {
    return (
      <View style={[styles.card, shadows.card, style]}>
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={bgGradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={startColor} />
              <Stop offset="1" stopColor={endColor} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${bgGradId})`} />
        </Svg>
        {accentColor ? <View style={[styles.accentBar, { backgroundColor: accentColor }]} /> : null}
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.card, shadows.card, style]}>
      <Svg width="100%" height={4} style={styles.topBar}>
        <Defs>
          <LinearGradient id={topGradId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={startColor} />
            <Stop offset="1" stopColor={endColor} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={4} fill={`url(#${topGradId})`} />
      </Svg>
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
