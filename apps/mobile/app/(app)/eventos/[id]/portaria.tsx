import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  StatusBar,
  Alert,
  TextInput,
  FlatList,
  Modal,
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
  searchGuests,
  getAllGuestsForEvent,
  getReceptionStats,
  NativeScannerView,
  ReceptionBadgeCard,
  FamilyGroupModal,
  OfflineQueueBanner,
  CarBasketBar,
  CarConfirmationModal,
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

  // Estatísticas de presença
  const [stats, setStats] = useState<{ total: number; checkedIn: number }>({
    total: 0,
    checkedIn: 0,
  });

  // Lista de Convidados e Busca
  const [searchQuery, setSearchQuery] = useState('');
  const [guestsList, setGuestsList] = useState<ReceptionGuest[]>([]);
  const [searching, setSearching] = useState(false);

  // Bandeja do Carro / Grupo Selecionado
  const [selectedCarGuests, setSelectedCarGuests] = useState<Map<string, ReceptionGuest>>(
    new Map(),
  );
  const [processingCar, setProcessingCar] = useState(false);

  // Modais
  const [scannerModalVisible, setScannerModalVisible] = useState(false);
  const [familyModalVisible, setFamilyModalVisible] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<ReceptionGuest[]>([]);
  const [pendingFamilyGuest, setPendingFamilyGuest] = useState<ReceptionGuest | null>(null);

  // Modal de Resumo de Confirmação do Carro
  const [carConfirmationVisible, setCarConfirmationVisible] = useState(false);
  const [justConfirmedGuests, setJustConfirmedGuests] = useState<ReceptionGuest[]>([]);

  // Card do último resultado escaneado individual
  const [lastScanResult, setLastScanResult] = useState<LastScanState | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Agenda auto-dismiss de cards de notificação
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

  // 1. Atualiza contagem de itens pendentes no SQLite e estatísticas
  const refreshStatsAndQueue = useCallback(async () => {
    if (!eventId) return;
    try {
      const [pendingItems, currentStats] = await Promise.all([
        getPendingQueue(eventId),
        getReceptionStats(eventId),
      ]);
      setPendingCount(pendingItems.length);
      setStats(currentStats);
    } catch (err) {
      console.warn('Erro ao consultar estatísticas no SQLite:', err);
    }
  }, [eventId]);

  // 2. Carrega lista de convidados a partir da busca ou todos
  const reloadGuests = useCallback(
    async (query: string = searchQuery) => {
      if (!eventId) return;
      try {
        setSearching(true);
        const results = await searchGuests(eventId, query);
        setGuestsList(results);
      } catch (err) {
        console.warn('Erro ao carregar lista de convidados:', err);
      } finally {
        setSearching(false);
      }
    },
    [eventId, searchQuery],
  );

  // Debounce na busca
  useEffect(() => {
    const timer = setTimeout(() => {
      void reloadGuests(searchQuery);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery, reloadGuests]);

  // 3. Sincronizador resiliente da fila SQLite
  const syncQueueNow = useCallback(async () => {
    if (!eventId || isSyncing) return;
    setIsSyncing(true);

    try {
      const result = await syncReceptionQueue(eventId);
      setIsOnline(result.isOnline);
      setPendingCount(result.pendingCount);
    } catch (err) {
      console.warn('Exceção ao sincronizar fila:', err);
      setIsOnline(false);
    } finally {
      setIsSyncing(false);
      await refreshStatsAndQueue();
      await reloadGuests();
    }
  }, [eventId, isSyncing, refreshStatsAndQueue, reloadGuests]);

  const retryNeedsAttentionNow = useCallback(async () => {
    if (!eventId || isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncReceptionQueue(eventId, { retryNeedsAttention: true });
      setIsOnline(result.isOnline);
      setPendingCount(result.pendingCount);
    } catch (err) {
      console.warn('Exceção ao reprocessar itens needs_attention:', err);
      setIsOnline(false);
    } finally {
      setIsSyncing(false);
      await refreshStatsAndQueue();
      await reloadGuests();
    }
  }, [eventId, isSyncing, refreshStatsAndQueue, reloadGuests]);

  // 4. Inicialização da tela
  const initializeScreen = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);

    try {
      await initReceptionDatabase();

      let localSnapshot = await getSnapshot(eventId);
      if (!localSnapshot) {
        try {
          localSnapshot = await downloadAndSaveEventSnapshot(eventId);
          if (localSnapshot) setIsOnline(true);
        } catch {
          setIsOnline(false);
        }
      }

      setSnapshot(localSnapshot);
      await refreshStatsAndQueue();
      await reloadGuests('');
    } catch (err) {
      console.error('Erro na inicialização da Portaria Prime:', err);
      Alert.alert(
        'Erro de Inicialização',
        'Não foi possível inicializar o banco de dados local da Portaria.',
      );
    } finally {
      setLoading(false);
    }
  }, [eventId, refreshStatsAndQueue, reloadGuests]);

  useEffect(() => {
    void initializeScreen();
  }, [initializeScreen]);

  // Watcher em background para sincronização automática
  useEffect(() => {
    if (!eventId) return;
    const unsubscribe = startQueueSyncWatcher(eventId, 10000, (status) => {
      setIsOnline(status.isOnline);
      setPendingCount(status.pendingCount);
    });
    return () => {
      unsubscribe();
    };
  }, [eventId]);

  // 5. Ação: Alternar Convidado no Carro (Car Basket)
  const toggleGuestInCar = useCallback(
    (guest: ReceptionGuest) => {
      if (guest.checked_in_at) {
        void playReceptionSound('already_checked_in');
        void AppHaptics.warning();
        Alert.alert(
          'Convidado Já Confirmado',
          `${guest.name} já realizou check-in às ${new Date(guest.checked_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
        );
        return;
      }

      void AppHaptics.selection();
      setSelectedCarGuests((prev) => {
        const next = new Map(prev);
        if (next.has(guest.id)) {
          next.delete(guest.id);
        } else {
          next.set(guest.id, guest);
        }
        return next;
      });
    },
    [],
  );

  // Ação: Adicionar toda a família do convidado ao Carro com 1 toque
  const handleSelectEntireFamily = useCallback(
    async (guest: ReceptionGuest) => {
      if (!guest.family_group_id) return;
      void AppHaptics.medium();

      try {
        const members = await getFamilyGroupMembers(eventId, guest.family_group_id);
        setSelectedCarGuests((prev) => {
          const next = new Map(prev);
          for (const member of members) {
            // Não adiciona quem já fez check-in antes
            if (!member.checked_in_at) {
              next.set(member.id, member);
            }
          }
          return next;
        });
      } catch (err) {
        console.warn('Erro ao buscar família:', err);
      }
    },
    [eventId],
  );

  // Ação: Remover convidado individual do carro
  const handleRemoveFromCar = useCallback((guestId: string) => {
    setSelectedCarGuests((prev) => {
      const next = new Map(prev);
      next.delete(guestId);
      return next;
    });
  }, []);

  // Ação: Limpar seleção do carro
  const handleClearCar = useCallback(() => {
    setSelectedCarGuests(new Map());
  }, []);

  // 6. Confirmação do Carro / Grupo de Alto Fluxo (Car Check-In)
  const handleConfirmCar = async () => {
    const guestsToConfirm = Array.from(selectedCarGuests.values());
    if (guestsToConfirm.length === 0 || processingCar) return;

    setProcessingCar(true);

    try {
      // 1. Agrupa os passageiros por grupo familiar (para respeitar a invariante do PostgreSQL)
      const familyGroups = new Map<string, ReceptionGuest[]>();
      const individualGuests: ReceptionGuest[] = [];

      for (const guest of guestsToConfirm) {
        if (guest.family_group_id) {
          const group = familyGroups.get(guest.family_group_id) ?? [];
          group.push(guest);
          familyGroups.set(guest.family_group_id, group);
        } else {
          individualGuests.push(guest);
        }
      }

      const nowIso = new Date().toISOString();

      // 2. Enfileira operações atômicas no SQLite local
      // A) Grupos familiares
      for (const [_, members] of familyGroups.entries()) {
        const groupLeader = members.find((m) => m.is_group_leader) || members[0];
        const memberIds = members.map((m) => m.id);

        await enqueueCheckIn({
          event_id: eventId,
          scanned_qr_token: groupLeader.qr_token,
          scanned_guest_id: groupLeader.id,
          confirmed_guest_ids: memberIds,
          scanned_at: nowIso,
        });
      }

      // B) Convidados individuais (ex: Valmira de carona)
      for (const guest of individualGuests) {
        await enqueueCheckIn({
          event_id: eventId,
          scanned_qr_token: guest.qr_token,
          scanned_guest_id: guest.id,
          confirmed_guest_ids: [guest.id],
          scanned_at: nowIso,
        });
      }

      // 3. Feedback visual e sonoro imediato
      void playReceptionSound('confirmed');
      void AppHaptics.success();

      // 4. Salva convidados confirmados para o modal de resumo das mesas
      setJustConfirmedGuests(guestsToConfirm);
      setCarConfirmationVisible(true);

      // 5. Limpa a bandeja do carro e o filtro de busca para o próximo veículo
      setSelectedCarGuests(new Map());
      setSearchQuery('');

      // 6. Atualiza dados locais
      await refreshStatsAndQueue();
      await reloadGuests('');

      // 7. Dispara sincronização em segundo plano se online
      if (isOnline) {
        void syncQueueNow();
      }
    } catch (err) {
      console.error('Erro ao confirmar check-in do carro:', err);
      void playReceptionSound('needs_attention');
      void AppHaptics.error();
      Alert.alert(
        'Erro na Gravação',
        'Não foi possível salvar o check-in no banco local. Tente novamente.',
      );
    } finally {
      setProcessingCar(false);
    }
  };

  // 7. Handler do Scanner QR Code com a Câmera
  const handleScan = async (scannedData: string) => {
    const scanPermission = canScanForEvent(snapshot);
    if (!scanPermission.allowed) {
      void playReceptionSound('rejected');
      void AppHaptics.error();
      Alert.alert(
        'Operação Encerrada',
        scanPermission.reason || 'O prazo da portaria expirou às 12:00.',
      );
      setScannerModalVisible(false);
      return;
    }

    let token = scannedData.trim();
    if (token.includes('?')) {
      try {
        const urlParams = new URLSearchParams(token.split('?')[1]);
        const extracted = urlParams.get('token') || urlParams.get('t') || urlParams.get('qr');
        if (extracted) token = extracted;
      } catch {
        // Mantém token original
      }
    }

    let guest = await findGuestByQrToken(eventId, token);
    if (!guest) {
      guest = await findGuestById(eventId, token);
    }

    // Não encontrado
    if (!guest) {
      void playReceptionSound('rejected');
      void AppHaptics.error();
      Alert.alert(
        'Não Identificado',
        'QR Code não pertence a nenhum convidado deste evento.',
      );
      return;
    }

    // Já confirmado anteriormente
    if (guest.checked_in_at) {
      void playReceptionSound('already_checked_in');
      void AppHaptics.warning();
      Alert.alert(
        'Convidado Já Confirmado',
        `${guest.name} já realizou check-in anteriormente às ${new Date(guest.checked_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
      );
      return;
    }

    // Se pertence a família, abre o modal de seleção familiar
    if (guest.family_group_id) {
      const members = await getFamilyGroupMembers(eventId, guest.family_group_id);
      if (members.length > 1) {
        setScannerModalVisible(false);
        setFamilyMembers(members);
        setPendingFamilyGuest(guest);
        setFamilyModalVisible(true);
        return;
      }
    }

    // Convidado individual escaneado via câmera: adiciona ao carro e fecha scanner
    void AppHaptics.success();
    void playReceptionSound('confirmed');
    setSelectedCarGuests((prev) => {
      const next = new Map(prev);
      next.set(guest!.id, guest!);
      return next;
    });

    setScannerModalVisible(false);
  };

  // Confirmação do modal de família vindo do scanner
  const handleConfirmFamilyModal = (confirmedIds: string[]) => {
    setFamilyModalVisible(false);
    if (confirmedIds.length === 0) return;

    void AppHaptics.selection();
    setSelectedCarGuests((prev) => {
      const next = new Map(prev);
      for (const id of confirmedIds) {
        const member = familyMembers.find((m) => m.id === id);
        if (member) next.set(member.id, member);
      }
      return next;
    });

    setPendingFamilyGuest(null);
  };

  const selectedCount = selectedCarGuests.size;
  const selectedGuestsList = useMemo(() => Array.from(selectedCarGuests.values()), [selectedCarGuests]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0B132B" />
        <ActivityIndicator size="large" color="#F2D875" />
        <Text style={styles.loadingText}>Carregando Portaria Prime...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B132B" />

      {/* 1. Header Superior com Acessibilidade e Status */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Voltar para a tela anterior"
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Portaria Prime</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {snapshot?.name || 'Evento'}
          </Text>
        </View>

        {/* Badge de Estatística de Presença */}
        <View style={styles.statsBadge}>
          <Ionicons name="people" size={14} color="#D4AF37" />
          <Text style={styles.statsBadgeText}>
            {stats.checkedIn}/{stats.total}
          </Text>
        </View>
      </View>

      {/* 2. Banner de Status Offline e Fila Local */}
      <OfflineQueueBanner
        isOnline={isOnline}
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        onSyncPress={() => void syncQueueNow()}
      />

      {/* 3. Botão Generoso de QR Code para Escanear com a Câmera */}
      <View style={styles.heroActionContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.heroScanButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => {
            void AppHaptics.medium();
            setScannerModalVisible(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Escanear convite com a câmera"
        >
          <View style={styles.heroScanIconWrap}>
            <Ionicons name="qr-code-outline" size={26} color="#111318" />
          </View>
          <View style={styles.heroScanCopy}>
            <Text style={styles.heroScanTitle}>Escanear Convite (QR Code)</Text>
            <Text style={styles.heroScanSubtitle}>
              Apontar câmera para leitura instantânea de convite
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#111318" />
        </Pressable>
      </View>

      {/* 4. Campo de Busca Rápida por Nome ou Sobrenome (ex: Borges, Valmira) */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome ou sobrenome (ex: Borges)..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
            accessibilityLabel="Buscar convidados por nome ou sobrenome"
          />
          {searchQuery.length > 0 && (
            <Pressable
              style={styles.searchClearBtn}
              onPress={() => {
                void AppHaptics.light();
                setSearchQuery('');
              }}
              hitSlop={8}
              accessibilityLabel="Limpar busca"
            >
              <Ionicons name="close-circle" size={20} color="#94A3B8" />
            </Pressable>
          )}
        </View>
      </View>

      {/* 5. Lista de Convidados de Alto Fluxo */}
      <FlatList
        data={guestsList}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.listContent,
          selectedCount > 0 && styles.listContentWithBasket,
        ]}
        renderItem={({ item }) => {
          const isSelected = selectedCarGuests.has(item.id);
          const isCheckedIn = Boolean(item.checked_in_at);
          const hasFamily = Boolean(item.family_group_id);

          return (
            <Pressable
              style={({ pressed }) => [
                styles.guestCard,
                isSelected && styles.guestCardSelected,
                isCheckedIn && styles.guestCardCheckedIn,
                pressed && !isCheckedIn && styles.guestCardPressed,
              ]}
              onPress={() => toggleGuestInCar(item)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${item.name}, ${item.table_name || 'sem mesa'}, ${isCheckedIn ? 'já confirmado' : isSelected ? 'selecionado no carro' : 'não confirmado'}`}
            >
              <View style={styles.guestCardLeft}>
                {/* Checkbox circular de seleção */}
                <View
                  style={[
                    styles.checkboxCircle,
                    isSelected && styles.checkboxCircleSelected,
                    isCheckedIn && styles.checkboxCircleCheckedIn,
                  ]}
                >
                  {isCheckedIn ? (
                    <Ionicons name="checkmark" size={16} color="#64748B" />
                  ) : isSelected ? (
                    <Ionicons name="checkmark" size={16} color="#111318" />
                  ) : (
                    <Ionicons name="add" size={16} color="#94A3B8" />
                  )}
                </View>

                {/* Dados do Convidado */}
                <View style={styles.guestCardInfo}>
                  <View style={styles.guestNameRow}>
                    <Text
                      style={[
                        styles.guestNameText,
                        isCheckedIn && styles.guestNameTextCheckedIn,
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </View>

                  <View style={styles.guestMetaRow}>
                    {item.table_name ? (
                      <View style={styles.tableBadge}>
                        <Ionicons name="restaurant-outline" size={11} color="#D4AF37" />
                        <Text style={styles.tableBadgeText}>{item.table_name}</Text>
                      </View>
                    ) : (
                      <Text style={styles.guestMetaText}>Sem mesa definida</Text>
                    )}

                    {hasFamily && (
                      <View style={styles.familyBadge}>
                        <Ionicons name="people-outline" size={11} color="#38BDF8" />
                        <Text style={styles.familyBadgeText}>
                          {item.is_group_leader ? 'Líder Familiar' : 'Família'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Lado Direito: Ações rápidas */}
              <View style={styles.guestCardRight}>
                {isCheckedIn ? (
                  <View style={styles.checkedInBadge}>
                    <Ionicons name="checkmark-done" size={13} color="#22C55E" />
                    <Text style={styles.checkedInBadgeText}>Já entrou</Text>
                  </View>
                ) : hasFamily && !isSelected ? (
                  <Pressable
                    style={styles.selectFamilyBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      void handleSelectEntireFamily(item);
                    }}
                    hitSlop={6}
                    accessibilityLabel={`Selecionar toda a família de ${item.name}`}
                  >
                    <Ionicons name="people" size={14} color="#F2D875" />
                    <Text style={styles.selectFamilyBtnText}>+ Família</Text>
                  </Pressable>
                ) : isSelected ? (
                  <View style={styles.inCarBadge}>
                    <Ionicons name="car" size={13} color="#111318" />
                    <Text style={styles.inCarBadgeText}>No Carro</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {searching ? (
              <ActivityIndicator color="#F2D875" size="small" />
            ) : (
              <>
                <Ionicons name="search-outline" size={36} color="#64748B" />
                <Text style={styles.emptyTitle}>
                  {searchQuery ? 'Nenhum convidado encontrado' : 'Nenhum convidado cadastrado'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery
                    ? `Verifique a ortografia ou limpe a busca para ver todos.`
                    : 'A lista de convidados será sincronizada automaticamente.'}
                </Text>
              </>
            )}
          </View>
        }
      />

      {/* 6. Bandeja Flutuante do Carro / Grupo (Car Basket) */}
      <CarBasketBar
        selectedGuests={selectedGuestsList}
        onRemoveGuest={handleRemoveFromCar}
        onClearAll={handleClearCar}
        onConfirmCar={() => void handleConfirmCar()}
        loading={processingCar}
      />

      {/* 7. Modal de Scanner em Tela Cheia */}
      <Modal
        visible={scannerModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setScannerModalVisible(false)}
      >
        <SafeAreaView style={styles.scannerModalContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />

          {/* Barra Superior do Scanner */}
          <View style={styles.scannerTopBar}>
            <Pressable
              style={styles.scannerCloseButton}
              onPress={() => setScannerModalVisible(false)}
              hitSlop={12}
              accessibilityLabel="Fechar leitor de QR Code"
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </Pressable>

            <Text style={styles.scannerModalTitle}>Leitor de Convites</Text>

            <Pressable
              style={styles.torchButton}
              onPress={() => setTorchEnabled((prev) => !prev)}
              hitSlop={10}
              accessibilityLabel="Alternar lanterna"
            >
              <Ionicons
                name={torchEnabled ? 'flash' : 'flash-off'}
                size={22}
                color={torchEnabled ? '#F2D875' : '#FFFFFF'}
              />
            </Pressable>
          </View>

          {/* Câmera Nativa */}
          <View style={styles.scannerCameraWrapper}>
            <NativeScannerView
              active={scannerModalVisible}
              onScan={(data) => void handleScan(data)}
              torchEnabled={torchEnabled}
              onTorchToggle={(enabled) => setTorchEnabled(enabled)}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* 8. Modal de Grupo Familiar */}
      <FamilyGroupModal
        visible={familyModalVisible}
        familyMembers={familyMembers}
        onConfirm={handleConfirmFamilyModal}
        onCancel={() => {
          setFamilyModalVisible(false);
          setPendingFamilyGuest(null);
        }}
      />

      {/* 9. Modal de Confirmação do Carro (Resumo das Mesas) */}
      <CarConfirmationModal
        visible={carConfirmationVisible}
        confirmedGuests={justConfirmedGuests}
        onClose={() => setCarConfirmationVisible(false)}
      />

      {/* 10. Card Flutuante de Status do Último Check-in */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B132B',
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
    backgroundColor: '#0B132B',
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
  statsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  statsBadgeText: {
    color: '#F2D875',
    fontSize: 12,
    fontWeight: '800',
  },
  heroActionContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  heroScanButton: {
    backgroundColor: '#F2D875',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#F2D875',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  heroScanIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(17, 19, 24, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  heroScanCopy: {
    flex: 1,
    gap: 2,
  },
  heroScanTitle: {
    color: '#111318',
    fontSize: 16,
    fontWeight: '800',
  },
  heroScanSubtitle: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    padding: 0,
  },
  searchClearBtn: {
    padding: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 8,
  },
  listContentWithBasket: {
    paddingBottom: 16,
  },
  guestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#131E3A',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  guestCardSelected: {
    borderColor: '#F2D875',
    backgroundColor: '#1C2A4F',
  },
  guestCardCheckedIn: {
    opacity: 0.65,
    backgroundColor: '#0F172A',
  },
  guestCardPressed: {
    opacity: 0.85,
  },
  guestCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  checkboxCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#475569',
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCircleSelected: {
    borderColor: '#F2D875',
    backgroundColor: '#F2D875',
  },
  checkboxCircleCheckedIn: {
    borderColor: '#334155',
    backgroundColor: '#1E293B',
  },
  guestCardInfo: {
    flex: 1,
    gap: 4,
  },
  guestNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestNameText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  guestNameTextCheckedIn: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  guestMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  tableBadgeText: {
    color: '#F2D875',
    fontSize: 11,
    fontWeight: '700',
  },
  familyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  familyBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
  },
  guestMetaText: {
    color: '#64748B',
    fontSize: 12,
  },
  guestCardRight: {
    marginLeft: 8,
  },
  checkedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  checkedInBadgeText: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '700',
  },
  selectFamilyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  selectFamilyBtnText: {
    color: '#F2D875',
    fontSize: 11,
    fontWeight: '700',
  },
  inCarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F2D875',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inCarBadgeText: {
    color: '#111318',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  scannerModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scannerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  scannerCloseButton: {
    padding: 6,
  },
  scannerModalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  torchButton: {
    padding: 6,
  },
  scannerCameraWrapper: {
    flex: 1,
  },
  floatingCardContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
  },
});
