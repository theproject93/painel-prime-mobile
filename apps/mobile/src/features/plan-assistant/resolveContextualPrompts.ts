export const DATA_QUICK_QUESTIONS = [
  'Quantos clientes aguardam orçamento?',
  'Qual a minha previsão de caixa atual?',
] as const;

export function resolveContextualPrompts(
  pathname: string,
  currentEventId: string | null
): readonly string[] {
  const cleanPath = (pathname || '').toLowerCase();

  if (cleanPath.includes('/convidados') || cleanPath.includes('/rsvp') || cleanPath.includes('/mesas')) {
    return [
      '🪑 Mapa e ocupação de mesas',
      '🥗 Relatório de restrições para buffet',
      '🚪 Check-in rápido portaria',
    ];
  }

  if (currentEventId || cleanPath.includes('/eventos/')) {
    return [
      '🎯 Raio-X deste evento',
      '💰 Margem de lucro real',
      '📋 Tarefas pendentes do evento',
    ];
  }

  if (cleanPath.includes('/financeiro') || cleanPath.includes('/caixa')) {
    return [
      '🔍 Auditoria de recebíveis',
      '💸 Dar baixa em Pix',
      '📉 Despesas em aberto',
    ];
  }

  if (cleanPath.includes('/fornecedores')) {
    return [
      '⏰ Alinhar montagem WhatsApp',
      '🔎 Buscar buffet no catálogo',
    ];
  }

  if (cleanPath.includes('/clientes') || cleanPath.includes('/crm')) {
    return [
      '📑 Consultar contratos',
      '✍️ Assinaturas pendentes',
    ];
  }

  if (cleanPath.includes('/dashboard')) {
    return [
      '📊 Resumo de caixa',
      '📅 Próximos eventos da semana',
      '⚠️ Parcelas a vencer em 15 dias',
    ];
  }

  return DATA_QUICK_QUESTIONS;
}
