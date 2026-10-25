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
 *
 * On Android edge-to-edge screens with transparent dialogs or fullscreen modals:
 * - On Android 11+ (API 30+), React Native's ReactRootView calculates:
 *     height = rootInsets.getInsets(WindowInsets.Type.ime()).bottom
 *              - rootInsets.getInsets(WindowInsets.Type.systemBars()).bottom
 *   Because systemBars (navBar) is subtracted, rawHeight represents only the height
 *   above the navigation bar (~312dp instead of the true 336dp on standard devices).
 * - On legacy Android (< API 30), ReactRootView calculates:
 *     heightDiff = displayMetrics.height - visibleFrame.bottom + notchHeight
 *   which double-counts status bar and display cutout / notch decor (~75-100dp).
 * - In contrast, screenY in ReactRootView is ALWAYS PixelUtil.toDIPFromPixel(mVisibleViewArea.bottom),
 *   which represents the exact Y coordinate where the software keyboard begins.
 *   Therefore, (screenHeight - screenY) gives the TRUE physical height of the keyboard
 *   measured from the absolute bottom of the display.
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

    // Primary: Calculate directly from screen geometry (screenHeight - screenY).
    // On edge-to-edge / fullscreen modals, this is the exact height from the screen bottom
    // to the top edge of Gboard / software keyboard.
    // NOTE: We MUST NOT use Math.min(rawHeight, visibleHeight) because on Android 11+,
    // rawHeight excludes navigation bar insets, making rawHeight smaller than visibleHeight!
    if (typeof screenY === 'number' && screenY > 0 && totalHeight > screenY) {
      const visibleHeight = totalHeight - screenY;
      if (visibleHeight >= 180 && visibleHeight <= 450) {
        return Math.round(visibleHeight);
      }
    }

    // Fallback 1: Legacy Android with notch / status bar decor inflation (rawHeight > 350dp)
    if (rawHeight > 350) {
      const statusBar = typeof options?.statusBarHeight === 'number' && options.statusBarHeight > 0
        ? options.statusBarHeight
        : 46;
      const decorInflation = statusBar + 24; // status bar + navigation bar
      const clamped = rawHeight - decorInflation;
      if (clamped >= 220 && clamped <= 380) {
        return Math.round(clamped);
      }
      return 336; // Sensible standard Gboard height
    }

    // Fallback 2: Modern Android edge-to-edge where screenHeight was supplied but screenY was missing/zero.
    // Add back the standard 24dp navigation bar so full-screen edge-to-edge views aren't cut off.
    if (totalHeight > 0 && rawHeight >= 200 && rawHeight <= 350) {
      return Math.min(Math.round(rawHeight + 24), 380);
    }
  }

  return rawHeight;
}
