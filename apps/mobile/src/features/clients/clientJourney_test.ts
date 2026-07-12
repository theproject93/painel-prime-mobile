import { friendlyCrmError, presentClientJourney } from './clientJourney.ts';

Deno.test('presents a new lead with a budget action', () => {
  const result = presentClientJourney({ stage: 'conhecendo_cliente' });
  if (result.state !== 'lead' || result.action !== 'send_budget') {
    throw new Error(`unexpected lead presentation: ${JSON.stringify(result)}`);
  }
});

Deno.test('prioritizes signed and lost terminal states', () => {
  const signed = presentClientJourney({
    stage: 'assinatura_contrato',
    signatureStatus: 'signed',
  });
  const lost = presentClientJourney({
    stage: 'cliente_perdido',
    budgetApprovalStatus: 'approved',
  });

  if (signed.state !== 'closed' || signed.action !== 'none') {
    throw new Error('signed client must be closed');
  }
  if (lost.state !== 'lost' || lost.action !== 'none') {
    throw new Error('lost client must never receive another commercial action');
  }
});

Deno.test('moves approved budgets to the contract action', () => {
  const result = presentClientJourney({
    stage: 'analisando_orcamento',
    budgetApprovalStatus: 'approved',
  });
  if (result.state !== 'contract_ready' || result.action !== 'send_contract') {
    throw new Error(`approved budget did not advance: ${JSON.stringify(result)}`);
  }
});

Deno.test('uses provider links for pending customer actions', () => {
  const budget = presentClientJourney({
    stage: 'analisando_orcamento',
    budgetApprovalStatus: 'pending',
    budgetExternalUrl: 'https://example.test/budget',
  });
  const signature = presentClientJourney({
    stage: 'assinatura_contrato',
    signatureStatus: 'pending',
    signatureExternalUrl: 'https://example.test/sign',
  });

  if (budget.action !== 'view_budget' || budget.url !== 'https://example.test/budget') {
    throw new Error('budget provider link was not preserved');
  }
  if (signature.action !== 'view_signature' || signature.url !== 'https://example.test/sign') {
    throw new Error('signature provider link was not preserved');
  }
});

Deno.test('translates backend codes without exposing technical details', () => {
  const cases: Array<[unknown, string]> = [
    ['client_email_required', 'Adicione o e-mail do cliente antes de enviar.'],
    ['budget_not_approved', 'O orçamento ainda precisa ser aprovado pelo cliente.'],
    ['advisor_signature_required', 'Confirme a assinatura da assessoria antes de enviar.'],
    ['column crm.foo does not exist', 'Não foi possível concluir agora. Tente novamente.'],
  ];

  for (const [raw, expected] of cases) {
    const actual = friendlyCrmError(raw);
    if (actual !== expected) throw new Error(`${String(raw)} rendered as ${actual}`);
  }
});
