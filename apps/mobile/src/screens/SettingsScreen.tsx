import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { useBiometricAccess } from '../contexts/BiometricAccessContext';
import { colors } from '../theme/colors';
import { fontSize, fontWeight, radii, spacing } from '../theme/tokens';

export function SettingsScreen() {
  const router = useRouter();
  const { available, enabled, busy, enable, disable } = useBiometricAccess();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen title="Configurações" subtitle="Segurança, privacidade e informações do aplicativo">
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.primaryStrong} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Seus dados protegidos</Text>
          <Text style={styles.description}>
            Sua sessão é armazenada com segurança no dispositivo e os dados permanecem vinculados à sua conta.
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed, !available && styles.unavailable]}
        disabled={!available || busy}
        onPress={() => void (enabled ? disable() : enable())}
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled, disabled: !available || busy }}
        accessibilityLabel="Entrada por biometria"
      >
        <Ionicons name="finger-print" size={23} color={available ? colors.primaryStrong : colors.mutedText} />
        <View style={styles.copy}>
          <Text style={styles.rowTitle}>Entrada por biometria</Text>
          <Text style={styles.rowDescription}>
            {!available ? 'Biometria não disponível neste aparelho' : enabled ? 'Ativada neste aparelho' : 'Entre sem digitar sua senha'}
          </Text>
        </View>
        <View style={[styles.toggle, enabled && styles.toggleOn]}><View style={[styles.toggleKnob, enabled && styles.toggleKnobOn]} /></View>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() => router.push('/politica-de-privacidade' as never)}
        accessibilityRole="button"
        accessibilityLabel="Abrir política de privacidade"
      >
        <Ionicons name="document-text-outline" size={21} color={colors.primaryStrong} />
        <View style={styles.copy}>
          <Text style={styles.rowTitle}>Política de privacidade</Text>
          <Text style={styles.rowDescription}>Saiba como suas informações são utilizadas</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
      </Pressable>

      <View style={styles.versionCard}>
        <Text style={styles.versionBrand}>Painel Prime</Text>
        <Text style={styles.versionText}>Versão {version}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.text,
    padding: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 4 },
  title: { color: colors.card, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  description: { color: '#C9CED8', fontSize: fontSize.sm, lineHeight: 20 },
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pressed: { opacity: 0.72 },
  unavailable: { opacity: 0.55 },
  rowTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  rowDescription: { color: colors.mutedText, fontSize: fontSize.xs, lineHeight: 18 },
  versionCard: { alignItems: 'center', paddingVertical: spacing.xl, gap: 4 },
  versionBrand: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  versionText: { color: colors.mutedText, fontSize: fontSize.sm },
  toggle: { width: 46, height: 26, justifyContent: 'center', borderRadius: 13, padding: 3, backgroundColor: colors.surfaceSubtle },
  toggleOn: { backgroundColor: colors.primaryStrong },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.card },
  toggleKnobOn: { alignSelf: 'flex-end' },
});
