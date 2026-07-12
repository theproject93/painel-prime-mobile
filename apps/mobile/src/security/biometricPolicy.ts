export const BIOMETRIC_RELOCK_AFTER_MS = 30_000;

export function biometricPreferenceKey(userId: string) {
  return `painelprime.biometric.enabled.v1.${userId}`;
}

export function biometricOfferKey(userId: string) {
  return `painelprime.biometric.offer.v1.${userId}`;
}

export function shouldRelock(backgroundedAt: number | null, now: number) {
  return backgroundedAt !== null && now - backgroundedAt >= BIOMETRIC_RELOCK_AFTER_MS;
}
