import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type AssignedEvent } from '../../contexts/UserRoleContext';
import { colors, shadows } from '../../theme/colors';
import { AppHaptics } from '../../lib/haptics';

export interface EventAccordionCardProps {
  event: AssignedEvent;
  isFirst?: boolean;
  onOpenPortaria: (eventId: string) => void;
  onOpenBriefing: (eventId: string) => void;
  onOpenTimeline: (eventId: string) => void;
}

const EVENT_TYPE_FALLBACKS: Record<string, string> = {
  wedding: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=300&q=80',
  casamento: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=300&q=80',
  birthday: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=300&q=80',
  aniversario: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=300&q=80',
  debutante: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=300&q=80',
  corporate: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=300&q=80',
  corporativo: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=300&q=80',
  generic: 'https://images.unsplash.com/photo-1507501336603-6e31db2be093?auto=format&fit=crop&w=300&q=80',
};

function formatEventBadgeDate(dateString: string): { label: string; isToday: boolean; isTomorrow: boolean; timeStr: string } {
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

    let label = target.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase();
    if (isToday) label = 'HOJE';
    else if (isTomorrow) label = 'AMANHÃ';

    return { label, isToday, isTomorrow, timeStr: hasTime ? timeStr : '' };
  } catch {
    return { label: 'EM BREVE', isToday: false, isTomorrow: false, timeStr: '' };
  }
}

export function EventAccordionCard({
  event,
  isFirst = false,
  onOpenPortaria,
  onOpenBriefing,
  onOpenTimeline,
}: EventAccordionCardProps) {
  // O primeiro card pode vir expandido por padrão para agilizar
  const [expanded, setExpanded] = useState(isFirst);
  const badgeInfo = formatEventBadgeDate(event.event_date);

  const fallbackUri =
    EVENT_TYPE_FALLBACKS[event.event_type?.toLowerCase() || 'generic'] ||
    EVENT_TYPE_FALLBACKS.generic;

  const toggleExpand = () => {
    void AppHaptics.selection();
    setExpanded((prev) => !prev);
  };

  return (
    <View style={[styles.card, expanded && styles.cardExpanded]}>
      {/* Linha Principal Compactada (Sempre Visível) */}
      <Pressable
        style={styles.headerPressable}
        onPress={toggleExpand}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Recolher' : 'Expandir'} evento ${event.name}`}
      >
        {/* Foto do Evento à Esquerda */}
        <View style={styles.thumbnailWrap}>
          <Image
            source={{ uri: fallbackUri }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
          {badgeInfo.isToday && (
            <View style={styles.liveDot} />
          )}
        </View>

        {/* Informações Centrais */}
        <View style={styles.headerInfo}>
          <View style={styles.topBadgeRow}>
            <View
              style={[
                styles.badge,
                badgeInfo.isToday && styles.badgeToday,
                badgeInfo.isTomorrow && styles.badgeTomorrow,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  badgeInfo.isToday && styles.badgeTextToday,
                ]}
              >
                {badgeInfo.label}
              </Text>
            </View>
            {Boolean(badgeInfo.timeStr) && (
              <Text style={styles.timeText}>{badgeInfo.timeStr}</Text>
            )}
            {Boolean(event.team_name) && (
              <Text style={styles.teamTag} numberOfLines={1}>
                {event.team_name}
              </Text>
            )}
          </View>

          <Text style={styles.eventName} numberOfLines={1}>
            {event.name}
          </Text>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color="#94A3B8" />
            <Text style={styles.metaText} numberOfLines={1}>
              {event.location || event.location_city || 'Local a confirmar'}
            </Text>
          </View>
        </View>

        {/* Ícone de Expansão à Direita */}
        <View style={styles.chevronWrap}>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={expanded ? '#D4AF37' : '#94A3B8'}
          />
        </View>
      </Pressable>

      {/* Painel de Ações Operacionais (Expandido via Acordeão) */}
      {expanded && (
        <View style={styles.expandedContent}>
          {/* Função do Colaborador no Evento */}
          <View style={styles.roleBox}>
            <Ionicons name="person-circle-outline" size={16} color="#D4AF37" />
            <Text style={styles.roleLabel}>
              Sua função: <Text style={styles.roleHighlight}>{event.role || 'Portaria e Recepção'}</Text>
            </Text>
          </View>

          {/* Botão de Destaque Máximo: Abrir Portaria Prime */}
          <Pressable
            style={({ pressed }) => [
              styles.portariaButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => onOpenPortaria(event.id)}
            accessibilityRole="button"
            accessibilityLabel={`Abrir Portaria Prime de ${event.name}`}
          >
            <View style={styles.portariaIconCircle}>
              <Ionicons name="qr-code-outline" size={20} color="#0B0F19" />
            </View>
            <View style={styles.portariaCopy}>
              <Text style={styles.portariaTitle}>Abrir Portaria Prime</Text>
              <Text style={styles.portariaSubtitle}>Check-in de convidados, carros e QR Code</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#0B0F19" />
          </Pressable>

          {/* Botões Secundários: Informação do Evento + Cronograma */}
          <View style={styles.secondaryActionsRow}>
            <Pressable
              style={styles.actionBtnSecondary}
              onPress={() => onOpenBriefing(event.id)}
              accessibilityRole="button"
              accessibilityLabel="Ver informações estratégicas do evento"
            >
              <Ionicons name="information-circle-outline" size={17} color="#38BDF8" />
              <Text style={styles.actionBtnSecondaryText}>Informações do Evento</Text>
            </Pressable>

            <Pressable
              style={styles.actionBtnSecondary}
              onPress={() => onOpenTimeline(event.id)}
              accessibilityRole="button"
              accessibilityLabel="Ver cronograma do dia"
            >
              <Ionicons name="time-outline" size={17} color="#FDE047" />
              <Text style={styles.actionBtnSecondaryText}>Cronograma do Dia</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    ...shadows.sm,
  },
  cardExpanded: {
    borderColor: 'rgba(212, 175, 55, 0.35)',
    backgroundColor: '#162032',
  },
  headerPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  thumbnailWrap: {
    position: 'relative',
    marginRight: 12,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#334155',
  },
  liveDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  topBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  badgeToday: {
    backgroundColor: '#D4AF37',
    borderColor: '#FDE047',
  },
  badgeTomorrow: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderColor: 'rgba(249, 115, 22, 0.4)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D4AF37',
    letterSpacing: 0.5,
  },
  badgeTextToday: {
    color: '#0B0F19',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  teamTag: {
    fontSize: 11,
    color: '#94A3B8',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    maxWidth: 120,
  },
  eventName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#94A3B8',
    flex: 1,
  },
  chevronWrap: {
    paddingLeft: 8,
    paddingRight: 4,
  },
  expandedContent: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  roleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  roleLabel: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  roleHighlight: {
    fontWeight: '700',
    color: '#D4AF37',
  },
  portariaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4AF37',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
    ...shadows.card,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  portariaIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  portariaCopy: {
    flex: 1,
  },
  portariaTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0B0F19',
    letterSpacing: -0.2,
  },
  portariaSubtitle: {
    fontSize: 11,
    color: '#1E293B',
    fontWeight: '500',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionBtnSecondaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F1F5F9',
  },
});
