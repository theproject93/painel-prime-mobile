export const BILLING_PLAN_DEFINITIONS = [
  {
    id: 'essencial',
    title: 'Plano Essencial',
    amountCents: 3900,
    monthlyAmountCents: 3900,
    annualAmountCents: 37440,
  },
  {
    id: 'profissional',
    title: 'Plano Profissional',
    amountCents: 5900,
    monthlyAmountCents: 5900,
    annualAmountCents: 56640,
  },
  {
    id: 'elite',
    title: 'Plano Elite',
    amountCents: 8900,
    monthlyAmountCents: 8900,
    annualAmountCents: 85440,
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

export function getBillingPlanDefinition(planId: string | null | undefined) {
  return BILLING_PLAN_DEFINITIONS.find((plan) => plan.id === planId) ?? null;
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
