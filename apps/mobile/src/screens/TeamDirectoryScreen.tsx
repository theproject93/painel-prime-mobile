import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';

import { PrimeLogoLoader } from '../components/PrimeLogoLoader';
import { Screen } from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { buildMemberPayload, normalizeTeamSummary, type TeamMemberSummary } from '../features/team/teamDirectoryModel';
import { getPrivateFileDownloadUrl, uploadPrivateAsset } from '../lib/r2FileStorage';
import { supabase } from '../lib/supabase';
import { colors, shadows } from '../theme/colors';

type Team = { id: string; name: string; leaderMemberId: string | null };
const emptyForm = { id: '', name: '', role: '', phone: '', email: '', teamId: '', photoUri: '', fileName: '', mimeType: 'image/jpeg', fileSize: null as number | null };
const db = supabase as any;

export function TeamDirectoryScreen() {
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [summary, setSummary] = useState(() => normalizeTeamSummary(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [teamModal, setTeamModal] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [memberModal, setMemberModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true); setError('');
    try {
      const membership = await db.from('tenant_memberships').select('tenant_id').eq('user_id', user.id).order('created_at').limit(1).maybeSingle();
      if (membership.error || !membership.data?.tenant_id) throw new Error('Sua assessoria ativa não foi encontrada.');
      const nextTenantId = String(membership.data.tenant_id);
      const [teamsResult, summaryResult] = await Promise.all([
        db.from('advisor_teams').select('id,name,leader_member_id').eq('tenant_id', nextTenantId).order('created_at').limit(100),
        db.rpc('get_team_operations_summary', { p_tenant_id: nextTenantId }),
      ]);
      if (teamsResult.error || summaryResult.error) throw teamsResult.error || summaryResult.error;
      const nextSummary = normalizeTeamSummary(summaryResult.data);
      nextSummary.members = await Promise.all(nextSummary.members.map(async (member) => ({
        ...member,
        photoUrl: member.photoFileId ? await getPrivateFileDownloadUrl(member.photoFileId).catch(() => member.photoUrl) : member.photoUrl,
      })));
      setTenantId(nextTenantId);
      setTeams((teamsResult.data ?? []).map((team: any) => ({ id: String(team.id), name: String(team.name), leaderMemberId: team.leader_member_id ? String(team.leader_member_id) : null })));
      setSummary(nextSummary);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar sua equipe.'); }
    finally { setLoading(false); }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const grouped = useMemo(() => teams.map((team) => ({ ...team, members: summary.members.filter((member) => member.teamId === team.id) })), [summary.members, teams]);

  async function run(action: () => Promise<void>) {
    if (saving) return false;
    setSaving(true); setError('');
    try { await action(); await load(); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível concluir esta ação.'); return false; }
    finally { setSaving(false); }
  }

  async function createTeam() {
    if (!teamName.trim() || !tenantId || !user?.id) return;
    if (await run(async () => { const result = await db.from('advisor_teams').insert({ tenant_id: tenantId, created_by: user.id, name: teamName.trim() }); if (result.error) throw result.error; })) {
      setTeamName(''); setTeamModal(false);
    }
  }

  function openMember(teamId: string, member?: TeamMemberSummary) {
    setForm(member ? { ...emptyForm, id: member.id, name: member.name, role: member.role ?? '', phone: member.phone ?? '', email: member.email ?? '', teamId: member.teamId } : { ...emptyForm, teamId });
    setMemberModal(true);
  }

  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.82 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setForm((current) => ({ ...current, photoUri: asset.uri, fileName: asset.fileName || `equipe-${Date.now()}.jpg`, mimeType: asset.mimeType || 'image/jpeg', fileSize: asset.fileSize ?? null }));
  }

  async function saveMember() {
    if (!form.name.trim() || !form.teamId || !tenantId || !user?.id) return;
    if (await run(async () => {
      const payload = buildMemberPayload(form);
      let memberId = form.id;
      if (memberId) {
        const result = await db.from('advisor_team_members').update(payload).eq('id', memberId);
        if (result.error) throw result.error;
      } else {
        const result = await db.from('advisor_team_members').insert({ ...payload, tenant_id: tenantId, created_by: user.id }).select('id').single();
        if (result.error) throw result.error;
        memberId = String(result.data.id);
      }
      if (form.photoUri) {
        const upload = await uploadPrivateAsset({ uri: form.photoUri, fileName: form.fileName, contentType: form.mimeType, byteSize: form.fileSize, entityType: 'advisor_team_member_photo', entityId: memberId });
        const result = await db.from('advisor_team_members').update({ photo_file_id: upload.fileId, photo_url: null }).eq('id', memberId);
        if (result.error) throw result.error;
      }
    })) { setMemberModal(false); setForm(emptyForm); }
  }

  async function changeAccess(member: TeamMemberSummary) {
    if (!member.email) { openMember(member.teamId, member); setError('Cadastre o e-mail antes de liberar o acesso.'); return; }
    const action = member.accessStatus === 'active' ? 'revoke' : 'invite';
    if (await run(async () => { const result = await db.functions.invoke('team-member-access', { body: { action, memberId: member.id } }); if (result.error) throw result.error; })) {
      Alert.alert(action === 'invite' ? 'Convite enviado' : 'Acesso removido', action === 'invite' ? `${member.name} receberá as instruções por e-mail.` : `${member.name} não verá mais os eventos até um novo convite.`);
    }
  }

  function archive(member: TeamMemberSummary) {
    if (member.upcomingEventCount > 0) { Alert.alert('Ainda existem escalas futuras', 'Retire esta pessoa dos próximos eventos antes de arquivar.'); return; }
    Alert.alert('Arquivar pessoa?', 'O histórico será preservado e o acesso será removido.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Arquivar', style: 'destructive', onPress: () => void run(async () => { const result = await db.rpc('archive_team_member', { p_member_id: member.id }); if (result.error) throw result.error; }) }]);
  }

  if (loading) return <PrimeLogoLoader label="Preparando sua equipe" />;
  return <Screen title="Sua equipe" subtitle="Pessoas, escalas e acessos em um só lugar.">
    <View style={styles.hero}><View style={styles.heroIcon}><Ionicons name="people" size={24} color="#111318" /></View><View style={styles.grow}><Text style={styles.heroTitle}>Equipe pronta para cada evento</Text><Text style={styles.heroText}>Antecipe escalas e libere uma visão simples para quem vai trabalhar.</Text></View></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.metrics}><Metric label="Pessoas" value={summary.activeMemberCount} /><Metric label="Eventos" value={summary.upcomingEventCount} /><Metric label="Conferir" value={summary.conflictCount} danger /></View>
    <View style={styles.infoCard}><Ionicons name="shield-checkmark-outline" size={22} color={colors.infoText} /><View style={styles.grow}><Text style={styles.infoTitle}>O que a pessoa verá?</Text><Text style={styles.infoText}>Somente cronograma, tarefas, equipe, fornecedores e recepção dos eventos em que estiver escalada. Valores e documentos ficam ocultos.</Text></View></View>
    <View style={styles.actionsRow}><Pressable style={styles.primaryButton} onPress={() => openMember(teams[0]?.id ?? '')} disabled={!teams.length}><Ionicons name="person-add" size={18} color="#FFF" /><Text style={styles.primaryText}>Adicionar pessoa</Text></Pressable><Pressable style={styles.secondaryIcon} onPress={() => setTeamModal(true)}><Ionicons name="add" size={22} color={colors.text} /></Pressable></View>
    {grouped.map((team) => <View key={team.id} style={styles.teamCard}><View style={styles.rowBetween}><View><Text style={styles.cardTitle}>{team.name}</Text><Text style={styles.muted}>{team.members.length} pessoa{team.members.length === 1 ? '' : 's'}</Text></View><Pressable style={styles.addButton} onPress={() => openMember(team.id)}><Ionicons name="add" size={18} color={colors.primaryStrong} /></Pressable></View>{team.members.map((member) => <View key={member.id} style={styles.memberCard}><View style={styles.memberTop}>{member.photoUrl ? <Image source={{ uri: member.photoUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.initial}>{member.name.charAt(0)}</Text></View>}<View style={styles.grow}><View style={styles.nameRow}><Text style={styles.memberName}>{member.name}</Text>{member.isLeader ? <Text style={styles.leaderBadge}>Líder</Text> : null}</View><Text style={styles.muted}>{member.role || 'Função não informada'}{member.phone ? ` · ${member.phone}` : ''}</Text></View><Pressable onPress={() => openMember(team.id, member)}><Ionicons name="pencil-outline" size={18} color={colors.mutedText} /></Pressable></View><View style={styles.operationalRow}><Text style={styles.eventCount}>{member.upcomingEventCount} evento{member.upcomingEventCount === 1 ? '' : 's'} por vir</Text>{member.hasConflict ? <Text style={styles.conflict}>Conferir horários</Text> : null}</View>{member.nextEvent ? <Text style={styles.nextEvent}>Próximo: {member.nextEvent.name} · {new Date(member.nextEvent.eventDate).toLocaleDateString('pt-BR')}</Text> : null}<View style={styles.memberActions}>{!member.isLeader ? <Pressable onPress={() => void run(async () => { const result = await db.from('advisor_teams').update({ leader_member_id: member.id }).eq('id', team.id); if (result.error) throw result.error; })}><Text style={styles.link}>Definir líder</Text></Pressable> : null}<Pressable onPress={() => void changeAccess(member)}><Text style={styles.accessLink}>{member.accessStatus === 'active' ? 'Remover acesso' : 'Liberar acesso'}</Text></Pressable><Pressable onPress={() => archive(member)}><Ionicons name="archive-outline" size={17} color={colors.mutedText} /></Pressable></View></View>)}</View>)}
    {!teams.length ? <View style={styles.empty}><Text style={styles.cardTitle}>Crie sua primeira equipe</Text><Text style={styles.muted}>Organize as pessoas antes de escalá-las nos eventos.</Text><Pressable style={styles.primaryButton} onPress={() => setTeamModal(true)}><Text style={styles.primaryText}>Criar equipe</Text></Pressable></View> : null}
    <TeamModal visible={teamModal} value={teamName} saving={saving} onChange={setTeamName} onClose={() => setTeamModal(false)} onSave={() => void createTeam()} />
    <MemberModal visible={memberModal} form={form} teams={teams} saving={saving} onChange={setForm} onPhoto={() => void choosePhoto()} onClose={() => setMemberModal(false)} onSave={() => void saveMember()} />
  </Screen>;
}

function Metric({ label, value, danger }: { label: string; value: number; danger?: boolean }) { return <View style={[styles.metric, danger && value > 0 && styles.metricDanger]}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

function TeamModal(props: { visible: boolean; value: string; saving: boolean; onChange: (value: string) => void; onClose: () => void; onSave: () => void }) { return <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}><View style={styles.overlay}><View style={styles.sheet}><Text style={styles.sheetTitle}>Criar equipe</Text><Text style={styles.muted}>Use um nome que sua assessoria reconheça facilmente.</Text><TextInput style={styles.input} value={props.value} onChangeText={props.onChange} placeholder="Ex.: Equipe Pérola" /><ModalActions saving={props.saving} onClose={props.onClose} onSave={props.onSave} /></View></View></Modal>; }

function MemberModal(props: { visible: boolean; form: typeof emptyForm; teams: Team[]; saving: boolean; onChange: React.Dispatch<React.SetStateAction<typeof emptyForm>>; onPhoto: () => void; onClose: () => void; onSave: () => void }) { const set = (key: keyof typeof emptyForm, value: string) => props.onChange((current) => ({ ...current, [key]: value })); return <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}><View style={styles.overlay}><View style={styles.sheet}><Text style={styles.sheetTitle}>{props.form.id ? 'Editar pessoa' : 'Adicionar pessoa'}</Text><Pressable style={styles.photoPicker} onPress={props.onPhoto}>{props.form.photoUri ? <Image source={{ uri: props.form.photoUri }} style={styles.photoPreview} /> : <Ionicons name="camera-outline" size={25} color={colors.primaryStrong} />}<Text style={styles.link}>{props.form.photoUri ? 'Trocar foto' : 'Escolher foto'}</Text></Pressable><TextInput style={styles.input} value={props.form.name} onChangeText={(value) => set('name', value)} placeholder="Nome completo" /><TextInput style={styles.input} value={props.form.role} onChangeText={(value) => set('role', value)} placeholder="Função" /><TextInput style={styles.input} value={props.form.phone} onChangeText={(value) => set('phone', value)} placeholder="Telefone" keyboardType="phone-pad" /><TextInput style={styles.input} value={props.form.email} onChangeText={(value) => set('email', value)} placeholder="E-mail para liberar acesso" keyboardType="email-address" autoCapitalize="none" /><View style={styles.teamChoices}>{props.teams.map((team) => <Pressable key={team.id} style={[styles.teamChoice, props.form.teamId === team.id && styles.teamChoiceActive]} onPress={() => set('teamId', team.id)}><Text style={styles.chipText}>{team.name}</Text></Pressable>)}</View><ModalActions saving={props.saving} onClose={props.onClose} onSave={props.onSave} /></View></View></Modal>; }

