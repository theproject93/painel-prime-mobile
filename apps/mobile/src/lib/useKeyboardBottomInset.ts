import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, KeyboardEvent, Platform, StatusBar } from 'react-native';

import { extractKeyboardHeight, resolveKeyboardEventNames } from './keyboardInsetHelpers';

export { extractKeyboardHeight, resolveKeyboardEventNames };

/**
 * Custom hook that tracks active keyboard height across Android and iOS.
 * Strips Android edge-to-edge phantom decor insets so bottom sheets and
 * forms position flush against the top edge of Gboard/software keyboard.
 */
export function useKeyboardBottomInset(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const { showEvent, hideEvent } = resolveKeyboardEventNames(Platform.OS);

    const handleKeyboardShow = (event: KeyboardEvent) => {
      const screenHeight = Dimensions.get('screen').height;
      const statusBarHeight = StatusBar.currentHeight ?? 46;
      setKeyboardHeight(
        extractKeyboardHeight(event, { platform: Platform.OS, screenHeight, statusBarHeight })
      );
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
