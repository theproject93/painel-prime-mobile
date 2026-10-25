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
 * endCoordinates.height often includes hidden IME window decor layers, causing phantom gaps.
 * Measuring against screenHeight - screenY yields the exact visible displacement on screen.
 */
export function extractKeyboardHeight(
  event: { endCoordinates?: { height?: number; screenY?: number } } | null | undefined,
  options?: { platform?: string; screenHeight?: number }
): number {
  if (!event?.endCoordinates) return 0;
  const rawHeight = event.endCoordinates.height ?? 0;
  const screenY = event.endCoordinates.screenY;
  const platform = options?.platform ?? 'android';

  if (platform === 'android' && typeof screenY === 'number' && screenY > 0) {
    const totalHeight = options?.screenHeight ?? 0;
    if (totalHeight > screenY) {
      const visibleHeight = totalHeight - screenY;
      if (visibleHeight > 0) {
        return Math.min(rawHeight, visibleHeight);
      }
    }
  }

  return rawHeight;
}
