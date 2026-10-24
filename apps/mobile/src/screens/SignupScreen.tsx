import { routeHrefs } from '@painel-prime/app/navigation';
import { validateStrongPassword, checkPwnedPassword } from '@painel-prime/app';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
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
import { AppHaptics } from '../lib/haptics';
import { mapAuthErrorMessage } from '../lib/authError';
import { functionErrorMessage } from '../features/clients/clientsCrmService';
import { supabase } from '../lib/supabase';
import {
  startWhatsAppZeroTapHandshake,
  subscribeWhatsAppZeroTapOtp,
} from '../lib/whatsappZeroTap';

const plans = [
  { id: 'essencial', name: 'Essencial', price: 'R$ 39/mês', desc: 'CRM + Eventos + Convites + Portais' },
  { id: 'profissional', name: 'Profissional', price: 'R$ 59/mês', desc: 'Tudo do Essencial + reuniões e financeiro completo' },
  { id: 'elite', name: 'Elite', price: 'R$ 89/mês', desc: 'Eventos ilimitados + Salas de Reunião com Atas por IA + Prioridade máxima' },
] as const;

export function SignupScreen() {
  const { signUp, signInWithProvider, user } = useAuth();
  const { plano } = useLocalSearchParams<{ plano?: string | string[] }>();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // WhatsApp OTP & Zero-Tap state
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneVerificationToken, setPhoneVerificationToken] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  const phoneRef = useRef(phone);
  phoneRef.current = phone;
  const phoneVerifiedRef = useRef(phoneVerified);
  phoneVerifiedRef.current = phoneVerified;
  const verifyingRef = useRef(false);

  const resolvedPlan = useMemo(() => {
    const candidate = normalizeSingleParam(plano).toLowerCase();
    return plans.some((plan) => plan.id === candidate) ? candidate : 'profissional';
  }, [plano]);
  const [selectedPlan, setSelectedPlan] = useState<string>(resolvedPlan);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'azure' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const planLabel = useMemo(
    () => plans.find((plan) => plan.id === selectedPlan)?.name ?? 'Profissional',
    [selectedPlan],
  );

  function normalizePhoneDigits(val: string): string {
    return val.replace(/\D/g, '');
  }

  function formatPhoneDisplay(val: string): string {
    const digits = normalizePhoneDigits(val).slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : '';
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  useEffect(() => {
    setSelectedPlan(resolvedPlan);
  }, [resolvedPlan]);

  useEffect(() => {
    if (!user) return;
    router.replace(routeHrefs.dashboard());
  }, [router, user]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  async function handleVerifyOtp(codeToVerify?: string, explicitPhone?: string) {
    if (verifyingRef.current || phoneVerifiedRef.current) return;
    const targetCode = (codeToVerify ?? otpCode).replace(/\D/g, '').trim();
    if (targetCode.length !== 6) {
      setPhoneError('Digite os 6 dígitos do código recebido.');
      void AppHaptics.error();
      return;
    }

    const targetPhoneDigits = normalizePhoneDigits(explicitPhone ?? phoneRef.current);
    if (!targetPhoneDigits) {
      setPhoneError('Informe o celular antes de validar o código.');
      void AppHaptics.error();
      return;
    }

    verifyingRef.current = true;
    setVerifyingOtp(true);
    setPhoneError('');
    setPhoneSuccess('');

    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('auth-phone-verification', {
        body: {
          action: 'verify',
          phone: targetPhoneDigits,
          code: targetCode,
        },
      });

      if (invokeErr) {
        let msg = 'Código incorreto ou expirado. Tente novamente.';
        try {
          const ctx = (invokeErr as any)?.context;
          if (ctx) {
            const body = await ctx.json();
            if (body?.message) msg = body.message;
          }
        } catch {
          // ignore
        }
        setPhoneError(msg);
        void AppHaptics.error();
        return;
      }

      setPhoneVerified(true);
      setPhoneVerificationToken(data?.verificationToken ?? null);
      setPhoneSuccess('WhatsApp verificado com sucesso!');
      void AppHaptics.success();
    } catch (err: unknown) {
      const msg = await functionErrorMessage(err);
      setPhoneError(msg || 'Falha ao validar código do WhatsApp.');
      void AppHaptics.error();
    } finally {
      verifyingRef.current = false;
      setVerifyingOtp(false);
    }
  }

  async function handleSendOtp() {
    if (sendingOtp || phoneVerified) return;
    setPhoneError('');
    setPhoneSuccess('');
    const rawDigits = normalizePhoneDigits(phone);
    if (rawDigits.length !== 11 || rawDigits[2] !== '9') {
      setPhoneError('Informe um celular válido com DDD e 9 dígitos (ex.: 11 99999-9999).');
      void AppHaptics.error();
      return;
    }

    setSendingOtp(true);
    try {
      // Inicia o handshake nativo Zero-Tap com o WhatsApp antes do disparo na Meta
      await startWhatsAppZeroTapHandshake();

      const { data, error: invokeErr } = await supabase.functions.invoke('auth-phone-verification', {
        body: {
          action: 'send',
          phone: rawDigits,
          name: name.trim() || undefined,
        },
      });

      if (invokeErr) {
        const msg = await functionErrorMessage(invokeErr);
        setPhoneError(msg || 'Não foi possível enviar o código via WhatsApp no momento.');
        void AppHaptics.error();
        return;
      }

      setOtpSent(true);
      setResendCountdown(data?.resendIn ?? 60);
      setPhoneSuccess('Código de verificação enviado para o seu WhatsApp!');
      void AppHaptics.success();
    } catch (err: unknown) {
      const msg = await functionErrorMessage(err);
      setPhoneError(msg || 'Falha ao enviar código pelo WhatsApp.');
      void AppHaptics.error();
    } finally {
      setSendingOtp(false);
    }
  }

  // Listener nativo Zero-Tap / One-Tap + fallback de deep link
  useEffect(() => {
    const unsubscribeZeroTap = subscribeWhatsAppZeroTapOtp((digits) => {
      setOtpSent(true);
      setOtpCode(digits);
      if (phoneRef.current && !phoneVerifiedRef.current) {
        void handleVerifyOtp(digits, phoneRef.current);
      }
    });

    function processIncomingUrl(url: string | null) {
      if (!url) return;
      const match = url.match(/[?&]code=(?:otp)?([0-9]{6})/i) || url.match(/[?&]code=([^&#]+)/i);
      if (!match) return;
      const extractedDigits = match[1].replace(/\D/g, '');
      if (extractedDigits.length !== 6) return;

      setOtpSent(true);
      setOtpCode(extractedDigits);

      const phoneMatch = url.match(/[?&]phone=([^&#]+)/i);
      const phoneInUrl = phoneMatch ? decodeURIComponent(phoneMatch[1]) : '';
      if (phoneInUrl && !phoneRef.current) {
        setPhone(formatPhoneDisplay(phoneInUrl));
      }

      const activePhone = phoneInUrl || phoneRef.current;
      if (activePhone && !phoneVerifiedRef.current) {
        void handleVerifyOtp(extractedDigits, activePhone);
      }
    }

    void Linking.getInitialURL().then(processIncomingUrl).catch(() => undefined);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      processIncomingUrl(url);
    });

    return () => {
      unsubscribeZeroTap();
      subscription.remove();
    };
  }, []);

  async function handleOAuth(provider: 'google' | 'azure') {
    setError('');
    setOauthLoading(provider);
    try {
      await signInWithProvider(provider);
      void AppHaptics.success();
    } catch {
      setError(
        provider === 'google'
          ? 'Não foi possível iniciar cadastro com Google.'
          : 'Não foi possível iniciar cadastro com Microsoft.'
      );
      void AppHaptics.error();
    } finally {
      setOauthLoading(null);
    }
  }

  async function handleSignup() {
    if (loading) return;
    setError('');
    setSuccess('');

    if (!phone.trim()) {
      setError('Informe seu número de WhatsApp para verificação.');
      void AppHaptics.error();
      return;
    }

    if (!phoneVerified) {
      setError('Por favor, confirme seu WhatsApp com o código de 6 dígitos antes de prosseguir.');
      void AppHaptics.error();
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      void AppHaptics.error();
      return;
    }

    const passwordError = validateStrongPassword(password);
    if (passwordError) {
      setError(passwordError);
      void AppHaptics.error();
      return;
    }

    setLoading(true);

    const isPwned = await checkPwnedPassword(password);
    if (isPwned) {
      setLoading(false);
      setError(
        'Esta senha já foi exposta em vazamentos públicos de dados. Por segurança, escolha outra senha.'
      );
      void AppHaptics.error();
      return;
    }
    try {
      await signUp(email.trim(), password, name.trim() || undefined);
      setSuccess(
        `Conta criada no plano ${planLabel}. Teste grátis de 30 dias ativado com acesso completo.`,
      );
      void AppHaptics.success();
    } catch (signupError: unknown) {
      setError(mapAuthErrorMessage(signupError));
      void AppHaptics.error();
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.page}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Pressable
            onPress={() => router.push(routeHrefs.landing())}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backLinkWrap}
            accessibilityRole="button"
            accessibilityLabel="Voltar ao início"
          >
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
                  onPress={() => {
                    setSelectedPlan(plan.id);
                    void AppHaptics.selection();
                  }}
                  style={[styles.planCard, selected ? styles.planCardSelected : null]}
                >
                  <Text style={[styles.planName, selected && styles.planNameSelected]}>{plan.name}</Text>
                  <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>{plan.price}</Text>
                  <Text style={styles.planDesc}>{plan.desc}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.oauthRow}>
            <Pressable
              style={styles.oauthBtn}
              onPress={() => void handleOAuth('google')}
              disabled={loading || oauthLoading !== null}
              accessibilityRole="button"
              accessibilityLabel="Continuar com Google"
            >
              {oauthLoading === 'google' ? (
                <ActivityIndicator size="small" color="#DEC479" />
              ) : (
                <GoogleIcon />
              )}
              <Text style={styles.oauthBtnText}>Google</Text>
            </Pressable>
            <Pressable
              style={styles.oauthBtn}
              onPress={() => void handleOAuth('azure')}
              disabled={loading || oauthLoading !== null}
              accessibilityRole="button"
              accessibilityLabel="Continuar com Microsoft"
            >
              {oauthLoading === 'azure' ? (
                <ActivityIndicator size="small" color="#DEC479" />
              ) : (
                <MicrosoftIcon />
              )}
              <Text style={styles.oauthBtnText}>Microsoft</Text>
            </Pressable>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou cadastre com e-mail e WhatsApp</Text>
            <View style={styles.dividerLine} />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Seu nome"
            placeholderTextColor="#71717A"
            value={name}
            onChangeText={setName}
          />

          <View style={styles.phoneSection}>
            <TextInput
              style={styles.input}
              placeholder="WhatsApp com DDD (ex.: 11 99999-9999)"
              placeholderTextColor="#71717A"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              value={phone}
              onChangeText={(text) => {
                setPhone(formatPhoneDisplay(text));
                setPhoneError('');
              }}
              editable={!phoneVerified}
            />

            {!phoneVerified ? (
              <Pressable
                style={[
                  styles.whatsappBtn,
                  (sendingOtp || resendCountdown > 0) && styles.whatsappBtnDisabled,
                ]}
                onPress={() => void handleSendOtp()}
                disabled={sendingOtp || resendCountdown > 0}
                accessibilityRole="button"
                accessibilityLabel="Enviar código via WhatsApp"
              >
                {sendingOtp ? (
                  <ActivityIndicator size="small" color="#25D366" />
                ) : (
                  <Text style={styles.whatsappBtnText}>
                    {otpSent
                      ? resendCountdown > 0
                        ? `Reenviar código em ${resendCountdown}s`
                        : 'Reenviar código via WhatsApp'
                      : 'Enviar código via WhatsApp'}
                  </Text>
                )}
              </Pressable>
            ) : (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓ WhatsApp verificado com sucesso</Text>
              </View>
            )}

            {otpSent && !phoneVerified ? (
              <View style={styles.otpRow}>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="Código de 6 dígitos"
                  placeholderTextColor="#71717A"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoComplete="sms-otp"
                  textContentType="oneTimeCode"
                  value={otpCode}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/\D/g, '').slice(0, 6);
                    setOtpCode(cleaned);
                    setPhoneError('');
                    if (cleaned.length === 6 && !verifyingOtp) {
                      void handleVerifyOtp(cleaned);
                    }
                  }}
                />
                <Pressable
                  style={[styles.verifyBtn, verifyingOtp && styles.whatsappBtnDisabled]}
                  onPress={() => void handleVerifyOtp()}
                  disabled={verifyingOtp || otpCode.length !== 6}
                  accessibilityRole="button"
                  accessibilityLabel="Verificar código"
                >
                  {verifyingOtp ? (
                    <ActivityIndicator size="small" color="#151922" />
                  ) : (
                    <Text style={styles.verifyBtnText}>Verificar</Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {phoneError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{phoneError}</Text>
              </View>
            ) : null}
            {phoneSuccess ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{phoneSuccess}</Text>
              </View>
            ) : null}
          </View>
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
            placeholder="Senha (mínimo 10 caracteres)"
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

          <Pressable
            onPress={() => router.push(routeHrefs.login())}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.loginLinkWrap}
            accessibilityRole="button"
            accessibilityLabel="Já tem conta? Entrar"
          >
            <Text style={styles.loginLink}>Já tem conta? Entrar</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push(routeHrefs.privacyPolicy())}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.privacyLinkWrap}
            accessibilityRole="button"
            accessibilityLabel="Abrir política de privacidade"
          >
            <Text style={styles.privacyLink}>Política de Privacidade</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function GoogleIcon() {
  return (
    <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#EA4335' }}>G</Text>
    </View>
  );
}

