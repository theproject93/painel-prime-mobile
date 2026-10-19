export type GuestStatus = 'confirmed' | 'declined' | 'pending';

export type ReviewSelectionStatus = GuestStatus | 'keep';

export type ConversationReviewGuest = {
  id: string;
  name: string;
  phone: string | null;
  confirmed: boolean | null;
  rsvp_status: GuestStatus | null;
  is_group_leader: boolean | null;
  family_group_id: string | null;
  group_sort_order: number | null;
};

export type ConversationMessageItem = {
  id: string;
  direction: 'inbound' | 'outbound';
  message_type: string | null;
  text_body: string | null;
  is_audio?: boolean | null;
  template_name?: string | null;
  created_at?: string | null;
  interactive_kind?: string | null;
  interactive_payload?: Record<string, unknown> | null;
};

export type ConversationReviewThread = {
  thread_id: string;
  event_id?: string;
  family_group_id: string | null;
  leader_guest_id: string | null;
  phone_normalized: string | null;
  state: 'handoff' | 'clarify' | 'awaiting_reply' | 'resolved' | string;
  flow_state: string | null;
  manual_review_reason: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_confidence: number | null;
  last_resolution_payload: Record<string, unknown> | null;
  leader_name: string | null;
  leader_phone: string | null;
  last_inbound_message?: {
    id?: string;
    text_body?: string | null;
    message_type?: string | null;
    created_at?: string | null;
  } | null;
  messages: ConversationMessageItem[];
  guests: ConversationReviewGuest[];
};

export type RsvpInboxFilter = 'all' | 'attention' | 'active' | 'resolved';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function isWithin24hWindow(
  lastInboundAt: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!lastInboundAt) return false;
  const parsed = new Date(lastInboundAt).getTime();
  if (Number.isNaN(parsed)) return false;
  const elapsed = nowMs - parsed;
  return elapsed >= 0 && elapsed <= TWENTY_FOUR_HOURS_MS;
}

