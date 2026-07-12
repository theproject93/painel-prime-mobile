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
  const value =
    typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object'
        ? String(
            (raw as Record<string, unknown>).error ??
              (raw as Record<string, unknown>).message ??
              '',
          )
        : '';
  const normalized = value.toLowerCase();

  if (normalized.includes('client_email_required')) {
    return 'Adicione o e-mail do cliente antes de enviar.';
  }
  if (normalized.includes('budget_not_approved')) {
    return 'O orçamento ainda precisa ser aprovado pelo cliente.';
  }
  if (normalized.includes('advisor_signature_required')) {
    return 'Confirme a assinatura da assessoria antes de enviar.';
  }
  if (normalized.includes('contract_pdf_required') || normalized.includes('document_not_found')) {
    return 'O contrato ainda não está pronto. Gere o documento e tente novamente.';
  }
  if (normalized.includes('documenso_not_configured') || normalized.includes('papermark_not_configured')) {
    return 'A integração de documentos está temporariamente indisponível.';
  }

  return 'Não foi possível concluir agora. Tente novamente.';
}
