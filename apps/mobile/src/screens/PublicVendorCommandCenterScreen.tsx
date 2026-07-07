import { routeHrefs } from '@painel-prime/app/navigation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../lib/supabase';
import { goBackOrReplace, normalizeSingleParam } from '../lib/router';
import { colors } from '../theme/colors';

type VendorStatus = 'pending' | 'en_route' | 'arrived' | 'done';

type VendorInfo = {
  vendor_id: string;
  event_id: string;
  vendor_name: string;
  vendor_category: string;
  event_name: string;
  event_date: string;
  status: VendorStatus | null;
  expected_arrival_time?: string | null;
  expected_done_time?: string | null;
  latest_note?: string | null;
};

type VendorHistoryRow = {
  status: VendorStatus;
  note: string | null;
  updated_by: 'assessoria' | 'fornecedor';
  created_at: string;
};

const STEPS: VendorStatus[] = ['en_route', 'arrived', 'done'];

export function PublicVendorCommandCenterScreen() {
  const router = useRouter();
  const { token: routeToken } = useLocalSearchParams<{ token?: string | string[] }>();
  const token = normalizeSingleParam(routeToken);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [info, setInfo] = useState<VendorInfo | null>(null);
  const [history, setHistory] = useState<VendorHistoryRow[]>([]);

  const loadVendor = useCallback(async () => {
    const { data, error: v2Error } = await supabase.rpc('get_vendor_by_token_v2', {
      p_token: token,
    });
    if (!v2Error && data && data.length > 0) {
      setInfo(data[0] as VendorInfo);
      return;
    }
    const fallback = await supabase.rpc('get_vendor_by_token', { p_token: token });
    if (!fallback.error && fallback.data && fallback.data.length > 0) {
      setInfo(fallback.data[0] as VendorInfo);
      return;
    }
    setInfo(null);
  }, [token]);

  const loadHistory = useCallback(async () => {
    const { data, error: historyError } = await supabase.rpc('get_vendor_status_history_by_token', {
      p_token: token,
    });
    if (!historyError) {
      setHistory((data as VendorHistoryRow[]) ?? []);
    }
  }, [token]);

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      setError('');
      await Promise.all([loadVendor(), loadHistory()]);
      setLoading(false);
    }
    void bootstrap();
  }, [loadHistory, loadVendor]);

  const statusLabel = useMemo<Record<VendorStatus, string>>(
    () => ({
      pending: 'Aguardando',
      en_route: 'A caminho',
      arrived: 'Cheguei',
      done: 'Finalizado',
    }),
    [],
  );

  async function updateStatus(status: VendorStatus) {
    setSaving(true);
    setError('');
    const res = await supabase.rpc('update_vendor_status_by_token', {
      p_token: token,
      p_status: status,
      p_note: noteInput.trim() || null,
    });
    if (res.error) {
      setError('Não foi possível atualizar status.');
      setSaving(false);
      return;
    }
    setNoteInput('');
    await Promise.all([loadVendor(), loadHistory()]);
    setSaving(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryStrong} />
      </View>
    );
  }

  if (!info) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>Link inválido.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable onPress={() => goBackOrReplace(router, routeHrefs.landing())}>
        <Text style={styles.back}>Voltar</Text>
      </Pressable>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.title}>{info.vendor_name}</Text>
        <Text style={styles.meta}>
          {info.event_name} | {new Date(info.event_date).toLocaleDateString('pt-BR')}
        </Text>
        <Text style={styles.meta}>Categoria: {info.vendor_category}</Text>
        <Text style={styles.meta}>
          Previsto: {info.expected_arrival_time || '--:--'} - {info.expected_done_time || '--:--'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Atualize seu status</Text>
        <View style={styles.row}>
          {STEPS.map((status) => (
            <Pressable key={status} style={styles.statusButton} onPress={() => void updateStatus(status)}>
              <Text style={styles.statusButtonText}>{statusLabel[status]}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput style={styles.input} value={noteInput} onChangeText={setNoteInput} placeholder="Observação rápida (opcional)" />
        <Pressable style={styles.saveButton} onPress={() => void updateStatus(info.status ?? 'pending')}>
          <Text style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Enviar observação'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Histórico</Text>
        {history.length === 0 ? (
          <Text style={styles.meta}>Sem atualizações ainda.</Text>
        ) : (
          history.map((item, idx) => (
            <View key={`${item.created_at}-${idx}`} style={styles.historyItem}>
              <Text style={styles.historyTitle}>{statusLabel[item.status]}</Text>
              <Text style={styles.meta}>{new Date(item.created_at).toLocaleString('pt-BR')}</Text>
              {item.note ? <Text style={styles.meta}>{item.note}</Text> : null}
              <Text style={styles.meta}>Atualizado por: {item.updated_by}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 16, gap: 10, paddingBottom: 26 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' },
  back: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  err: { color: '#FECACA', backgroundColor: '#7F1D1D', borderRadius: 8, padding: 8 },
  card: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 10, gap: 6 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  meta: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusButton: { borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#0F172A' },
  statusButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: '#FFFFFF' },
  saveButton: { minHeight: 40, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  historyItem: { borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 8, gap: 2, backgroundColor: '#0F172A' },
  historyTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