export function format24hRemaining(
  lastInboundAt: string | null | undefined,
  nowMs = Date.now()
): string {
  if (!lastInboundAt) return 'Janela 24h fechada';
  const parsed = new Date(lastInboundAt).getTime();
  if (Number.isNaN(parsed)) return 'Janela 24h fechada';
  const remainingMs = TWENTY_FOUR_HOURS_MS - (nowMs - parsed);
  if (remainingMs <= 0) return 'Janela 24h fechada';

  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes}m restantes`;
  return `${minutes} min restantes`;
}

export function threadStateLabel(state: string | undefined): string {
  if (state === 'handoff') return 'Contato manual';
  if (state === 'clarify') return 'Pedir confirmação';
  if (state === 'awaiting_reply') return 'Plan IA ativa';
  if (state === 'resolved') return 'Resolvido';
  return 'Em revisão';
}

export function flowStateLabel(flowState: string | null | undefined): string {
  if (flowState === 'awaiting_leader_decision') return 'Aguardando titular';
  if (flowState === 'awaiting_companion_decision') return 'Confirmando acompanhantes';
  if (flowState === 'manual_review') return 'Transbordo humano';
  if (flowState === 'completed') return 'Fluxo concluído';
  return 'Em atendimento';
}

export function summarizeReviewThreads(threads: ConversationReviewThread[]) {
  let attention = 0;
  let active = 0;
  let resolved = 0;

  for (const thread of threads) {
    if (thread.state === 'handoff' || thread.state === 'clarify') {
      attention += 1;
    } else if (thread.state === 'awaiting_reply') {
      active += 1;
    } else if (thread.state === 'resolved') {
      resolved += 1;
    } else {
      attention += 1;
    }
  }

  return { total: threads.length, attention, active, resolved };
}

export function extractSuggestedMembers(
  payload: Record<string, unknown> | null | undefined
): Array<{ guestId: string; nextStatus: GuestStatus }> {
  const interpretation =
    payload?.interpretation &&
    typeof payload.interpretation === 'object' &&
    !Array.isArray(payload.interpretation)
      ? (payload.interpretation as Record<string, unknown>)
      : null;

  const members = Array.isArray(interpretation?.members) ? interpretation.members : [];
  return members
    .map((member) => {
      if (!member || typeof member !== 'object' || Array.isArray(member)) return null;
      const row = member as Record<string, unknown>;
      const guestId =
        typeof row.guestId === 'string'
          ? row.guestId
          : typeof row.guest_id === 'string'
          ? row.guest_id
          : '';
      const nextStatus =
        row.nextStatus === 'confirmed' ||
        row.nextStatus === 'declined' ||
        row.nextStatus === 'pending'
          ? (row.nextStatus as GuestStatus)
          : row.next_status === 'confirmed' ||
            row.next_status === 'declined' ||
            row.next_status === 'pending'
          ? (row.next_status as GuestStatus)
          : null;
      if (!guestId || !nextStatus) return null;
      return { guestId, nextStatus };
    })
    .filter((m): m is { guestId: string; nextStatus: GuestStatus } => m !== null);
}

export function buildDefaultReviewSelections(
  thread: ConversationReviewThread
): Record<string, ReviewSelectionStatus> {
  const selections: Record<string, ReviewSelectionStatus> = {};
  for (const guest of thread.guests ?? []) {
    selections[guest.id] = (guest.rsvp_status as GuestStatus) ?? 'pending';
  }
  for (const member of extractSuggestedMembers(thread.last_resolution_payload)) {
    selections[member.guestId] = member.nextStatus;
  }
  return selections;
}

export function normalizeReviewThreads(value: unknown): ConversationReviewThread[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): ConversationReviewThread | null => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      const row = entry as Record<string, unknown>;
      const threadId = typeof row.thread_id === 'string' ? row.thread_id.trim() : '';
      if (!threadId) return null;

      const guests: ConversationReviewGuest[] = Array.isArray(row.guests)
        ? row.guests
            .map((g): ConversationReviewGuest | null => {
              if (!g || typeof g !== 'object' || Array.isArray(g)) return null;
              const grow = g as Record<string, unknown>;
              const gid = typeof grow.id === 'string' ? grow.id.trim() : '';
              const gname = typeof grow.name === 'string' ? grow.name.trim() : '';
              if (!gid || !gname) return null;
              return {
                id: gid,
                name: gname,
                phone: typeof grow.phone === 'string' ? grow.phone : null,
                confirmed: typeof grow.confirmed === 'boolean' ? grow.confirmed : null,
                rsvp_status:
                  grow.rsvp_status === 'confirmed' ||
                  grow.rsvp_status === 'declined' ||
                  grow.rsvp_status === 'pending'
                    ? (grow.rsvp_status as GuestStatus)
                    : null,
                is_group_leader:
                  typeof grow.is_group_leader === 'boolean' ? grow.is_group_leader : null,
                family_group_id:
                  typeof grow.family_group_id === 'string' ? grow.family_group_id : null,
                group_sort_order:
                  typeof grow.group_sort_order === 'number' ? grow.group_sort_order : null,
              };
            })
            .filter((g): g is ConversationReviewGuest => g !== null)
        : [];

      const messages: ConversationMessageItem[] = Array.isArray(row.messages)
        ? row.messages
            .map((m): ConversationMessageItem | null => {
              if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
              const mrow = m as Record<string, unknown>;
              const mid = typeof mrow.id === 'string' ? mrow.id.trim() : '';
              if (!mid) return null;
              return {
                id: mid,
                direction: mrow.direction === 'outbound' ? 'outbound' : 'inbound',
                message_type: typeof mrow.message_type === 'string' ? mrow.message_type : 'text',
                text_body: typeof mrow.text_body === 'string' ? mrow.text_body : null,
                is_audio: typeof mrow.is_audio === 'boolean' ? mrow.is_audio : false,
                template_name:
                  typeof mrow.template_name === 'string' ? mrow.template_name : null,
                created_at: typeof mrow.created_at === 'string' ? mrow.created_at : null,
                interactive_kind:
                  typeof mrow.interactive_kind === 'string' ? mrow.interactive_kind : null,
                interactive_payload:
                  mrow.interactive_payload &&
                  typeof mrow.interactive_payload === 'object' &&
                  !Array.isArray(mrow.interactive_payload)
                    ? (mrow.interactive_payload as Record<string, unknown>)
                    : null,
              };
            })
            .filter((m): m is ConversationMessageItem => m !== null)
        : [];

      return {
        thread_id: threadId,
        event_id: typeof row.event_id === 'string' ? row.event_id : undefined,
        family_group_id: typeof row.family_group_id === 'string' ? row.family_group_id : null,
        leader_guest_id: typeof row.leader_guest_id === 'string' ? row.leader_guest_id : null,
        phone_normalized: typeof row.phone_normalized === 'string' ? row.phone_normalized : null,
        state: typeof row.state === 'string' ? row.state : 'awaiting_reply',
        flow_state: typeof row.flow_state === 'string' ? row.flow_state : null,
        manual_review_reason:
          typeof row.manual_review_reason === 'string' ? row.manual_review_reason : null,
        last_inbound_at: typeof row.last_inbound_at === 'string' ? row.last_inbound_at : null,
        last_outbound_at: typeof row.last_outbound_at === 'string' ? row.last_outbound_at : null,
        last_confidence:
          typeof row.last_confidence === 'number' ? row.last_confidence : null,
        last_resolution_payload:
          row.last_resolution_payload &&
          typeof row.last_resolution_payload === 'object' &&
          !Array.isArray(row.last_resolution_payload)
            ? (row.last_resolution_payload as Record<string, unknown>)
            : null,
        leader_name: typeof row.leader_name === 'string' ? row.leader_name : null,
        leader_phone: typeof row.leader_phone === 'string' ? row.leader_phone : null,
        last_inbound_message:
          row.last_inbound_message &&
          typeof row.last_inbound_message === 'object' &&
          !Array.isArray(row.last_inbound_message)
            ? (row.last_inbound_message as ConversationReviewThread['last_inbound_message'])
            : null,
        messages,
        guests,
      };
    })
    .filter((t): t is ConversationReviewThread => t !== null);
}