function MicrosoftIcon() {
  return (
    <View style={{ width: 18, height: 18, flexDirection: 'row', flexWrap: 'wrap' }}>
      <View style={{ width: 9, height: 9, backgroundColor: '#F35325' }} />
      <View style={{ width: 9, height: 9, backgroundColor: '#81BC06' }} />
      <View style={{ width: 9, height: 9, backgroundColor: '#05A6F0' }} />
      <View style={{ width: 9, height: 9, backgroundColor: '#FFBA08' }} />
    </View>
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
  backLinkWrap: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
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
  oauthRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  oauthBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  oauthBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: typography.fontFamily.sansSemiBold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontFamily: typography.fontFamily.sansMedium,
  },
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
  phoneSection: {
    gap: 8,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  otpInput: {
    flex: 1,
    letterSpacing: 4,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: typography.fontFamily.sansBold,
  },
  whatsappBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#25D366',
    backgroundColor: 'rgba(37,211,102,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  whatsappBtnDisabled: {
    opacity: 0.5,
  },
  whatsappBtnText: {
    color: '#25D366',
    fontSize: 13,
    fontFamily: typography.fontFamily.sansBold,
  },
  verifyBtn: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#DEC479',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    color: '#151922',
    fontSize: 13,
    fontFamily: typography.fontFamily.sansBold,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  verifiedText: {
    color: '#4ADE80',
    fontSize: 13,
    fontFamily: typography.fontFamily.sansSemiBold,
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
  loginLinkWrap: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  loginLink: { color: '#A1A1AA', textAlign: 'center', fontFamily: typography.fontFamily.sansSemiBold, fontSize: 13 },
  privacyLinkWrap: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  privacyLink: { color: '#71717A', fontSize: 12, fontFamily: typography.fontFamily.sansMedium, textAlign: 'center', textDecorationLine: 'underline' },
});
