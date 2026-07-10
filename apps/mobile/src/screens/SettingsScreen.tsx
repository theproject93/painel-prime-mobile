import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import { Screen } from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

type AppSettings = {
  autoRefresh: boolean;
  compactMode: boolean;
  notifications: boolean;
};

const STORAGE_KEY = 'planejar_pro_app_settings_v1';

export function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<AppSettings>({
    autoRefresh: true,
    compactMode: false,
    notifications: true,
  });

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const localRaw = await AsyncStorage.getItem(STORAGE_KEY);
      if (localRaw && alive) {
        try {
          const parsed = JSON.parse(localRaw) as Partial<AppSettings>;
          setSettings((prev) => ({
            autoRefresh: parsed.autoRefresh ?? prev.autoRefresh,
            compactMode: parsed.compactMode ?? prev.compactMode,
            notifications: parsed.notifications ?? prev.notifications,
          }));
        } catch {
          // ignore parse error
        }
      }

      const remoteSettings = ((user?.user_metadata as Record<string, any> | undefined)?.app_settings ?? null) as
        | Partial<AppSettings>
        | null;
      if (remoteSettings && alive) {
        setSettings((prev) => ({
          autoRefresh: remoteSettings.autoRefresh ?? prev.autoRefresh,
          compactMode: remoteSettings.compactMode ?? prev.compactMode,
          notifications: remoteSettings.notifications ?? prev.notifications,
        }));
      }
      if (alive) setLoading(false);
    }
    void load();
    return () => {
      alive = false;
    };
  }, [user?.id, user?.user_metadata]);

  async function persist(next: AppSettings) {
    setSettings(next);
    setSaving(true);
    setMessage('');
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    const { error } = await supabase.auth.updateUser({
      data: {
        ...(user?.user_metadata ?? {}),
        app_settings: next,
      },
    });

    setSaving(false);
    if (error) {
      setMessage(`Salvo localmente, mas falhou sincronização na nuvem: ${error.message}`);
      return;
    }
    setMessage('Configurações salvas e sincronizadas.');
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryStrong} />
      </View>
    );
  }

  return (
    <Screen title="Configurações" subtitle="Preferências persistidas do aplicativo">
      <Pressable onPress={() => router.push('/mais')}>
        <Text style={styles.back}>Voltar</Text>
      </Pressable>

              <View style={styles.card}>
          <Text style={styles.sectionTitle}>Experiencia</Text>
          <ToggleItem
            title="Atualização automática"
            value={settings.autoRefresh}
            onToggle={() => void persist({ ...settings, autoRefresh: !settings.autoRefresh })}
          />
          <ToggleItem
            title="Modo compacto de listas"
            value={settings.compactMode}
            onToggle={() => void persist({ ...settings, compactMode: !settings.compactMode })}
          />
          <ToggleItem
            title="Notificações"
            value={settings.notifications}
            onToggle={() => void persist({ ...settings, notifications: !settings.notifications })}
          />
        </View>

              <View style={styles.syncWrap}>
          {saving ? <ActivityIndicator color={colors.primaryStrong} /> : null}
          {message ? <Text style={styles.message}>{message}</Text> : <Text style={styles.syncHint}>As alterações são sincronizadas automaticamente.</Text>}
        </View>
          </Screen>
  );
}

function ToggleItem({ title, value, onToggle }: { title: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable style={styles.item} onPress={onToggle}>
      <Text style={styles.itemTitle}>{title}</Text>
      <Text style={styles.itemValue}>{value ? 'Ativado' : 'Desativado'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  back: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, gap: 8 },
  syncWrap: { minHeight: 32, justifyContent: 'center', gap: 6 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  item: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 4 },
  itemTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  itemValue: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  syncHint: { color: colors.mutedText, fontSize: 12 },
  message: { color: colors.text, backgroundColor: colors.primarySoft, borderRadius: 8, padding: 8 },
});
