import { supabase } from '../../lib/supabase';

const CRM_WEB_BASE = process.env.EXPO_PUBLIC_APP_URL || 'https://app.painelprime.com.br';

async function accessToken(forceRefresh = false) {
  if (forceRefresh) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token ?? null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function callCrmWebApi<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }) {
  const send = async (token: string) => {
    const response = await fetch(`${CRM_WEB_BASE}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const payload = await response.json().catch(() => ({})) as T & { error?: string };
    return { response, payload };
  };

  let token = await accessToken(false);
  if (!token) throw new Error('Sua sessão expirou. Entre novamente.');
  let result = await send(token);
  if (result.response.status === 401) {
    token = await accessToken(true);
    if (token) result = await send(token);
  }
  if (!result.response.ok) throw new Error(result.payload.error || `Falha ao acessar integração (${result.response.status}).`);
  return result.payload;
}
