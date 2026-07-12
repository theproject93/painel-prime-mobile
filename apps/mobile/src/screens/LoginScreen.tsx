import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { routeHrefs } from '@painel-prime/app/navigation';
import { UniversalLink } from '@painel-prime/ui';
import { useAuth } from '../contexts/AuthContext';
import { typography } from '../theme/fonts';
import { colors } from '../theme/colors';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'azure' | null>(null);
  const { signIn, signInWithProvider, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    router.replace(routeHrefs.dashboard());
  }, [router, user]);

  async function handleLogin() {
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      const msg = String(err?.message ?? '').trim();
      setError(msg || 'E-mail ou senha inválidos.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOAuth(provider: 'google' | 'azure') {
    setError('');
    setOauthLoading(provider);
    try {
      await signInWithProvider(provider);
    } catch {
      setError(
        provider === 'google'
          ? 'Não foi possível iniciar login com Google.'
          : 'Não foi possível iniciar login com Microsoft.'
      );
    } finally {
      setOauthLoading(null);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.page}
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

        <Pressable>
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
    justifyContent: 'center',
    paddingHorizontal: 20,
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
  forgotLink: {
    color: '#A1A1AA',
    fontSize: 13,
    fontFamily: typography.fontFamily.sansSemiBold,
    textAlign: 'right',
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
  },
  signupLink: {
    color: '#A1A1AA',
    fontSize: 13,
    fontFamily: typography.fontFamily.sansSemiBold,
    textAlign: 'center',
  },
});
