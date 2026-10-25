/**
 * Helper to determine platform-appropriate keyboard event names.
 * iOS supports 'will' events for smoother transitions, whereas Android uses 'did' events.
 */
export function resolveKeyboardEventNames(platform: 'ios' | 'android' | string) {
  return {
    showEvent: platform === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
    hideEvent: platform === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
  } as const;
}

/**
 * Extracts numeric height from KeyboardEvent safely.
 * On Android edge-to-edge screens with transparent dialogs or custom navigation bars,
 * React Native's Android keyboard observer inflates endCoordinates.height by double-counting
 * the status bar and display cutout / decor insets (~92-100dp).
 * A physical smartphone keyboard in portrait never exceeds ~340dp (typically 260-336dp).
 * This helper strips the phantom decor so bottom insets sit flush on top of the keyboard.
 */
export function extractKeyboardHeight(
  event: { endCoordinates?: { height?: number; screenY?: number } } | null | undefined,
  options?: { platform?: string; screenHeight?: number; statusBarHeight?: number }
): number {
  if (!event?.endCoordinates) return 0;
  const rawHeight = event.endCoordinates.height ?? 0;
  if (rawHeight <= 0) return 0;

  const platform = options?.platform ?? 'android';

  if (platform === 'android') {
    const screenY = event.endCoordinates.screenY;
    const totalHeight = options?.screenHeight ?? 0;

    // Case 1: If screenY accurately reflects the physical keyboard top (screenHeight - screenY is plausible)
    if (typeof screenY === 'number' && screenY > 0 && totalHeight > screenY) {
      const visibleHeight = totalHeight - screenY;
      if (visibleHeight > 0 && visibleHeight <= 350) {
        return Math.min(rawHeight, visibleHeight);
      }
    }

    // Case 2: React Native's Android legacy/IME insets double-add the status bar and notch/cutout decor
    // when calculating height (> 350dp on phones). Strip the double-counted status + cutout decor (~92-100dp).
    if (rawHeight > 350) {
      const statusBar = typeof options?.statusBarHeight === 'number' && options.statusBarHeight > 0
        ? options.statusBarHeight
        : 46;
      const decorInflation = statusBar * 2 + 7; // e.g. 46 * 2 + 7 = 99dp
      const clamped = rawHeight - decorInflation;
      if (clamped >= 220 && clamped <= 350) {
        return Math.round(clamped);
      }
      return Math.min(rawHeight, 336);
    }
  }

  return rawHeight;
}
