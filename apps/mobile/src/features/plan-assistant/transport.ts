import { supabase } from '../../lib/supabase';
import { normalizeAccessToken } from './core';
import type { PlanAssistantApiResponse, PlanAssistantRequest } from './types';

async function resolveTransportAccessToken(forceRefresh = false) {
  if (forceRefresh) {
    const { data } = await supabase.auth.refreshSession();
    return normalizeAccessToken(data.session?.access_token ?? null);
  }
  const { data } = await supabase.auth.getSession();
  if (data.session) return normalizeAccessToken(data.session.access_token);
  const { data: refreshed } = await supabase.auth.refreshSession();
  return normalizeAccessToken(refreshed.session?.access_token ?? null);
}

export async function invokePlanAssistantChat(
  body: PlanAssistantRequest,
  providedAccessToken?: string | null,
) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('plan_assistant_missing_env');

  const sendWithToken = (token: string) =>
    fetch(`${supabaseUrl}/functions/v1/plan-assistant-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

  let accessToken = normalizeAccessToken(providedAccessToken) ?? await resolveTransportAccessToken();
  if (!accessToken) throw new Error('plan_assistant_unauthorized');

  let response = await sendWithToken(accessToken);
  if (response.status === 401) {
    const refreshedToken = await resolveTransportAccessToken(true);
    if (!refreshedToken) throw new Error('plan_assistant_unauthorized_after_refresh');
    accessToken = refreshedToken;
    response = await sendWithToken(accessToken);
  }

  const text = await response.text();
  let payload: PlanAssistantApiResponse = {};
  try {
    payload = text ? JSON.parse(text) as PlanAssistantApiResponse : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw new Error(`plan_assistant_http_${response.status}:${text || payload.message || `http_${response.status}`}`);
  }
  return { payload, accessToken };
}

export async function invokePlanAssistantChatViaSupabase(
  body: PlanAssistantRequest,
  accessToken?: string | null,
) {
  const headers: Record<string, string> = {};
  const normalizedToken = normalizeAccessToken(accessToken);
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (normalizedToken) headers.Authorization = `Bearer ${normalizedToken}`;
  if (supabaseAnonKey) headers.apikey = supabaseAnonKey;

  const { data, error } = await supabase.functions.invoke('plan-assistant-chat', {
    body,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });
  if (error) throw new Error(`plan_assistant_invoke_error:${error.message}`);
  return (data ?? {}) as PlanAssistantApiResponse;
}

export async function getPlanAssistantAccessToken(forceRefresh = false) {
  if (forceRefresh) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    const token = normalizeAccessToken(refreshed.session?.access_token ?? null);
    if (!token) return null;
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      await supabase.auth.signOut();
      throw new Error('plan_assistant_relogin_required');
    }
    return token;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const current = normalizeAccessToken(sessionData.session?.access_token ?? null);
  if (current) {
    const { data, error } = await supabase.auth.getUser(current);
    if (!error && data.user) return current;
  }
  return getPlanAssistantAccessToken(true);
}
