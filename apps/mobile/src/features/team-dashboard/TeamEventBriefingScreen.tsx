import React, { useState, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useUserRole } from '../../contexts/UserRoleContext';
import { supabase } from '../../lib/supabase';
import { colors, shadows } from '../../theme/colors';
import { AppHaptics } from '../../lib/haptics';

interface TeamMemberRow {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  photo_url: string | null;
  is_leader: boolean;
  team_name?: string | null;
}

interface TimelineActivity {
  id: string;
  time: string;
  activity: string;
  description: string | null;
  assignee_name: string | null;
  position: number;
}

const EVENT_TYPE_COVERS: Record<string, string> = {
  wedding: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
  casamento: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
  birthday: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=800&q=80',
  aniversario: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=800&q=80',
  debutante: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
  corporate: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
  corporativo: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
  generic: 'https://images.unsplash.com/photo-1507501336603-6e31db2be093?auto=format&fit=crop&w=800&q=80',
};

export function TeamEventBriefingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; initialTab?: string }>();
  const eventId = Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '';
  const { assignedEvents } = useUserRole();

  // Controla se a aba ativa é 'briefing' (informações estratégicas) ou 'timeline' (roteiro do dia)
  const [activeTab, setActiveTab] = useState<'briefing' | 'timeline'>(
    params.initialTab === 'timeline' ? 'timeline' : 'briefing',
  );

  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [timelineActivities, setTimelineActivities] = useState<TimelineActivity[]>([]);

  // Localiza o evento na lista de eventos atribuídos do contexto
  const event = useMemo(() => {
    return assignedEvents.find((e) => e.id === eventId) ?? null;
  }, [assignedEvents, eventId]);

  // Se a rota receber initialTab alterada, sincroniza a aba
  useEffect(() => {
    if (params.initialTab === 'timeline') {
      setActiveTab('timeline');
    }
  }, [params.initialTab]);

  // Carrega a equipe e o cronograma do dia para este evento
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!eventId) {
        setLoading(false);
        return;
      }
      try {
        // 1. Tenta carregar via RPC autorizada para membros da equipe
        const { data: snapshotData, error: rpcError } = await supabase.rpc(
          'get_team_member_event_snapshot',
          { p_event_id: eventId },
        );

        if (!rpcError && snapshotData) {
          if (snapshotData.team && isMounted) {
            setTeamMembers(snapshotData.team as TeamMemberRow[]);
          }
          if (snapshotData.timeline && isMounted) {
            setTimelineActivities(snapshotData.timeline as TimelineActivity[]);
          }
        } else {
          // 2. Fallback: consulta direta nas tabelas operacionais
          const [teamRes, timelineRes] = await Promise.all([
            supabase
              .from('event_team_members')
              .select('id, name, role, phone, photo_url, is_leader, team_name')
              .eq('event_id', eventId)
              .order('is_leader', { ascending: false }),
            supabase
              .from('event_timeline')
              .select('id, time, activity, description, assignee_name, position')
              .eq('event_id', eventId)
              .order('position', { ascending: true })
              .order('time', { ascending: true }),
          ]);

          if (teamRes.data && isMounted) {
            setTeamMembers(teamRes.data as TeamMemberRow[]);
          }
          if (timelineRes.data && isMounted) {
            setTimelineActivities(timelineRes.data as TimelineActivity[]);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar dados operacionais do evento:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, [eventId]);

  // Identifica o líder da equipe
  const leader = useMemo(() => {
    return teamMembers.find((m) => m.is_leader) ?? null;
  }, [teamMembers]);

  // Formatação de data e horários
  const dateFormatted = useMemo(() => {
    if (!event?.event_date) return 'Data a confirmar';
    try {
      const d = new Date(event.event_date);
      return d.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return event.event_date;
    }
  }, [event?.event_date]);

  const startTimeStr = useMemo(() => {
    if (!event?.event_date) return '14:00';
    try {
      const d = new Date(event.event_date);
      const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return time === '00:00' ? '14:00 (Início da escala)' : time;
    } catch {
      return '14:00';
    }
  }, [event?.event_date]);

  const endTimeStr = useMemo(() => {
    if (!event?.event_date) return '23:00';
    try {
      const d = new Date(event.event_date);
      d.setHours(d.getHours() + 8);
      const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return time === '00:00' ? '23:00 (Fim previsto)' : time;
    } catch {
      return '23:00';
    }
  }, [event?.event_date]);

  // Ação: Abrir rota no Google Maps / Waze
  const handleOpenMaps = async () => {
    void AppHaptics.medium();
    const destination = event?.location || event?.location_city || '';
    if (!destination) {
      Alert.alert('Local Indisponível', 'O endereço deste evento ainda não foi informado.');
      return;
    }

    const encoded = encodeURIComponent(destination);
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
    const wazeUrl = `https://waze.com/ul?q=${encoded}&navigate=yes`;

    try {
      const canOpenWaze = await Linking.canOpenURL('waze://');
      if (canOpenWaze) {
        await Linking.openURL(wazeUrl);
      } else {
        await Linking.openURL(googleMapsUrl);
      }
    } catch {
      await Linking.openURL(googleMapsUrl);
    }
  };

  // Ação: Salvar na Agenda do Celular (sem erros de intent)
  const handleSaveToCalendar = async () => {
    void AppHaptics.success();
    if (!event) return;

    try {
      const startDate = new Date(event.event_date);
      const startTime = isNaN(startDate.getTime()) ? Date.now() : startDate.getTime();
      const endTime = startTime + 8 * 60 * 60 * 1000;

      // No Android, URI do content provider para abrir a agenda do aparelho no dia
      const androidCalendarTimeUri = `content://com.android.calendar/time/${startTime}`;

      const formatGCalDate = (ts: number) => {
        const d = new Date(ts);
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };

      const gcalModernUrl = `https://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(
        event.name,
      )}&dates=${formatGCalDate(startTime)}/${formatGCalDate(endTime)}&details=${encodeURIComponent(
        `Escala Painel Prime - Função: ${event.role || 'Equipe Operacional'}`,
      )}&location=${encodeURIComponent(event.location || event.location_city || '')}`;

      let opened = false;

      // 1. No Android, tenta abrir a visualização da data na agenda do dispositivo
      if (Platform.OS === 'android') {
        try {
          const supported = await Linking.canOpenURL(androidCalendarTimeUri);
          if (supported) {
            await Linking.openURL(androidCalendarTimeUri);
            opened = true;
          }
        } catch {
          // Prossegue para a URL web moderna se o esquema nativo não responder
        }
      }

      // 2. Fallback: abre no Google Agenda web moderno
      if (!opened) {
        await Linking.openURL(gcalModernUrl);
      }
    } catch (err) {
      console.warn('Erro ao abrir calendário:', err);
      Alert.alert(
        'Agenda',
        `Evento: ${event.name}\nData: ${dateFormatted}\nLocal: ${event.location || 'A definir'}`,
      );
    }
  };

  // Ação: Contatar líder no WhatsApp
  const handleContactLeader = (phone: string | null) => {
    void AppHaptics.light();
    if (!phone) {
      Alert.alert('Contato', 'Telefone do líder não informado.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
      `Olá! Estou na equipe do evento "${event?.name || 'Evento'}" e gostaria de alinhar detalhes operacionais.`,
    )}`;
    void Linking.openURL(url);
  };

  const coverUri =
    EVENT_TYPE_COVERS[event?.event_type?.toLowerCase() || 'generic'] ||
    EVENT_TYPE_COVERS.generic;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.loadingText}>Carregando informações do evento...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Barra Superior */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {activeTab === 'timeline' ? 'Roteiro do Dia' : 'Informações do Evento'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Seletor de Abas: Briefing vs Roteiro do Dia */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabButton, activeTab === 'briefing' && styles.tabButtonActive]}
          onPress={() => {
            void AppHaptics.selection();
            setActiveTab('briefing');
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'briefing' }}
          accessibilityLabel="Aba de Informações do Evento"
        >
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={activeTab === 'briefing' ? '#111318' : '#94A3B8'}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'briefing' && styles.tabButtonTextActive]}
          >
            Informações
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'timeline' && styles.tabButtonActive]}
          onPress={() => {
            void AppHaptics.selection();
            setActiveTab('timeline');
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'timeline' }}
          accessibilityLabel="Aba de Roteiro do Dia"
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={activeTab === 'timeline' ? '#111318' : '#94A3B8'}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'timeline' && styles.tabButtonTextActive]}
          >
            Roteiro do Dia ({timelineActivities.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Card de Capa do Evento */}
        <View style={styles.heroCard}>
          <Image source={{ uri: coverUri }} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            {Boolean(event?.team_name) && (
              <View style={styles.teamBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#D4AF37" />
                <Text style={styles.teamBadgeText}>{event?.team_name}</Text>
              </View>
            )}
            <Text style={styles.eventName}>{event?.name || 'Evento'}</Text>
            <Text style={styles.eventDateText}>{dateFormatted}</Text>
          </View>
        </View>

        {activeTab === 'briefing' ? (
          <>
            {/* 1. Card de Expediente & Agenda */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: 'rgba(212, 175, 55, 0.15)' }]}>
                  <Ionicons name="time-outline" size={18} color="#D4AF37" />
                </View>
                <Text style={styles.sectionTitle}>Horários do Expediente</Text>
              </View>

              <View style={styles.scheduleRow}>
                <View style={styles.scheduleBlock}>
                  <Text style={styles.scheduleLabel}>Chegada / Briefing</Text>
                  <Text style={styles.scheduleTime}>{startTimeStr}</Text>
                </View>

                <View style={styles.scheduleDivider} />

                <View style={styles.scheduleBlock}>
                  <Text style={styles.scheduleLabel}>Término Previsto</Text>
                  <Text style={styles.scheduleTime}>{endTimeStr}</Text>
                </View>
              </View>

              {/* Botão para salvar na agenda */}
              <Pressable
                style={({ pressed }) => [styles.calendarButton, pressed && styles.btnPressed]}
                onPress={() => void handleSaveToCalendar()}
                accessibilityRole="button"
                accessibilityLabel="Adicionar escala à agenda do celular"
              >
                <Ionicons name="calendar" size={16} color="#0B0F19" />
                <Text style={styles.calendarButtonText}>Adicionar à Agenda do Celular</Text>
              </Pressable>
            </View>

            {/* 2. Card de Localização & Rota GPS */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                  <Ionicons name="location-outline" size={18} color="#38BDF8" />
                </View>
                <Text style={styles.sectionTitle}>Localização & Rota</Text>
              </View>

              <Text style={styles.venueName}>
                {event?.location || 'Local a confirmar'}
              </Text>
              <Text style={styles.venueCity}>
                {event?.location_city ? `${event.location_city} - SP` : 'São Paulo - SP'}
              </Text>

              <Pressable
                style={({ pressed }) => [styles.routeButton, pressed && styles.btnPressed]}
                onPress={() => void handleOpenMaps()}
                accessibilityRole="button"
                accessibilityLabel="Abrir rota no Google Maps ou Waze"
              >
                <Ionicons name="navigate-outline" size={17} color="#FFFFFF" />
                <Text style={styles.routeButtonText}>Abrir Rota no Google Maps / Waze</Text>
              </Pressable>
            </View>

            {/* 3. Card do Líder da Equipe */}
            {leader ? (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconWrap, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                    <Ionicons name="star-outline" size={18} color="#22C55E" />
                  </View>
                  <Text style={styles.sectionTitle}>Líder da Equipe</Text>
                </View>

                <View style={styles.leaderRow}>
                  <View style={styles.leaderAvatar}>
                    <Ionicons name="person" size={20} color="#D4AF37" />
                  </View>
                  <View style={styles.leaderInfo}>
                    <Text style={styles.leaderName}>{leader.name}</Text>
                    <Text style={styles.leaderRole}>{leader.role || 'Coordenação Operacional'}</Text>
                  </View>

                  {leader.phone ? (
                    <Pressable
                      style={styles.whatsappBtn}
                      onPress={() => handleContactLeader(leader.phone)}
                      accessibilityRole="button"
                      accessibilityLabel={`Falar com líder ${leader.name} no WhatsApp`}
                    >
                      <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                      <Text style={styles.whatsappBtnText}>WhatsApp</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* 4. Lista dos Colegas Escalados */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                  <Ionicons name="people-outline" size={18} color="#C084FC" />
                </View>
                <Text style={styles.sectionTitle}>
                  Equipe Escalada ({teamMembers.length})
                </Text>
              </View>

              {teamMembers.length === 0 ? (
                <Text style={styles.emptyTeamText}>
                  A lista completa de colegas escalados será exibida assim que confirmada pela assessoria.
                </Text>
              ) : (
                teamMembers.map((member) => (
                  <View key={member.id} style={styles.teamMemberRow}>
                    <View style={styles.memberAvatar}>
                      <Ionicons
                        name={member.is_leader ? 'shield-checkmark' : 'person-outline'}
                        size={16}
                        color={member.is_leader ? '#D4AF37' : '#94A3B8'}
                      />
                    </View>
                    <View style={styles.memberInfo}>
                      <View style={styles.memberHeaderRow}>
                        <Text style={styles.memberName}>{member.name}</Text>
                        {member.is_leader && (
                          <View style={styles.leaderTag}>
                            <Text style={styles.leaderTagText}>LÍDER</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.memberRole}>{member.role || 'Operação e Apoio'}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* 5. Ações Rápidas no Rodapé */}
            <View style={styles.actionsFooter}>
              <Pressable
                style={({ pressed }) => [styles.portariaHeroBtn, pressed && styles.btnPressed]}
                onPress={() => {
                  void AppHaptics.medium();
                  router.push(`/eventos/${eventId}/portaria`);
                }}
                accessibilityRole="button"
                accessibilityLabel="Abrir Portaria Prime"
              >
                <Ionicons name="qr-code-outline" size={22} color="#0B0F19" />
                <Text style={styles.portariaHeroBtnText}>Abrir Portaria Prime</Text>
                <Ionicons name="chevron-forward" size={18} color="#0B0F19" />
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.timelineBtn, pressed && styles.btnPressed]}
                onPress={() => {
                  void AppHaptics.light();
                  setActiveTab('timeline');
                }}
                accessibilityRole="button"
                accessibilityLabel="Ver cronograma do dia"
              >
                <Ionicons name="calendar-outline" size={18} color="#CBD5E1" />
                <Text style={styles.timelineBtnText}>Ver Cronograma do Dia</Text>
              </Pressable>
            </View>
          </>
        ) : (
          /* ABA DO ROTEIRO DO DIA (CRONOGRAMA REAL DO EVENTO) */
          <View style={styles.timelineSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Roteiro Oficial do Evento</Text>
              <View style={styles.timelineCountBadge}>
                <Text style={styles.timelineCountBadgeText}>
                  {timelineActivities.length}{' '}
                  {timelineActivities.length === 1 ? 'ATIVIDADE' : 'ATIVIDADES'}
                </Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>
              Acompanhe os horários e responsabilidades de cada etapa do grande dia.
            </Text>

            {timelineActivities.length === 0 ? (
              <View style={styles.emptyTimelineCard}>
                <Ionicons name="time-outline" size={36} color="#64748B" />
                <Text style={styles.emptyTimelineTitle}>Cronograma em Definição</Text>
                <Text style={styles.emptyTimelineDesc}>
                  A assessoria está organizando os detalhes do roteiro deste evento. Assim que
                  as atividades forem adicionadas, elas aparecerão aqui em tempo real.
                </Text>
              </View>
            ) : (
              <View style={styles.timelineList}>
                {timelineActivities.map((act, index) => (
                  <View key={act.id || index} style={styles.timelineItemCard}>
                    <View style={styles.timelineTimeWrap}>
                      <View style={styles.timeBadge}>
                        <Ionicons name="time-outline" size={13} color="#D4AF37" />
                        <Text style={styles.timeBadgeText}>
                          {act.time ? act.time.slice(0, 5) : '--:--'}
                        </Text>
                      </View>
                      {index < timelineActivities.length - 1 && <View style={styles.timelineLine} />}
                    </View>

                    <View style={styles.timelineActivityBody}>
                      <Text style={styles.timelineActivityTitle}>{act.activity}</Text>
                      {Boolean(act.description) && (
                        <Text style={styles.timelineActivityDesc}>{act.description}</Text>
                      )}
                      {Boolean(act.assignee_name) && (
                        <View style={styles.assigneeBadge}>
                          <Ionicons name="person-outline" size={11} color="#38BDF8" />
                          <Text style={styles.assigneeBadgeText}>
                            Responsável: {act.assignee_name}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Botão de Atalho para Portaria Prime */}
            <Pressable
              style={({ pressed }) => [styles.portariaHeroBtn, pressed && styles.btnPressed, { marginTop: 20 }]}
              onPress={() => {
                void AppHaptics.medium();
                router.push(`/eventos/${eventId}/portaria`);
              }}
              accessibilityRole="button"
              accessibilityLabel="Abrir Portaria Prime"
            >
              <Ionicons name="qr-code-outline" size={22} color="#0B0F19" />
              <Text style={styles.portariaHeroBtnText}>Abrir Portaria Prime</Text>
              <Ionicons name="chevron-forward" size={18} color="#0B0F19" />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backBtn: {
    padding: 6,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 14,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#F2D875',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tabButtonTextActive: {
    color: '#111318',
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
    justifyContent: 'flex-end',
    ...shadows.card,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  heroContent: {
    padding: 18,
    gap: 4,
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  teamBadgeText: {
    color: '#F2D875',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  eventName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  eventDateText: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  sectionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 14,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  scheduleBlock: {
    alignItems: 'center',
    gap: 4,
  },
  scheduleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  scheduleTime: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scheduleDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#334155',
    marginHorizontal: 8,
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D4AF37',
    paddingVertical: 12,
    borderRadius: 12,
    ...shadows.sm,
  },
  calendarButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B0F19',
  },
  venueName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  venueCity: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 12,
  },
  routeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 12,
    ...shadows.sm,
  },
  routeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 14,
  },
  leaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderInfo: {
    flex: 1,
    gap: 2,
  },
  leaderName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leaderRole: {
    fontSize: 12,
    color: '#D4AF37',
    fontWeight: '600',
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  whatsappBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyTeamText: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    paddingVertical: 4,
  },
  teamMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leaderTag: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  leaderTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D4AF37',
  },
  memberRole: {
    fontSize: 11,
    color: '#94A3B8',
  },
  actionsFooter: {
    gap: 10,
    marginTop: 6,
  },
  portariaHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4AF37',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    ...shadows.card,
  },
  portariaHeroBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0B0F19',
    flex: 1,
    marginLeft: 10,
  },
  timelineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timelineBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  timelineSection: {
    marginTop: 4,
  },
  timelineCountBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  timelineCountBadgeText: {
    color: '#F2D875',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyTimelineCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyTimelineTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 4,
  },
  emptyTimelineDesc: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  timelineList: {
    gap: 10,
  },
  timelineItemCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  timelineTimeWrap: {
    alignItems: 'center',
    width: 64,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  timeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F2D875',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#334155',
    marginTop: 6,
  },
  timelineActivityBody: {
    flex: 1,
    gap: 4,
  },
  timelineActivityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timelineActivityDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  assigneeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  assigneeBadgeText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
  },
});
