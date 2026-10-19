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
    throw new Error(
      response.error.message ||
        `Falha ao executar ação ${payload.action} na thread de WhatsApp.`
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
