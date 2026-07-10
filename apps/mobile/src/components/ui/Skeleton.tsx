import { StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';

type SkeletonListProps = {
  count: number;
};

export function SkeletonList({ count }: SkeletonListProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.row}>
          <View style={styles.avatar} />
          <View style={styles.lines}>
            <View style={styles.line1} />
            <View style={styles.line2} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  lines: {
    flex: 1,
    gap: 6,
  },
  line1: {
    height: 12,
    borderRadius: 4,
    backgroundColor: colors.border,
    width: '60%',
  },
  line2: {
    height: 10,
    borderRadius: 4,
    backgroundColor: colors.border,
    width: '35%',
  },
});
