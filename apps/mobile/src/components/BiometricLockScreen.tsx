import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows, spacing } from '../theme/colors';

export function BiometricLockScreen({ busy, onAuthenticate, onUsePassword }: { busy: boolean; onAuthenticate: () => void; onUsePassword: () => void }) {
  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.card}>
        <View style={styles.icon}><Ionicons name="finger-print" size={38} color={colors.gold700} /></View>
        <Text style={styles.title}>Seu espaço está protegido</Text>
        <Text style={styles.subtitle}>Use sua biometria para continuar no Painel Prime.</Text>
        <Pressable style={styles.primary} disabled={busy} onPress={onAuthenticate}><Text style={styles.primaryText}>{busy ? 'Confirmando...' : 'Entrar com biometria'}</Text></Pressable>
        <Pressable style={styles.secondary} onPress={onUsePassword}><Text style={styles.secondaryText}>Usar e-mail e senha</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 9999, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  card: { width: '100%', maxWidth: 420, alignItems: 'center', gap: spacing.lg, borderRadius: 24, padding: 28, backgroundColor: colors.card, ...shadows.elevated },
  icon: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 38, backgroundColor: colors.gold100 },
  title: { color: colors.text, fontSize: 23, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  primary: { width: '100%', minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, backgroundColor: colors.ink950 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondary: { minHeight: 44, justifyContent: 'center' },
  secondaryText: { color: colors.gold700, fontSize: 14, fontWeight: '700' },
});
