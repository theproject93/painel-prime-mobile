import type { Href, Router } from 'expo-router';

export function normalizeSingleParam(
  value: string | string[] | null | undefined,
) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

export function goBackOrReplace(router: Router, fallback: Href) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}

export function getVisibleSegments(segments: readonly string[]) {
  return segments.filter(
    (segment) => !segment.startsWith('(') && segment !== 'index',
  );
}
