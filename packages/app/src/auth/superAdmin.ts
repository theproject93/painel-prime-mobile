import type { User } from '@supabase/supabase-js';

export function parseConfiguredEmailList(rawValue: string | null | undefined) {
  return (rawValue ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

export function hasSuperAdminMetadata(
  user: Pick<User, 'email' | 'user_metadata'> | null | undefined
) {
  if (!user) return false;

  const metadata = (user.user_metadata as Record<string, unknown> | undefined) ?? {};
  const role =
    typeof metadata.role === 'string' ? metadata.role.toLowerCase().trim() : '';

  return (
    metadata.is_super_admin === true ||
    metadata.super_admin === true ||
    role === 'super_admin'
  );
}

export function hasConfiguredSuperAdminEmail(
  email: string | null | undefined,
  configuredEmails: readonly string[]
) {
  const normalizedEmail = email?.toLowerCase().trim() ?? '';
  return normalizedEmail.length > 0 && configuredEmails.includes(normalizedEmail);
}

export function resolveImmediateSuperAdmin(
  user: Pick<User, 'email' | 'user_metadata'> | null | undefined,
  configuredEmails: readonly string[]
) {
  return hasSuperAdminMetadata(user) || hasConfiguredSuperAdminEmail(user?.email, configuredEmails);
}
