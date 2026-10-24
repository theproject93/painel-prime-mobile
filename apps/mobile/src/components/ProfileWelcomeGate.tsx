import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getHumanGreeting } from '@painel-prime/app';

import { useAuth } from '../contexts/AuthContext';
import { AppHaptics } from '../lib/haptics';
import { getPrivateFileDownloadUrl, uploadPrivateAsset } from '../lib/r2FileStorage';
import { supabase } from '../lib/supabase';
import { PrimeLogoLoader } from './PrimeLogoLoader';
import { useKeyboardBottomInset } from '../lib/useKeyboardBottomInset';

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
  const keyboardHeight = useKeyboardBottomInset();
  const [checking, setChecking] = useState(true);
  const [complete, setComplete] = useState(false);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const greeting = useMemo(
    () => getHumanGreeting({ displayName: name, email: user?.email }),
    [name, user?.email],
  );

  const userId = user?.id;

  useEffect(() => {
    let alive = true;
    if (!userId) {
      setChecking(false);
      return;
    }

    // Se já verificou e completou este usuário, não reseta checking para não desmontar a navegação
    if (complete && checkedUserId === userId) {
      return;
    }

    async function checkProfile() {
      setChecking(true);
      const { data, error: profileError } = await supabase
        .from('user_onboarding_state')
        .select('display_name,avatar_url,avatar_file_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!alive) return;
      if (profileError) {
        setError('Não conseguimos preparar sua experiência. Tente novamente.');
        setChecking(false);
        return;
      }

      const profile = data as WelcomeProfile | null;
      const externalAvatar = String(user?.user_metadata?.avatar_url ?? '') || null;
      const existingName =
        profile?.display_name ||
        String(user?.user_metadata?.name ?? '') ||
        String(user?.email ?? '').split('@')[0];

      setName(existingName.trim());

      if (profile?.avatar_file_id) {
        try {
          const signedUrl = await getPrivateFileDownloadUrl(profile.avatar_file_id);
          if (!alive) return;
          setAvatarUrl(signedUrl);
          setComplete(true);
          setCheckedUserId(userId ?? null);
        } catch {
          setStep('photo');
        }
      } else if (profile?.avatar_url || externalAvatar) {
        setAvatarUrl(profile?.avatar_url || externalAvatar);
        setComplete(true);
        setCheckedUserId(userId ?? null);
      } else {
        setStep('name');
      }
      setChecking(false);
    }

    void checkProfile();
    return () => {
      alive = false;
    };
  }, [userId, complete, checkedUserId]);

  async function saveName() {
    const cleanName = name.trim();
    if (!user?.id || cleanName.length < 2 || saving) return;
    setSaving(true);
    setError('');

    const { data: updatedProfile, error: updateError } = await supabase
      .from('user_onboarding_state')
      .update({
        display_name: cleanName,
        setup_started_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select('user_id')
      .maybeSingle();

    const insertResult =
      !updateError && !updatedProfile
        ? await supabase.from('user_onboarding_state').insert({
            user_id: user.id,
            display_name: cleanName,
            setup_started_at: new Date().toISOString(),
          })
        : null;

    setSaving(false);

    if (updateError || insertResult?.error) {
      void AppHaptics.error();
      setError('Não foi possível salvar seu nome. Tente novamente.');
      return;
    }

    void AppHaptics.light();
    setName(cleanName);
    setStep('photo');
  }

  async function choosePhoto() {
    if (!user?.id || saving) return;
    void AppHaptics.light();

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

      const { data: updatedProfile, error: updateError } = await supabase
        .from('user_onboarding_state')
        .update({
          display_name: name.trim(),
          avatar_file_id: upload.fileId,
          avatar_url: null,
          setup_completed_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select('user_id')
        .maybeSingle();

      if (updateError) throw updateError;

      if (!updatedProfile) {
        const { error: insertError } = await supabase.from('user_onboarding_state').insert({
          user_id: user.id,
          display_name: name.trim(),
          avatar_file_id: upload.fileId,
          avatar_url: null,
          setup_completed_at: new Date().toISOString(),
        });
        if (insertError) throw insertError;
      }

      setAvatarUrl(await getPrivateFileDownloadUrl(upload.fileId));
      void AppHaptics.success();
      setStep('ready');
    } catch {
      void AppHaptics.error();
      setError('Não foi possível enviar sua foto. Confira a conexão e tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function skipPhoto() {
    if (saving) return;
    void AppHaptics.light();

    // Se o usuário preferir definir depois, registramos o avanço sem travar no gate
    if (user?.id) {
      void supabase
        .from('user_onboarding_state')
        .update({
          display_name: name.trim(),
          setup_completed_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    }

    setStep('ready');
  }

  const handleFinish = () => {
    void AppHaptics.success();
    setComplete(true);
  };

  if (checking) {
    return <PrimeLogoLoader variant="fullscreen" label="Preparando uma experiência só sua" />;
  }

  if (complete) {
    return children;
  }

  return (
    <KeyboardAvoidingView
      style={[
        styles.page,
        {
          paddingTop: insets.top + 18,
          paddingBottom:
            Platform.OS === 'android' && keyboardHeight > 0
              ? keyboardHeight + 16
              : insets.bottom + 18,
        },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <View style={styles.brandRow}>
        <View style={styles.brandLogoFrame}>
          <Image source={primeLogo} style={styles.brandLogo} resizeMode="contain" />
        </View>
        <Text style={styles.brandName}>Painel Prime</Text>
      </View>

      <View style={styles.content}>
        {step === 'name' ? (
          <>
            <View style={styles.stepIcon}>
              <Ionicons name="sparkles" size={26} color="#DEC479" />
            </View>
            <Text style={styles.eyebrow}>UMA EXPERIÊNCIA FEITA PARA VOCÊ</Text>
            <Text style={styles.title}>{greeting}</Text>
            <Text style={styles.subtitle}>Como podemos te chamar na plataforma?</Text>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Seu nome ou como prefere ser chamado</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Seu nome"
                placeholderTextColor="#71717A"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => void saveName()}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.primaryButton, name.trim().length < 2 && styles.buttonDisabled]}
              disabled={name.trim().length < 2 || saving}
              onPress={() => void saveName()}
              accessibilityRole="button"
              accessibilityLabel="Continuar para a próxima etapa"
            >
              <Text style={styles.primaryButtonText}>{saving ? 'Salvando…' : 'Continuar'}</Text>
              <Ionicons name="arrow-forward" size={19} color="#111113" />
            </Pressable>
          </>
        ) : null}

        {step === 'photo' ? (
          <>
            <View style={styles.stepIcon}>
              <Ionicons name="camera" size={26} color="#DEC479" />
            </View>
            <Text style={styles.eyebrow}>AGORA, DEIXE O APP COM A SUA CARA</Text>
            <Text style={styles.title}>Envie uma foto para o seu perfil.</Text>
            <Text style={styles.subtitle}>
              Ela aparecerá na sua página inicial e tornará cada atendimento mais próximo e profissional.
            </Text>

            <Pressable
              style={styles.photoPicker}
              onPress={() => void choosePhoto()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Escolher foto na galeria do dispositivo"
            >
              <View style={styles.photoCircle}>
                <Ionicons name="camera-outline" size={38} color="#DEC479" />
              </View>
              <Text style={styles.photoTitle}>
                {saving ? 'Personalizando seu perfil…' : 'Escolher minha foto'}
              </Text>
              <Text style={styles.photoHint}>Você poderá alterar quando quiser no Perfil.</Text>
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {/* Botão de saída/continuação sem foto: elimina o Dead End */}
            <Pressable
              style={styles.secondaryButton}
              onPress={() => void skipPhoto()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Definir foto depois e continuar"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.secondaryButtonText}>Definir depois</Text>
              <Ionicons name="arrow-forward" size={17} color="#A1A1AA" />
            </Pressable>
          </>
        ) : null}

        {step === 'ready' ? (
          <>
            <Text style={styles.eyebrow}>TUDO PRONTO</Text>
            <View style={styles.readyAvatarFrame}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.readyAvatar} />
              ) : (
                <View style={styles.readyAvatarPlaceholder}>
                  <Ionicons name="person" size={54} color="#DEC479" />
                </View>
              )}
              <View style={styles.readyBadge}>
                <Ionicons name="checkmark" size={19} color="#111113" />
              </View>
            </View>
            <Text style={[styles.title, styles.centerText]}>Bem-vindo, {name.trim()}.</Text>
            <Text style={[styles.readyCopy, styles.centerText]}>
              Sua experiência de alto padrão em organização de eventos começa agora!
            </Text>

            <Pressable
              style={styles.primaryButton}
              onPress={handleFinish}
              accessibilityRole="button"
              accessibilityLabel="Começar a usar o Painel Prime"
            >
              <Text style={styles.primaryButtonText}>Começar</Text>
              <Ionicons name="sparkles" size={18} color="#111113" />
            </Pressable>
          </>
        ) : null}
      </View>

      <View style={styles.progressRow}>
        {(['name', 'photo', 'ready'] as Step[]).map((item) => (
          <View
            key={item}
            style={[styles.progressDot, item === step && styles.progressDotActive]}
          />
        ))}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    overflow: 'hidden',
    paddingHorizontal: 24,
    backgroundColor: '#111113',
  },
  glowTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    right: -120,
    top: -100,
    backgroundColor: '#DEC479',
    opacity: 0.12,
  },
  glowBottom: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    left: -140,
    bottom: -90,
    backgroundColor: '#3F3F46',
    opacity: 0.14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogoFrame: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#2A2A30',
    overflow: 'hidden',
  },
  brandLogo: {
    width: 38,
    height: 38,
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  stepIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(222, 196, 121, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(222, 196, 121, 0.35)',
  },
  eyebrow: {
    color: '#DEC479',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '900',
  },
  subtitle: {
    color: '#A1A1AA',
    fontSize: 15,
    lineHeight: 22,
  },
  fieldBlock: {
    gap: 8,
    marginTop: 6,
  },
  label: {
    color: '#E4E4E7',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A30',
    paddingHorizontal: 16,
    backgroundColor: '#18181B',
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 16,
    backgroundColor: '#DEC479',
  },
  primaryButtonText: {
    color: '#111113',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A30',
    backgroundColor: '#18181B',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  error: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(185, 28, 28, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(185, 28, 28, 0.4)',
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
  },
  photoPicker: {
    minHeight: 210,
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(222, 196, 121, 0.35)',
    backgroundColor: '#18181B',
  },
  photoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111113',
    borderWidth: 2,
    borderColor: '#DEC479',
    borderStyle: 'dashed',
  },
  photoTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  photoHint: {
    color: '#71717A',
    fontSize: 13,
  },
  readyAvatarFrame: {
    width: 160,
    height: 160,
    alignSelf: 'center',
    borderRadius: 80,
    padding: 6,
    backgroundColor: '#DEC479',
    shadowColor: '#DEC479',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  readyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 74,
  },
  readyAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 74,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DEC479',
    borderWidth: 3,
    borderColor: '#111113',
  },
  readyCopy: {
    color: '#A1A1AA',
    fontSize: 16,
    lineHeight: 23,
  },
  centerText: {
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2A2A30',
  },
  progressDotActive: {
    width: 24,
    backgroundColor: '#DEC479',
  },
});
