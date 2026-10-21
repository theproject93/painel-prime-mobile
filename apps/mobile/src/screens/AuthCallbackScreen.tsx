import { routeHrefs } from '@painel-prime/app/navigation';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { consumeAuthCallback } from '../lib/oauthCallback';
import { supabase } from '../lib/supabase';
import { typography } from '../theme/fonts';

export function AuthCallbackScreen() {
  const routeParams = useLocalSearchParams();
  const incomingUrl = Linking.useURL();
  const router = useRouter();
  const [message, setMessage] = useState('Concluindo autenticação...');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    let mounted = true;
    let navigated = false;

    function goDashboard() {
      if (!mounted || navigated) return;
      navigated = true;
      router.replace(routeHrefs.dashboard());
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        goDashboard();
      }
    });

    async function finishAuth() {
      setProcessing(true);
      setError('');
      setMessage('Concluindo autenticação...');

      const initialUrl = await Linking.getInitialURL().catch(() => null);
      const candidateUrl = incomingUrl || initialUrl;

      const outcome = await consumeAuthCallback({
        url: candidateUrl,
        routeParams: routeParams as Record<string, string | string[] | undefined>,
      });

      if (!mounted || navigated) return;

      if (outcome.session) {
        goDashboard();
        return;
      }

      if (outcome.error) {
        setError(outcome.error);
        setMessage('Não foi possível concluir o login.');
        setProcessing(false);
        return;
      }

      // Aguarda propagação assíncrona caso o listener global do AuthContext esteja finalizando o token
      for (let attempt = 0; attempt < 6; attempt += 1) {
        if (!mounted || navigated) return;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          goDashboard();
          return;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 400));
      }

      if (!mounted || navigated) return;
      setProcessing(false);
      setMessage('Sessão não foi criada automaticamente.');
    }

    void finishAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [incomingUrl, routeParams, router]);

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        {processing ? <ActivityIndicator size="large" color="#DEC479" /> : null}
        <Text style={styles.message}>{message}</Text>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}
        <Pressable
          style={styles.button}
          onPress={() => router.replace(routeHrefs.login())}
          accessibilityRole="button"
          accessibilityLabel="Voltar para login"
        >
          <Text style={styles.buttonText}>Voltar para login</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#111113',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    padding: 24,
    gap: 14,
    alignItems: 'center',
  },
  message: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: typography.fontFamily.sansSemiBold,
    textAlign: 'center',
  },
  errorBox: {
    width: '100%',
    backgroundColor: 'rgba(209,67,67,0.15)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(209,67,67,0.3)',
  },
  error: {
    color: '#FCA5A5',
    fontSize: 13,
    fontFamily: typography.fontFamily.sansMedium,
    textAlign: 'center',
  },
  button: {
    minHeight: 46,
    minWidth: 160,
    borderRadius: 12,
    backgroundColor: '#DEC479',
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#151922',
    fontSize: 14,
    fontFamily: typography.fontFamily.sansBold,
  },
});
