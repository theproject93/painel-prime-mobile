import { supabase } from '../../lib/supabase';
import { normalizeAccessToken, parsePlanAssistantResponseText } from './core';
import type { PlanAssistantApiResponse, PlanAssistantRequest } from './types';
import { generateUuidV4 } from './uuid';

const TRANSPORT_TIMEOUT_MS = 25_000;

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
  const reqId = body.requestId || body.request_id || generateUuidV4();
  body.requestId = reqId;
  body.request_id = reqId;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('plan_assistant_missing_env');

  const cleanUrl = supabaseUrl.trim().replace(/\/+$/u, '');
  const sendWithToken = (token: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TRANSPORT_TIMEOUT_MS);
    return fetch(`${cleanUrl}/functions/v1/plan-assistant-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  };

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
  const payload = parsePlanAssistantResponseText(text);

  if (!response.ok) {
    throw new Error(`plan_assistant_http_${response.status}:${text || payload.message || `http_${response.status}`}`);
  }
  return { payload, accessToken };
}

export async function invokePlanAssistantChatViaSupabase(
  body: PlanAssistantRequest,
  accessToken?: string | null,
) {
  const reqId = body.requestId || body.request_id || generateUuidV4();
  body.requestId = reqId;
  body.request_id = reqId;

  let normalizedToken = normalizeAccessToken(accessToken) ?? (await resolveTransportAccessToken());
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const invokeWithToken = (token: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (supabaseAnonKey) headers.apikey = supabaseAnonKey;
    return supabase.functions.invoke('plan-assistant-chat', {
      body,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
  };

  let { data, error } = await invokeWithToken(normalizedToken);
  if (error && (String(error.message).includes('401') || (error as { status?: number }).status === 401)) {
    const refreshed = await resolveTransportAccessToken(true);
    if (refreshed) {
      normalizedToken = refreshed;
      const secondAttempt = await invokeWithToken(normalizedToken);
      data = secondAttempt.data;
      error = secondAttempt.error;
    }
  }

  if (error) throw new Error(`plan_assistant_invoke_error:${error.message}`);
  if (typeof data === 'string') {
    return parsePlanAssistantResponseText(data);
  }
  return (data ?? {}) as PlanAssistantApiResponse;
}

export async function getPlanAssistantAccessToken(forceRefresh = false) {
  if (forceRefresh) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    return normalizeAccessToken(refreshed.session?.access_token ?? null);
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const current = normalizeAccessToken(sessionData.session?.access_token ?? null);
  if (current) return current;
  return getPlanAssistantAccessToken(true);
}
