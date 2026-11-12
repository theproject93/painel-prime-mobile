export type PlanDecisionStatus = 'pending' | 'executed' | 'failed' | 'cancelled' | 'expired';

export type PlanDecision = {
  proposalId: string;
  threadId: string | null;
  eventId: string | null;
  title: string;
  description: string;
  createdAt: string;
  expiresAt: string;
  status: PlanDecisionStatus;
  result?: string;
};

const MAX_DECISIONS = 100;

export function decisionFromProposal(
  proposal: { proposal_id: string; title?: string; description?: string; expires_at: string },
  threadId: string | null,
  eventId: string | null,
  now = new Date(),
): PlanDecision {
  return {
    proposalId: proposal.proposal_id,
    threadId,
    eventId,
    title: proposal.title?.trim() || 'Ação assistida',
    description: proposal.description?.trim() || '',
    createdAt: now.toISOString(),
    expiresAt: proposal.expires_at,
    status: 'pending',
  };
}

export function effectiveDecisionStatus(decision: PlanDecision, nowMs = Date.now()): PlanDecisionStatus {
  return decision.status === 'pending' && new Date(decision.expiresAt).getTime() <= nowMs
    ? 'expired'
    : decision.status;
}

export function upsertDecision(items: PlanDecision[], decision: PlanDecision): PlanDecision[] {
  return [decision, ...items.filter((item) => item.proposalId !== decision.proposalId)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_DECISIONS);
}

export function updateDecisionStatus(
  items: PlanDecision[], proposalId: string, status: PlanDecisionStatus, result?: string,
): PlanDecision[] {
  return items.map((item) => item.proposalId === proposalId
    ? { ...item, status, ...(result ? { result: result.slice(0, 500) } : {}) }
    : item);
}

export function decisionsForEvent(items: PlanDecision[], eventId: string | null): PlanDecision[] {
  return eventId === null ? items : items.filter((item) => item.eventId === eventId);
}
