export const BILLING_PLAN_DEFINITIONS = [
  {
    id: 'essencial',
    title: 'Plano Essencial',
    amountCents: 4900,
    monthlyAmountCents: 4900,
    annualAmountCents: 47040,
  },
  {
    id: 'profissional',
    title: 'Plano Profissional',
    amountCents: 8900,
    monthlyAmountCents: 8900,
    annualAmountCents: 85440,
  },
  {
    id: 'elite',
    title: 'Plano Elite',
    amountCents: 14900,
    monthlyAmountCents: 14900,
    annualAmountCents: 143040,
  },
  {
    id: 'fornecedor',
    title: 'Plano Fornecedor',
    amountCents: 2900,
    monthlyAmountCents: 2900,
    annualAmountCents: 27840,
  },
] as const;

export type BillingPlanDefinition = (typeof BILLING_PLAN_DEFINITIONS)[number];
export type BillingPlanId = BillingPlanDefinition['id'];
export type BillingCycle = 'monthly' | 'annual';

export const BILLING_CYCLE_VALUES = ['monthly', 'annual'] as const;
export const ANNUAL_BILLING_DISCOUNT_PERCENT = 20;

export function normalizePlanTierId(planId: string | null | undefined): BillingPlanId | null {
  if (!planId) return null;
  const clean = planId.trim().toLowerCase();
  if (clean === 'elite' || clean.startsWith('elite_') || clean.startsWith('elite-') || clean.includes('elite')) {
    return 'elite';
  }
  if (clean === 'profissional' || clean.startsWith('profissional_') || clean.startsWith('profissional-') || clean.includes('profissional')) {
    return 'profissional';
  }
  if (clean === 'fornecedor' || clean.startsWith('fornecedor_') || clean.startsWith('fornecedor-') || clean.includes('fornecedor')) {
    return 'fornecedor';
  }
  if (clean === 'essencial' || clean.startsWith('essencial_') || clean.startsWith('essencial-') || clean.includes('essencial')) {
    return 'essencial';
  }
  return null;
}

export function getBillingPlanDefinition(planId: string | null | undefined) {
  const normalized = normalizePlanTierId(planId);
  return BILLING_PLAN_DEFINITIONS.find((plan) => plan.id === (normalized ?? planId)) ?? null;
}

export function normalizeBillingCycle(value: unknown): BillingCycle {
  return value === 'annual' ? 'annual' : 'monthly';
}

export function getBillingPlanAmountCents(
  planId: BillingPlanId | string | null | undefined,
  cycle: BillingCycle = 'monthly'
) {
  const plan = getBillingPlanDefinition(planId);
  if (!plan) return null;
  return cycle === 'annual' ? plan.annualAmountCents : plan.monthlyAmountCents;
}
