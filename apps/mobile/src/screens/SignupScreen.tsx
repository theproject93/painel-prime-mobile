import { routeHrefs } from '@painel-prime/app/navigation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { normalizeSingleParam } from '../lib/router';
import { typography } from '../theme/fonts';
import { colors } from '../theme/colors';

const plans = [
  { id: 'essencial', name: 'Essencial', price: 'R$ 39/mes', desc: 'CRM + Eventos + Convites + Portais' },
  { id: 'profissional', name: 'Profissional', price: 'R$ 59/mes', desc: 'Tudo do Essencial + Torre de Comando + Financeiro completo' },
  { id: 'elite', name: 'Elite', price: 'R$ 89/mes', desc: 'Tudo + IA comercial + automações avançadas + Prioridade máxima' },
] as const;

export function SignupScreen() {
  const { signUp } = useAuth();
  const { plano } = useLocalSearchParams<{ plano?: string | string[] }>();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const resolvedPlan = useMemo(() => {
    const candidate = normalizeSingleParam(plano).toLowerCase();
    return plans.some((plan) => plan.id === candidate) ? candidate : 'profissional';
  }, [plano]);
  const [selectedPlan, setSelectedPlan] = useState<string>(resolvedPlan);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const planLabel = useMemo(
    () => plans.find((plan) => plan.id === selectedPlan)?.name ?? 'Profissional',
    [selectedPlan],
  );

  useEffect(() => {
    setSelectedPlan(resolvedPlan);
  }, [resolvedPlan]);

  async function handleSignup() {
    if (loading) return;
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    if (password.length < 6) {
      setError('Use uma senha com pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim() || undefined);
      setSuccess(
        `Conta criada no plano ${planLabel}. Teste grátis de 30 dias ativado com acesso completo.`,
      );
    } catch (signupError: unknown) {
      const message =
        signupError instanceof Error ? signupError.message : 'Falha ao criar conta.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.page}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Pressable onPress={() => router.push(routeHrefs.landing())}>
            <Text style={styles.backLink}>Voltar ao início</Text>
          </Pressable>
          <Text style={styles.title}>Assinar Painel Prime</Text>
          <Text style={styles.subtitle}>Escolha seu plano e inicie 30 dias grátis.</Text>

          <View style={styles.planRow}>
            {plans.map((plan) => {
              const selected = selectedPlan === plan.id;
              return (
                <Pressable
                  key={plan.id}
                  onPress={() => setSelectedPlan(plan.id)}
                  style={[styles.planCard, selected ? styles.planCardSelected : null]}
                >
                  <Text style={[styles.planName, selected && styles.planNameSelected]}>{plan.name}</Text>
                  <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>{plan.price}</Text>
                  <Text style={styles.planDesc}>{plan.desc}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Seu nome"
            placeholderTextColor="#71717A"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="E-mail"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#71717A"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            secureTextEntry
            placeholderTextColor="#71717A"
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirmar senha"
            secureTextEntry
            placeholderTextColor="#71717A"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {success ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}

          <Pressable style={styles.primaryButton} onPress={() => void handleSignup()}>
            {loading ? (
              <ActivityIndicator color="#151922" />
            ) : (
              <Text style={styles.primaryText}>Criar conta e iniciar teste</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.push(routeHrefs.login())}>
            <Text style={styles.loginLink}>Já tem conta? Entrar</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#111113' },
  content: { padding: 20, justifyContent: 'center', minHeight: '100%' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  backLink: { color: '#A1A1AA', fontSize: 13, fontFamily: typography.fontFamily.sansSemiBold },
  title: { color: '#FFFFFF', fontSize: 30, fontFamily: typography.fontFamily.sansExtraBold },
  subtitle: { color: '#A1A1AA', fontSize: 14, fontFamily: typography.fontFamily.sansMedium, marginBottom: 4 },
  planRow: { gap: 8 },
  planCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 2,
  },
  planCardSelected: {
    borderColor: '#DEC479',
    backgroundColor: 'rgba(222,196,121,0.08)',
  },
  planName: { color: '#FFFFFF', fontSize: 14, fontFamily: typography.fontFamily.sansBold },
  planNameSelected: { color: '#DEC479' },
  planPrice: { color: '#A1A1AA', fontSize: 18, fontFamily: typography.fontFamily.sansExtraBold },
  planPriceSelected: { color: '#DEC479' },
  planDesc: { color: '#71717A', fontSize: 12, fontFamily: typography.fontFamily.sans, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.05)',
    fontFamily: typography.fontFamily.sans,
  },
  errorBox: {
    backgroundColor: 'rgba(209,67,67,0.15)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(209,67,67,0.3)',
  },
  errorText: { color: '#FCA5A5', fontSize: 13, textAlign: 'center', fontFamily: typography.fontFamily.sansSemiBold },
  successBox: {
    backgroundColor: 'rgba(31,157,98,0.15)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(31,157,98,0.3)',
  },
  successText: { color: '#86EFAC', fontSize: 13, textAlign: 'center', fontFamily: typography.fontFamily.sansSemiBold },
  primaryButton: {
    backgroundColor: '#DEC479',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#151922', fontWeight: '700', fontSize: 15, fontFamily: typography.fontFamily.sansBold },
  loginLink: { color: '#A1A1AA', textAlign: 'center', fontFamily: typography.fontFamily.sansSemiBold, fontSize: 13 },
});
