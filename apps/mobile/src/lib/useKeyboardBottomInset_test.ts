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

Deno.test('extractKeyboardHeight correctly calculates Android physical keyboard height from screenY geometry', () => {
  // Scenario: On modern Android edge-to-edge screens, screenHeight = 960 and screenY = 624
  // True visible keyboard height is 960 - 624 = 336dp (Gboard physical height)
  // Even if rawHeight is 312 (ReactRootView subtracted navBar), it must NOT truncate to 312
  const event = { endCoordinates: { height: 312, screenY: 624 } };
  const height = extractKeyboardHeight(event, { platform: 'android', screenHeight: 960, statusBarHeight: 46 });
  assertEquals(height, 336);
});

Deno.test('extractKeyboardHeight strips double-counted notch/status decor on physical Android devices', () => {
  // Legacy Android scenario: React Native reports height 406 with legacy inflation (> 350dp)
  // Status bar = 46dp, decor inflation = 46 + 24 = 70dp
  // True physical Gboard height = 406 - 70 = 336dp
  const event = { endCoordinates: { height: 406 } };
  const height = extractKeyboardHeight(event, { platform: 'android', screenHeight: 960, statusBarHeight: 46 });
  assertEquals(height, 336);
});

Deno.test('extractKeyboardHeight compensates modern Android rawHeight without screenY', () => {
  // Modern Android where rawHeight = 312 (navBar excluded) and screenY is undefined
  const event = { endCoordinates: { height: 312 } };
  const height = extractKeyboardHeight(event, { platform: 'android', screenHeight: 960, statusBarHeight: 46 });
  assertEquals(height, 336);
});

Deno.test('extractKeyboardHeight leaves iOS heights untouched', () => {
  const event = { endCoordinates: { height: 336, screenY: 508 } };
  const height = extractKeyboardHeight(event, { platform: 'ios', screenHeight: 844 });
  assertEquals(height, 336);
});