function ModalActions({ saving, onClose, onSave }: { saving: boolean; onClose: () => void; onSave: () => void }) { return <View style={styles.modalActions}><Pressable style={styles.cancelButton} onPress={onClose}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable style={styles.saveButton} onPress={onSave}><Text style={styles.primaryText}>{saving ? 'Salvando…' : 'Salvar'}</Text></Pressable></View>; }

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 22, padding: 17, backgroundColor: '#F2D875', borderWidth: 1, borderColor: '#E1BD3F' }, heroIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' }, heroTitle: { color: '#111318', fontSize: 17, fontWeight: '800' }, heroText: { color: '#5C4A18', fontSize: 12, lineHeight: 18 }, grow: { flex: 1, gap: 3 }, error: { color: colors.dangerText, backgroundColor: colors.dangerBg, padding: 12, borderRadius: 12 },
  metrics: { flexDirection: 'row', gap: 8 }, metric: { flex: 1, padding: 12, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }, metricDanger: { borderColor: '#E7A4A4' }, metricValue: { color: colors.text, fontSize: 22, fontWeight: '900' }, metricLabel: { color: colors.mutedText, fontSize: 11 }, infoCard: { flexDirection: 'row', gap: 10, padding: 15, borderRadius: 18, backgroundColor: colors.infoBg }, infoTitle: { color: colors.infoText, fontWeight: '800' }, infoText: { color: colors.infoText, fontSize: 12, lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: 9 }, primaryButton: { minHeight: 50, flex: 1, borderRadius: 15, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink950 }, primaryText: { color: '#FFF', fontWeight: '800' }, secondaryIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  teamCard: { gap: 12, padding: 15, borderRadius: 20, backgroundColor: colors.surfaceSubtle }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, cardTitle: { color: colors.text, fontSize: 17, fontWeight: '800' }, muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 }, addButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.card }, memberCard: { gap: 9, padding: 13, borderRadius: 17, backgroundColor: colors.card, ...shadows.sm }, memberTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 45, height: 45, borderRadius: 14 }, avatarFallback: { width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }, initial: { color: colors.primaryStrong, fontSize: 18, fontWeight: '900' }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, memberName: { color: colors.text, fontWeight: '800' }, leaderBadge: { color: '#72550A', backgroundColor: '#FFF0B5', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, fontSize: 10, fontWeight: '800' }, operationalRow: { flexDirection: 'row', justifyContent: 'space-between' }, eventCount: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' }, conflict: { color: colors.dangerText, fontSize: 11, fontWeight: '800' }, nextEvent: { color: colors.mutedText, fontSize: 11 }, memberActions: { flexDirection: 'row', alignItems: 'center', gap: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 9 }, link: { color: colors.primaryStrong, fontSize: 12, fontWeight: '800' }, accessLink: { color: colors.infoText, fontSize: 12, fontWeight: '800' },
  empty: { gap: 10, padding: 22, borderRadius: 20, backgroundColor: colors.card }, overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,9,14,0.65)' }, sheet: { maxHeight: '92%', gap: 12, padding: 20, paddingBottom: 34, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.card }, sheetTitle: { color: colors.text, fontSize: 22, fontWeight: '800' }, input: { minHeight: 50, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.background }, photoPicker: { alignSelf: 'center', alignItems: 'center', gap: 5 }, photoPreview: { width: 72, height: 72, borderRadius: 22 }, teamChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, teamChoice: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 99, backgroundColor: colors.surfaceSubtle }, teamChoiceActive: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryStrong }, chipText: { color: colors.text, fontSize: 11, fontWeight: '700' }, modalActions: { flexDirection: 'row', gap: 9 }, cancelButton: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border }, cancelText: { color: colors.text, fontWeight: '700' }, saveButton: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.ink950 },
});
