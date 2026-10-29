import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface OfflineQueueBannerProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing?: boolean;
  onSyncPress?: () => void;
}

export function OfflineQueueBanner({
  isOnline,
  pendingCount,
  isSyncing = false,
  onSyncPress,
}: OfflineQueueBannerProps) {
  // Configuração visual de acordo com o estado de rede e volume de fila
  let bannerBg = '#F8FAFC';
  let bannerBorder = '#E2E8F0';
  let iconColor = '#64748B';
  let textColor = '#334155';
  let iconName: keyof typeof Ionicons.glyphMap = 'cloud-done-outline';
  let statusText = 'Conectado ao Servidor';
  let subText = 'Fila local sincronizada';

  if (!isOnline) {
    if (pendingCount > 0) {
      bannerBg = '#FEFCE8';
      bannerBorder = '#FDE047';
      iconColor = '#CA8A04';
      textColor = '#854D0E';
      iconName = 'cloud-offline-outline';
      statusText = 'Modo Offline';
      subText = `${pendingCount} ${pendingCount === 1 ? 'check-in salvo' : 'check-ins salvos'} no aparelho`;
    } else {
      bannerBg = '#F8FAFC';
      bannerBorder = '#CBD5E1';
      iconColor = '#64748B';
      textColor = '#475569';
      iconName = 'cloud-offline-outline';
      statusText = 'Modo Offline';
      subText = 'Banco local pronto para leitura';
    }
  } else if (isSyncing) {
    bannerBg = '#EFF6FF';
    bannerBorder = '#BFDBFE';
    iconColor = '#2563EB';
    textColor = '#1E40AF';
    iconName = 'sync-outline';
    statusText = 'Sincronizando...';
    subText = `Enviando ${pendingCount} ${pendingCount === 1 ? 'operação' : 'operações'} ao servidor`;
  } else if (pendingCount > 0) {
    bannerBg = '#FFFBEB';
    bannerBorder = '#FDE68A';
    iconColor = '#D97706';
    textColor = '#92400E';
    iconName = 'cloud-upload-outline';
    statusText = 'Conectado';
    subText = `${pendingCount} ${pendingCount === 1 ? 'operação pendente' : 'operações pendentes'}`;
  } else {
    // Online e 0 pendentes
    bannerBg = '#F0FDF4';
    bannerBorder = '#BBF7D0';
    iconColor = '#16A34A';
    textColor = '#166534';
    iconName = 'checkmark-circle-outline';
    statusText = 'Conectado ao Servidor';
    subText = 'Todas as entradas sincronizadas';
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bannerBg,
          borderColor: bannerBorder,
        },
      ]}
      accessibilityRole="header"
      accessibilityLabel={`${statusText}: ${subText}`}
    >
      <View style={styles.leftSection}>
        {isSyncing ? (
          <ActivityIndicator size="small" color={iconColor} style={styles.spinner} />
        ) : (
          <Ionicons name={iconName} size={20} color={iconColor} style={styles.icon} />
        )}

        <View style={styles.textContainer}>
          <Text style={[styles.statusText, { color: textColor }]}>
            {statusText}
          </Text>
          <Text style={[styles.subText, { color: textColor }]}>
            {subText}
          </Text>
        </View>
      </View>

      {/* Botão de sincronização manual quando online e com pendências */}
      {isOnline && pendingCount > 0 && onSyncPress && !isSyncing && (
        <Pressable
          style={[styles.syncButton, { borderColor: iconColor }]}
          onPress={onSyncPress}
          hitSlop={8}
        >
          <Ionicons name="refresh" size={14} color={iconColor} />
          <Text style={[styles.syncButtonText, { color: iconColor }]}>
            Sincronizar
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 10,
  },
  spinner: {
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  subText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
