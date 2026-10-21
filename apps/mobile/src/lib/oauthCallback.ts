import { type Session, type User } from '@supabase/supabase-js';
import { mapAuthErrorMessage } from './authError';
import { normalizeSingleParam } from './router';
import { supabase } from './supabase';

export type AuthCallbackInput = {
  url?: string | null;
  routeParams?: Record<string, string | string[] | undefined>;
};

export type AuthCallbackOutcome = {
  session: Session | null;
  error: string | null;
  handled: boolean;
};

type ExtractedCallbackParams = {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  tokenHash: string | null;
  otpType: string | null;
  providerError: string | null;
};

const inFlightByKey = new Map<string, Promise<AuthCallbackOutcome>>();
const completedKeys = new Map<string, number>();
const COMPLETED_TTL_MS = 60_000;

function cleanString(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseQueryAndHashFromUrl(rawUrl: string | null | undefined): URLSearchParams {
  const merged = new URLSearchParams();
  if (!rawUrl || !rawUrl.trim()) return merged;

  const trimmed = rawUrl.trim();
  const hashIndex = trimmed.indexOf('#');
  const queryIndex = trimmed.indexOf('?');

  if (queryIndex !== -1) {
    const queryEnd = hashIndex !== -1 && hashIndex > queryIndex ? hashIndex : trimmed.length;
    const rawQuery = trimmed.slice(queryIndex + 1, queryEnd);
    const queryParams = new URLSearchParams(rawQuery);
    queryParams.forEach((value, key) => {
      if (!merged.has(key)) merged.set(key, value);
    });
  }

  if (hashIndex !== -1) {
    const rawHash = trimmed.slice(hashIndex + 1).replace(/^\?/, '');
    const hashParams = new URLSearchParams(rawHash);
    hashParams.forEach((value, key) => {
      if (!merged.has(key)) merged.set(key, value);
    });
  }

  return merged;
}

export function extractAuthCallbackParams(input: AuthCallbackInput): ExtractedCallbackParams {
  const params = parseQueryAndHashFromUrl(input.url);

  if (input.routeParams) {
    // Expo Router 6 stores URL #fragment inside routeParams['#']
    const rawHashParam = normalizeSingleParam(input.routeParams['#']);
    if (rawHashParam) {
      const hashSearchParams = new URLSearchParams(rawHashParam.replace(/^#/, ''));
      hashSearchParams.forEach((value, key) => {
        if (!params.has(key)) params.set(key, value);
      });
    }

    for (const [key, rawValue] of Object.entries(input.routeParams)) {
      if (key === '#') continue;
      const single = normalizeSingleParam(rawValue);
      if (single && !params.has(key)) {
        params.set(key, single);
      }
    }
  }

  const providerError =
    cleanString(params.get('error_description')) ??
    cleanString(params.get('error'));

  return {
    accessToken: cleanString(params.get('access_token')),
    refreshToken: cleanString(params.get('refresh_token')),
    code: cleanString(params.get('code')),
    tokenHash: cleanString(params.get('token_hash')),
    otpType: cleanString(params.get('type')),
    providerError,
  };
}

function deriveUserDisplayName(user: User): string | null {
  const metadata = (user.user_metadata as Record<string, unknown> | undefined) ?? {};
  const candidates = [
    metadata.name,
    metadata.full_name,
    metadata.preferred_username,
    user.email ? user.email.split('@')[0] : null,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function deriveUserAvatarUrl(user: User): string | null {
  const metadata = (user.user_metadata as Record<string, unknown> | undefined) ?? {};
  const candidates = [metadata.avatar_url, metadata.picture];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate.trim())) {
      return candidate.trim();
    }
  }
  return null;
}

function deriveAuthProvider(user: User): string | null {
  const appMeta = (user.app_metadata as Record<string, unknown> | undefined) ?? {};
  if (typeof appMeta.provider === 'string' && appMeta.provider.trim()) {
    return appMeta.provider.trim();
  }
  if (Array.isArray(user.identities) && user.identities.length > 0) {
    const firstProvider = user.identities[0]?.provider;
    if (typeof firstProvider === 'string' && firstProvider.trim()) {
      return firstProvider.trim();
    }
  }
  return null;
}

async function normalizeAuthenticatedUserMetadata(session: Session): Promise<void> {
  try {
    const metadata = (session.user.user_metadata as Record<string, unknown> | undefined) ?? {};
    const nextMetadata: Record<string, unknown> = { ...metadata };
    const normalizedName = deriveUserDisplayName(session.user);
    const normalizedAvatarUrl = deriveUserAvatarUrl(session.user);
    const provider = deriveAuthProvider(session.user);
    let shouldUpdate = false;

    if (normalizedName && metadata.name !== normalizedName) {
      nextMetadata.name = normalizedName;
      shouldUpdate = true;
    }
    if (provider && metadata.auth_provider !== provider) {
      nextMetadata.auth_provider = provider;
      shouldUpdate = true;
    }
    if (normalizedAvatarUrl && metadata.avatar_url !== normalizedAvatarUrl) {
      nextMetadata.avatar_url = normalizedAvatarUrl;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      await supabase.auth.updateUser({ data: nextMetadata });
    }
  } catch {
    // Best-effort normalization; do not block login flow
  }
}

export function isAuthCallbackUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const extracted = extractAuthCallbackParams({ url });
  return Boolean(
    url.includes('auth/callback') ||
      extracted.accessToken ||
      extracted.code ||
      extracted.tokenHash ||
      extracted.providerError
  );
}

export async function consumeAuthCallback(input: AuthCallbackInput): Promise<AuthCallbackOutcome> {
  const extracted = extractAuthCallbackParams(input);

  if (extracted.providerError) {
    return {
      session: null,
      error: mapAuthErrorMessage(new Error(extracted.providerError)),
      handled: true,
    };
  }

  const dedupeKey =
    (extracted.accessToken && `token:${extracted.accessToken.slice(-24)}`) ||
    (extracted.code && `code:${extracted.code}`) ||
    (extracted.tokenHash && `otp:${extracted.tokenHash}`) ||
    null;

  if (!dedupeKey) {
    const { data } = await supabase.auth.getSession();
    return {
      session: data.session ?? null,
      error: null,
      handled: false,
    };
  }

  const completedAt = completedKeys.get(dedupeKey);
  if (completedAt && Date.now() - completedAt < COMPLETED_TTL_MS) {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      return {
        session: data.session,
        error: null,
        handled: true,
      };
    }
  }

  const existingPromise = inFlightByKey.get(dedupeKey);
  if (existingPromise) {
    return existingPromise;
  }

  const task = (async (): Promise<AuthCallbackOutcome> => {
    try {
      if (extracted.accessToken && extracted.refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: extracted.accessToken,
          refresh_token: extracted.refreshToken,
        });
        if (error) {
          return {
            session: null,
            error: mapAuthErrorMessage(error),
            handled: true,
          };
        }
        if (data.session) {
          completedKeys.set(dedupeKey, Date.now());
          void normalizeAuthenticatedUserMetadata(data.session);
          return {
            session: data.session,
            error: null,
            handled: true,
          };
        }
      }

      if (extracted.code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(extracted.code);
        if (error) {
          const { data: fallback } = await supabase.auth.getSession();
          if (fallback.session) {
            completedKeys.set(dedupeKey, Date.now());
            return {
              session: fallback.session,
              error: null,
              handled: true,
            };
          }
          return {
            session: null,
            error: mapAuthErrorMessage(error),
            handled: true,
          };
        }
        if (data.session) {
          completedKeys.set(dedupeKey, Date.now());
          void normalizeAuthenticatedUserMetadata(data.session);
          return {
            session: data.session,
            error: null,
            handled: true,
          };
        }
      }

      if (extracted.tokenHash && extracted.otpType) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: extracted.tokenHash,
          type: extracted.otpType as 'email' | 'recovery' | 'invite' | 'email_change' | 'magiclink',
        });
        if (error) {
          return {
            session: null,
            error: mapAuthErrorMessage(error),
            handled: true,
          };
        }
        if (data.session) {
          completedKeys.set(dedupeKey, Date.now());
          void normalizeAuthenticatedUserMetadata(data.session);
          return {
            session: data.session,
            error: null,
            handled: true,
          };
        }
      }

      const { data } = await supabase.auth.getSession();
      return {
        session: data.session ?? null,
        error: null,
        handled: true,
      };
    } finally {
      inFlightByKey.delete(dedupeKey);
    }
  })();

  inFlightByKey.set(dedupeKey, task);
  return task;
}
