import React, { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen } from '../../components/Screen';
import { type AssignedEvent } from '../../contexts/UserRoleContext';
import { colors, shadows } from '../../theme/colors';
import { AppHaptics } from '../../lib/haptics';
import { EventAccordionCard } from './EventAccordionCard';

interface TeamMemberDashboardViewProps {
  displayName: string;
  avatarUrl: string | null;
  onPickAvatar: () => void;
  uploadingAvatar: boolean;
  assignedEvents: AssignedEvent[];
  onRefreshEvents: () => Promise<void>;
}

function formatRelativeDate(dateString: string): { badge: string; isToday: boolean; isTomorrow: boolean; formattedDate: string } {
  try {
    const target = new Date(dateString);
    const now = new Date();
    const isToday =
      target.getDate() === now.getDate() &&
      target.getMonth() === now.getMonth() &&
      target.getFullYear() === now.getFullYear();

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      target.getDate() === tomorrow.getDate() &&
      target.getMonth() === tomorrow.getMonth() &&
      target.getFullYear() === tomorrow.getFullYear();

    const timeStr = target.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const hasTime = timeStr !== '00:00' && !dateString.includes('T00:00:00');

    let badge = 'EM BREVE';
    if (isToday) badge = 'HOJE';
    else if (isTomorrow) badge = 'AMANHÃ';
    else {
      const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) badge = `EM ${diffDays} DIAS`;
    }

    const formattedDate = target.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }) + (hasTime ? ` às ${timeStr}` : '');

    return { badge, isToday, isTomorrow, formattedDate };
  } catch {
    return { badge: 'EM BREVE', isToday: false, isTomorrow: false, formattedDate: dateString };
  }
}

