import { supabase } from '../../lib/supabase';
import type { EventPadrinhoItem, EventPadrinhoGuest } from './padrinhosModel';

const PADRINHOS_COLUMNS =
  'id, event_id, guest_id, role, side, entry_order, pair_padrinho_id, attire_status, attire_color, attire_notes, special_role, manual_sent_at, created_at, updated_at, guest:event_guests(id, name, phone, confirmed, rsvp_status, table_id, family_group_id)';

export type DispatchPlanIaPayload = {
  actionType: 'manual' | 'concentration' | 'attire';
  eventId: string;
  padrinhoIds?: string[];
};

export type DispatchPlanIaResult = {
  ok: boolean;
  requested?: number;
  success?: number;
  failed?: number;
  ignored?: number;
  results?: Array<{
    category: 'success' | 'failed' | 'ignored';
    padrinhoId: string;
    guestName?: string;
    phone?: string;
    error?: string;
  }>;
};

export class InsufficientCreditsError extends Error {
  requiredCredits: number;
  currentBalance: number;

  constructor(message: string, requiredCredits = 0, currentBalance = 0) {
    super(message);
    this.name = 'InsufficientCreditsError';
    this.requiredCredits = requiredCredits;
    this.currentBalance = currentBalance;
  }
}

export async function fetchEventPadrinhos(eventId: string): Promise<EventPadrinhoItem[]> {
  const { data, error } = await supabase
    .from('event_padrinhos')
    .select(PADRINHOS_COLUMNS)
    .eq('event_id', eventId)
    .order('entry_order', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Falha ao carregar cortejo de padrinhos.');
  }

  return (data ?? []) as unknown as EventPadrinhoItem[];
}

export async function fetchEventGuests(eventId: string): Promise<EventPadrinhoGuest[]> {
  const { data, error } = await supabase
    .from('event_guests')
    .select('id, name, phone, confirmed, rsvp_status, table_id, family_group_id')
    .eq('event_id', eventId)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Falha ao carregar lista de convidados.');
  }

  return (data ?? []) as EventPadrinhoGuest[];
}

export async function savePadrinho(
  payload: Partial<EventPadrinhoItem> & { event_id: string; guest_id: string }
): Promise<EventPadrinhoItem> {
  const now = new Date().toISOString();
  const upsertData = {
    ...payload,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('event_padrinhos')
    .upsert(upsertData)
    .select(PADRINHOS_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message || 'Falha ao salvar membro do cortejo.');
  }

  return data as unknown as EventPadrinhoItem;
}

export async function deletePadrinho(id: string): Promise<void> {
  const { error } = await supabase.from('event_padrinhos').delete().eq('id', id);

  if (error) {
    throw new Error(error.message || 'Falha ao remover membro do cortejo.');
  }
}

export async function fetchWhatsAppWalletCredits(): Promise<number> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return 0;

    const { data, error } = await supabase
      .from('organization_whatsapp_wallets')
      .select('balance_credits')
      .limit(1)
      .maybeSingle();

    if (error || !data) return 0;
    return typeof data.balance_credits === 'number' ? data.balance_credits : 0;
  } catch {
    return 0;
  }
}

export async function dispatchPadrinhosPlanIa(
  payload: DispatchPlanIaPayload
): Promise<DispatchPlanIaResult> {
  const response = await supabase.functions.invoke('whatsapp-padrinhos-dispatch', {
    body: {
      actionType: payload.actionType,
      eventId: payload.eventId,
      padrinhoIds: payload.padrinhoIds,
    },
  });

  if (response.error) {
    // Check if error response represents 402 Insufficient credits
    const errorDetails = response.data as Record<string, unknown> | undefined;
    if (
      errorDetails?.error === 'insufficient_whatsapp_credits' ||
      response.error.message?.includes('402') ||
      response.error.message?.includes('insufficient_whatsapp_credits')
    ) {
      throw new InsufficientCreditsError(
        (errorDetails?.message as string) ||
          'Saldo insuficiente de créditos de WhatsApp. Recarregue seus créditos para continuar.',
        Number(errorDetails?.requiredCredits ?? 0),
        Number(errorDetails?.currentBalance ?? 0)
      );
    }
    throw new Error(response.error.message || 'Falha no disparo do Plano IA.');
  }

  return response.data as DispatchPlanIaResult;
}

export function subscribeToPadrinhos(eventId: string, onUpdate: () => void): () => void {
  const channel = supabase
    .channel(`realtime_event_padrinhos_${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'event_padrinhos',
        filter: `event_id=eq.${eventId}`,
      },
      () => {
        onUpdate();
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
