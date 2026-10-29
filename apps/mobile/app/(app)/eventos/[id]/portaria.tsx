import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  initReceptionDatabase,
  getSnapshot,
  findGuestByQrToken,
  findGuestById,
  getFamilyGroupMembers,
  enqueueCheckIn,
  getPendingQueue,
  syncReceptionQueue,
  downloadAndSaveEventSnapshot,
  startQueueSyncWatcher,
  canScanForEvent,
  playReceptionSound,
  NativeScannerView,
  ReceptionBadgeCard,
  FamilyGroupModal,
  OfflineQueueBanner,
  ManualSearchModal,
  type ReceptionGuest,
  type ReceptionSnapshotRow,
  type CheckInState,
  type ApplyReceptionResult,
} from '../../../../src/features/reception';
import { AppHaptics } from '../../../../src/lib/haptics';

interface LastScanState {
  state: CheckInState;
  guestName: string;
  tableName?: string | null;
  companionsCount?: number;
  scannedAt: string;
  clientScanId?: string;
  errorMessage?: string | null;
}

export default function PortariaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const eventId = Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '';

  // Estados principais da tela
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<ReceptionSnapshotRow | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);

  // Estados dos Modais e Scanner
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [familyModalVisible, setFamilyModalVisible] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<ReceptionGuest[]>([]);
  const [pendingFamilyGuest, setPendingFamilyGuest] = useState<ReceptionGuest | null>(null);

  // Card do último resultado escaneado
  const [lastScanResult, setLastScanResult] = useState<LastScanState | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Agenda auto-dismiss de cards confirmados ou já registrados
  const scheduleCardDismiss = useCallback((state: CheckInState) => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }
    if (state === 'confirmed' || state === 'already_checked_in' || state === 'pending') {
      dismissTimerRef.current = setTimeout(() => {
        setLastScanResult(null);
      }, 5000);
    }
  }, []);

  // Atualiza card flutuante de 'pending' para o estado retornado pela RPC ('confirmed', 'already_checked_in' ou 'rejected')
  const applySyncResultsToLastScan = useCallback(
    (results?: ApplyReceptionResult[]) => {
      if (!results || results.length === 0) return;
      setLastScanResult((prev) => {
        if (!prev || !prev.clientScanId) return prev;
        const matched = results.find((r) => r.client_scan_id === prev.clientScanId);
        if (!matched) return prev;
        const nextState: CheckInState =
          matched.status === 'already_checked_in'
            ? 'already_checked_in'
            : matched.status === 'rejected'
              ? 'rejected'
              : 'confirmed';
        if (prev.state === nextState) return prev;
        void playReceptionSound(nextState);
        scheduleCardDismiss(nextState);
        return {
          ...prev,
          state: nextState,
          errorMessage: matched.error ?? prev.errorMessage,
        };
      });
    },
    [scheduleCardDismiss],
  );

  // 1. Atualiza contagem de itens pendentes no SQLite
  const refreshPendingCount = useCallback(async () => {
    if (!eventId) return;
    try {
      const pendingItems = await getPendingQueue(eventId);
      setPendingCount(pendingItems.length);
    } catch (err) {
      console.warn('Erro ao consultar fila pendente no SQLite:', err);
    }
  }, [eventId]);

  // 2. Sincronizador resiliente da fila SQLite via serviço dedicado de sincronização
  const syncQueueNow = useCallback(async () => {
    if (!eventId || isSyncing) return;
    setIsSyncing(true);

    try {
      const result = await syncReceptionQueue(eventId);
      setIsOnline(result.isOnline);
      setPendingCount(result.pendingCount);
      applySyncResultsToLastScan(result.results);
    } catch (err) {
      console.warn('Exceção ao sincronizar fila:', err);
      setIsOnline(false);
    } finally {
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [eventId, isSyncing, refreshPendingCount, applySyncResultsToLastScan]);

  const retryNeedsAttentionNow = useCallback(async () => {
    if (!eventId || isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncReceptionQueue(eventId, { retryNeedsAttention: true });
      setIsOnline(result.isOnline);
      setPendingCount(result.pendingCount);
      applySyncResultsToLastScan(result.results);
    } catch (err) {
      console.warn('Exceção ao reprocessar itens needs_attention:', err);
      setIsOnline(false);
    } finally {
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [eventId, isSyncing, refreshPendingCount, applySyncResultsToLastScan]);

  // 3. Inicialização: banco SQLite, auto-cura e carga do snapshot via serviço
  const initializeScreen = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);

    try {
      // Inicializa banco e auto-cura itens interrompidos em in_flight
      await initReceptionDatabase();

      // Busca snapshot salvo localmente
      let localSnapshot = await getSnapshot(eventId);

      // Se não houver snapshot salvo localmente, baixa da RPC do Supabase
      if (!localSnapshot) {
        try {
          localSnapshot = await downloadAndSaveEventSnapshot(eventId);
          if (localSnapshot) {
            setIsOnline(true);
          }
        } catch {
          // Permanece offline se não conseguir conectar
          setIsOnline(false);
        }
      }

      setSnapshot(localSnapshot);
      await refreshPendingCount();
    } catch (err) {
      console.error('Erro na inicialização da Portaria Prime:', err);
      Alert.alert(
        'Erro de Inicialização',
        'Não foi possível inicializar o banco de dados local da Portaria.',
      );
    } finally {
      setLoading(false);
    }
  }, [eventId, refreshPendingCount]);

  useEffect(() => {
    void initializeScreen();
  }, [initializeScreen]);

  // Watcher em background para drenagem contínua da fila quando houver conectividade
  useEffect(() => {
    if (!eventId) return;
    const unsubscribe = startQueueSyncWatcher(eventId, 10000, (status) => {
      setIsOnline(status.isOnline);
      setPendingCount(status.pendingCount);
      applySyncResultsToLastScan(status.results);
    });
    return () => {
      unsubscribe();
    };
  }, [eventId, applySyncResultsToLastScan]);

  // 4. Processamento de Check-in (Individual ou Grupo)
  const processCheckIn = async (
    guest: ReceptionGuest,
    confirmedGuestIds: string[],
    scannedToken: string | null,
  ) => {
    try {
      // Grava no SQLite durável ANTES de atualizar a UI
      const queueOp = await enqueueCheckIn({
        event_id: eventId,
        scanned_qr_token: scannedToken,
        scanned_guest_id: guest.id,
        confirmed_guest_ids: confirmedGuestIds,
        scanned_at: new Date().toISOString(),
      });

      const companionsCount = Math.max(0, confirmedGuestIds.length - 1);

      void playReceptionSound('pending');
      void AppHaptics.success();

      setLastScanResult({
        state: 'pending',
        guestName: guest.name,
        tableName: guest.table_name,
        companionsCount,
        scannedAt: queueOp.scanned_at,
        clientScanId: queueOp.client_scan_id,
      });

      scheduleCardDismiss('pending');
      await refreshPendingCount();

      if (isOnline) {
        void syncQueueNow();
      }
    } catch (err) {
      console.error('Erro ao registrar check-in local:', err);
      void playReceptionSound('needs_attention');
      void AppHaptics.error();

      setLastScanResult({
        state: 'needs_attention',
        guestName: guest.name,
        tableName: guest.table_name,
        scannedAt: new Date().toISOString(),
        errorMessage: 'Falha ao gravar check-in no banco local. Tente novamente.',
      });
    }
  };

  // 5. Handler de Leitura de QR Code
  const handleScan = async (scannedData: string) => {
    // Verifica retenção / expiração às 12:00 do dia seguinte
    const scanPermission = canScanForEvent(snapshot);
    if (!scanPermission.allowed) {
      void playReceptionSound('rejected');
      void AppHaptics.error();
      setLastScanResult({
        state: 'rejected',
        guestName: 'Operação Encerrada',
        scannedAt: new Date().toISOString(),
        errorMessage: scanPermission.reason || 'O prazo da portaria expirou às 12:00.',
      });
      return;
    }

    // Extrai token limpo: suporta UUID direto, URL com ?token= ou ?t=
    let token = scannedData.trim();
    if (token.includes('?')) {
      try {
        const urlParams = new URLSearchParams(token.split('?')[1]);
        const extracted = urlParams.get('token') || urlParams.get('t') || urlParams.get('qr');
        if (extracted) token = extracted;
      } catch {
        // Mantém token bruto
      }
    }

    // Localiza convidado no banco SQLite local
    let guest = await findGuestByQrToken(eventId, token);
    if (!guest) {
      // Tenta buscar por ID direto
      guest = await findGuestById(eventId, token);
    }

    // A) Convidado NÃO encontrado no evento
    if (!guest) {
      void playReceptionSound('rejected');
      void AppHaptics.error();
      setLastScanResult({
        state: 'rejected',
        guestName: 'Não Identificado',
        scannedAt: new Date().toISOString(),
        errorMessage: 'QR Code não pertence a nenhum convidado deste evento.',
      });
      scheduleCardDismiss('rejected');
      return;
    }

    // B) Convidado já estava confirmado anteriormente
    if (guest.checked_in_at) {
      void playReceptionSound('already_checked_in');
      void AppHaptics.warning();
      setLastScanResult({
        state: 'already_checked_in',
        guestName: guest.name,
        tableName: guest.table_name,
        scannedAt: guest.checked_in_at,
      });
      scheduleCardDismiss('already_checked_in');
      return;
    }

    // C) Convidado pertence a um grupo familiar (R3)
    if (guest.family_group_id) {
      const members = await getFamilyGroupMembers(eventId, guest.family_group_id);
      if (members.length > 1) {
        // Abre modal para o operador selecionar explicitamente os presentes
        setFamilyMembers(members);
        setPendingFamilyGuest(guest);
        setFamilyModalVisible(true);
        return;
      }
    }

    // D) Convidado individual: check-in direto
    await processCheckIn(guest, [guest.id], token);
  };

  // 6. Confirmação do Modal de Grupo Familiar (R3)
  const handleConfirmFamilyGroup = async (confirmedGuestIds: string[]) => {
    setFamilyModalVisible(false);
    if (!pendingFamilyGuest) return;

    if (confirmedGuestIds.length === 0) {
      void AppHaptics.warning();
      Alert.alert(
        'Nenhum Selecionado',
        'Nenhum integrante foi marcado para entrada.',
      );
      return;
    }

    await processCheckIn(
      pendingFamilyGuest,
      confirmedGuestIds,
      pendingFamilyGuest.qr_token,
    );
    setPendingFamilyGuest(null);
  };

  // 7. Seleção de convidado via Busca Manual
  const handleSelectFromSearch = async (guest: ReceptionGuest) => {
    setSearchModalVisible(false);

    if (guest.checked_in_at) {
      void playReceptionSound('already_checked_in');
      void AppHaptics.warning();
      setLastScanResult({
        state: 'already_checked_in',
        guestName: guest.name,
        tableName: guest.table_name,
        scannedAt: guest.checked_in_at,
      });
      scheduleCardDismiss('already_checked_in');
      return;
    }

    if (guest.family_group_id) {
      const members = await getFamilyGroupMembers(eventId, guest.family_group_id);
      if (members.length > 1) {
        setFamilyMembers(members);
        setPendingFamilyGuest(guest);
        setFamilyModalVisible(true);
        return;
      }
    }

    await processCheckIn(guest, [guest.id], guest.qr_token);
  };

  // Verificação de bloqueio por expiração de retenção (R5)
  const scanAuth = canScanForEvent(snapshot);
  const isScannerBlocked = !scanAuth.allowed;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <ActivityIndicator size="large" color="#FDE047" />
        <Text style={styles.loadingText}>Preparando Portaria Prime...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header Superior da Portaria */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Voltar para detalhes do evento"
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Portaria Prime</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {snapshot?.name || 'Evento'}
          </Text>
        </View>

        {/* Botão de Busca Manual */}
        <Pressable
          style={styles.actionButton}
          onPress={() => setSearchModalVisible(true)}
          hitSlop={8}
          accessibilityLabel="Buscar convidado por nome ou telefone"
        >
          <Ionicons name="search" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Banner de Status Offline e Fila Local */}
      <OfflineQueueBanner
        isOnline={isOnline}
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        onSyncPress={() => void syncQueueNow()}
      />

      {/* Área Central: Câmera ou Aviso de Expiração */}
      <View style={styles.scannerWrapper}>
        {isScannerBlocked ? (
          <View style={styles.blockedContainer}>
            <Ionicons name="lock-closed" size={56} color="#F97316" />
            <Text style={styles.blockedTitle}>Operação Encerrada</Text>
            <Text style={styles.blockedSubtitle}>
              {scanAuth.reason ||
                'O prazo de operação offline encerrou às 12:00 do dia seguinte ao evento.'}
            </Text>
            {pendingCount > 0 && (
              <Pressable
                style={styles.syncBlockedButton}
                onPress={() => void syncQueueNow()}
              >
                <Ionicons name="cloud-upload" size={18} color="#FFFFFF" />
                <Text style={styles.syncBlockedButtonText}>
                  Sincronizar Fila ({pendingCount})
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <NativeScannerView
            active={!familyModalVisible && !searchModalVisible && !lastScanResult}
            onScan={(data) => void handleScan(data)}
            torchEnabled={torchEnabled}
            onTorchToggle={(enabled) => setTorchEnabled(enabled)}
          />
        )}
      </View>

      {/* Card Flutuante de Status do Último Check-in */}
      {lastScanResult && (
        <View style={styles.floatingCardContainer}>
          <ReceptionBadgeCard
            state={lastScanResult.state}
            guestName={lastScanResult.guestName}
            tableName={lastScanResult.tableName}
            companionsCount={lastScanResult.companionsCount}
            scannedAt={lastScanResult.scannedAt}
            clientScanId={lastScanResult.clientScanId}
            errorMessage={lastScanResult.errorMessage}
            onDismiss={() => setLastScanResult(null)}
            onRetry={
              lastScanResult.state === 'needs_attention'
                ? () => void retryNeedsAttentionNow()
                : undefined
            }
          />
        </View>
      )}

      {/* Modal de Grupo Familiar (R3) */}
      <FamilyGroupModal
        visible={familyModalVisible}
        familyMembers={familyMembers}
        onConfirm={(confirmedIds) => void handleConfirmFamilyGroup(confirmedIds)}
        onCancel={() => {
          setFamilyModalVisible(false);
          setPendingFamilyGuest(null);
        }}
      />

      {/* Modal de Busca Manual */}
      <ManualSearchModal
        visible={searchModalVisible}
        eventId={eventId}
        onSelectGuest={(guest) => void handleSelectFromSearch(guest)}
        onClose={() => setSearchModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    padding: 6,
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
  },
  scannerWrapper: {
    flex: 1,
    position: 'relative',
  },
  blockedContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  blockedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  blockedSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  syncBlockedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#023C69',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 16,
  },
  syncBlockedButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  floatingCardContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
  },
});
