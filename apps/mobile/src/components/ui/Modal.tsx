import { Ionicons } from '@expo/vector-icons';
import { Alert, Modal as RNModal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { useBiometricAccess } from '../../contexts/BiometricAccessContext';
import { useKeyboardBottomInset } from '../../lib/useKeyboardBottomInset';

type ModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

export function Modal({ visible, onClose, title, children }: ModalProps) {
  const keyboardHeight = useKeyboardBottomInset();
  let isCurtainActive = false;
  try {
    const biometric = useBiometricAccess();
    isCurtainActive = biometric?.isCurtainActive ?? false;
  } catch {
    // Fallback when rendered outside BiometricAccessProvider
  }

  return (
    <RNModal visible={visible && !isCurtainActive} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, keyboardHeight > 0 && { paddingBottom: keyboardHeight }]}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Fechar modal"
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </RNModal>
  );
}

export function confirmAlert(title: string, message: string, onConfirm: () => Promise<void>) {
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Remover',
      style: 'destructive',
      onPress: () => {
        void onConfirm();
      },
    },
  ]);
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
});
