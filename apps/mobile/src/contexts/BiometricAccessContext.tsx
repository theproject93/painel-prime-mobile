import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from './AuthContext';
import { BiometricLockScreen } from '../components/BiometricLockScreen';
import { BiometricOptInModal } from '../components/BiometricOptInModal';
import {
  biometricOfferKey,
  biometricPreferenceKey,
  shouldInitializeBiometricForUser,
  shouldRelock,
  shouldStartBackgroundTimer,
} from '../security/biometricPolicy';

type BiometricAccessValue = {
  available: boolean;
  enabled: boolean;
  busy: boolean;
  enable: () => Promise<boolean>;
  disable: () => Promise<void>;
};

const BiometricAccessContext = createContext<BiometricAccessValue | null>(null);

export function BiometricAccessProvider({ children }: PropsWithChildren) {
  const { user, loading, signOut } = useAuth();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offerVisible, setOfferVisible] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const authenticationInFlight = useRef(false);
  const initializedUserId = useRef<string | null>(null);
  const userId = user?.id ?? null;

  const authenticate = useCallback(async () => {
    if (!userId || authenticationInFlight.current) return false;
    authenticationInFlight.current = true;
    setBusy(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Acessar Painel Prime',
        promptSubtitle: 'Confirme sua identidade',
        promptDescription: 'Use sua biometria para continuar',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: true,
        biometricsSecurityLevel: 'strong',
        requireConfirmation: false,
      });
      if (result.success) setLocked(false);
      return result.success;
    } finally {
      authenticationInFlight.current = false;
      setBusy(false);
    }
  }, [userId]);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      initializedUserId.current = null;
      setLocked(false);
      setEnabled(false);
      setOfferVisible(false);
      return;
    }
    if (!shouldInitializeBiometricForUser(initializedUserId.current, userId)) return;
    initializedUserId.current = userId;
    let active = true;
    void (async () => {
      try {
        const [hasHardware, enrolled, stored, offered] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          SecureStore.getItemAsync(biometricPreferenceKey(userId)),
          SecureStore.getItemAsync(biometricOfferKey(userId)),
        ]);
        if (!active) return;
        const canUse = hasHardware && enrolled;
        const isEnabled = canUse && stored === 'true';
        setAvailable(canUse);
        setEnabled(isEnabled);
        setLocked(isEnabled);
        setOfferVisible(canUse && !isEnabled && offered !== 'seen');
        if (isEnabled) void authenticate();
      } catch (error) {
        console.warn('Biometric initialization failed', error);
        if (!active) return;
        initializedUserId.current = null;
        setAvailable(false);
        setEnabled(false);
        setLocked(false);
      }
    })();
    return () => { active = false; };
  }, [authenticate, loading, userId]);

  useEffect(() => {
    const handleState = (nextState: AppStateStatus) => {
      if (!enabled || authenticationInFlight.current) return;
      if (shouldStartBackgroundTimer(nextState)) {
        backgroundedAt.current = Date.now();
        return;
      }
      if (nextState === 'active') {
        if (shouldRelock(backgroundedAt.current, Date.now())) {
          setLocked(true);
          void authenticate();
        }
        backgroundedAt.current = null;
      }
    };
    const subscription = AppState.addEventListener('change', handleState);
    return () => subscription.remove();
  }, [authenticate, enabled]);

  const enable = useCallback(async () => {
    if (!userId || !available) return false;
    const success = await authenticate();
    if (!success) return false;
    await SecureStore.setItemAsync(biometricPreferenceKey(userId), 'true');
    await SecureStore.setItemAsync(biometricOfferKey(userId), 'seen');
    setEnabled(true);
    setOfferVisible(false);
    return true;
  }, [authenticate, available, userId]);

  const disable = useCallback(async () => {
    if (!userId) return;
    await SecureStore.deleteItemAsync(biometricPreferenceKey(userId));
    await SecureStore.setItemAsync(biometricOfferKey(userId), 'seen');
    setEnabled(false);
    setLocked(false);
  }, [userId]);

  const dismissOffer = useCallback(async () => {
    if (userId) await SecureStore.setItemAsync(biometricOfferKey(userId), 'seen');
    setOfferVisible(false);
  }, [userId]);

  const usePassword = useCallback(async () => {
    setLocked(false);
    await signOut();
  }, [signOut]);

  return (
    <BiometricAccessContext.Provider value={{ available, enabled, busy, enable, disable }}>
      {children}
      <BiometricOptInModal visible={offerVisible} busy={busy} onEnable={() => void enable()} onDismiss={() => void dismissOffer()} />
      {locked ? <BiometricLockScreen busy={busy} onAuthenticate={() => void authenticate()} onUsePassword={() => void usePassword()} /> : null}
    </BiometricAccessContext.Provider>
  );
}

export function useBiometricAccess() {
  const value = useContext(BiometricAccessContext);
  if (!value) throw new Error('useBiometricAccess must be used inside BiometricAccessProvider');
  return value;
}
