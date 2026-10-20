import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { routeHrefs } from '@painel-prime/app/navigation';
import { UniversalLink } from '@painel-prime/ui';
import { useAuth } from '../contexts/AuthContext';
import { typography } from '../theme/fonts';
import { colors } from '../theme/colors';
import { AppHaptics } from '../lib/haptics';
import { mapAuthErrorMessage } from '../lib/authError';
import { supabase } from '../lib/supabase';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'azure' | null>(null);

  // Modal de Recuperação de Senha ("Esqueceu sua senha?")
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');

  const { signIn, signInWithProvider, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    router.replace(routeHrefs.dashboard());
  }, [router, user]);

  async function handleLogin() {
    if (submitting) return;
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Por favor, informe seu e-mail de acesso.');
      void AppHaptics.error();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Por favor, informe um formato de e-mail válido.');
      void AppHaptics.error();
      return;
    }
    if (!password) {
      setError('Por favor, digite sua senha.');
      void AppHaptics.error();
      return;
    }

    setSubmitting(true);
    try {
      await signIn(cleanEmail, password);
      void AppHaptics.success();
    } catch (err: any) {
      setError(mapAuthErrorMessage(err));
      void AppHaptics.error();
    } finally {
      setSubmitting(false);
    }
  }

  function openForgotModal() {
    setError('');
    setRecoveryError('');
    setRecoverySuccess(false);
    setRecoveryEmail(email.trim());
    setForgotModalVisible(true);
    void AppHaptics.light();
  }

  async function handleSendPasswordReset() {
    const cleanEmail = recoveryEmail.trim();
    if (!cleanEmail) {
      setRecoveryError('Por favor, informe seu e-mail cadastrado.');
      void AppHaptics.error();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setRecoveryError('Por favor, informe um formato de e-mail válido.');
      void AppHaptics.error();
      return;
    }

    setRecoveryLoading(true);
    setRecoveryError('');
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: 'painelprime://auth/callback?type=recovery',
      });
      if (resetError) throw resetError;
      setRecoverySuccess(true);
      void AppHaptics.success();
    } catch (err) {
      setRecoveryError(mapAuthErrorMessage(err));
      void AppHaptics.error();
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function handleOAuth(provider: 'google' | 'azure') {
    setError('');
    setOauthLoading(provider);
    try {
      await signInWithProvider(provider);
      void AppHaptics.success();
    } catch {
      setError(
        provider === 'google'
          ? 'Não foi possível iniciar login com Google.'
          : 'Não foi possível iniciar login com Microsoft.'
      );
      void AppHaptics.error();
    } finally {
      setOauthLoading(null);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: 'height' })}
      style={styles.page}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <UniversalLink
            href={routeHrefs.landing()}
            style={styles.backLinkWrap}
            textStyle={styles.backLink}
          >
            Voltar ao início
          </UniversalLink>

          <View>
            <Text style={styles.title}>Acessar Conta</Text>
            <Text style={styles.subtitle}>Entre com suas credenciais.</Text>
          </View>

          {/* OAuth Buttons */}
          <View style={styles.oauthRow}>
            <Pressable
              style={styles.oauthBtn}
              onPress={() => void handleOAuth('google')}
              disabled={submitting || oauthLoading !== null}
            >
              {oauthLoading === 'google' ? (
                <ActivityIndicator size="small" color="#151922" />
              ) : (
                <GoogleIcon />
              )}
              <Text style={styles.oauthBtnText}>Google</Text>
            </Pressable>
            <Pressable
              style={styles.oauthBtn}
              onPress={() => void handleOAuth('azure')}
              disabled={submitting || oauthLoading !== null}
            >
              {oauthLoading === 'azure' ? (
                <ActivityIndicator size="small" color="#151922" />
              ) : (
                <MicrosoftIcon />
              )}
              <Text style={styles.oauthBtnText}>Microsoft</Text>
            </Pressable>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              testID="edit_text_email"
              nativeID="edit_text_email"
              accessibilityLabel="Campo de e-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="seu@email.com"
              placeholderTextColor={colors.mutedText}
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              testID="edit_text_password"
              nativeID="edit_text_password"
              accessibilityLabel="Campo de senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="********"
              placeholderTextColor={colors.mutedText}
              style={styles.input}
            />
          </View>

          <Pressable
            onPress={openForgotModal}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Esqueceu sua senha? Toque para recuperar o acesso."
            style={({ pressed }) => [styles.forgotLinkWrap, pressed && styles.pressedOpacity]}
          >
            <Text style={styles.forgotLink}>Esqueceu sua senha?</Text>
          </Pressable>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            testID="btn_login"
            nativeID="btn_login"
            accessibilityLabel="Entrar na Plataforma"
            onPress={() => void handleLogin()}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && !submitting ? styles.submitButtonPressed : null,
              submitting ? styles.submitButtonDisabled : null,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.primaryTextOn} />
            ) : (
              <Text style={styles.submitButtonText}>Entrar na Plataforma</Text>
            )}
          </Pressable>

          <UniversalLink
            href={routeHrefs.signup()}
            style={styles.signupLinkWrap}
            textStyle={styles.signupLink}
          >
            Não tem conta? Assinar agora
          </UniversalLink>
        </View>
      </ScrollView>

      {/* Modal Dark Luxury de Recuperação de Senha */}
      <Modal
        visible={forgotModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setForgotModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recuperar Senha</Text>
              <Pressable
                onPress={() => setForgotModalVisible(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Fechar modal de recuperação de senha"
              >
                <Ionicons name="close" size={22} color="#A1A1AA" />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Digite seu e-mail cadastrado. Enviaremos as instruções para você redefinir sua senha com segurança.
            </Text>

            {recoverySuccess ? (
              <View style={styles.recoverySuccessBox}>
                <Ionicons name="checkmark-circle" size={32} color="#86EFAC" />
                <Text style={styles.recoverySuccessText}>
                  Se este e-mail estiver cadastrado, enviamos as instruções de recuperação. Verifique sua caixa de entrada e spam.
                </Text>
                <Pressable
                  style={styles.modalActionBtn}
                  onPress={() => setForgotModalVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Entendido, fechar aviso de sucesso"
                >
                  <Text style={styles.modalActionBtnText}>Entendido</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.modalForm}>
                <TextInput
                  style={styles.input}
                  value={recoveryEmail}
                  onChangeText={setRecoveryEmail}
                  placeholder="seu@email.com"
                  placeholderTextColor={colors.mutedText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Campo de e-mail para recuperação"
                />
                {recoveryError ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{recoveryError}</Text>
                  </View>
                ) : null}
                <Pressable
                  style={[styles.modalActionBtn, recoveryLoading && styles.submitButtonDisabled]}
                  disabled={recoveryLoading}
                  onPress={() => void handleSendPasswordReset()}
                  accessibilityRole="button"
                  accessibilityLabel="Enviar link de recuperação de senha"
                >
                  {recoveryLoading ? (
                    <ActivityIndicator color="#151922" />
                  ) : (
                    <Text style={styles.modalActionBtnText}>Enviar link de recuperação</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  page: {
    flex: 1,
    backgroundColor: '#111113',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    padding: 22,
    gap: 14,
  },
  backLinkWrap: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  backLink: {
    color: '#A1A1AA',
    fontSize: 13,
    fontFamily: typography.fontFamily.sansSemiBold,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontFamily: typography.fontFamily.sansExtraBold,
  },
  subtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    fontFamily: typography.fontFamily.sansMedium,
    marginBottom: 4,
  },
  oauthRow: {
    flexDirection: 'row',
    gap: 8,
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
  fieldGroup: {
    gap: 6,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: typography.fontFamily.sansSemiBold,
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
  forgotLinkWrap: {
    alignSelf: 'flex-end',
    minHeight: 36,
    justifyContent: 'center',
  },
  forgotLink: {
    color: '#DEC479',
    fontSize: 13,
    fontFamily: typography.fontFamily.sansSemiBold,
    textAlign: 'right',
  },
  pressedOpacity: {
    opacity: 0.7,
  },
  errorBox: {
    backgroundColor: 'rgba(209,67,67,0.15)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(209,67,67,0.3)',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    textAlign: 'center',
    fontFamily: typography.fontFamily.sansSemiBold,
  },
  submitButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#DEC479',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonPressed: {
    backgroundColor: '#C9A54D',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#151922',
    fontSize: 15,
    fontFamily: typography.fontFamily.sansBold,
  },
  signupLinkWrap: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  signupLink: {
    color: '#A1A1AA',
    fontSize: 13,
    fontFamily: typography.fontFamily.sansSemiBold,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#18181B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 22,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: typography.fontFamily.sansBold,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.fontFamily.sansMedium,
  },
  modalForm: {
    gap: 12,
  },
  recoverySuccessBox: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  recoverySuccessText: {
    color: '#86EFAC',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: typography.fontFamily.sansMedium,
  },
  modalActionBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#DEC479',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  modalActionBtnText: {
    color: '#151922',
    fontSize: 14,
    fontFamily: typography.fontFamily.sansBold,
  },
});
