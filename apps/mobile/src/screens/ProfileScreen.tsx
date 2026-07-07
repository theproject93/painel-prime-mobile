import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '../components/Screen';
import { WalkthroughAnchorTarget } from '../components/WalkthroughAnchors';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

type BillingSubscription = {
  status: string | null;
  plan_id: string | null;
  amount_cents: number | null;
  last_payment_status: string | null;
  updated_at: string | null;
};

const BILLING_OPTIONS = [
  { id: 'test_1', label: 'Teste PIX/cartao R$ 1' },
  { id: 'test_2', label: 'Teste PIX/cartao R$ 2' },
  { id: 'essencial', label: 'Plano Essencial' },
  { id: 'profissional', label: 'Plano Profissional' },
  { id: 'elite', label: 'Plano Elite' },
] as const;

function formatCurrency(valueCents: number | null | undefined) {
  if (valueCents == null) return '-';
  return (valueCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [officialWhatsapp, setOfficialWhatsapp] = useState('');
  const [officialInstagram, setOfficialInstagram] = useState('');
  const [officialEmail, setOfficialEmail] = useState('');

  const [saving, setSaving] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [billingSub, setBillingSub] = useState<BillingSubscription | null>(null);

  useEffect(() => {
    const meta = (user?.user_metadata as Record<string, any> | undefined) ?? {};
    setName(String(meta.name ?? ''));
    setPhone(String(meta.phone ?? ''));
    setOfficialWhatsapp(String(meta.official_whatsapp ?? ''));
    setOfficialInstagram(String(meta.official_instagram ?? ''));
    setOfficialEmail(String(meta.official_email ?? user?.email ?? ''));
  }, [user?.id, user?.email, user?.user_metadata]);

  useEffect(() => {
    let cancelled = false;
    async function loadBilling() {
      if (!user?.id) return;
      const { data } = await supabase
        .from('billing_subscriptions')
        .select('status,plan_id,amount_cents,last_payment_status,updated_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled) {
        setBillingSub((data as BillingSubscription | null) ?? null);
      }
    }
    void loadBilling();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const billingPlanLabel = useMemo(() => {
    if (!billingSub?.plan_id) return '-';
    return BILLING_OPTIONS.find((option) => option.id === billingSub.plan_id)?.label ?? billingSub.plan_id;
  }, [billingSub?.plan_id]);

  async function saveProfile() {
    setSaving(true);
    setMessage('');
    const { error } = await supabase.auth.updateUser({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        official_whatsapp: officialWhatsapp.trim(),
        official_instagram: officialInstagram.trim(),
        official_email: officialEmail.trim(),
      },
    });
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('Perfil atualizado com sucesso.');
  }

  async function openBillingCheckout(planId: string) {
    const { data: currentSession } = await supabase.auth.getSession();
    let session = currentSession.session;
    if (!session) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      session = refreshed.session;
    }
    if (!session) {
      setMessage('Sessão expirada. Faça login novamente.');
      return;
    }

    setBillingLoading(true);
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      setBillingLoading(false);
      setMessage('Variaveis EXPO_PUBLIC_SUPABASE_URL/ANON_KEY ausentes.');
      return;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/billing-create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ planId }),
    });
    setBillingLoading(false);

    if (!response.ok) {
      const body = await response.text();
      setMessage(`Falha ao iniciar checkout (${response.status}): ${body || 'sem detalhes'}`);
      return;
    }

    const data = (await response.json()) as { checkoutUrl?: string | null };
    const checkoutUrl = data.checkoutUrl;
    if (!checkoutUrl) {
      setMessage('Checkout não retornou URL válida.');
      return;
    }

    await Linking.openURL(checkoutUrl);
  }

  return (
    <Screen title="Perfil" subtitle="Conta, contatos oficiais e assinatura">
      <WalkthroughAnchorTarget id="profile.identity" borderRadius={14}>
        <View style={styles.identityStack}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Informações pessoais</Text>
            <Text style={styles.label}>Nome</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Seu nome" />
            <Text style={styles.label}>Email da conta</Text>
            <Text style={styles.value}>{user?.email ?? '-'}</Text>
            <Text style={styles.label}>Telefone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Seu telefone" />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Contatos oficiais (CRM)</Text>
            <Text style={styles.label}>WhatsApp oficial</Text>
            <TextInput style={styles.input} value={officialWhatsapp} onChangeText={setOfficialWhatsapp} placeholder="+55..." />
            <Text style={styles.label}>Email oficial</Text>
            <TextInput style={styles.input} value={officialEmail} onChangeText={setOfficialEmail} placeholder="contato@..." />
            <Text style={styles.label}>Instagram oficial</Text>
            <TextInput style={styles.input} value={officialInstagram} onChangeText={setOfficialInstagram} placeholder="@perfil" />
          </View>
        </View>
      </WalkthroughAnchorTarget>

      <WalkthroughAnchorTarget id="profile.billing" borderRadius={14}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Assinatura</Text>
          <Text style={styles.value}>Plano: {billingPlanLabel}</Text>
          <Text style={styles.value}>Status: {billingSub?.status ?? '-'}</Text>
          <Text style={styles.value}>Ultimo pagamento: {billingSub?.last_payment_status ?? '-'}</Text>
          <Text style={styles.value}>Valor: {formatCurrency(billingSub?.amount_cents)}</Text>
          <Text style={styles.caption}>Atualizado: {billingSub?.updated_at ? new Date(billingSub.updated_at).toLocaleString('pt-BR') : '-'}</Text>
          <View style={styles.rowBtns}>
            {BILLING_OPTIONS.map((option) => (
              <Pressable key={option.id} style={styles.btnGhost} onPress={() => void openBillingCheckout(option.id)}>
                <Text style={styles.smallText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          {billingLoading ? <ActivityIndicator color={colors.primaryStrong} /> : null}
        </View>
      </WalkthroughAnchorTarget>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.rowBtns}>
        <Pressable onPress={() => void saveProfile()} style={styles.saveButton}>
          {saving ? <ActivityIndicator color={colors.primaryTextOn} /> : <Text style={styles.saveText}>Salvar perfil</Text>}
        </Pressable>
        <Pressable onPress={() => void signOut()} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
  identityStack: { gap: 14 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  label: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  value: { color: colors.text, fontSize: 13, fontWeight: '600' },
  caption: { color: colors.mutedText, fontSize: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: colors.text },
  rowBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btnGhost: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  smallText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  message: { color: colors.text, backgroundColor: colors.primarySoft, borderRadius: 8, padding: 8, textAlign: 'center' },
  saveButton: { flex: 1, minHeight: 42, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.primaryTextOn, fontWeight: '700', fontSize: 14 },
  logoutButton: { flex: 1, minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  logoutText: { color: colors.text, fontWeight: '700', fontSize: 14 },
});
