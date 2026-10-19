import type { PlanDefinition, WhatsappCreditPackage } from './types';

export const ANNUAL_DISCOUNT_PERCENT = 20;

export const PLANS_CATALOG: readonly PlanDefinition[] = [
  {
    id: 'essencial',
    name: 'Essencial',
    tagline: 'Ideal para assessores iniciando sua trajetória independente.',
    monthlyAmountCents: 4900,
    annualAmountCents: 47040, // 39,20/mês
    trialDays: 30,
    maxEvents: 3,
    maxUsers: 1,
    features: [
      'Até 3 eventos simultâneos ativos',
      'Checklist inteligente e cronograma do dia',
      'Controle financeiro básico por evento',
      'Portal do cliente e RSVP via link público',
      'Plan IA com automação inteligente',
      '1 usuário com acesso completo',
    ],
  },
  {
    id: 'profissional',
    name: 'Profissional',
    tagline: 'O plano perfeito para assessorias consolidadas em crescimento.',
    monthlyAmountCents: 8900,
    annualAmountCents: 85440, // 71,20/mês
    popular: true,
    badge: 'Mais Escolhido',
    trialDays: 0,
    maxEvents: 10,
    maxUsers: 3,
    features: [
      'Até 10 eventos simultâneos ativos',
      'CRM de noivos com pipeline Kanban completo',
      'Gestão avançada de equipe e fornecedores',
      'Disparos cognitivos oficiais de WhatsApp RSVP',
      'Mapa de mesas interativo touch completo',
      'Até 3 usuários simultâneos da equipe',
    ],
  },
  {
    id: 'elite',
    name: 'Elite Equilíbrio',
    tagline: 'Potência máxima e escala sem limites para grandes produtoras.',
    monthlyAmountCents: 14900,
    annualAmountCents: 143040, // 119,20/mês
    badge: 'Sem Limites',
    trialDays: 0,
    maxEvents: null, // Ilimitado
    maxUsers: 10,
    features: [
      'Eventos simultâneos ilimitados',
      'Salas virtuais de reunião Daily.co ilimitadas',
      'Transcrição e geração de atas executivas por IA',
      'Multi-cortejo de padrinhos com manual inteligente',
      'Suporte prioritário via WhatsApp corporativo',
      'Até 10 usuários simultâneos da assessoria',
    ],
  },
];

export const WHATSAPP_CREDITS_CATALOG: readonly WhatsappCreditPackage[] = [
  {
    id: 'whatsapp_credits_start',
    name: 'Pacote Start',
    credits: 200,
    amountCents: 3990,
    priceFormatted: 'R$ 39,90',
    unitPriceFormatted: 'R$ 0,20 / envio',
    popular: false,
    description: 'Ideal para mini-weddings e eventos intimistas de até 200 convidados.',
    features: [
      '200 disparos de WhatsApp RSVP Oficial',
      'Inteligência Artificial Plan IA inclusa',
      'Confirmação automática de acompanhantes',
      'Interpretação semântica de áudios e respostas',
      'Validade indeterminada (sem expiração)',
    ],
  },
  {
    id: 'whatsapp_credits_pro',
    name: 'Pacote Pro',
    credits: 500,
    amountCents: 8990,
    priceFormatted: 'R$ 89,90',
    unitPriceFormatted: 'R$ 0,18 / envio',
    popular: true,
    badge: 'Mais Escolhido',
    description: 'O pacote ideal para casamentos médios, debutantes e formaturas.',
    features: [
      '500 disparos de WhatsApp RSVP Oficial',
      'Inteligência Artificial Plan IA inclusa',
      'Confirmação automática de famílias e pares',
      'Estorno automático de números inválidos',
      'Validade indeterminada (sem expiração)',
    ],
  },
  {
    id: 'whatsapp_credits_premium',
    name: 'Pacote Premium',
    credits: 1500,
    amountCents: 22990,
    priceFormatted: 'R$ 229,90',
    unitPriceFormatted: 'R$ 0,15 / envio',
    popular: false,
    badge: 'Melhor Custo-Benefício',
    description: 'Volume máximo com o menor custo unitário por mensagem para altas demandas.',
    features: [
      '1.500 disparos de WhatsApp RSVP Oficial',
      'Inteligência Artificial Plan IA inclusa',
      'Economia de 25% no valor por mensagem',
      'Estorno automático de números inválidos',
      'Validade indeterminada (sem expiração)',
    ],
  },
];

export function formatCurrencyFromCents(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return 'R$ 0,00';
  const val = cents / 100;
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatCurrencyValue(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
