import { assertEquals } from 'jsr:@std/assert';

import {
  extractKeyboardHeight,
  resolveKeyboardEventNames,
} from './keyboardInsetHelpers.ts';

Deno.test('resolveKeyboardEventNames maps platform to correct event cycle', () => {
  const iosEvents = resolveKeyboardEventNames('ios');
  assertEquals(iosEvents.showEvent, 'keyboardWillShow');
  assertEquals(iosEvents.hideEvent, 'keyboardWillHide');

  const androidEvents = resolveKeyboardEventNames('android');
  assertEquals(androidEvents.showEvent, 'keyboardDidShow');
  assertEquals(androidEvents.hideEvent, 'keyboardDidHide');

  const fallbackEvents = resolveKeyboardEventNames('web');
  assertEquals(fallbackEvents.showEvent, 'keyboardDidShow');
  assertEquals(fallbackEvents.hideEvent, 'keyboardDidHide');
});

Deno.test('extractKeyboardHeight safely extracts height or defaults to zero', () => {
  assertEquals(extractKeyboardHeight(undefined), 0);
  assertEquals(extractKeyboardHeight(null), 0);
  assertEquals(extractKeyboardHeight({}), 0);
  assertEquals(extractKeyboardHeight({ endCoordinates: {} }), 0);
  assertEquals(extractKeyboardHeight({ endCoordinates: { height: 290 } }), 290);
});

Deno.test('extractKeyboardHeight correctly clamps Android phantom decor insets when screenY is plausible', () => {
  // Scenario: Android returns raw height 435, but screenHeight 960 and screenY 624
  // True visible keyboard height is 960 - 624 = 336
  const event = { endCoordinates: { height: 435, screenY: 624 } };
  const height = extractKeyboardHeight(event, { platform: 'android', screenHeight: 960 });
  assertEquals(height, 336);
});

Deno.test('extractKeyboardHeight strips double-counted notch/status decor on physical Android devices', () => {
  // Real Moto G62 scenario: React Native reports height 435.2 and screenY 524.8 (both inflated)
  // Status bar = 46dp, decor inflation = 46 * 2 + 7 = 99dp
  // True physical Gboard height = 435.2 - 99 = 336.2 -> 336dp
  const event = { endCoordinates: { height: 435.2, screenY: 524.8 } };
  const height = extractKeyboardHeight(event, { platform: 'android', screenHeight: 960, statusBarHeight: 46 });
  assertEquals(height, 336);
});

Deno.test('extractKeyboardHeight preserves uninflated Android keyboard heights', () => {
  // Normal Android keyboard that is already reasonable (e.g. 280dp)
  const event = { endCoordinates: { height: 280, screenY: 680 } };
  const height = extractKeyboardHeight(event, { platform: 'android', screenHeight: 960, statusBarHeight: 46 });
  assertEquals(height, 280);
});

Deno.test('extractKeyboardHeight leaves iOS heights untouched', () => {
  const event = { endCoordinates: { height: 336, screenY: 508 } };
  const height = extractKeyboardHeight(event, { platform: 'ios', screenHeight: 844 });
  assertEquals(height, 336);
});
