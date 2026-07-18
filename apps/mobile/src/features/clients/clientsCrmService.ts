import { Linking } from 'react-native';
import { friendlyCrmError } from './clientJourney';
import { clientFormPayload } from './clientsScreenSelectors';
import type { ClientForm, ClientRow } from './clientsScreenTypes';
import { supabase } from '../../lib/supabase';

const CLIENT_COLUMNS = 'id,name,email,phone,stage,event_type,event_date_expected,budget_expected,notes,updated_at';
const CRM_WEB_BASE = process.env.EXPO_PUBLIC_APP_URL || 'https://app.painelprime.com.br';

export async function functionErrorMessage(error: unknown) { const context = (error as { context?: Response } | null)?.context; if (context && typeof context.clone === 'function') { try { return friendlyCrmError(await context.clone().json()); } catch { /* resposta não JSON */ } } return friendlyCrmError(error); }
export async function createClient(userId: string, form: ClientForm) { return supabase.from('crm_clients').insert({ user_id: userId, ...clientFormPayload(form), stage: 'conhecendo_cliente' } as never).select(CLIENT_COLUMNS).single(); }
export async function updateClient(clientId: string, form: ClientForm) { return supabase.from('crm_clients').update({ ...clientFormPayload(form), updated_at: new Date().toISOString() }).eq('id', clientId).select(CLIENT_COLUMNS).single(); }
export async function markClientLost(clientId: string) { return supabase.from('crm_clients').update({ stage: 'cliente_perdido', lost_at: new Date().toISOString() }).eq('id', clientId).select(CLIENT_COLUMNS).single(); }
export async function sendClientBudget(clientId: string) { return supabase.functions.invoke('crm-send-budget', { body: { clientId } }); }
export async function sendClientContract(client: ClientRow) {
  const generated = await supabase.functions.invoke('crm-generate-document', { body: { clientId: client.id, documentType: 'contract' } }); if (generated.error) throw generated.error;
  const documentId = (generated.data as { document?: { id?: string } } | null)?.document?.id; if (!documentId) throw new Error('document_not_found');
  const signed = await supabase.functions.invoke('crm-sign-advisor-contract', { body: { clientId: client.id, documentId, accepted: true } }); if (signed.error) throw signed.error;
  const { data } = await supabase.auth.getSession(); if (!data.session?.access_token) throw new Error('unauthorized');
  const response = await fetch(`${CRM_WEB_BASE}/api/crm/integrations/documenso/create-envelope`, { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: client.id, documentId, sendEmail: true, traceContext: { actionLabel: 'Enviar para assinatura', actionMessage: 'Envio iniciado pelo aplicativo Android' } }) });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>; if (!response.ok) throw body;
  const url = typeof body.url === 'string' ? body.url : null; if (url && (await Linking.canOpenURL(url))) await Linking.openURL(url);
}
