import { routeHrefs } from '@painel-prime/app/navigation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PublicAccessState } from '../components/PublicAccessState';
import { supabase } from '../lib/supabase';
import { goBackOrReplace, normalizeSingleParam } from '../lib/router';
import { colors } from '../theme/colors';

type GuestStatus = 'pending' | 'confirmed' | 'declined';

type GuestInviteData = {
  guest_id: string;
  event_id: string;
  event_name: string;
  event_date: string | null;
  location: string | null;
  couple: string | null;
  guest_name: string;
  rsvp_status: GuestStatus;
  plus_one_count: number | null;
  dietary_restrictions: string | null;
  rsvp_note: string | null;
  invite_message_template: string | null;
  invite_dress_code: string | null;
  table_name: string | null;
};

export function PublicGuestInviteScreen() {
  const router = useRouter();
  const { token: routeToken } = useLocalSearchParams<{ token?: string | string[] }>();
  const token = normalizeSingleParam(routeToken);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invite, setInvite] = useState<GuestInviteData | null>(null);
  const [status, setStatus] = useState<GuestStatus>('pending');
  const [plusOneCount, setPlusOneCount] = useState('0');
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [rsvpNote, setRsvpNote] = useState('');

  const loadInvite = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: rpcError } = await supabase
      .rpc('get_guest_invite_by_token', { p_token: token })
      .single();

    if (rpcError || !data) {
      setError('Convite não encontrado ou expirado.');
      setLoading(false);
      return;
    }

    const payload = data as GuestInviteData;
    setInvite(payload);
    setStatus(payload.rsvp_status ?? 'pending');
    setPlusOneCount(String(Math.max(Number(payload.plus_one_count ?? 0), 0)));
    setDietaryRestrictions(payload.dietary_restrictions ?? '');
    setRsvpNote(payload.rsvp_note ?? '');
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void loadInvite();
  }, [loadInvite]);

  const eventTitle = useMemo(() => {
    if (!invite) return '';
    return invite.couple?.trim() || invite.event_name;
  }, [invite]);

  async function submitRsvp() {
    if (saving) return;
    setSaving(true);
    setError('');
    setSuccess('');
    const parsedPlusOne = Number.parseInt(plusOneCount, 10);
    const { error: rpcError } = await supabase.rpc('submit_guest_rsvp_by_token', {
      p_token: token,
      p_status: status,
      p_plus_one_count: Number.isFinite(parsedPlusOne) ? Math.max(parsedPlusOne, 0) : 0,
      p_dietary_restrictions: dietaryRestrictions,
      p_rsvp_note: rsvpNote,
    });
    if (rpcError) {
      setError('Não foi possível salvar seu RSVP.');
      setSaving(false);
      return;
    }
    setSuccess('RSVP atualizado com sucesso.');
    setSaving(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryStrong} />
      </View>
    );
  }

  if (!invite) {
    return (
      <View style={styles.emptyPage}>
        <PublicAccessState
          eyebrow="CONVITE DIGITAL"
          title="Esse convite não está mais ativo"
          description="O endereço pode ter expirado, sido substituído ou perdido parte do token no compartilhamento."
          detail={error || 'Abra novamente a mensagem recebida ou solicite um novo convite ao anfitriao.'}
          primaryLabel="Ir para o início"
          onPrimaryPress={() => router.replace(routeHrefs.landing())}
          secondaryLabel="Voltar"
          onSecondaryPress={() => goBackOrReplace(router, routeHrefs.landing())}
        />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Pressable onPress={() => goBackOrReplace(router, routeHrefs.landing())}>
        <Text style={styles.back}>Voltar</Text>
      </Pressable>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.title}>{eventTitle}</Text>
        <Text style={styles.sub}>Olá, {invite.guest_name}. Confirme sua presença.</Text>
        <Text style={styles.meta}>
          {invite.event_date ? new Date(invite.event_date).toLocaleDateString('pt-BR') : 'A definir'} | {invite.location || 'Local a definir'}
        </Text>
        {invite.invite_dress_code ? <Text style={styles.meta}>Dress code: {invite.invite_dress_code}</Text> : null}

        <View style={styles.row}>
          <Pressable style={[styles.pill, status === 'confirmed' ? styles.pillOn : null]} onPress={() => setStatus('confirmed')}>
            <Text style={styles.pillText}>Confirmar</Text>
          </Pressable>
          <Pressable style={[styles.pill, status === 'pending' ? styles.pillOn : null]} onPress={() => setStatus('pending')}>
            <Text style={styles.pillText}>Pendente</Text>
          </Pressable>
          <Pressable style={[styles.pill, status === 'declined' ? styles.pillOn : null]} onPress={() => setStatus('declined')}>
            <Text style={styles.pillText}>Recusar</Text>
          </Pressable>
        </View>

        <TextInput style={styles.input} value={plusOneCount} onChangeText={setPlusOneCount} keyboardType="numeric" placeholder="Acompanhantes" />
        <TextInput style={styles.input} value={dietaryRestrictions} onChangeText={setDietaryRestrictions} placeholder="Restricoes alimentares" />
        <TextInput style={[styles.input, styles.area]} value={rsvpNote} onChangeText={setRsvpNote} placeholder="Observação" multiline />

        {success ? <Text style={styles.ok}>{success}</Text> : null}

        <Pressable style={styles.button} onPress={() => void submitRsvp()}>
          <Text style={styles.buttonText}>{saving ? 'Salvando...' : 'Salvar resposta'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 8 },
  emptyPage: { flex: 1, justifyContent: 'center', backgroundColor: '#F5F5F4', padding: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  back: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  err: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 8 },
  ok: { color: '#166534', backgroundColor: '#ECFDF5', borderRadius: 8, padding: 8 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  sub: { color: colors.text, fontSize: 14, fontWeight: '600' },
  meta: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillOn: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
  pillText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: colors.text },
  area: { minHeight: 90, textAlignVertical: 'top' },
  button: { minHeight: 42, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.primaryTextOn, fontWeight: '700', fontSize: 14 },
});
