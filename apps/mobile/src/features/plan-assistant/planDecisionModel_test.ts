import { strict as assert } from 'node:assert';
import {
  decisionFromProposal,
  decisionsForEvent,
  effectiveDecisionStatus,
  updateDecisionStatus,
  upsertDecision,
} from './planDecisionModel.ts';

Deno.test('a caixa mantém decisões por evento e evita duplicar propostas', () => {
  const date = new Date('2026-11-11T12:00:00Z');
  const a = decisionFromProposal({ proposal_id: 'a', title: 'Criar tarefa', expires_at: '2026-11-11T12:15:00Z' }, 'thread-a', 'event-a', date);
  const b = decisionFromProposal({ proposal_id: 'b', title: 'Enviar convite', expires_at: '2026-11-11T12:15:00Z' }, 'thread-b', 'event-b', date);
  const items = upsertDecision(upsertDecision([a], b), { ...a, status: 'executed' });
  assert.equal(items.length, 2);
  assert.equal(decisionsForEvent(items, 'event-a')[0].status, 'executed');
  assert.equal(decisionsForEvent(items, 'event-b')[0].proposalId, 'b');
  assert.equal(decisionsForEvent(items, 'missing').length, 0);
});

Deno.test('pendência expira e falha pode ser substituída por execução confirmada', () => {
  const decision = decisionFromProposal({ proposal_id: 'a', expires_at: '2026-11-11T12:15:00Z' }, null, null);
  assert.equal(effectiveDecisionStatus(decision, Date.parse('2026-11-11T12:14:00Z')), 'pending');
  assert.equal(effectiveDecisionStatus(decision, Date.parse('2026-11-11T12:16:00Z')), 'expired');
  const failed = updateDecisionStatus([decision], 'a', 'failed', 'Falha temporária');
  const executed = updateDecisionStatus(failed, 'a', 'executed', 'Tarefa criada');
  assert.equal(executed[0].status, 'executed');
  assert.equal(executed[0].result, 'Tarefa criada');
});
