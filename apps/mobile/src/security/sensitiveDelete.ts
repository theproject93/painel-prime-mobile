import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { supabase } from '../lib/supabase';

const deviceKey = (userId: string) => `sensitive-delete-device-${userId}`;
const secretKey = (userId: string) => `sensitive-delete-secret-${userId}`;
const registeredKey = (userId: string) => `sensitive-delete-registered-${userId}`;

async function deviceId(userId: string) {
  let id = await SecureStore.getItemAsync(deviceKey(userId));
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(deviceKey(userId), id);
  }
  return id;
}

async function invoke(targetId: string, proof: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('authorize-sensitive-delete', {
    body: { targetKind: 'event_document', targetId, ...proof },
  });
  if (error || !data?.ok) {
    throw new Error(data?.error === 'invalid_confirmation'
      ? 'Senha ou biometria inválida. Tente novamente.'
      : 'Não foi possível confirmar a exclusão. Tente novamente.');
  }
  return data as { ok: boolean; biometricSecret?: string };
}

export async function canUseSensitiveDeleteBiometrics(userId: string) {
  const [hardware, enrolled, registered] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    SecureStore.getItemAsync(registeredKey(userId)),
  ]);
  return { available: hardware && enrolled, registered: hardware && enrolled && registered === 'true' };
}

export async function authorizeSensitiveDeleteWithPassword(userId: string, targetId: string, password: string, registerBiometrics: boolean) {
  const id = registerBiometrics ? await deviceId(userId) : undefined;
  const data = await invoke(targetId, { password, ...(id ? { deviceId: id, rememberBiometric: true } : {}) });
  if (id && data.biometricSecret) {
    await SecureStore.setItemAsync(secretKey(userId), data.biometricSecret, {
      requireAuthentication: true,
      authenticationPrompt: 'Ativar biometria para excluir documentos',
    });
    await SecureStore.setItemAsync(registeredKey(userId), 'true');
  }
}

export async function authorizeSensitiveDeleteWithBiometrics(userId: string, targetId: string) {
  const verified = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Excluir documento',
    promptSubtitle: 'Confirme sua identidade',
    disableDeviceFallback: true,
    biometricsSecurityLevel: 'strong',
  });
  if (!verified.success) throw new Error('Biometria não confirmada.');
  const secret = await SecureStore.getItemAsync(secretKey(userId), {
    requireAuthentication: true,
    authenticationPrompt: 'Confirme sua biometria para excluir o documento',
  });
  if (!secret) throw new Error('Biometria não cadastrada. Confirme com sua senha.');
  await invoke(targetId, { deviceId: await deviceId(userId), biometricSecret: secret });
}
