import { checkPwnedPassword, validateStrongPassword } from '@painel-prime/app';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '../components/Screen';
import { mapAuthErrorMessage } from '../lib/authError';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

export function PasswordRecoveryScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function updatePassword() {
    if (busy) return;
    setError('');
    const policyError = validateStrongPassword(password);
    if (policyError) { setError(policyError); return; }
    if (password !== confirmation) { setError('As senhas não conferem.'); return; }

    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError('Link de recuperação inválido ou expirado. Solicite um novo link.');
        return;
      }
      if (await checkPwnedPassword(password)) {
        setError('Esta senha já foi exposta em vazamentos. Escolha outra senha.');
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword('');
      setConfirmation('');
      setSaved(true);
    } catch (updateError) {
      setError(mapAuthErrorMessage(updateError));
    } finally {
      setBusy(false);
    }
  }

  return <Screen title="Definir nova senha" subtitle="Escolha uma senha para voltar a acessar sua conta.">
    {saved ? <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.success}>Senha atualizada com sucesso.</Text>
      <Pressable style={styles.button} accessibilityRole="button" onPress={() => router.replace('/dashboard')}>
        <Text style={styles.buttonText}>Ir para o painel</Text>
      </Pressable>
    </View> : <View style={styles.card}>
      <Text style={styles.label}>Nova senha</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword}
        secureTextEntry textContentType="newPassword" autoCapitalize="none" autoCorrect={false}
        accessibilityLabel="Nova senha" />
      <Text style={styles.label}>Confirme a nova senha</Text>
      <TextInput style={styles.input} value={confirmation} onChangeText={setConfirmation}
        secureTextEntry textContentType="newPassword" autoCapitalize="none" autoCorrect={false}
        accessibilityLabel="Confirme a nova senha" />
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      <Pressable style={[styles.button, busy && styles.disabled]} disabled={busy} accessibilityRole="button"
        accessibilityState={{ disabled: busy }} onPress={() => void updatePassword()}>
        {busy ? <ActivityIndicator color={colors.primaryTextOn} /> : <Text style={styles.buttonText}>Atualizar senha</Text>}
      </Pressable>
    </View>}
  </Screen>;
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 12, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
  input: { minHeight: 48, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, color: colors.text },
  error: { color: colors.dangerText, backgroundColor: colors.dangerBg, padding: 12, borderRadius: 10 },
  success: { color: colors.successText, fontSize: 17, fontWeight: '700' },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.primary },
  buttonText: { color: colors.primaryTextOn, fontWeight: '700' },
  disabled: { opacity: 0.55 },
});
