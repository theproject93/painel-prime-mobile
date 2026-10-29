import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CheckInState } from '../types/receptionTypes';

export interface ReceptionBadgeCardProps {
  state: CheckInState;
  guestName: string;
  tableName?: string | null;
  companionsCount?: number;
  scannedAt?: string;
  clientScanId?: string;
  errorMessage?: string | null;
  onDismiss?: () => void;
  onRetry?: () => void;
}

interface StateConfig {
  badgeLabel: string;
  title: string;
  description: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  iconName: keyof typeof Ionicons.glyphMap;
}

const STATE_CONFIGS: Record<CheckInState, StateConfig> = {
  confirmed: {
    badgeLabel: 'Confirmado no Servidor',
    title: 'Entrada Autorizada',
    description: 'Check-in confirmado e registrado com sucesso.',
    color: '#22C55E',
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    iconName: 'checkmark-circle',
  },
  pending: {
    badgeLabel: 'Gravado e Pendente Localmente',
    title: 'Check-in Gravado Offline',
    description: 'Salvo com segurança no aparelho. Sincronizará quando a rede voltar.',
    color: '#EAB308',
    backgroundColor: '#FEFCE8',
    borderColor: '#FDE047',
    iconName: 'cloud-upload-outline',
  },
  in_flight: {
    badgeLabel: 'Gravado e Pendente Localmente',
    title: 'Transmitindo...',
    description: 'Enviando confirmação de entrada ao servidor.',
    color: '#EAB308',
    backgroundColor: '#FEFCE8',
    borderColor: '#FDE047',
    iconName: 'sync-outline',
  },
  already_checked_in: {
    badgeLabel: 'Já Estava Confirmado Anteriormente',
    title: 'Entrada Já Registrada',
    description: 'Este convidado já realizou check-in previamente.',
    color: '#F97316',
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    iconName: 'alert-circle',
  },
  rejected: {
    badgeLabel: 'Rejeitado / Erro de Escopo',
    title: 'Entrada Rejeitada',
    description: 'QR Code ou convidado inválido para este evento.',
    color: '#EF4444',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    iconName: 'close-circle',
  },
  needs_attention: {
    badgeLabel: 'Atenção Necessária',
    title: 'Verificação Manual Requerida',
    description: 'Limite de tentativas excedido ou conflito no registro.',
    color: '#A855F7',
    backgroundColor: '#FAF5FF',
    borderColor: '#D8B4FE',
    iconName: 'warning',
  },
};

export function ReceptionBadgeCard({
  state,
  guestName,
  tableName,
  companionsCount,
  scannedAt,
  clientScanId,
  errorMessage,
  onDismiss,
  onRetry,
}: ReceptionBadgeCardProps) {
  const config = STATE_CONFIGS[state] || STATE_CONFIGS.pending;

  const formattedTime = scannedAt
    ? new Date(scannedAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${config.badgeLabel}: ${guestName}`}
    >
      {/* Header do Card com Tag de Status e Botão de Fechar */}
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: config.color }]}>
          <Ionicons name={config.iconName} size={14} color="#FFFFFF" style={styles.badgeIcon} />
          <Text style={styles.badgeText}>{config.badgeLabel}</Text>
        </View>

        {onDismiss && (
          <Pressable
            onPress={onDismiss}
            hitSlop={8}
            style={styles.closeButton}
            accessibilityLabel="Fechar notificação"
          >
            <Ionicons name="close" size={20} color="#64748B" />
          </Pressable>
        )}
      </View>

      {/* Conteúdo Principal */}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
            <Ionicons name={config.iconName} size={28} color={config.color} />
          </View>
          <View style={styles.titleTextContainer}>
            <Text style={styles.title}>{config.title}</Text>
            <Text style={styles.guestName} numberOfLines={2}>
              {guestName || 'Convidado Desconhecido'}
            </Text>
          </View>
        </View>

        <Text style={styles.description}>
          {errorMessage || config.description}
        </Text>

        {/* Metadados: Mesa, Acompanhantes e Horário */}
        <View style={styles.metaContainer}>
          {Boolean(tableName) && (
            <View style={styles.metaItem}>
              <Ionicons name="restaurant-outline" size={15} color="#475569" />
              <Text style={styles.metaText}>{tableName}</Text>
            </View>
          )}

          {typeof companionsCount === 'number' && companionsCount > 0 && (
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={15} color="#475569" />
              <Text style={styles.metaText}>
                {companionsCount} {companionsCount === 1 ? 'acompanhante' : 'acompanhantes'}
              </Text>
            </View>
          )}

          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={15} color="#475569" />
            <Text style={styles.metaText}>{formattedTime}</Text>
          </View>
        </View>

        {/* Identificador de Scan / Debug */}
        {Boolean(clientScanId) && (
          <Text style={styles.scanIdText}>
            ID: {clientScanId?.substring(0, 8)}...
          </Text>
        )}
      </View>

      {/* Ação de Retry se necessário */}
      {state === 'needs_attention' && onRetry && (
        <View style={styles.actionsContainer}>
          <Pressable
            style={[styles.retryButton, { backgroundColor: config.color }]}
            onPress={onRetry}
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Tentar Novamente</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  badgeIcon: {
    marginRight: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  closeButton: {
    padding: 4,
  },
  body: {
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  guestName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  description: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginTop: 4,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  scanIdText: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  actionsContainer: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
