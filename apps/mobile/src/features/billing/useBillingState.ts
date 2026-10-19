import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type {
  BillingCycle,
  BillingPayment,
  BillingSubscription,
} from './types';

export function useBillingState() {
  const { user, isSuperAdmin } = useAuth();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [whatsappCredits, setWhatsappCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError('');

    try {
      // 1. Assinatura ativa do usuário
      const subPromise = supabase
        .from('billing_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2. Histórico de pagamentos
      const paymentsPromise = supabase
        .from('billing_payments')
        .select('*')
        .eq('user_id', user.id)
        .order('processed_at', { ascending: false })
        .limit(50);

      // 3. Saldo de créditos de WhatsApp (busca em platform_tenants ou fallback)
      const tenantId = (user.app_metadata as Record<string, unknown>)?.tenant_id as string | undefined;
      const creditsPromise = tenantId
        ? supabase
            .from('platform_tenants')
            .select('whatsapp_credits_balance')
            .eq('id', tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [subRes, paymentsRes, creditsRes] = await Promise.all([
        subPromise,
        paymentsPromise,
        creditsPromise,
      ]);

      if (subRes.data) {
        setSubscription(subRes.data as BillingSubscription);
      } else {
        setSubscription(null);
      }

      if (paymentsRes.data) {
        setPayments(paymentsRes.data as BillingPayment[]);
      } else {
        setPayments([]);
      }

      if (creditsRes.data && typeof (creditsRes.data as Record<string, unknown>).whatsapp_credits_balance === 'number') {
        setWhatsappCredits(Number((creditsRes.data as Record<string, unknown>).whatsapp_credits_balance));
      } else {
        setWhatsappCredits(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar informações de faturamento.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleCheckout = useCallback(
    async (planOrPackageId: string, cycle: BillingCycle = billingCycle) => {
      setCheckoutLoading(true);
      setError('');
      try {
        const isCreditPackage = planOrPackageId.startsWith('whatsapp_credits_');
        const { data, error: invokeError } = await supabase.functions.invoke('billing-create-checkout', {
          body: {
            planId: planOrPackageId,
            billingCycle: isCreditPackage ? 'monthly' : cycle,
            paymentMethod: 'pix',
            redirectPath: '/mais/assinaturas',
            action: isCreditPackage ? 'purchase_credits' : 'new_subscription',
          },
        });

        if (invokeError) {
          throw new Error(invokeError.message || 'Falha ao conectar com o serviço de pagamento.');
        }

        const checkoutUrl = data?.checkoutUrl || data?.rawCheckoutUrl || data?.brandedCheckoutUrl;
        if (!checkoutUrl) {
          throw new Error(data?.details || data?.error || 'Link de pagamento não retornado pelo gateway.');
        }

        await WebBrowser.openBrowserAsync(checkoutUrl);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Não foi possível iniciar o checkout';
        setError(message);
        throw err;
      } finally {
        setCheckoutLoading(false);
      }
    },
    [billingCycle],
  );

  return {
    user,
    isSuperAdmin,
    billingCycle,
    setBillingCycle,
    subscription,
    payments,
    whatsappCredits,
    loading,
    refreshing,
    checkoutLoading,
    error,
    setError,
    load,
    refresh,
    handleCheckout,
  };
}
