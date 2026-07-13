import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getHumanGreeting } from '@painel-prime/app';

import { useAuth } from '../contexts/AuthContext';
import { getPrivateFileDownloadUrl, uploadPrivateAsset } from '../lib/r2FileStorage';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { PrimeLogoLoader } from './PrimeLogoLoader';

type WelcomeProfile = {
  display_name: string | null;
  avatar_url: string | null;
  avatar_file_id: string | null;
};

type Step = 'name' | 'photo' | 'ready';
const primeLogo = require('../../assets/splash-icon.png');

export function ProfileWelcomeGate({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(true);
  const [complete, setComplete] = useState(false);
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const greeting = useMemo(() => getHumanGreeting({ displayName: name, email: user?.email }), [name, user?.email]);

  useEffect(() => {
    let alive = true;
    async function checkProfile() {
      if (!user?.id) return;
      setChecking(true);
      const { data, error: profileError } = await supabase
        .from('user_onboarding_state')
        .select('display_name,avatar_url,avatar_file_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!alive) return;
      if (profileError) {
        setError('Não conseguimos preparar sua experiência. Tente novamente.');
        setChecking(false);
        return;
      }
      const profile = data as WelcomeProfile | null;
      const externalAvatar = String(user.user_metadata?.avatar_url ?? '') || null;
      const existingName = profile?.display_name || String(user.user_metadata?.name ?? '') || String(user.email ?? '').split('@')[0];
      setName(existingName.trim());
      if (profile?.avatar_file_id) {
        try {
          const signedUrl = await getPrivateFileDownloadUrl(profile.avatar_file_id);
          if (!alive) return;
          setAvatarUrl(signedUrl);
          setComplete(true);
        } catch {
          setStep('photo');
        }
      } else if (profile?.avatar_url || externalAvatar) {
        setAvatarUrl(profile?.avatar_url || externalAvatar);
        setComplete(true);
      } else {
        setStep('name');
      }
      setChecking(false);
    }
    void checkProfile();
    return () => { alive = false; };
  }, [user]);

  async function saveName() {
    const cleanName = name.trim();
    if (!user?.id || cleanName.length < 2 || saving) return;
    setSaving(true);
    setError('');
    const { data: updatedProfile, error: updateError } = await supabase.from('user_onboarding_state').update({
      display_name: cleanName,
      setup_started_at: new Date().toISOString(),
    }).eq('user_id', user.id).select('user_id').maybeSingle();
    const insertResult = !updateError && !updatedProfile
      ? await supabase.from('user_onboarding_state').insert({ user_id: user.id, display_name: cleanName, setup_started_at: new Date().toISOString() })
      : null;
    setSaving(false);
    if (updateError || insertResult?.error) {
      setError('Não foi possível salvar seu nome. Tente novamente.');
      return;
    }
    setName(cleanName);
    setStep('photo');
  }

  async function choosePhoto() {
    if (!user?.id || saving) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.84,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setSaving(true);
    setError('');
    try {
      const extension = (asset.fileName?.split('.').pop() || 'jpg').toLowerCase();
      const upload = await uploadPrivateAsset({
        uri: asset.uri,
        fileName: `perfil-${user.id}-${Date.now()}.${extension}`,
        contentType: asset.mimeType ?? 'image/jpeg',
        byteSize: asset.fileSize ?? null,
        entityType: 'user_avatar',
        entityId: user.id,
      });
      const { data: updatedProfile, error: updateError } = await supabase.from('user_onboarding_state').update({
        display_name: name.trim(),
        avatar_file_id: upload.fileId,
        avatar_url: null,
        setup_completed_at: new Date().toISOString(),
      }).eq('user_id', user.id).select('user_id').maybeSingle();
      if (updateError) throw updateError;
      if (!updatedProfile) {
        const { error: insertError } = await supabase.from('user_onboarding_state').insert({ user_id: user.id, display_name: name.trim(), avatar_file_id: upload.fileId, avatar_url: null, setup_completed_at: new Date().toISOString() });
        if (insertError) throw insertError;
      }
      setAvatarUrl(await getPrivateFileDownloadUrl(upload.fileId));
      setStep('ready');
    } catch {
      setError('Não foi possível enviar sua foto. Confira a conexão e tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  if (checking) return <PrimeLogoLoader variant="fullscreen" label="Preparando uma experiência só sua" />;
  if (complete) return children;

  return (
    <KeyboardAvoidingView
      style={[styles.page, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <View style={styles.brandRow}>
        <View style={styles.brandLogoFrame}><Image source={primeLogo} style={styles.brandLogo} resizeMode="contain" /></View>
        <Text style={styles.brandName}>Painel Prime</Text>
      </View>

      <View style={styles.content}>
        {step === 'name' ? (
          <>
            <View style={styles.stepIcon}><Ionicons name="sparkles" size={26} color="#111318" /></View>
            <Text style={styles.eyebrow}>UMA EXPERIÊNCIA FEITA PARA VOCÊ</Text>
            <Text style={styles.title}>{greeting}</Text>
            <Text style={styles.subtitle}>Precisamos te conhecer.</Text>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Como posso te chamar?</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Seu nome"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => void saveName()}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={[styles.primaryButton, name.trim().length < 2 && styles.buttonDisabled]} disabled={name.trim().length < 2 || saving} onPress={() => void saveName()}>
              <Text style={styles.primaryButtonText}>{saving ? 'Salvando…' : 'Continuar'}</Text>
              <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
            </Pressable>
          </>
        ) : null}

        {step === 'photo' ? (
          <>
            <Text style={styles.eyebrow}>AGORA, DEIXE O APP COM A SUA CARA</Text>
            <Text style={styles.title}>Envie uma foto para personalizar o seu app.</Text>
            <Text style={styles.subtitle}>Ela aparecerá na sua página inicial e deixará cada acesso mais próximo e pessoal.</Text>
            <Pressable style={styles.photoPicker} onPress={() => void choosePhoto()} disabled={saving}>
              <View style={styles.photoCircle}>
                <Ionicons name="camera-outline" size={42} color={colors.gold700} />
              </View>
              <Text style={styles.photoTitle}>{saving ? 'Personalizando seu app…' : 'Escolher minha foto'}</Text>
              <Text style={styles.photoHint}>Você poderá trocar quando quiser.</Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        ) : null}

        {step === 'ready' ? (
          <>
            <Text style={styles.eyebrow}>EXPERIÊNCIA PERSONALIZADA</Text>
            <View style={styles.readyAvatarFrame}>{avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.readyAvatar} /> : null}<View style={styles.readyBadge}><Ionicons name="checkmark" size={19} color="#FFFFFF" /></View></View>
            <Text style={[styles.title, styles.centerText]}>Tudo pronto, {name.trim()}.</Text>
            <Text style={[styles.readyCopy, styles.centerText]}>Sua experiência Prime em organização de eventos começa agora!</Text>
            <Pressable style={styles.primaryButton} onPress={() => setComplete(true)}>
              <Text style={styles.primaryButtonText}>Começar</Text>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            </Pressable>
          </>
        ) : null}
      </View>

      <View style={styles.progressRow}>
        {(['name', 'photo', 'ready'] as Step[]).map((item) => <View key={item} style={[styles.progressDot, item === step && styles.progressDotActive]} />)}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, overflow: 'hidden', paddingHorizontal: 24, backgroundColor: '#F8F5EE' },
  glowTop: { position: 'absolute', width: 300, height: 300, borderRadius: 150, right: -130, top: -120, backgroundColor: '#F0D56F', opacity: 0.48 },
  glowBottom: { position: 'absolute', width: 260, height: 260, borderRadius: 130, left: -150, bottom: -110, backgroundColor: '#D9D0FF', opacity: 0.45 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogoFrame: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111318', overflow: 'hidden' },
  brandLogo: { width: 40, height: 40 },
  brandName: { color: '#111318', fontSize: 16, fontWeight: '900' },
  content: { flex: 1, justifyContent: 'center', gap: 16, maxWidth: 500, width: '100%', alignSelf: 'center' },
  stepIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E3C65B' },
  eyebrow: { color: '#876D19', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#111318', fontSize: 31, lineHeight: 37, fontWeight: '900' },
  subtitle: { color: '#687083', fontSize: 16, lineHeight: 23 },
  fieldBlock: { gap: 8, marginTop: 8 },
  label: { color: '#111318', fontSize: 14, fontWeight: '800' },
  input: { minHeight: 58, borderRadius: 17, borderWidth: 1, borderColor: '#D7D1C5', paddingHorizontal: 16, backgroundColor: '#FFFFFF', color: '#111318', fontSize: 18, fontWeight: '800' },
  primaryButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 17, backgroundColor: '#111318' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  buttonDisabled: { opacity: 0.45 },
  error: { padding: 11, borderRadius: 12, backgroundColor: '#FEE2E2', color: '#B91C1C', fontSize: 12, fontWeight: '700' },
  photoPicker: { minHeight: 265, gap: 10, alignItems: 'center', justifyContent: 'center', padding: 24, borderRadius: 28, borderWidth: 1, borderColor: '#DFC45C', backgroundColor: '#FFF9E5' },
  photoCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E8D68E', borderStyle: 'dashed' },
  photoTitle: { color: '#111318', fontSize: 18, fontWeight: '900' },
  photoHint: { color: '#7A735F', fontSize: 13 },
  readyAvatarFrame: { width: 178, height: 178, alignSelf: 'center', borderRadius: 89, padding: 7, backgroundColor: '#E3C65B', shadowColor: '#806510', shadowOpacity: 0.23, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 7 },
  readyAvatar: { width: '100%', height: '100%', borderRadius: 82 },
  readyBadge: { position: 'absolute', right: 8, bottom: 8, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111318', borderWidth: 3, borderColor: '#F8F5EE' },
  readyCopy: { color: '#687083', fontSize: 17, lineHeight: 24 },
  centerText: { textAlign: 'center' },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 7 },
  progressDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D5CEC1' },
  progressDotActive: { width: 24, backgroundColor: '#B28B24' },
});
