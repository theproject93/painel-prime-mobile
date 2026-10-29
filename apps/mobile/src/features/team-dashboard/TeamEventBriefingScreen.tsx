import React, { useEffect, useState, useMemo } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';
import { useUserRole, type AssignedEvent } from '../../contexts/UserRoleContext';
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
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const eventId = Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '';
  const { assignedEvents } = useUserRole();

  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);

  // Localiza o evento na lista de eventos atribuídos do contexto
  const event = useMemo(() => {
    return assignedEvents.find((e) => e.id === eventId) ?? null;
  }, [assignedEvents, eventId]);

  // Carrega a equipe escalada para este evento
  useEffect(() => {
    let isMounted = true;
    async function loadTeam() {
      if (!eventId) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('event_team_members')
          .select('id, name, role, phone, photo_url, is_leader, team_name')
          .eq('event_id', eventId)
          .order('is_leader', { ascending: false });

        if (!error && data && isMounted) {
          setTeamMembers(data as TeamMemberRow[]);
        }
      } catch (err) {
        console.warn('Erro ao carregar equipe escalada do evento:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadTeam();
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
    const geoUrl = `geo:0,0?q=${encoded}`;

    try {
      const canGeo = Platform.OS === 'android' && (await Linking.canOpenURL(geoUrl));
      if (canGeo) {
        await Linking.openURL(geoUrl);
      } else {
        await Linking.openURL(googleMapsUrl);
      }
    } catch {
      await Linking.openURL(googleMapsUrl);
    }
  };

  // Ação: Salvar na Agenda do Android
  const handleSaveToCalendar = async () => {
    void AppHaptics.success();
    if (!event) return;

    try {
      const startDate = new Date(event.event_date);
      const startTime = isNaN(startDate.getTime()) ? Date.now() : startDate.getTime();
      const endTime = startTime + 8 * 60 * 60 * 1000;

      // Monta URL de Intent universal do Google Agenda
      const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        event.name,
      )}&dates=${new Date(startTime).toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${new Date(
        endTime,
      )
        .toISOString()
        .replace(/[-:]/g, '')
        .split('.')[0]}Z&details=${encodeURIComponent(
        `Escala de Trabalho Painel Prime - Função: ${event.role || 'Equipe Operacional'}`,
      )}&location=${encodeURIComponent(event.location || '')}`;

      await Linking.openURL(gcalUrl);
    } catch (err) {
      console.warn('Erro ao abrir calendário:', err);
      Alert.alert('Agenda', 'Não foi possível adicionar automaticamente à agenda.');
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
          Informações do Evento
        </Text>
        <View style={{ width: 40 }} />
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

        {/* 1. Card de Expediente & Agenda */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: 'rgba(212, 175, 55, 0.15)' }]}>
              <Ionicons name="time" size={18} color="#D4AF37" />
            </View>
            <Text style={styles.sectionTitle}>Horários do Expediente</Text>
          </View>

          <View style={styles.scheduleRow}>
            <View style={styles.scheduleBlock}>
              <Text style={styles.scheduleLabel}>Chegada / Briefing</Text>
              <Text style={styles.scheduleValue}>{startTimeStr}</Text>
            </View>
            <View style={styles.scheduleDivider} />
            <View style={styles.scheduleBlock}>
              <Text style={styles.scheduleLabel}>Término Previsto</Text>
              <Text style={styles.scheduleValue}>{endTimeStr}</Text>
            </View>
          </View>

          {/* Botão Salvar na Agenda do Android */}
          <Pressable
            style={({ pressed }) => [styles.calendarButton, pressed && styles.btnPressed]}
            onPress={() => void handleSaveToCalendar()}
            accessibilityRole="button"
            accessibilityLabel="Adicionar evento à agenda do celular"
          >
            <Ionicons name="calendar-outline" size={18} color="#0B0F19" />
            <Text style={styles.calendarButtonText}>Adicionar à Agenda do Celular</Text>
          </Pressable>
        </View>

        {/* 2. Card de Localização & Rota no Maps */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
              <Ionicons name="location" size={18} color="#38BDF8" />
            </View>
            <Text style={styles.sectionTitle}>Localização & Rota</Text>
          </View>

          <Text style={styles.venueName}>
            {event?.location || 'Local a confirmar'}
          </Text>
          {Boolean(event?.location_city) && (
            <Text style={styles.venueCity}>
              {event?.location_city} {event?.location_state ? `- ${event.location_state}` : ''}
            </Text>
          )}

          {/* Botão Abrir Rota no Google Maps */}
          <Pressable
            style={({ pressed }) => [styles.mapsButton, pressed && styles.btnPressed]}
            onPress={() => void handleOpenMaps()}
            accessibilityRole="button"
            accessibilityLabel="Abrir rota no Google Maps ou Waze"
          >
            <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
            <Text style={styles.mapsButtonText}>Abrir Rota no Google Maps / Waze</Text>
          </Pressable>
        </View>

        {/* 3. Card de Liderança do Evento */}
        {leader ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="star" size={18} color="#10B981" />
              </View>
              <Text style={styles.sectionTitle}>Líder / Cerimonialista Responsável</Text>
            </View>

            <View style={styles.leaderRow}>
              <View style={styles.leaderAvatarCircle}>
                <Ionicons name="person" size={20} color="#10B981" />
              </View>
              <View style={styles.leaderInfo}>
                <Text style={styles.leaderName}>{leader.name}</Text>
                <Text style={styles.leaderRole}>{leader.role || 'Coordenação Geral'}</Text>
              </View>
              {Boolean(leader.phone) && (
                <Pressable
                  style={styles.whatsappBtn}
                  onPress={() => handleContactLeader(leader.phone)}
                  accessibilityRole="button"
                  accessibilityLabel={`Conversar com ${leader.name} no WhatsApp`}
                >
                  <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                </Pressable>
              )}
            </View>
          </View>
        ) : null}

        {/* 4. Card da Equipe Escalada */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
              <Ionicons name="people" size={18} color="#A855F7" />
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

        {/* 5. Ações Rápidas Operacionais */}
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
              router.push(`/eventos/${eventId}?initialTab=timeline`);
            }}
            accessibilityRole="button"
            accessibilityLabel="Ver cronograma do dia"
          >
            <Ionicons name="calendar-outline" size={18} color="#CBD5E1" />
            <Text style={styles.timelineBtnText}>Ver Cronograma do Dia</Text>
          </Pressable>
        </View>
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
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
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
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    borderColor: 'rgba(212, 175, 55, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  teamBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D4AF37',
  },
  eventName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  eventDateText: {
    fontSize: 13,
    color: '#CBD5E1',
    textTransform: 'capitalize',
  },
  sectionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  scheduleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  scheduleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  scheduleLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
  },
  scheduleValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scheduleDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 12,
    ...shadows.sm,
  },
  mapsButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leaderAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderInfo: {
    flex: 1,
  },
  leaderName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leaderRole: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  whatsappBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  emptyTeamText: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  teamMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInfo: {
    flex: 1,
  },
  memberHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
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
    fontSize: 12,
    color: '#94A3B8',
  },
  actionsFooter: {
    marginTop: 8,
    gap: 10,
  },
  portariaHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  timelineBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
