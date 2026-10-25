import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, KeyboardEvent, Platform } from 'react-native';

import { extractKeyboardHeight, resolveKeyboardEventNames } from './keyboardInsetHelpers';

export { extractKeyboardHeight, resolveKeyboardEventNames };

/**
 * Custom hook that tracks active keyboard height across Android and iOS.
 * On Android edge-to-edge screens with transparent Modal dialogs, native window
 * resizing (adjustResize) does not shift transparent Modal contents. This hook provides
 * the active keyboard height in pixels so views can apply dynamic bottom padding.
 */
export function useKeyboardBottomInset(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const { showEvent, hideEvent } = resolveKeyboardEventNames(Platform.OS);

    const handleKeyboardShow = (event: KeyboardEvent) => {
      const screenHeight = Dimensions.get('screen').height;
      setKeyboardHeight(extractKeyboardHeight(event, { platform: Platform.OS, screenHeight }));
    };

    const handleKeyboardHide = () => {
      setKeyboardHeight(0);
    };

    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return keyboardHeight;
}
