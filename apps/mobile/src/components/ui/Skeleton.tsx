import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/colors';

type SkeletonProps = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
};

function SkeletonBlock({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] });

  return (
    <Animated.View
      style={[
        styles.block,
        { width: width as number | undefined, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <SkeletonBlock height={120} borderRadius={12} />
      <SkeletonBlock width="70%" height={18} borderRadius={6} style={styles.mt8} />
      <SkeletonBlock width="50%" height={14} borderRadius={6} style={styles.mt6} />
      <View style={styles.row}>
        <SkeletonBlock width={80} height={32} borderRadius={16} />
        <SkeletonBlock width={80} height={32} borderRadius={16} />
      </View>
    </View>
  );
}

function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

function SkeletonPage() {
  return (
    <View style={styles.page}>
      <SkeletonBlock width="60%" height={28} borderRadius={8} />
      <SkeletonBlock width="90%" height={16} borderRadius={6} style={styles.mt8} />
      <View style={styles.rowWrap}>
        <SkeletonBlock width="48%" height={80} borderRadius={12} style={styles.mt16} />
        <SkeletonBlock width="48%" height={80} borderRadius={12} style={styles.mt16} />
      </View>
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.border },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  },
  list: { gap: 10, padding: 16 },
  page: { padding: 16, gap: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt16: { marginTop: 16 },
});

export { SkeletonBlock, SkeletonCard, SkeletonList, SkeletonPage };
export type { SkeletonProps };
