export type ClientJourneyState =
  | 'lead'
  | 'budget_pending'
  | 'contract_ready'
  | 'signature_pending'
  | 'closed'
  | 'lost';

export type ClientJourneySnapshot = {
  stage: string;
  budgetApprovalStatus?: string | null;
  budgetExternalUrl?: string | null;
  contractSignedAt?: string | null;
  signatureStatus?: string | null;
  signatureExternalUrl?: string | null;
};

export type ClientJourneyPresentation = {
  state: ClientJourneyState;
  label: string;
  helper: string;
  action: 'send_budget' | 'view_budget' | 'send_contract' | 'view_signature' | 'none';
  actionLabel: string | null;
  url: string | null;
};

export function presentClientJourney(_snapshot: ClientJourneySnapshot): ClientJourneyPresentation {
  const snapshot = _snapshot;
  const stage = snapshot.stage.trim().toLowerCase();
  const approval = snapshot.budgetApprovalStatus?.trim().toLowerCase() ?? '';
  const signature = snapshot.signatureStatus?.trim().toLowerCase() ?? '';

  if (['cliente_perdido', 'perdido', 'lost'].includes(stage)) {
    return {
      state: 'lost',
      label: 'Cliente perdido',
      helper: 'A jornada comercial foi encerrada.',
      action: 'none',
      actionLabel: null,
      url: null,
    };
  }

  if (
    ['cliente_fechado', 'fechado', 'won', 'closed'].includes(stage) ||
    ['signed', 'completed'].includes(signature) ||
    Boolean(snapshot.contractSignedAt)
  ) {
    return {
      state: 'closed',
      label: 'Cliente fechado',
      helper: 'Contrato concluído. O evento pode seguir para a operação.',
      action: 'none',
      actionLabel: null,
      url: null,
    };
  }

  if (signature && !['cancelled', 'canceled', 'expired', 'failed', 'error'].includes(signature)) {
    return {
      state: 'signature_pending',
      label: 'Aguardando assinatura',
      helper: 'O contrato já foi enviado ao cliente.',
      action: snapshot.signatureExternalUrl ? 'view_signature' : 'none',
      actionLabel: snapshot.signatureExternalUrl ? 'Ver assinatura' : null,
      url: snapshot.signatureExternalUrl ?? null,
    };
  }

  if (approval === 'approved' || stage === 'assinatura_contrato') {
    return {
      state: 'contract_ready',
      label: 'Contrato pronto para envio',
      helper: 'O orçamento foi aprovado. Prepare a assinatura.',
      action: 'send_contract',
      actionLabel: 'Enviar contrato',
      url: null,
    };
  }

  if (stage === 'analisando_orcamento' || approval === 'pending') {
    const hasLink = Boolean(snapshot.budgetExternalUrl);
    return {
      state: 'budget_pending',
      label: 'Aguardando orçamento',
      helper: 'A proposta está com o cliente para análise.',
      action: hasLink ? 'view_budget' : 'send_budget',
      actionLabel: hasLink ? 'Ver proposta' : 'Reenviar orçamento',
      url: snapshot.budgetExternalUrl ?? null,
    };
  }

  return {
    state: 'lead',
    label: 'Novo contato',
    helper: 'Complete os dados e envie a primeira proposta.',
    action: 'send_budget',
    actionLabel: 'Enviar orçamento',
    url: null,
  };
}

export function friendlyCrmError(_raw: unknown): string {
  const raw = _raw;
  let code = '';
  let message = '';

  if (typeof raw === 'string') {
    code = raw.trim();
    message = raw.trim();
  } else if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    if (typeof rec.error === 'string') code = rec.error.trim();
    if (typeof rec.message === 'string') message = rec.message.trim();
    if (!code && message) code = message;
    if (!message && code) message = code;
  }

  const normalizedCode = code.toLowerCase();
  const normalizedMessage = message.toLowerCase();
  const combined = `${normalizedCode} ${normalizedMessage}`;

  // 1. Falha de conexão com a internet
  if (/network request failed/i.test(combined)) {
    return 'Falha de conexão com a internet. Verifique sua rede e tente novamente.';
  }

  // 2. Mapeamento específico dos códigos do CRM para PT-BR
  if (combined.includes('invalid_template_id')) {
    return 'Modelo de documento inválido ou não selecionado.';
  }
  if (combined.includes('document_template_not_found')) {
    return 'Modelo de documento não encontrado.';
  }
  if (combined.includes('onlyoffice_entitlement_required')) {
    return 'A edição de documentos exige o plano Elite.';
  }
  if (combined.includes('elite_plan_required')) {
    return 'Este recurso exige o plano Elite.';
  }
  if (combined.includes('client_email_required')) {
    return 'Adicione o e-mail do cliente antes de enviar.';
  }
  if (combined.includes('budget_not_approved')) {
    return 'O orçamento ainda precisa ser aprovado pelo cliente.';
  }
  if (combined.includes('advisor_signature_required')) {
    return 'Confirme a assinatura da assessoria antes de enviar.';
  }
  if (combined.includes('contract_pdf_required')) {
    return 'O contrato ainda não está pronto. Gere o documento e tente novamente.';
  }
  if (combined.includes('document_not_found')) {
    return 'Documento não encontrado. Gere o documento e tente novamente.';
  }
  if (combined.includes('documenso_not_configured')) {
    return 'A integração de assinatura digital não está configurada.';
  }
  if (combined.includes('papermark_not_configured')) {
    return 'A integração de visualização de documentos não está configurada.';
  }
  if (combined.includes('unauthorized') || combined.includes('missing_authorization')) {
    return 'Sessão expirada. Entre novamente.';
  }

  // 3. Bloqueio rigoroso de vazamento de mensagens técnicas ou de infraestrutura
  const isBlockedTechnical =
    combined.includes('edge function') ||
    combined.includes('non-2xx') ||
    combined.includes('status code') ||
    combined.includes('functionshttperror') ||
    combined.includes('fetch') ||
    combined.includes('column ') ||
    combined.includes('relation ') ||
    combined.includes('syntax error') ||
    combined.includes('database') ||
    combined.includes('postgres') ||
    combined.includes('internal_error') ||
    /pgrst/i.test(combined) ||
    /jwt expired/i.test(combined) ||
    /unique constraint/i.test(combined) ||
    /foreign key/i.test(combined) ||
    /syntax (for|error)/i.test(combined) ||
    /syntax/i.test(combined) ||
    /violates/i.test(combined) ||
    /duplicate key/i.test(combined) ||
    /constraint/i.test(combined) ||
    /failed to fetch/i.test(combined) ||
    /connection reset/i.test(combined) ||
    /connection refused/i.test(combined) ||
    /bad request/i.test(combined) ||
    /internal server error/i.test(combined);

  if (isBlockedTechnical) {
    return 'Não foi possível concluir agora. Tente novamente.';
  }

  // 3. Se for código cru em snake_case (ex: invalid_client_id, server_misconfigured)
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/i.test(message) || /^[a-z0-9]+(_[a-z0-9]+)+$/i.test(code)) {
    return 'Não foi possível concluir agora. Tente novamente.';
  }

  // 4. Preservar mensagens limpas de validação em PT-BR (ex: "Cadastre o e-mail do cliente antes de enviar.")
  if (message && message.length > 5 && !message.includes('_') && !/[<>{}\\]/.test(message)) {
    return message;
  }

  return 'Não foi possível concluir agora. Tente novamente.';
}
