import { assertEquals } from 'jsr:@std/assert@1';

import {
  biometricOfferKey,
  biometricPreferenceKey,
  shouldRelock,
} from './biometricPolicy.ts';

Deno.test('biometric preferences are isolated by account and use SecureStore-safe keys', () => {
  assertEquals(biometricPreferenceKey('user-a'), 'painelprime.biometric.enabled.v1.user-a');
  assertEquals(biometricOfferKey('user-b'), 'painelprime.biometric.offer.v1.user-b');
  assertEquals(biometricPreferenceKey('user-a').includes(':'), false);
});

Deno.test('background gate relocks only after thirty seconds', () => {
  assertEquals(shouldRelock(1_000, 30_999), false);
  assertEquals(shouldRelock(1_000, 31_000), true);
  assertEquals(shouldRelock(null, 99_000), false);
});
