import { useCallback, useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../src/contexts/AuthContext';
import { useUserRole } from '../../src/contexts/UserRoleContext';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme/colors';
import { fontSize, fontWeight, radii, shadows, spacing } from '../../src/theme/tokens';
import { AppHaptics } from '../../src/lib/haptics';

interface InvitePreview {
  member_name: string;
  member_email: string;
  team_name: string;
  tenant_name: string;
  expires_at: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
}

export default function AceitarConviteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token.trim() : '';

  const { user, signOut } = useAuth();
  const { refreshRole, refreshAssignedEvents } = useUserRole();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Formulário de novo usuário
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const fetchPreview = useCallback(async () => {
    if (!token) {
      setError('Token de convite não encontrado no link.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('preview_team_access_invite', {
        p_token: token,
      });

      if (rpcError) {
        setError('Não foi possível verificar este convite. O link pode ser inválido.');
        setLoading(false);
        return;
      }

      if (!data) {
        setError('Convite não encontrado ou expirado.');
        setLoading(false);
        return;
      }

      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      setPreview(parsed as InvitePreview);
    } catch {
      setError('Erro ao carregar os dados do convite.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchPreview();
  }, [fetchPreview]);

  // Se o usuário logado tiver o mesmo e-mail do convite, aceita diretamente
  const handleAcceptLoggedUser = async () => {
    if (!token) return;
    setSubmitting(true);
    setError(null);

    try {
      const { data, error: acceptError } = await supabase.rpc('accept_team_access_invite', {
        p_token: token,
      });

      if (acceptError) {
        if (acceptError.message.includes('email_mismatch')) {
          setError('O e-mail da sua conta conectada não corresponde ao e-mail deste convite.');
        } else if (acceptError.message.includes('expired')) {
          setError('Este convite expirou. Solicite um novo à assessoria.');
        } else {
          setError('Não foi possível aceitar o convite: ' + acceptError.message);
        }
        setSubmitting(false);
        return;
      }

      void AppHaptics.success();
      setSuccessMessage('Convite aceito com sucesso! Bem-vindo(a) à equipe.');
      await refreshRole();
      await refreshAssignedEvents();

      setTimeout(() => {
        router.replace('/(app)/(tabs)/eventos' as never);
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao aceitar o convite.';
      setError(msg);
      setSubmitting(false);
    }
  };

  // Criação de nova conta para o membro convidado
  const handleSignupAndAccept = async () => {
    if (!preview || !token) return;

    if (!password || password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const email = preview.member_email.trim().toLowerCase();

      // 1. Cria a conta no Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: preview.member_name,
            full_name: preview.member_name,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already registered')) {
          setError('Já existe uma conta com este e-mail. Faça login para aceitar o convite.');
        } else {
          setError(signUpError.message);
        }
        setSubmitting(false);
        return;
      }

      // Se não houver sessão imediata (ex: requer confirmação de e-mail), tenta fazer sign in
      let session = authData.session;
      if (!session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!signInError && signInData.session) {
          session = signInData.session;
        }
      }

      if (session) {
        // 2. Aceita o convite com a conta recém-autenticada
        const { error: acceptError } = await supabase.rpc('accept_team_access_invite', {
          p_token: token,
        });

        if (acceptError) {
          console.warn('Erro ao aceitar convite pós-signup:', acceptError.message);
        }

        void AppHaptics.success();
        setSuccessMessage('Conta criada e acesso à equipe ativado com sucesso!');
        await refreshRole();
        await refreshAssignedEvents();

        setTimeout(() => {
          router.replace('/(app)/(tabs)/eventos' as never);
        }, 1500);
      } else {
        // Conta criada mas requer validação por e-mail
        setSuccessMessage(
          'Conta criada com sucesso! Enviamos uma confirmação para seu e-mail. Após confirmar, faça login para acessar sua escala.'
        );
        setSubmitting(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao criar conta.';
      setError(msg);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primaryStrong} />
        <Text style={styles.loadingText}>Verificando convite de equipe...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoBadge}>
          <Ionicons name="people-circle" size={44} color={colors.gold700} />
        </View>

        <Text style={styles.title}>Convite de Equipe</Text>
        <Text style={styles.subtitle}>
          {preview?.tenant_name
            ? `Você foi convidado(a) por ${preview.tenant_name} para trabalhar nos eventos da assessoria.`
            : 'Acesse o Painel Prime para gerenciar suas escalas e a Portaria Prime.'}
        </Text>

        {preview && (
          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <Ionicons name="person-outline" size={18} color={colors.primaryStrong} />
              <Text style={styles.previewText}>
                <Text style={styles.previewLabel}>Membro: </Text>
                {preview.member_name}
              </Text>
            </View>
            <View style={styles.previewRow}>
              <Ionicons name="mail-outline" size={18} color={colors.primaryStrong} />
              <Text style={styles.previewText}>
                <Text style={styles.previewLabel}>E-mail: </Text>
                {preview.member_email}
              </Text>
            </View>
            {preview.team_name ? (
              <View style={styles.previewRow}>
                <Ionicons name="briefcase-outline" size={18} color={colors.primaryStrong} />
                <Text style={styles.previewText}>
                  <Text style={styles.previewLabel}>Equipe: </Text>
                  {preview.team_name}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.dangerText} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#166534" />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {preview?.status === 'expired' && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>Este convite expirou. Solicite um novo à assessoria.</Text>
          </View>
        )}

        {preview?.status === 'accepted' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Este convite já foi aceito. Você pode fazer login diretamente com seu e-mail e senha.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.replace('/(public)/login' as never)}
            >
              <Text style={styles.primaryButtonText}>Ir para o Login</Text>
            </Pressable>
          </View>
        )}

        {preview?.status === 'pending' && !successMessage && (
          <>
            {user ? (
              // Usuário já autenticado
              <View style={styles.actionSection}>
                <Text style={styles.sectionNotice}>
                  Você está conectado como <Text style={{ fontWeight: '700' }}>{user.email}</Text>.
                </Text>
                <Pressable
                  style={[styles.primaryButton, submitting && styles.buttonDisabled]}
                  onPress={handleAcceptLoggedUser}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.primaryTextOn} />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Aceitar Convite e Entrar</Text>
                      <Ionicons name="arrow-forward" size={18} color={colors.primaryTextOn} />
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={styles.switchAccountButton}
                  onPress={() => void signOut()}
                >
                  <Text style={styles.switchAccountText}>Sair desta conta para usar outro e-mail</Text>
                </Pressable>
              </View>
            ) : (
              // Novo usuário: formulário de senha
              <View style={styles.formSection}>
                <Text style={styles.formTitle}>Defina sua senha de acesso</Text>
                <Text style={styles.formSubtitle}>
                  Crie uma senha segura para entrar no aplicativo Painel Prime quando quiser.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>E-mail convidado</Text>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={preview.member_email}
                    editable={false}
                    selectTextOnFocus={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Senha</Text>
                  <View style={styles.passwordWrap}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Mínimo 8 caracteres"
                      placeholderTextColor={colors.mutedText}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <Pressable
                      style={styles.eyeIcon}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.mutedText}
                      />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirmar Senha</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Repita sua senha"
                    placeholderTextColor={colors.mutedText}
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>

                <Pressable
                  style={[styles.primaryButton, submitting && styles.buttonDisabled]}
                  onPress={handleSignupAndAccept}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.primaryTextOn} />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Criar Conta e Acessar Equipe</Text>
                      <Ionicons name="arrow-forward" size={18} color={colors.primaryTextOn} />
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={styles.loginLink}
                  onPress={() => router.push('/(public)/login' as never)}
                >
                  <Text style={styles.loginLinkText}>
                    Já tem uma conta cadastrada? <Text style={styles.loginLinkHighlight}>Entrar</Text>
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedText,
    fontWeight: '600',
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  title: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  previewCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    marginBottom: 20,
    ...shadows.sm,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewLabel: {
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  previewText: {
    fontSize: 14,
    color: colors.text,
  },
  errorBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.dangerBg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#F5C2C2',
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.dangerText,
    fontWeight: '600',
  },
  successBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#DCFCE7',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#86EFAC',
    padding: 14,
    marginBottom: 16,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    color: '#166534',
    fontWeight: '700',
  },
  warningBox: {
    width: '100%',
    backgroundColor: '#FEF3C7',
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
    textAlign: 'center',
  },
  infoBox: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionSection: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  sectionNotice: {
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: 4,
  },
  formSection: {
    width: '100%',
    gap: 14,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  formSubtitle: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
    marginBottom: 6,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
  },
  inputDisabled: {
    backgroundColor: colors.surfaceSubtle,
    color: colors.mutedText,
  },
  passwordWrap: {
    height: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  eyeIcon: {
    padding: 6,
  },
  primaryButton: {
    height: 50,
    backgroundColor: colors.primaryStrong,
    borderRadius: radii.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    ...shadows.sm,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: fontWeight.bold,
    color: colors.primaryTextOn,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  switchAccountButton: {
    paddingVertical: 10,
  },
  switchAccountText: {
    fontSize: 13,
    color: colors.mutedText,
    textDecorationLine: 'underline',
  },
  loginLink: {
    marginTop: 12,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 13,
    color: colors.mutedText,
  },
  loginLinkHighlight: {
    color: colors.primaryStrong,
    fontWeight: fontWeight.bold,
  },
});
