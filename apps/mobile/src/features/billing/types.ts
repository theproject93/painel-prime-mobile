export type BillingPlanId = 'essencial' | 'profissional' | 'elite' | 'fornecedor';

export type BillingCycle = 'monthly' | 'annual';

export type WhatsappCreditPackageId =
  | 'whatsapp_credits_start'
  | 'whatsapp_credits_pro'
  | 'whatsapp_credits_premium';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'pending'
  | 'pending_checkout'
  | 'pending_payment'
  | 'pending_pix'
  | 'canceled'
  | 'past_due'
  | 'unpaid';

export type PlanFeature = {
  text: string;
  included: boolean;
};

export type PlanDefinition = {
  id: BillingPlanId;
  name: string;
  tagline: string;
  monthlyAmountCents: number;
  annualAmountCents: number;
  featured?: boolean;
  popular?: boolean;
  badge?: string;
  trialDays: number;
  maxEvents: number | null; // null = ilimitado
  maxUsers: number;
  features: string[];
};

export type WhatsappCreditPackage = {
  id: WhatsappCreditPackageId;
  name: string;
  credits: number;
  amountCents: number;
  priceFormatted: string;
  unitPriceFormatted: string;
  popular: boolean;
  badge?: string;
  description: string;
  features: string[];
};

export type BillingSubscription = {
  user_id: string;
  tenant_id?: string | null;
  provider: string;
  status: string;
  plan_id: string | null;
  amount_cents: number | null;
  billing_cycle?: string | null;
  current_period_end?: string | null;
  trial_end?: string | null;
  last_payment_status: string | null;
  updated_at: string;
};

export type BillingPayment = {
  id: string;
  user_id: string | null;
  provider: string;
  provider_payment_id: string;
  status: string;
  amount: number | null;
  currency: string | null;
  payment_method_id: string | null;
  payer_email: string | null;
  processed_at: string;
};

export type CheckoutResponse = {
  ok: boolean;
  checkoutUrl?: string;
  orderNsu?: string;
  provider?: string;
  externalReference?: string;
  error?: string;
  details?: string;
};
