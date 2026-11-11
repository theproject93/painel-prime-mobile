import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { useUserRole } from '../contexts/UserRoleContext';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { earnedAchievement, missionStatus, visibleMissions, type AdoptionSnapshot, type Mission } from '../features/adoption/adoptionModel';
import { saveAdoptionProgress, verifyAdoption } from '../features/adoption/adoptionRepository';

type EventOption = { id: string; name: string };
type ViewMode = 'missions' | 'achievements';

export function AdoptionMissionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isTeamMemberOnly, assignedEvents, loading: roleLoading } = useUserRole();
  const [eventId, setEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [snapshot, setSnapshot] = useState<AdoptionSnapshot | null>(null);
  const [view, setView] = useState<ViewMode>('missions');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const userId = user?.id ?? null;
  const identity = `${userId ?? ''}:${isTeamMemberOnly ? 'equipe' : 'assessoria'}:${eventId ?? ''}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;

  useEffect(() => {
    setEventId(null);
    setSnapshot(null);
    setSelected(null);
    setEvents([]);
    request.current++;
  }, [userId, isTeamMemberOnly]);

  useEffect(() => {
    if (!userId || roleLoading) return;
    if (isTeamMemberOnly) {
      setEvents(assignedEvents.map(event => ({ id: event.id, name: event.name })));
      return;
    }
    let cancelled = false;
    void supabase.from('events').select('id, name').neq('status', 'deleted').order('event_date', { ascending: false }).limit(50)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) { setError('Não foi possível carregar os eventos.'); return; }
        setEvents((data ?? []).filter(row => typeof row.id === 'string' && typeof row.name === 'string'));
      });
    return () => { cancelled = true; };
  }, [userId, isTeamMemberOnly, assignedEvents, roleLoading]);

  const refresh = useCallback(async () => {
    if (!userId || roleLoading || (isTeamMemberOnly && eventId === null)) {
      setSnapshot(null);
      return;
    }
    const sequence = ++request.current;
    const requestedIdentity = identity;
    setBusy(true);
    setError('');
    try {
      const next = await verifyAdoption(userId, eventId, isTeamMemberOnly);
      if (request.current === sequence && identityRef.current === requestedIdentity) setSnapshot(next);
    } catch {
      if (request.current === sequence && identityRef.current === requestedIdentity) {
        setSnapshot(null);
        setError('Não foi possível carregar suas missões. Tente novamente.');
      }
    } finally {
      if (request.current === sequence && identityRef.current === requestedIdentity) setBusy(false);
    }
  }, [userId, eventId, isTeamMemberOnly, roleLoading, identity]);

  useFocusEffect(useCallback(() => { void refresh(); return () => { request.current++; }; }, [refresh]));

  const chooseEvent = (id: string | null) => {
    request.current++;
    setSnapshot(null);
    setSelected(null);
    setBusy(false);
    setEventId(id);
  };

  const changeProgress = async (mission: Mission, status: 'active' | 'paused' | 'dismissed' | 'presented') => {
    if (!userId || !snapshot || busy || (mission.eventScoped && !eventId)) return;
    const current = snapshot.progress.find(row => row.journey_id === mission.id);
    const activeIdentity = identity;
    setBusy(true);
    setError('');
    try {
      await saveAdoptionProgress(userId, eventId, isTeamMemberOnly, mission.id, status, current);
      if (identityRef.current === activeIdentity) await refresh();
    } catch {
      if (identityRef.current === activeIdentity) setError('Não foi possível salvar a orientação. Atualize e tente novamente.');
    } finally {
      if (identityRef.current === activeIdentity) setBusy(false);
    }
  };

  const openWork = (mission: Mission) => {
    if (mission.eventScoped && !eventId) { setError('Escolha um evento para continuar.'); return; }
    if (!mission.route) { setError('Esta atividade ainda não tem atalho no aplicativo.'); return; }
    const route = mission.eventScoped ? `/eventos/${eventId}?initialTab=${mission.route}` : mission.route;
    router.push(route as never);
  };

  const missions = snapshot ? visibleMissions(snapshot) : [];
  const achievements = missions.filter(item => item.achievement);
  const current = missions.find(item => item.id === selected);

  return <Screen title="Missões e conquistas" subtitle="Seu progresso é verificado na plataforma" showBack>
    <View style={styles.tabs}>
      {(['missions', 'achievements'] as const).map(mode => <Pressable key={mode} style={[styles.tab, view === mode && styles.tabActive]}
        onPress={() => { setView(mode); setSelected(null); }} accessibilityRole="tab" accessibilityState={{ selected: view === mode }}>
        <Text style={[styles.tabText, view === mode && styles.tabTextActive]}>{mode === 'missions' ? 'Missões' : 'Conquistas'}</Text>
      </Pressable>)}
    </View>

    <Text style={styles.sectionLabel}>Contexto do evento</Text>
    <View style={styles.eventChoices}>
      {!isTeamMemberOnly && <Pressable style={[styles.choice, !eventId && styles.choiceActive]} onPress={() => chooseEvent(null)}><Text style={styles.choiceText}>Assessoria</Text></Pressable>}
      {events.map(event => <Pressable key={event.id} style={[styles.choice, eventId === event.id && styles.choiceActive]}
        onPress={() => chooseEvent(event.id)} accessibilityLabel={`Selecionar evento ${event.name}`}><Text style={styles.choiceText} numberOfLines={1}>{event.name}</Text></Pressable>)}
    </View>
    {isTeamMemberOnly && !eventId && <Text style={styles.hint}>Escolha um evento da sua escala para ver as orientações disponíveis.</Text>}
    {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    {busy && <ActivityIndicator color={colors.primaryStrong} accessibilityLabel="Atualizando missões" />}
    <Pressable style={styles.refresh} onPress={() => void refresh()} disabled={busy || !userId} accessibilityRole="button"><Ionicons name="refresh" size={18} color={colors.primaryStrong} /><Text style={styles.refreshText}>Atualizar resultados</Text></Pressable>

    {snapshot && view === 'missions' && missions.map(mission => {
      const status = missionStatus(mission, snapshot);
      const expanded = selected === mission.id;
      return <View key={mission.id} style={styles.card}>
        <Pressable style={styles.cardHeader} onPress={() => setSelected(expanded ? null : mission.id)} accessibilityRole="button" accessibilityLabel={`${mission.title}. ${status}`}>
          <View style={styles.cardCopy}><Text style={styles.cardTitle}>{mission.title}</Text><Text style={styles.status}>{status}</Text></View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={19} color={colors.textSecondary} />
        </Pressable>
        {expanded && <View style={styles.details}>
          <Text style={styles.description}>{mission.instruction}</Text>
          {mission.achievement && <Text style={styles.criterion}>Conquista: {mission.achievement}</Text>}
          <View style={styles.actions}>
            <Action label="Ir para a atividade" onPress={() => openWork(mission)} disabled={!mission.route || Boolean(mission.eventScoped && !eventId)} />
            <Action label="Iniciar orientação" onPress={() => void changeProgress(mission, 'active')} disabled={busy || Boolean(mission.eventScoped && !eventId)} />
            <Action label={mission.orientation ? 'Marcar orientação como vista' : 'Pausar orientação'}
              onPress={() => void changeProgress(mission, mission.orientation ? 'presented' : 'paused')} disabled={busy || Boolean(mission.eventScoped && !eventId)} />
            {!mission.orientation && <Action label="Ignorar missão" onPress={() => void changeProgress(mission, 'dismissed')} disabled={busy || Boolean(mission.eventScoped && !eventId)} />}
          </View>
          <Text style={styles.disclaimer}>A orientação não conclui a missão. O resultado é verificado no servidor.</Text>
        </View>}
      </View>;
    })}
    {snapshot && view === 'achievements' && (achievements.length ? achievements.map(mission => {
      const earned = earnedAchievement(mission, snapshot);
      return <View key={mission.id} style={styles.card}>
        <View style={styles.achievementRow}><Ionicons name={earned ? 'ribbon' : 'ribbon-outline'} size={28} color={earned ? colors.gold600 : colors.mutedText} />
          <View style={styles.cardCopy}><Text style={styles.cardTitle}>{mission.achievement}</Text><Text style={styles.status}>{earned ? 'Conquistada' : mission.eventScoped && !eventId ? 'Escolha um evento' : 'Ainda não conquistada'}</Text></View></View>
        <Text style={styles.description}>{mission.criterion ?? mission.instruction}</Text>
        {earned && <Text style={styles.criterion}>Verificada em {new Date(earned.earned_at).toLocaleDateString('pt-BR')}</Text>}
      </View>;
    }) : <Text style={styles.hint}>Nenhuma conquista disponível neste contexto.</Text>)}
    {snapshot && !missions.length && <Text style={styles.hint}>Nenhuma missão disponível para seu perfil neste contexto.</Text>}
    {current && <Text style={styles.footer}>As conquistas refletem resultados reais da assessoria, do evento ou da sua conta.</Text>}
  </Screen>;
}

function Action({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable style={[styles.action, disabled && styles.disabled]} onPress={onPress} disabled={disabled} accessibilityRole="button"><Text style={styles.actionText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8 }, tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surfaceSubtle }, tabActive: { backgroundColor: colors.primarySoft }, tabText: { color: colors.textSecondary, fontWeight: '700' }, tabTextActive: { color: colors.primaryStrong },
  sectionLabel: { color: colors.text, fontWeight: '700', marginTop: 8 }, eventChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { minHeight: 44, maxWidth: '100%', paddingHorizontal: 14, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, choiceActive: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft }, choiceText: { color: colors.text, fontWeight: '600' },
  hint: { color: colors.textSecondary, lineHeight: 21 }, error: { padding: 12, borderRadius: 12, backgroundColor: colors.dangerBg, color: colors.dangerText }, refresh: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }, refreshText: { color: colors.primaryStrong, fontWeight: '700' },
  card: { padding: 16, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 10 }, cardHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }, cardCopy: { flex: 1, gap: 4 }, cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' }, status: { color: colors.primaryStrong, fontSize: 13, fontWeight: '600' }, details: { gap: 10 }, description: { color: colors.textSecondary, lineHeight: 21 }, criterion: { color: colors.textSecondary, fontSize: 13 }, disclaimer: { color: colors.mutedText, fontSize: 12, lineHeight: 18 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.primarySoft }, actionText: { color: colors.primaryStrong, fontWeight: '700' }, disabled: { opacity: 0.45 }, achievementRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, footer: { color: colors.mutedText, fontSize: 12 },
});
