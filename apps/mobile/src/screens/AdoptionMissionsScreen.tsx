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
const MISSION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  overview: 'compass-outline', agency: 'business-outline', event: 'calendar-outline', client: 'person-add-outline',
  contract: 'document-text-outline', guests: 'people-outline', vendors: 'storefront-outline',
  timeline: 'time-outline', tasks: 'checkbox-outline', finance: 'wallet-outline', team: 'people-circle-outline',
  reception: 'checkmark-circle-outline', ai: 'sparkles-outline', rsvp: 'chatbubbles-outline',
  'vendor-profile': 'id-card-outline', 'assigned-timeline': 'time-outline', 'assigned-reception': 'checkmark-circle-outline',
};

export function AdoptionMissionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isTeamMemberOnly, assignedEvents, loading: roleLoading } = useUserRole();
  const [eventId, setEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventOption[]>([]);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const [snapshot, setSnapshot] = useState<AdoptionSnapshot | null>(null);
  const tenantId = snapshot?.tenant_id ?? null;
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
    setBusy(false);
    request.current++;
  }, [userId, isTeamMemberOnly]);

  useEffect(() => {
    if (!userId || roleLoading) return;
    if (isTeamMemberOnly) {
      setEvents(assignedEvents.map(event => ({ id: event.id, name: event.name })));
      return;
    }
    if (!tenantId) return;
    let cancelled = false;
    void supabase.from('events').select('id, name').eq('tenant_id', tenantId).neq('status', 'deleted').order('event_date', { ascending: false }).limit(50)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) { setError('Não foi possível carregar os eventos.'); return; }
        setEvents((data ?? []).filter(row => typeof row.id === 'string' && typeof row.name === 'string'));
      });
    return () => { cancelled = true; };
  }, [userId, isTeamMemberOnly, assignedEvents, roleLoading, tenantId]);

  const refresh = useCallback(async () => {
    if (!userId || roleLoading || (isTeamMemberOnly && eventId === null)) {
      setSnapshot(null);
      setBusy(false);
      return;
    }
    const sequence = ++request.current;
    const requestedIdentity = identity;
    setBusy(true);
    setError('');
    try {
      if (eventId && !eventsRef.current.some(event => event.id === eventId)) throw new Error('Evento indisponível');
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
      if (eventId && !events.some(event => event.id === eventId)) throw new Error('Evento indisponível');
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
    if (eventId && !events.some(event => event.id === eventId)) { setError('Este evento não está disponível.'); return; }
    if (!mission.route) { setError('Esta atividade ainda não tem atalho no aplicativo.'); return; }
    const route = mission.eventScoped ? `/eventos/${encodeURIComponent(eventId!)}?initialTab=${encodeURIComponent(mission.route)}` : mission.route;
    router.push(route as never);
  };

  const missions = snapshot ? visibleMissions(snapshot) : [];
  const achievements = missions.filter(item => item.achievement);
  const earnedCount = snapshot ? achievements.filter(item => earnedAchievement(item, snapshot)).length : 0;
  const current = missions.find(item => item.id === selected);

  return <Screen title="Missões e conquistas" subtitle="Seu progresso é verificado na plataforma" showBack onBack={() => router.replace('/mais' as never)}>
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.heroIcon}><Ionicons name="trophy" size={31} color={colors.gold700} /></View>
        <Ionicons name="sparkles" size={24} color={colors.gold600} />
      </View>
      <Text style={styles.heroTitle}>{isTeamMemberOnly ? 'Sua escala, seu próximo passo' : 'Sua jornada merece destaque'}</Text>
      <Text style={styles.heroDescription}>{isTeamMemberOnly ? 'Acompanhe as orientações do evento em que você está escalado.' : 'Avance nas missões e veja suas conquistas confirmadas pela plataforma.'}</Text>
      <View style={styles.heroStats}>
        <View style={styles.heroStat}><Ionicons name="flag-outline" size={17} color={colors.gold700} /><Text style={styles.heroStatText}>{missions.length} {isTeamMemberOnly ? 'orientações' : 'missões'}</Text></View>
        {!isTeamMemberOnly && <View style={styles.heroStat}><Ionicons name="ribbon-outline" size={17} color={colors.gold700} /><Text style={styles.heroStatText}>{earnedCount} {earnedCount === 1 ? 'conquista' : 'conquistas'}</Text></View>}
      </View>
      {!isTeamMemberOnly && achievements.length > 0 && <View style={styles.progressTrack} accessibilityLabel={`${earnedCount} de ${achievements.length} conquistas verificadas`}><View style={[styles.progressFill, { width: `${Math.round(earnedCount / achievements.length * 100)}%` }]} /></View>}
    </View>
    <View style={styles.tabs}>
      {(['missions', 'achievements'] as const).map(mode => <Pressable key={mode} style={[styles.tab, view === mode && styles.tabActive]}
        onPress={() => { setView(mode); setSelected(null); }} accessibilityRole="tab" accessibilityState={{ selected: view === mode }}>
        <Ionicons name={mode === 'missions' ? 'flag-outline' : 'trophy-outline'} size={18} color={view === mode ? colors.gold700 : colors.textSecondary} />
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
          <View style={styles.missionIcon}><Ionicons name={MISSION_ICONS[mission.id] ?? 'flag-outline'} size={22} color={colors.gold700} /></View>
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
      return <View key={mission.id} style={[styles.card, earned && styles.earnedCard]}>
        <View style={styles.achievementRow}><View style={[styles.achievementIcon, earned && styles.earnedIcon]}><Ionicons name={earned ? 'trophy' : 'trophy-outline'} size={25} color={earned ? colors.gold700 : colors.mutedText} /></View>
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
  hero: { padding: 20, borderRadius: 24, backgroundColor: colors.gold100, borderWidth: 1, borderColor: colors.gold200, gap: 10 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroIcon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.gold200 },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: '800', lineHeight: 27 },
  heroDescription: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  heroStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.card },
  heroStatText: { color: colors.gold700, fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 7, overflow: 'hidden', borderRadius: 7, backgroundColor: colors.card, marginTop: 4 },
  progressFill: { height: '100%', borderRadius: 7, backgroundColor: colors.gold600 },
  tabs: { flexDirection: 'row', gap: 8 }, tab: { flex: 1, flexDirection: 'row', gap: 7, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surfaceSubtle }, tabActive: { backgroundColor: colors.gold100, borderWidth: 1, borderColor: colors.gold200 }, tabText: { color: colors.textSecondary, fontWeight: '700' }, tabTextActive: { color: colors.gold700 },
  sectionLabel: { color: colors.text, fontWeight: '700', marginTop: 8 }, eventChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { minHeight: 44, maxWidth: '100%', paddingHorizontal: 14, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, choiceActive: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft }, choiceText: { color: colors.text, fontWeight: '600' },
  hint: { color: colors.textSecondary, lineHeight: 21 }, error: { padding: 12, borderRadius: 12, backgroundColor: colors.dangerBg, color: colors.dangerText }, refresh: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }, refreshText: { color: colors.primaryStrong, fontWeight: '700' },
  card: { padding: 16, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 10 }, earnedCard: { backgroundColor: colors.gold50, borderColor: colors.gold200 }, cardHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 }, missionIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold50 }, cardCopy: { flex: 1, gap: 4 }, cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' }, status: { color: colors.gold700, fontSize: 13, fontWeight: '700' }, details: { gap: 10 }, description: { color: colors.textSecondary, lineHeight: 21 }, criterion: { color: colors.textSecondary, fontSize: 13 }, disclaimer: { color: colors.mutedText, fontSize: 12, lineHeight: 18 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.primarySoft }, actionText: { color: colors.primaryStrong, fontWeight: '700' }, disabled: { opacity: 0.45 }, achievementRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, achievementIcon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSubtle }, earnedIcon: { backgroundColor: colors.gold100 }, footer: { color: colors.mutedText, fontSize: 12 },
});
