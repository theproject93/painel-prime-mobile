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
    ['invalid_template_id', 'Modelo de documento inválido ou não selecionado.'],
    ['document_template_not_found', 'Modelo de documento não encontrado.'],
    ['onlyoffice_entitlement_required', 'A edição de documentos exige o plano Elite.'],
    ['elite_plan_required', 'Este recurso exige o plano Elite.'],
    ['contract_pdf_required', 'O contrato ainda não está pronto. Gere o documento e tente novamente.'],
    ['document_not_found', 'Documento não encontrado. Gere o documento e tente novamente.'],
    ['documenso_not_configured', 'A integração de assinatura digital não está configurada.'],
    ['papermark_not_configured', 'A integração de visualização de documentos não está configurada.'],
    ['unauthorized', 'Sessão expirada. Entre novamente.'],
    ['missing_authorization', 'Sessão expirada. Entre novamente.'],
    [{ error: 'invalid_template_id' }, 'Modelo de documento inválido ou não selecionado.'],
    [{ message: 'onlyoffice_entitlement_required' }, 'A edição de documentos exige o plano Elite.'],
    ['column crm.foo does not exist', 'Não foi possível concluir agora. Tente novamente.'],
    ['Edge Function returned a non-2xx status code', 'Não foi possível concluir agora. Tente novamente.'],
    [new Error('Edge Function returned a non-2xx status code'), 'Não foi possível concluir agora. Tente novamente.'],
    ['FunctionsHttpError: status code 500', 'Não foi possível concluir agora. Tente novamente.'],
    ['Failed to fetch', 'Não foi possível concluir agora. Tente novamente.'],
    ['PGRST116: JSON object requested', 'Não foi possível concluir agora. Tente novamente.'],
    ['Network request failed', 'Falha de conexão com a internet. Verifique sua rede e tente novamente.'],
    ['duplicate key value violates unique constraint', 'Não foi possível concluir agora. Tente novamente.'],
    ['invalid input syntax for type uuid', 'Não foi possível concluir agora. Tente novamente.'],
    [new Error('Network request failed'), 'Falha de conexão com a internet. Verifique sua rede e tente novamente.'],
    [{ message: 'PGRST116: JSON object requested, multiple (or no) rows returned' }, 'Não foi possível concluir agora. Tente novamente.'],
    ['Cadastre o e-mail do cliente antes de enviar.', 'Cadastre o e-mail do cliente antes de enviar.'],
    ['Gere o orçamento antes de criar o link de leitura.', 'Gere o orçamento antes de criar o link de leitura.'],
  ];

  for (const [raw, expected] of cases) {
    const actual = friendlyCrmError(raw);
    if (actual !== expected) {
      throw new Error(`${String(raw)} rendered as "${actual}", expected "${expected}"`);
    }
  }
});
