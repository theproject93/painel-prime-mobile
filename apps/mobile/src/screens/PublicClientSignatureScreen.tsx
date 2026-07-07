import { routeHrefs } from '@painel-prime/app/navigation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { supabase } from '../lib/supabase';
import { goBackOrReplace, normalizeSingleParam } from '../lib/router';
import { colors } from '../theme/colors';

type SignPayload = {
  request_id: string;
  client_name: string;
  client_email: string | null;
  document_title: string;
  document_content: string;
  status: string;
  expires_at: string | null;
};

export function PublicClientSignatureScreen() {
  const router = useRouter();
  const { token: routeToken } = useLocalSearchParams<{ token?: string | string[] }>();
  const token = normalizeSingleParam(routeToken);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [payload, setPayload] = useState<SignPayload | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc('get_signature_request_by_token', {
        p_token: token,
      });
      if (rpcError) {
        setError('Não foi possível abrir o documento.');
      } else if (Array.isArray(data) && data[0]) {
        setPayload(data[0] as SignPayload);
      } else {
        setError('Este link expirou ou não está mais disponível.');
      }
      setLoading(false);
    }
    void load();
  }, [token]);

  async function signNow() {
    if (!accepted || !signerName.trim() || saving) return;
    setSaving(true);
    setError('');
    const { data: ok, error: rpcError } = await supabase.rpc('sign_signature_request_by_token', {
      p_token: token,
      p_signer_name: signerName.trim(),
      p_signer_email: signerEmail.trim() || null,
    });
    if (rpcError || !ok) {
      setError('Não foi possível concluir a assinatura.');
      setSaving(false);
      return;
    }
    setDone(true);
    setSaving(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryStrong} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable onPress={() => goBackOrReplace(router, routeHrefs.landing())}>
        <Text style={styles.back}>Voltar</Text>
      </Pressable>
      <View style={styles.card}>
        <Text style={styles.title}>Assinatura de contrato</Text>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {done ? <Text style={styles.ok}>Assinatura concluida com sucesso.</Text> : null}
        {payload && !done ? (
          <>
            <Text style={styles.meta}>Cliente: {payload.client_name}</Text>
            <Text style={styles.subtitle}>{payload.document_title}</Text>
            <Text style={styles.document}>{payload.document_content}</Text>
            <TextInput style={styles.input} value={signerName} onChangeText={setSignerName} placeholder="Seu nome completo" />
            <TextInput style={styles.input} value={signerEmail} onChangeText={setSignerEmail} placeholder="Seu email (opcional)" />
            <View style={styles.row}>
              <Switch value={accepted} onValueChange={setAccepted} />
              <Text style={styles.meta}>Li e concordo com os termos acima.</Text>
            </View>
            <Pressable style={styles.button} onPress={() => void signNow()}>
              <Text style={styles.buttonText}>{saving ? 'Assinando...' : 'Assinar contrato'}</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 8, paddingBottom: 26 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  back: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 8 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  document: { color: colors.text, fontSize: 13, lineHeight: 19, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: { minHeight: 42, borderRadius: 10, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  err: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 8 },
  ok: { color: '#166534', backgroundColor: '#ECFDF5', borderRadius: 8, padding: 8 },
});

