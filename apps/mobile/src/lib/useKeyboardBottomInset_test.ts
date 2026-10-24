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
