import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, fontSize, fontWeight } from '../../theme/tokens';
import { Button } from './Button';

type EmptyStateProps = {
  icon?: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="outline" size="md" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: spacing.xl, alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg },
  icon: { fontSize: 48, marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },
  message: { color: colors.mutedText, fontSize: fontSize.md, textAlign: 'center', lineHeight: 20 },
  action: { marginTop: spacing.md },
});
