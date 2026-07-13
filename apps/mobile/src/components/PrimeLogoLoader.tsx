import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image as RNImage,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Defs, Image as SvgImage, LinearGradient, Mask, Rect, Stop } from 'react-native-svg';

import { colors } from '../theme/colors';

type PrimeLogoLoaderProps = {
  label?: string;
  variant?: 'fullscreen' | 'screen' | 'inline';
};

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const logo = require('../../assets/splash-icon.png');

export function PrimeLogoLoader({ label = 'Carregando', variant = 'screen' }: PrimeLogoLoaderProps) {
  const { height: windowHeight } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const rawId = useId();
  const safeId = useMemo(() => rawId.replace(/[^a-zA-Z0-9_-]/g, ''), [rawId]);
  const size = variant === 'inline' ? 72 : 112;

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!active) return;
      setReduceMotion(enabled);
      if (!enabled) {
        animation = Animated.loop(
          Animated.timing(progress, {
            toValue: 1,
            duration: 1900,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: false,
          }),
        );
        animation.start();
      }
    });
    return () => {
      active = false;
      animation?.stop();
      progress.stopAnimation();
    };
  }, [progress]);

  const shineX = progress.interpolate({ inputRange: [0, 1], outputRange: [-size * 1.5, size * 1.5] });

  return (
    <View
      style={[
        styles.root,
        variant === 'screen' && styles.screen,
        variant === 'screen' && { minHeight: Math.max(420, windowHeight - 150) },
        variant === 'fullscreen' && styles.fullscreen,
        variant === 'inline' && styles.inline,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <View style={{ width: size, height: size }}>
        <RNImage source={logo} style={[styles.logo, { width: size, height: size }]} resizeMode="contain" />
        {!reduceMotion ? (
          <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <Mask id={`logo-mask-${safeId}`}>
                <SvgImage href={logo} width={size} height={size} preserveAspectRatio="xMidYMid meet" />
              </Mask>
              <LinearGradient id={`shine-${safeId}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="rgba(255,255,255,0)" />
                <Stop offset="0.5" stopColor="rgba(255,255,255,0.92)" />
                <Stop offset="1" stopColor="rgba(255,255,255,0)" />
              </LinearGradient>
            </Defs>
            <AnimatedRect
              x={shineX}
              y={-size / 2}
              width={size / 2}
              height={size * 2}
              rotation="24"
              origin={`${size / 2}, ${size / 2}`}
              fill={`url(#shine-${safeId})`}
              opacity={0.8}
              mask={`url(#logo-mask-${safeId})`}
            />
          </Svg>
        ) : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.background },
  screen: { flex: 1, alignSelf: 'stretch' },
  fullscreen: { flex: 1, backgroundColor: '#111113' },
  inline: { minHeight: 118, backgroundColor: 'transparent' },
  logo: { opacity: 0.96 },
  label: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
});
