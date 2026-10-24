import { supabase } from '../../lib/supabase';
import {
  normalizeReviewThreads,
  type ConversationReviewThread,
  type GuestStatus,
} from './rsvpInboxModel';

export type ReviewActionPayload = {
  action: 'apply' | 'clarify' | 'handoff' | 'send_message' | 'resend_qr';
  eventId: string;
  threadId?: string;
  guestId?: string;
  members?: Array<{ guestId: string; nextStatus: GuestStatus }>;
  replyText?: string;
  reason?: string;
};

export type ReviewActionResult = {
  ok: boolean;
  action: string;
  threadId?: string;
  guestId?: string;
  replyMessageId?: string;
  qrOwnerId?: string;
  qrOwnerName?: string;
  sentTo?: string;
  error?: string;
};

export async function fetchRsvpReviewQueue(
  eventId: string
): Promise<ConversationReviewThread[]> {
  const { data, error } = await supabase.rpc('get_whatsapp_rsvp_review_queue', {
    p_event_id: eventId,
  });

  if (error) {
    throw new Error(error.message || 'Falha ao carregar fila de atendimento RSVP.');
  }

  return normalizeReviewThreads(data);
}

export async function invokeRsvpReviewAction(
  payload: ReviewActionPayload
): Promise<ReviewActionResult> {
  const response = await supabase.functions.invoke('whatsapp-rsvp-review-action', {
    body: payload,
  });

  if (response.error) {
    let detail = '';
    const context = (response.error as { context?: Response } | null)?.context;
    if (context && typeof context.clone === 'function') {
      try {
        const body = await context.clone().json();
        detail =
          typeof body?.message === 'string'
            ? body.message
            : typeof body?.error === 'string'
              ? body.error
              : '';
      } catch {
        // payload não JSON
      }
    }
    const rawMsg = detail || response.error.message || '';
    const lower = rawMsg.toLowerCase();
    const isLeakedTechnical =
      !rawMsg ||
      lower.includes('edge function') ||
      lower.includes('non-2xx') ||
      lower.includes('status code') ||
      lower.includes('functionshttperror') ||
      lower.includes('fetch') ||
      /^[a-z0-9]+(_[a-z0-9]+)+$/i.test(rawMsg);

    throw new Error(
      isLeakedTechnical
        ? 'Não foi possível executar esta ação no WhatsApp agora. Tente novamente.'
        : rawMsg
    );
  }

  return response.data as ReviewActionResult;
}

export function subscribeToRsvpInbox(eventId: string, onUpdate: () => void): () => void {
  const channel = supabase
    .channel(`realtime_rsvp_inbox_${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'whatsapp_rsvp_threads',
        filter: `event_id=eq.${eventId}`,
      },
      () => {
        onUpdate();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'whatsapp_rsvp_messages',
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
