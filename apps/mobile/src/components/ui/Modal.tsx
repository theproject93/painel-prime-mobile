import { Modal as RNModal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, radii, shadows, fontSize, fontWeight } from '../../theme/tokens';

type ModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

export function Modal({ visible, onClose, title, children }: ModalProps) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {title ? (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>×</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.body}>{children}</View>
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

export function confirmAlert(title: string, message: string, onConfirm: () => void, onCancel?: () => void) {
  const { Alert } = require('react-native');
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel', onPress: onCancel },
    { text: 'Confirmar', style: 'destructive', onPress: onConfirm },
  ]);
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: spacing.lg,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '85%',
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  close: {
    color: colors.mutedText,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.semibold,
    paddingHorizontal: spacing.xs,
  },
  body: { padding: spacing.md, paddingTop: spacing.sm },
});
