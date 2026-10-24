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
 */
export function extractKeyboardHeight(event: { endCoordinates?: { height?: number } } | null | undefined): number {
  return event?.endCoordinates?.height ?? 0;
}
