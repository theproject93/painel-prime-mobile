import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radii, shadows } from '../../theme/colors';
import { AppHaptics } from '../../lib/haptics';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonBox, SkeletonList } from '../../components/ui/Skeleton';
import { PadrinhoFormModal } from './PadrinhoFormModal';
import { PadrinhoPairCard } from './PadrinhoPairCard';
import { PadrinhosPlanIaModal } from './PadrinhosPlanIaModal';
import { PadrinhosStatsCards, type PadrinhosFilterType } from './PadrinhosStatsCards';
import {
  type EventPadrinhoItem,
  type PadrinhoPairGroup,
} from './padrinhosModel';
import { usePadrinhosData } from './usePadrinhosData';

type Props = {
  eventId: string;
  eventType?: string | null;
  isDebutante?: boolean;
};

export function PadrinhosTab({ eventId, eventType, isDebutante = false }: Props) {
  const isDeb = isDebutante || eventType === '15_anos' || eventType === 'debutante';
  const {
    padrinhos,
    pairs,
    guests,
    whatsappCredits,
    loading,
    refreshing,
    error,
    refresh,
    savePadrinho,
    deletePadrinho,
    dispatchPlanIa,
  } = usePadrinhosData(eventId);

  const [activeFilter, setActiveFilter] = useState<PadrinhosFilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<EventPadrinhoItem | null>(null);
  const [companionTarget, setCompanionTarget] = useState<EventPadrinhoItem | null>(null);
  const [planIaModalVisible, setPlanIaModalVisible] = useState(false);
  const [planIaTargetItem, setPlanIaTargetItem] = useState<EventPadrinhoItem | null>(null);

  // Filter pairs based on search and active filter
  const filteredPairs = useMemo(() => {
    return pairs.filter((group: PadrinhoPairGroup) => {
      const primary = group.primary;
      const companion = group.companion;

      // 1. Text Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const primaryMatch = primary.guest?.name.toLowerCase().includes(query);
        const companionMatch = companion?.guest?.name.toLowerCase().includes(query);
        if (!primaryMatch && !companionMatch) return false;
      }

      // 2. Category Filter
      if (activeFilter === 'unpaired') {
        return !companion;
      }
      if (activeFilter === 'confirmed_attire') {
        const primConfirmed = primary.attire_status === 'confirmed';
        const compConfirmed = !companion || companion.attire_status === 'confirmed';
        return primConfirmed && compConfirmed;
      }
      if (activeFilter === 'pending_attire') {
        const primPending = primary.attire_status !== 'confirmed';
        const compPending = companion && companion.attire_status !== 'confirmed';
        return primPending || compPending;
      }

      return true;
    });
  }, [pairs, searchQuery, activeFilter]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setCompanionTarget(null);
    setFormModalVisible(true);
  };

  const handleEdit = (item: EventPadrinhoItem) => {
    setEditingItem(item);
    setCompanionTarget(null);
    setFormModalVisible(true);
  };

  const handlePairCompanion = (primaryItem: EventPadrinhoItem) => {
    setEditingItem(null);
    setCompanionTarget(primaryItem);
    setFormModalVisible(true);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Remover do Cortejo',
      `Tem certeza que deseja remover ${name} do cortejo cerimonial?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePadrinho(id);
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Falha ao remover.';
              Alert.alert('Erro', msg);
            }
          },
        },
      ]
    );
  };

  const handleOpenPlanIa = (item?: EventPadrinhoItem) => {
    setPlanIaTargetItem(item || null);
    setPlanIaModalVisible(true);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <SkeletonBox width="70%" height={44} borderRadius={10} />
          <SkeletonBox width="26%" height={44} borderRadius={10} />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginVertical: 10 }}>
          <SkeletonBox width="23%" height={68} borderRadius={12} />
          <SkeletonBox width="23%" height={68} borderRadius={12} />
          <SkeletonBox width="23%" height={68} borderRadius={12} />
          <SkeletonBox width="23%" height={68} borderRadius={12} />
        </View>
        <SkeletonList count={4} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Controls: Search and Actions */}
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.mutedText} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={isDeb ? 'Buscar na corte de honra...' : 'Buscar padrinhos...'}
            placeholderTextColor={colors.mutedText}
            style={styles.searchInput}
          />
          {searchQuery ? (
            <Pressable
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Limpar busca"
            >
              <Ionicons name="close-circle" size={16} color={colors.mutedText} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={() => handleOpenPlanIa()}
          style={styles.planIaBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Automações Plan IA"
        >
          <Ionicons name="sparkles" size={16} color={colors.gold700} />
          <Text style={styles.planIaBtnText}>Plan IA</Text>
        </Pressable>
      </View>

      {/* Stats Cards */}
      <PadrinhosStatsCards
        activeFilter={activeFilter}
        isDebutante={isDeb}
        onFilterChange={(filter) => {
          AppHaptics.selection();
          setActiveFilter(filter);
        }}
        padrinhos={padrinhos}
      />

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.dangerText} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Pairs List */}
      <FlatList
        data={filteredPairs}
        keyExtractor={(item) => item.pairKey}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.gold700}
            colors={[colors.gold700]}
          />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <PadrinhoPairCard
            pair={item}
            isDebutante={isDeb}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPairCompanion={handlePairCompanion}
            onOpenPlanIa={handleOpenPlanIa}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title={
              searchQuery || activeFilter !== 'all'
                ? 'Nenhum integrante encontrado no filtro'
                : isDeb
                ? 'Nenhuma corte de honra cadastrada'
                : 'Nenhum padrinho cadastrado'
            }
            message={
              searchQuery || activeFilter !== 'all'
                ? 'Tente ajustar o termo digitado ou alternar os filtros acima.'
                : isDeb
                ? 'Adicione damas e cavalheiros de honra para organizar a valsa e o cortejo.'
                : 'Cadastre padrinhos e madrinhas para organizar o cortejo e disparar os trajes.'
            }
            iconName={isDeb ? 'sparkles-outline' : 'people-outline'}
            actionLabel={
              searchQuery || activeFilter !== 'all'
                ? 'Limpar Filtros'
                : isDeb
                ? 'Adicionar à Corte'
                : 'Adicionar Padrinho'
            }
            onAction={
              searchQuery || activeFilter !== 'all'
                ? () => {
                    setSearchQuery('');
                    setActiveFilter('all');
                  }
                : handleOpenAdd
            }
          />
        }
      />

      {/* Floating Action Button (FAB) */}
      <Pressable
        onPress={handleOpenAdd}
        style={[styles.fab, shadows.elevated]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={isDeb ? 'Nova Corte' : 'Novo Padrinho'}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
        <Text style={styles.fabText}>{isDeb ? 'Nova Corte' : 'Novo Padrinho'}</Text>
      </Pressable>

      {/* Modals */}
      <PadrinhoFormModal
        visible={formModalVisible}
        onClose={() => setFormModalVisible(false)}
        onSave={savePadrinho}
        eventId={eventId}
        isDebutante={isDeb}
        editingItem={editingItem}
        companionTarget={companionTarget}
        existingPadrinhos={padrinhos}
        guests={guests}
      />

      <PadrinhosPlanIaModal
        visible={planIaModalVisible}
        onClose={() => setPlanIaModalVisible(false)}
        padrinhos={padrinhos}
        selectedItem={planIaTargetItem}
        whatsappCredits={whatsappCredits}
        isDebutante={isDeb}
        onDispatch={dispatchPlanIa}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.textSecondary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  planIaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold50,
    borderWidth: 1,
    borderColor: colors.gold200,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: radii.md,
  },
  planIaBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold700,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.danger100,
    padding: 8,
    marginHorizontal: 16,
    borderRadius: radii.sm,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 12,
    color: colors.dangerText,
    flex: 1,
  },
  listContent: {
    paddingBottom: 88,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryStrong,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radii.full,
  },
  fabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