export function TeamMemberDashboardView({
  displayName,
  avatarUrl,
  onPickAvatar,
  uploadingAvatar,
  assignedEvents,
  onRefreshEvents,
}: TeamMemberDashboardViewProps) {
  const router = useRouter();
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [eventPickerTarget, setEventPickerTarget] = useState<'timeline' | 'team' | 'portaria' | null>(null);

  // Localiza o próximo evento ativo na escala
  const nextEvent = useMemo(() => {
    if (assignedEvents.length === 0) return null;
    const now = Date.now();
    // Prioriza eventos de hoje ou futuros
    const upcoming = [...assignedEvents].sort(
      (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
    );
    const futureOrToday = upcoming.find(
      (ev) => new Date(ev.event_date).getTime() >= now - 12 * 60 * 60 * 1000,
    );
    return futureOrToday ?? upcoming[0];
  }, [assignedEvents]);

  // Lista todos os eventos ordenados (hoje/futuros primeiro, passados depois)
  const sortedEvents = useMemo(() => {
    if (assignedEvents.length === 0) return [];
    const margin = Date.now() - 12 * 60 * 60 * 1000;
    const upcoming = assignedEvents
      .filter((ev) => new Date(ev.event_date).getTime() >= margin)
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    const past = assignedEvents
      .filter((ev) => new Date(ev.event_date).getTime() < margin)
      .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
    return [...upcoming, ...past];
  }, [assignedEvents]);

  const dateInfo = useMemo(() => {
    if (!nextEvent) return null;
    return formatRelativeDate(nextEvent.event_date);
  }, [nextEvent]);

  const handleOpenPortaria = (eventId: string) => {
    void AppHaptics.medium();
    router.push(`/eventos/${eventId}/portaria`);
  };

  const handleOpenTimeline = (eventId: string) => {
    void AppHaptics.light();
    router.push(`/eventos/${eventId}?initialTab=timeline`);
  };

  const handleOpenTeam = (eventId: string) => {
    void AppHaptics.light();
    router.push(`/eventos/${eventId}?initialTab=team`);
  };

  const handleOpenEventDetails = (eventId: string) => {
    void AppHaptics.light();
    router.push(`/eventos/${eventId}`);
  };

  const handleActionClick = (target: 'timeline' | 'team' | 'portaria') => {
    void AppHaptics.light();
    if (assignedEvents.length === 0) {
      router.push('/eventos');
      return;
    }
    if (assignedEvents.length === 1) {
      const singleId = assignedEvents[0].id;
      if (target === 'portaria') handleOpenPortaria(singleId);
      else if (target === 'timeline') handleOpenTimeline(singleId);
      else handleOpenEventDetails(singleId);
      return;
    }
    // Se houver mais de 1 evento, abre seletor amigável para o colaborador escolher
    setEventPickerTarget(target);
  };

  const handleSelectEventFromPicker = (eventId: string) => {
    const target = eventPickerTarget;
    setEventPickerTarget(null);
    if (target === 'portaria') handleOpenPortaria(eventId);
    else if (target === 'timeline') handleOpenTimeline(eventId);
    else handleOpenEventDetails(eventId);
  };

  return (
    <Screen>
      {/* 1. Hero com Saudação e Identificação Operacional */}
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Pressable
          style={styles.avatarButton}
          onPress={onPickAvatar}
          accessibilityLabel="Alterar foto de perfil"
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <Ionicons name="camera-outline" size={24} color={colors.primaryStrong} />
          )}
          <View style={styles.avatarBadge}>
            <Ionicons name="pencil" size={11} color="#111318" />
          </View>
        </Pressable>

        <View style={styles.heroCopy}>
          <View style={styles.roleBadgeContainer}>
            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#D6AF42" />
              <Text style={styles.roleBadgeText}>
                {nextEvent?.team_name || assignedEvents[0]?.team_name || 'Equipe Operacional'}
              </Text>
            </View>
          </View>
          <Text style={styles.greeting} numberOfLines={1}>
            Olá, {displayName || 'Membro da Equipe'}!
          </Text>
          <Text style={styles.heroSubtitle}>
            Hospitalidade e precisão para tornar cada evento impecável.
          </Text>
          {uploadingAvatar && <Text style={styles.avatarHint}>Atualizando sua foto…</Text>}
        </View>
      </View>

      {/* 2. Escalas Operacionais da Equipe (Cards Compactos com Acordeão) */}
      {sortedEvents.length > 0 ? (
        <View style={styles.accordionSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>Suas Escalas de Eventos</Text>
              <Text style={styles.sectionSubtitle}>
                {sortedEvents.length === 1
                  ? '1 evento escalado para sua equipe'
                  : `${sortedEvents.length} eventos escalados para sua equipe`}
              </Text>
            </View>
            <View style={styles.eventCountBadge}>
              <Text style={styles.eventCountBadgeText}>
                {sortedEvents.length} {sortedEvents.length === 1 ? 'ESCALA' : 'ESCALAS'}
              </Text>
            </View>
          </View>

          <View style={styles.accordionContainer}>
            {sortedEvents.map((event, idx) => (
              <EventAccordionCard
                key={event.id}
                event={event}
                isFirst={idx === 0}
                onOpenPortaria={handleOpenPortaria}
                onOpenBriefing={handleOpenEventDetails}
                onOpenTimeline={handleOpenTimeline}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="calendar-outline" size={32} color="#D4AF37" />
          </View>
          <Text style={styles.emptyTitle}>Tudo tranquilo por aqui!</Text>
          <Text style={styles.emptyDescription}>
            Você não possui escalas ativas no momento. Assim que a assessoria incluir você em um evento, o acesso à Portaria Prime e o cronograma aparecerão aqui.
          </Text>
          <Pressable
            style={styles.emptyRefreshButton}
            onPress={() => void onRefreshEvents()}
            accessibilityRole="button"
            accessibilityLabel="Atualizar escalas de eventos"
          >
            <Ionicons name="refresh-outline" size={16} color="#023C69" />
            <Text style={styles.emptyRefreshButtonText}>Atualizar escalas</Text>
          </Pressable>
        </View>
      )}

      {/* 3. Métricas Operacionais da Equipe */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#EBF4FF' }]}>
            <Ionicons name="calendar" size={18} color="#023C69" />
          </View>
          <Text style={styles.statValue}>{assignedEvents.length}</Text>
          <Text style={styles.statLabel}>
            {assignedEvents.length === 1 ? 'Escala ativa' : 'Escalas ativas'}
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#FEF9C3' }]}>
            <Ionicons name="shield-checkmark" size={18} color="#A16207" />
          </View>
          <Text style={styles.statValue}>100%</Text>
          <Text style={styles.statLabel}>Portaria offline ativa</Text>
        </View>
      </View>

      {/* 4. Ações Rápidas da Equipe */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Ações da Equipe</Text>
        <Text style={styles.sectionSubtitle}>
          Ferramentas essenciais para o dia da operação.
        </Text>
      </View>

      <View style={styles.actionGrid}>
        {/* Ação 1: Portaria Prime */}
        <Pressable
          style={({ pressed }) => [styles.actionCard, pressed && styles.cardPressed]}
          onPress={() => handleActionClick('portaria')}
          accessibilityRole="button"
          accessibilityLabel="Portaria Prime"
        >
          <View style={[styles.actionIconWrap, { backgroundColor: '#FDF8ED' }]}>
            <Ionicons name="qr-code-outline" size={22} color="#B8933A" />
          </View>
          <Text style={styles.actionTitle}>Portaria Prime</Text>
          <Text style={styles.actionDescription}>
            Check-in rápido de convidados via QR Code e busca.
          </Text>
        </Pressable>

        {/* Ação 2: Cronograma do Dia */}
        <Pressable
          style={({ pressed }) => [styles.actionCard, pressed && styles.cardPressed]}
          onPress={() => handleActionClick('timeline')}
          accessibilityRole="button"
          accessibilityLabel="Cronograma do dia"
        >
          <View style={[styles.actionIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="time-outline" size={22} color="#1D4ED8" />
          </View>
          <Text style={styles.actionTitle}>Cronograma</Text>
          <Text style={styles.actionDescription}>
            Acompanhe os horários da cerimônia e atrações.
          </Text>
        </Pressable>

        {/* Ação 3: Equipe Escalada */}
        <Pressable
          style={({ pressed }) => [styles.actionCard, pressed && styles.cardPressed]}
          onPress={() => handleActionClick('team')}
          accessibilityRole="button"
          accessibilityLabel="Equipe escalada"
        >
          <View style={[styles.actionIconWrap, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="people-outline" size={22} color="#15803D" />
          </View>
          <Text style={styles.actionTitle}>Minha Equipe</Text>
          <Text style={styles.actionDescription}>
            Consulte os colegas escalados e suas atribuições.
          </Text>
        </Pressable>

        {/* Ação 4: Guia Rápido de Portaria Offline */}
        <Pressable
          style={({ pressed }) => [styles.actionCard, pressed && styles.cardPressed]}
          onPress={() => {
            void AppHaptics.selection();
            setGuideModalOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Como funciona a portaria offline"
        >
          <View style={[styles.actionIconWrap, { backgroundColor: '#FAF5FF' }]}>
            <Ionicons name="information-circle-outline" size={22} color="#7E22CE" />
          </View>
          <Text style={styles.actionTitle}>Modo Offline</Text>
          <Text style={styles.actionDescription}>
            Dicas para portaria em locais sem sinal de internet.
          </Text>
        </Pressable>
      </View>

      {/* Modal: Guia Rápido de Portaria Offline */}
      <Modal
        visible={guideModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setGuideModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="shield-checkmark" size={20} color="#023C69" />
                <Text style={styles.modalTitle}>Portaria Prime Offline</Text>
              </View>
              <Pressable
                onPress={() => setGuideModalOpen(false)}
                hitSlop={12}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.guideItem}>
                <View style={styles.guideStepNumber}>
                  <Text style={styles.guideStepText}>1</Text>
                </View>
                <View style={styles.guideStepCopy}>
                  <Text style={styles.guideStepTitle}>Baixe o evento antes de ir</Text>
                  <Text style={styles.guideStepDesc}>
                    Abra a tela de Portaria com internet no local de saída. O Painel Prime salva os convidados diretamente no seu aparelho.
                  </Text>
                </View>
              </View>

              <View style={styles.guideItem}>
                <View style={styles.guideStepNumber}>
                  <Text style={styles.guideStepText}>2</Text>
                </View>
                <View style={styles.guideStepCopy}>
                  <Text style={styles.guideStepTitle}>Check-in instantâneo sem sinal</Text>
                  <Text style={styles.guideStepDesc}>
                    O leitor valida o QR Code em menos de 100ms direto no banco SQLite local, mesmo se o sítio ou salão não tiver conexão.
                  </Text>
                </View>
              </View>

              <View style={styles.guideItem}>
                <View style={styles.guideStepNumber}>
                  <Text style={styles.guideStepText}>3</Text>
                </View>
                <View style={styles.guideStepCopy}>
                  <Text style={styles.guideStepTitle}>Sincronização em segundo plano</Text>
                  <Text style={styles.guideStepDesc}>
                    Todas as entradas confirmadas ficam na fila segura e são sincronizadas automaticamente com o servidor assim que a internet oscilar ou retornar.
                  </Text>
                </View>
              </View>

              <View style={styles.guideItem}>
                <View style={styles.guideStepNumber}>
                  <Text style={styles.guideStepText}>4</Text>
                </View>
                <View style={styles.guideStepCopy}>
                  <Text style={styles.guideStepTitle}>Convidado sem convite em mãos?</Text>
                  <Text style={styles.guideStepDesc}>
                    Toque no botão &quot;Buscar Convidado&quot; para pesquisar pelo nome ou telefone e confirmar a entrada de toda a família de uma só vez.
                  </Text>
                </View>
              </View>

              <Pressable
                style={styles.modalConfirmBtn}
                onPress={() => setGuideModalOpen(false)}
              >
                <Text style={styles.modalConfirmBtnText}>Entendido</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Seletor de Evento para Múltiplas Escalas */}
      <Modal
        visible={eventPickerTarget !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEventPickerTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons
                  name={
                    eventPickerTarget === 'portaria'
                      ? 'qr-code-outline'
                      : eventPickerTarget === 'timeline'
                        ? 'time-outline'
                        : 'people-outline'
                  }
                  size={20}
                  color="#D4AF37"
                />
                <Text style={styles.modalTitle}>
                  {eventPickerTarget === 'portaria'
                    ? 'Abrir Portaria Prime'
                    : eventPickerTarget === 'timeline'
                      ? 'Roteiro do Dia'
                      : 'Informações da Equipe'}
                </Text>
              </View>
              <Pressable
                onPress={() => setEventPickerTarget(null)}
                hitSlop={12}
                style={styles.modalCloseBtn}
                accessibilityLabel="Fechar seleção de evento"
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Selecione o evento desejado:
            </Text>

            <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
              {sortedEvents.map((ev) => (
                <Pressable
                  key={ev.id}
                  style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
                  onPress={() => handleSelectEventFromPicker(ev.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Selecionar evento ${ev.name}`}
                >
                  <View style={styles.pickerItemIconWrap}>
                    <Ionicons name="calendar" size={18} color="#D4AF37" />
                  </View>
                  <View style={styles.pickerItemContent}>
                    <Text style={styles.pickerItemTitle} numberOfLines={1}>
                      {ev.name}
                    </Text>
                    <Text style={styles.pickerItemMeta} numberOfLines={1}>
                      {new Date(ev.event_date).toLocaleDateString('pt-BR')} • {ev.location || 'Local a confirmar'}
                    </Text>
                    {Boolean(ev.team_name) && (
                      <Text style={styles.pickerItemTeam} numberOfLines={1}>
                        Equipe: {ev.team_name}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 140,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    marginBottom: 16,
  },
  heroGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    right: -70,
    top: -90,
    backgroundColor: '#D4AF37',
    opacity: 0.22,
  },
  avatarButton: {
    width: 68,
    height: 68,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#D4AF37',
    backgroundColor: '#FFF8DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
  },
  avatarBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  roleBadgeContainer: {
    flexDirection: 'row',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  roleBadgeText: {
    color: '#E8D5A0',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  greeting: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  avatarHint: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '700',
  },
  highlightCard: {
    backgroundColor: '#0A1E32',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    padding: 18,
    marginBottom: 16,
    ...shadows.elevated,
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  highlightBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  statusBadgeToday: {
    backgroundColor: '#F2D875',
    borderColor: '#E1BD3F',
  },
  statusBadgeTomorrow: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  statusBadgeText: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBadgeTextToday: {
    color: '#111318',
  },
  teamTag: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  detailsIconBtn: {
    padding: 4,
  },
  eventName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  eventInfoList: {
    gap: 6,
    marginBottom: 16,
  },
  eventInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventInfoText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  eventInfoRole: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  portariaMainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2D875',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E1BD3F',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  portariaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portariaButtonCopy: {
    flex: 1,
    gap: 2,
  },
  portariaButtonTitle: {
    color: '#111318',
    fontSize: 16,
    fontWeight: '800',
  },
  portariaButtonSubtitle: {
    color: '#4B3F18',
    fontSize: 11,
    fontWeight: '600',
  },
  secondaryEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  secondaryEventButtonText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: 16,
    ...shadows.card,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.gold50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyDescription: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#EBF4FF',
  },
  emptyRefreshButtonText: {
    color: '#023C69',
    fontSize: 13,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
    ...shadows.sm,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    marginBottom: 12,
    gap: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: colors.mutedText,
    fontSize: 13,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
    ...shadows.sm,
  },
  cardPressed: {
    opacity: 0.85,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  actionDescription: {
    color: colors.mutedText,
    fontSize: 11,
    lineHeight: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: '#64748B',
    fontSize: 13,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
    gap: 16,
  },
  guideItem: {
    flexDirection: 'row',
    gap: 12,
  },
  guideStepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F2D875',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideStepText: {
    color: '#111318',
    fontSize: 14,
    fontWeight: '800',
  },
  guideStepCopy: {
    flex: 1,
    gap: 3,
  },
  guideStepTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  guideStepDesc: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  modalConfirmBtn: {
    backgroundColor: '#023C69',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  accordionSection: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  eventCountBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  eventCountBadgeText: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  accordionContainer: {
    marginTop: 12,
  },
  pickerScroll: {
    maxHeight: 320,
    marginTop: 8,
    marginBottom: 8,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  pickerItemPressed: {
    backgroundColor: '#EDF2F7',
  },
  pickerItemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemContent: {
    flex: 1,
    gap: 2,
  },
  pickerItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  pickerItemMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  pickerItemTeam: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D4AF37',
  },
});
