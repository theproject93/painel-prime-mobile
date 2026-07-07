import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

type TypedSupabaseOptions = Parameters<typeof createClient<Database>>[2];
type UntypedSupabaseOptions = Parameters<typeof createClient>[2];

type SupabaseEnv = {
  supabaseUrl: string | null | undefined;
  supabaseAnonKey: string | null | undefined;
};

function requireEnv(name: string, value: string | null | undefined) {
  if (!value || !value.trim()) {
    throw new Error(`Missing ${name} in environment.`);
  }

  return value;
}

export function createPainelPrimeSupabaseClient(env: SupabaseEnv, options?: TypedSupabaseOptions) {
  const supabaseUrl = requireEnv('SUPABASE_URL', env.supabaseUrl);
  const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY', env.supabaseAnonKey);

  return createClient<Database>(supabaseUrl, supabaseAnonKey, options);
}

export function createWebSupabaseClient(env: SupabaseEnv) {
  return createPainelPrimeSupabaseClient(env, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
}

export function createNativeSupabaseClient(
  env: SupabaseEnv,
  storage: NonNullable<NonNullable<UntypedSupabaseOptions>['auth']>['storage']
) {
  const supabaseUrl = requireEnv('SUPABASE_URL', env.supabaseUrl);
  const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY', env.supabaseAnonKey);

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
