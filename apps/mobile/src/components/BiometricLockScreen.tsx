import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, shadows, spacing } from '../theme/colors';

const PRIME_LOGO = require('../../assets/prime-logo-transparent.png');

export function PrivacyCurtain() {
  return (
    <View
      style={styles.curtainOverlay}
      accessibilityViewIsModal
      accessibilityRole="none"
      accessibilityLabel="Cortina de privacidade bancária Painel Prime"
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
    >
      <StatusBar style="light" backgroundColor="#111113" translucent={false} />
      <View style={styles.curtainCenter}>
        <Image
          source={PRIME_LOGO}
          style={styles.curtainLogo}
          resizeMode="contain"
          accessibilityLabel="Logotipo oficial Painel Prime"
        />
        <Text style={styles.curtainBrand}>PAINEL PRIME</Text>
        <View style={styles.curtainBadge}>
          <Ionicons name="shield-checkmark" size={14} color="#DEC479" />
          <Text style={styles.curtainBadgeText}>Ambiente Seguro</Text>
        </View>
      </View>
    </View>
  );
}

export function BiometricLockScreen({
  busy = false,
  isCurtainOnly = false,
  onAuthenticate,
  onUsePassword,
}: {
  busy?: boolean;
  isCurtainOnly?: boolean;
  onAuthenticate?: () => void;
  onUsePassword?: () => void;
}) {
  if (isCurtainOnly) {
    return <PrivacyCurtain />;
  }

  return (
    <View
      style={styles.overlay}
      accessibilityViewIsModal
      accessibilityRole="alert"
      accessibilityLabel="Bloqueio biométrico Painel Prime"
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
    >
      <StatusBar style="light" backgroundColor="#111113" translucent={false} />
      <View style={styles.card}>
        <Image
          source={PRIME_LOGO}
          style={styles.cardLogo}
          resizeMode="contain"
          accessibilityLabel="Logotipo oficial Painel Prime"
        />
        <View style={styles.icon}>
          <Ionicons name="finger-print" size={38} color="#DEC479" />
        </View>
        <Text style={styles.title}>Seu espaço está protegido</Text>
        <Text style={styles.subtitle}>Use sua biometria para continuar no Painel Prime.</Text>
        <Pressable
          style={styles.primary}
          disabled={busy}
          onPress={onAuthenticate}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={busy ? 'Confirmando biometria...' : 'Entrar com biometria'}
        >
          <Text style={styles.primaryText}>{busy ? 'Confirmando...' : 'Entrar com biometria'}</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          disabled={busy}
          onPress={onUsePassword}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Usar e-mail e senha"
        >
          <Text style={styles.secondaryText}>Usar e-mail e senha</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: '#111113',
  },
  curtainOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111113',
  },
  curtainCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  curtainLogo: {
    width: 96,
    height: 114,
  },
  curtainBrand: {
    color: '#DEC479',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginTop: 4,
  },
  curtainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(222, 196, 121, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(222, 196, 121, 0.25)',
  },
  curtainBadgeText: {
    color: '#DEC479',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 24,
    padding: 28,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: 'rgba(222, 196, 121, 0.25)',
    ...shadows.elevated,
  },
  cardLogo: {
    width: 52,
    height: 62,
    marginBottom: 4,
  },
  icon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    backgroundColor: 'rgba(222, 196, 121, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(222, 196, 121, 0.3)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  primary: {
    width: '100%',
    minHeight: 48,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: '#DEC479',
    marginTop: 4,
  },
  primaryText: {
    color: '#111113',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  secondary: {
    minHeight: 44,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#DEC479',
    fontSize: 14,
    fontWeight: '700',
  },
});

