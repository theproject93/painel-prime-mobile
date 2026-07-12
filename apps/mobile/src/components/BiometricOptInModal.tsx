import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows, spacing } from '../theme/colors';

export function BiometricOptInModal({ visible, busy, onEnable, onDismiss }: { visible: boolean; busy: boolean; onEnable: () => void; onDismiss: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}><Ionicons name="finger-print" size={32} color={colors.gold700} /></View>
          <Text style={styles.title}>Entre mais rápido nas próximas vezes</Text>
          <Text style={styles.copy}>Use a biometria deste aparelho. Sua senha nunca será salva.</Text>
          <Pressable style={styles.primary} disabled={busy} onPress={onEnable}><Text style={styles.primaryText}>{busy ? 'Confirmando...' : 'Ativar biometria'}</Text></Pressable>
          <Pressable style={styles.secondary} onPress={onDismiss}><Text style={styles.secondaryText}>Agora não</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: 'rgba(15,17,21,0.55)' },
  card: { width: '100%', maxWidth: 420, alignItems: 'center', gap: spacing.lg, borderRadius: 24, padding: 28, backgroundColor: colors.card, ...shadows.elevated },
  icon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 32, backgroundColor: colors.gold100 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  copy: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  primary: { width: '100%', minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, backgroundColor: colors.ink950 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondary: { minHeight: 44, justifyContent: 'center' },
  secondaryText: { color: colors.gold700, fontSize: 14, fontWeight: '700' },
});
