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

Deno.test('extractKeyboardHeight correctly clamps Android phantom decor insets', () => {
  // Scenario: Android returns raw height 435, but screenHeight 960 and screenY 624
  // True visible keyboard height is 960 - 624 = 336
  const event = { endCoordinates: { height: 435, screenY: 624 } };
  const height = extractKeyboardHeight(event, { platform: 'android', screenHeight: 960 });
  assertEquals(height, 336);
});
