import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

type InfoCardProps = {
  label: string;
  value: string;
};

export function InfoCard({ label, value }: InfoCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0F1115',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  label: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  value: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
});
