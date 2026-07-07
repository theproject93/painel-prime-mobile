import { routeHrefs } from '@painel-prime/app/navigation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../lib/supabase';
import { normalizeSingleParam } from '../lib/router';
import { colors } from '../theme/colors';

export function AuthCallbackScreen() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const router = useRouter();
  const [message, setMessage] = useState('Concluindo autenticação...');
  const [error, setError] = useState('');

  useEffect(() => {
    async function finishAuth() {
      const authCode = normalizeSingleParam(code);

      if (authCode) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
        if (exchangeError) {
          setError(exchangeError.message);
          setMessage('Não foi possível concluir o login.');
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace(routeHrefs.dashboard());
        return;
      }

      setMessage('Sessão não foi criada automaticamente.');
    }

    void finishAuth();
  }, [code, router]);

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <ActivityIndicator color={colors.primaryStrong} />
        <Text style={styles.message}>{message}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={styles.button}
          onPress={() => router.replace(routeHrefs.login())}
        >
          <Text style={styles.buttonText}>Voltar para login</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 10, alignItems: 'center' },
  message: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  error: { color: colors.dangerText, fontSize: 12, textAlign: 'center' },
  button: { minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.text, fontSize: 13, fontWeight: '700' },
});

