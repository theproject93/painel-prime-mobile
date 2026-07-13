import { useCallback, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';

import { PrimeLogoLoader } from '../components/PrimeLogoLoader';
import { Screen } from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { getPrivateFileDownloadUrl, uploadPrivateAsset } from '../lib/r2FileStorage';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

type TeamMember = { id: string; team_id: string; name: string; role: string | null; phone: string | null; email: string | null; photo_file_id: string | null; photo_url: string | null };
type Team = { id: string; name: string; leader_member_id: string | null; members: TeamMember[] };

const TEAM_SUGGESTIONS = ['Equipe Esmeralda', 'Equipe Pérola', 'Equipe Aurora'];
const teamDb = supabase as any;

export function TeamDirectoryScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamModal, setTeamModal] = useState(false);
  const [memberTeam, setMemberTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState('');
  const [member, setMember] = useState({ name: '', role: '', phone: '', email: '', photoUri: '', fileName: '', mimeType: 'image/jpeg', fileSize: null as number | null });

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    const [teamsRes, membersRes] = await Promise.all([
      teamDb.from('advisor_teams').select('id,name,leader_member_id').order('created_at', { ascending: true }),
      teamDb.from('advisor_team_members').select('id,team_id,name,role,phone,email,photo_file_id,photo_url').order('created_at', { ascending: true }),
    ]);
    if (teamsRes.error || membersRes.error) {
      setError(teamsRes.error?.message || membersRes.error?.message || 'Não foi possível carregar sua equipe.');
      setLoading(false);
      return;
    }
    const hydratedMembers = await Promise.all((membersRes.data ?? []).map(async (row: TeamMember) => {
      if (!row.photo_file_id) return row;
      try { return { ...row, photo_url: await getPrivateFileDownloadUrl(row.photo_file_id) }; }
      catch { return row; }
    }));
    setTeams((teamsRes.data ?? []).map((team: Omit<Team, 'members'>) => ({ ...team, members: hydratedMembers.filter((item) => item.team_id === team.id) })));
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function currentTenantId() {
    const { data, error: tenantError } = await teamDb.from('tenant_memberships').select('tenant_id').eq('user_id', user?.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (tenantError || !data?.tenant_id) throw new Error('Sua conta ainda não possui uma assessoria ativa.');
    return String(data.tenant_id);
  }

  async function createTeam() {
    if (!user?.id || !teamName.trim() || saving) return;
    setSaving(true); setError('');
    try {
      const tenantId = await currentTenantId();
      const { error: createError } = await teamDb.from('advisor_teams').insert({ tenant_id: tenantId, created_by: user.id, name: teamName.trim() });
      if (createError) throw createError;
      setTeamName(''); setTeamModal(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar a equipe.'); }
    finally { setSaving(false); }
  }

  async function chooseMemberPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.82 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setMember((current) => ({ ...current, photoUri: asset.uri, fileName: asset.fileName || `equipe-${Date.now()}.jpg`, mimeType: asset.mimeType || 'image/jpeg', fileSize: asset.fileSize ?? null }));
  }

  async function createMember() {
    if (!user?.id || !memberTeam || !member.name.trim() || saving) return;
    setSaving(true); setError('');
    try {
      const tenantId = await currentTenantId();
      const { data: created, error: createError } = await teamDb.from('advisor_team_members').insert({ tenant_id: tenantId, team_id: memberTeam.id, created_by: user.id, name: member.name.trim(), role: member.role.trim() || 'Assessoria', phone: member.phone.trim() || null, email: member.email.trim() || null }).select('id').single();
      if (createError) throw createError;
      if (member.photoUri) {
        const upload = await uploadPrivateAsset({ uri: member.photoUri, fileName: member.fileName, contentType: member.mimeType, byteSize: member.fileSize, entityType: 'advisor_team_member_photo', entityId: String(created.id) });
        const { error: photoError } = await teamDb.from('advisor_team_members').update({ photo_file_id: upload.fileId, photo_url: null }).eq('id', created.id);
        if (photoError) throw photoError;
      }
      setMember({ name: '', role: '', phone: '', email: '', photoUri: '', fileName: '', mimeType: 'image/jpeg', fileSize: null }); setMemberTeam(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível adicionar a pessoa.'); }
    finally { setSaving(false); }
  }

  async function chooseLeader(team: Team, memberId: string) {
    const { error: updateError } = await teamDb.from('advisor_teams').update({ leader_member_id: memberId }).eq('id', team.id);
    if (updateError) setError(updateError.message); else await load();
  }

  if (loading) return <PrimeLogoLoader label="Preparando sua equipe" />;

  return (
    <Screen title="Sua equipe" subtitle="Cadastre uma vez e escale as pessoas certas em cada evento.">
      <View style={styles.hero}><View style={styles.heroIcon}><Ionicons name="people" size={25} color="#111318" /></View><View style={styles.grow}><Text style={styles.heroTitle}>Gente boa faz eventos memoráveis</Text><Text style={styles.heroText}>Organize líderes, funções, contatos e fotos. Depois, escolha a equipe dentro de qualquer evento.</Text></View></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.primaryButton} onPress={() => setTeamModal(true)}><Ionicons name="add" size={20} color="#FFFFFF" /><Text style={styles.primaryText}>Criar equipe</Text></Pressable>
      {teams.length === 0 ? <View style={styles.empty}><Ionicons name="sparkles-outline" size={28} color={colors.primaryStrong} /><Text style={styles.cardTitle}>Sua primeira equipe começa aqui</Text><Text style={styles.muted}>Dê um nome marcante e reúna as pessoas que trabalham com você.</Text></View> : null}
      {teams.map((team) => <View key={team.id} style={styles.teamCard}><View style={styles.rowBetween}><View style={styles.grow}><Text style={styles.cardTitle}>{team.name}</Text><Text style={styles.muted}>{team.members.length} pessoa{team.members.length === 1 ? '' : 's'} cadastrada{team.members.length === 1 ? '' : 's'}</Text></View><Pressable style={styles.iconButton} onPress={() => setMemberTeam(team)}><Ionicons name="person-add-outline" size={19} color={colors.text} /></Pressable></View>{team.members.map((item) => <View key={item.id} style={styles.memberRow}>{item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.initial}>{item.name.charAt(0).toUpperCase()}</Text></View>}<View style={styles.grow}><View style={styles.memberNameRow}><Text style={styles.memberName}>{item.name}</Text>{team.leader_member_id === item.id ? <Text style={styles.leaderBadge}>Líder</Text> : null}</View><Text style={styles.muted}>{item.role || 'Assessoria'}{item.phone ? ` · ${item.phone}` : ''}</Text></View>{team.leader_member_id !== item.id ? <Pressable onPress={() => void chooseLeader(team, item.id)}><Text style={styles.leaderAction}>Definir líder</Text></Pressable> : null}</View>)}</View>)}

      <Modal visible={teamModal} transparent animationType="slide" onRequestClose={() => setTeamModal(false)}><View style={styles.overlay}><View style={styles.sheet}><Text style={styles.sheetTitle}>Nome da equipe</Text><Text style={styles.muted}>Use um nome que sua assessoria reconheça facilmente.</Text><View style={styles.suggestions}>{TEAM_SUGGESTIONS.map((name) => <Pressable key={name} style={styles.chip} onPress={() => setTeamName(name)}><Text style={styles.chipText}>{name}</Text></Pressable>)}</View><TextInput style={styles.input} value={teamName} onChangeText={setTeamName} placeholder="Ex.: Equipe Esmeralda" /><View style={styles.actions}><Pressable style={styles.secondaryButton} onPress={() => setTeamModal(false)}><Text style={styles.secondaryText}>Cancelar</Text></Pressable><Pressable style={styles.primaryButtonSmall} onPress={() => void createTeam()}><Text style={styles.primaryText}>{saving ? 'Criando…' : 'Criar equipe'}</Text></Pressable></View></View></View></Modal>
      <Modal visible={Boolean(memberTeam)} transparent animationType="slide" onRequestClose={() => setMemberTeam(null)}><View style={styles.overlay}><View style={styles.sheet}><Text style={styles.sheetTitle}>Adicionar pessoa</Text><Text style={styles.muted}>Esta pessoa ficará disponível para todos os eventos.</Text><Pressable style={styles.photoPicker} onPress={() => void chooseMemberPhoto()}>{member.photoUri ? <Image source={{ uri: member.photoUri }} style={styles.photoPreview} /> : <Ionicons name="camera-outline" size={25} color={colors.primaryStrong} />}<Text style={styles.photoText}>{member.photoUri ? 'Trocar foto' : 'Escolher foto'}</Text></Pressable><TextInput style={styles.input} value={member.name} onChangeText={(value) => setMember((current) => ({ ...current, name: value }))} placeholder="Nome completo" /><TextInput style={styles.input} value={member.role} onChangeText={(value) => setMember((current) => ({ ...current, role: value }))} placeholder="Função na equipe" /><TextInput style={styles.input} value={member.phone} onChangeText={(value) => setMember((current) => ({ ...current, phone: value }))} placeholder="Telefone" keyboardType="phone-pad" /><TextInput style={styles.input} value={member.email} onChangeText={(value) => setMember((current) => ({ ...current, email: value }))} placeholder="E-mail" keyboardType="email-address" autoCapitalize="none" /><View style={styles.actions}><Pressable style={styles.secondaryButton} onPress={() => setMemberTeam(null)}><Text style={styles.secondaryText}>Cancelar</Text></Pressable><Pressable style={styles.primaryButtonSmall} onPress={() => void createMember()}><Text style={styles.primaryText}>{saving ? 'Salvando…' : 'Adicionar'}</Text></Pressable></View></View></View></Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 22, padding: 17, backgroundColor: '#F2D875', borderWidth: 1, borderColor: '#E1BD3F' },
  heroIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
  heroTitle: { color: '#111318', fontSize: 17, fontWeight: '800' }, heroText: { color: '#5C4A18', fontSize: 12, lineHeight: 18 }, grow: { flex: 1, gap: 3 },
  primaryButton: { minHeight: 52, borderRadius: 15, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111318' }, primaryText: { color: '#FFFFFF', fontWeight: '800' },
  empty: { alignItems: 'center', gap: 8, padding: 25, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  teamCard: { gap: 12, padding: 16, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, cardTitle: { color: colors.text, fontSize: 17, fontWeight: '800' }, muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 }, iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, avatar: { width: 46, height: 46, borderRadius: 15 }, avatarFallback: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }, initial: { color: colors.primaryStrong, fontSize: 18, fontWeight: '800' }, memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, memberName: { color: colors.text, fontSize: 14, fontWeight: '800' }, leaderBadge: { color: '#72550A', backgroundColor: '#FFF0B5', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: '800' }, leaderAction: { color: colors.primaryStrong, fontSize: 11, fontWeight: '800' },
  error: { color: colors.dangerText, backgroundColor: colors.dangerBg, padding: 10, borderRadius: 12 }, overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,9,14,0.62)' }, sheet: { maxHeight: '90%', gap: 12, padding: 20, paddingBottom: 34, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.card }, sheetTitle: { color: colors.text, fontSize: 22, fontWeight: '800' }, suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primarySoft }, chipText: { color: colors.primaryStrong, fontSize: 11, fontWeight: '700' }, input: { minHeight: 50, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.background }, actions: { flexDirection: 'row', gap: 10 }, secondaryButton: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border }, secondaryText: { color: colors.text, fontWeight: '700' }, primaryButtonSmall: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#111318' }, photoPicker: { alignSelf: 'center', alignItems: 'center', gap: 6 }, photoPreview: { width: 76, height: 76, borderRadius: 24 }, photoText: { color: colors.primaryStrong, fontSize: 12, fontWeight: '800' },
});
