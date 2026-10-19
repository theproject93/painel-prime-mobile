import { Ionicons } from '@expo/vector-icons';
import {
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
import {
  format24hRemaining,
  isWithin24hWindow,
  threadStateLabel,
  type ConversationReviewThread,
  type RsvpInboxFilter,
} from './rsvpInboxModel';

type Props = {
  threads: ConversationReviewThread[];
  selectedThreadId: string | null;
  onSelectThread: (thread: ConversationReviewThread) => void;
  filter: RsvpInboxFilter;
  onFilterChange: (f: RsvpInboxFilter) => void;
  stats: { total: number; attention: number; active: number; resolved: number };
  refreshing: boolean;
  onRefresh: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
};

export function RsvpThreadList({
  threads,
  selectedThreadId,
  onSelectThread,
  filter,
  onFilterChange,
  stats,
  refreshing,
  onRefresh,
  searchQuery,
  onSearchChange,
}: Props) {

  const renderStateBadge = (state: string) => {
    const isHandoff = state === 'handoff';
    const isClarify = state === 'clarify';
    const isResolved = state === 'resolved';

    const bg = isHandoff
      ? colors.danger100
      : isClarify
      ? colors.warning100
      : isResolved
      ? colors.success100
      : '#EFF6FF';
    const textCol = isHandoff
      ? colors.dangerText
      : isClarify
      ? colors.gold700
      : isResolved
      ? colors.success600
      : '#1D4ED8';

    return (
      <View style={[styles.stateBadge, { backgroundColor: bg }]}>
        <Text style={[styles.stateBadgeText, { color: textCol }]}>
          {threadStateLabel(state)}
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: ConversationReviewThread }) => {
    const isSelected = item.thread_id === selectedThreadId;
    const windowOpen = isWithin24hWindow(item.last_inbound_at);
    const lastMsg =
      item.messages && item.messages.length > 0
        ? item.messages[item.messages.length - 1]
        : item.last_inbound_message;
    const lastText = lastMsg?.text_body || 'Sem mensagens recentes';
    const guestCount = item.guests?.length || 1;

    return (
      <Pressable
        onPress={() => onSelectThread(item)}
        style={[
          styles.threadCard,
          shadows.sm,
          isSelected && styles.threadCardSelected,
        ]}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.leaderName} numberOfLines={1}>
                {item.leader_name || 'Convidado WhatsApp'}
              </Text>
              {renderStateBadge(item.state)}
            </View>
            <Text style={styles.phoneText}>
              {item.phone_normalized || item.leader_phone || 'Telefone não informado'}
            </Text>
          </View>
        </View>

        {/* Snippet */}
        <Text style={styles.snippetText} numberOfLines={2}>
          {lastText}
        </Text>

        {/* Footer info */}
        <View style={styles.cardFooter}>
          {/* 24h Window Badge */}
          <View
            style={[
              styles.windowBadge,
              windowOpen ? styles.windowBadgeOpen : styles.windowBadgeClosed,
            ]}
          >
            <Ionicons
              name={windowOpen ? 'shield-checkmark' : 'lock-closed'}
              size={11}
              color={windowOpen ? '#16A34A' : colors.gold700}
            />
            <Text
              style={[
                styles.windowBadgeText,
                { color: windowOpen ? '#16A34A' : colors.gold700 },
              ]}
            >
              {windowOpen
                ? format24hRemaining(item.last_inbound_at)
                : 'Janela 24h fechada'}
            </Text>
          </View>

          {/* Members Count */}
          <View style={styles.membersCountBadge}>
            <Ionicons name="people-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.membersCountText}>
              {guestCount} {guestCount > 1 ? 'convidados' : 'convidado'}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.mutedText} />
          <TextInput
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Buscar por nome, telefone ou mensagem..."
            placeholderTextColor={colors.mutedText}
            style={styles.searchInput}
          />
          {searchQuery ? (
            <Pressable
              onPress={() => onSearchChange('')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Limpar busca"
            >
              <Ionicons name="close-circle" size={16} color={colors.mutedText} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabsRow}>
        <Pressable
          onPress={() => {
            AppHaptics.selection();
            onFilterChange('all');
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
        >
          <Text
            style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}
          >
            Todos ({stats.total})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            AppHaptics.selection();
            onFilterChange('attention');
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          style={[styles.filterTab, filter === 'attention' && styles.filterTabActive]}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === 'attention' && styles.filterTabTextActive,
            ]}
          >
            Atenção ({stats.attention})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            AppHaptics.selection();
            onFilterChange('active');
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          style={[styles.filterTab, filter === 'active' && styles.filterTabActive]}
        >
          <Text
            style={[styles.filterTabText, filter === 'active' && styles.filterTabTextActive]}
          >
            Plan IA ({stats.active})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            AppHaptics.selection();
            onFilterChange('resolved');
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          style={[styles.filterTab, filter === 'resolved' && styles.filterTabActive]}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === 'resolved' && styles.filterTabTextActive,
            ]}
          >
            Resolvidos ({stats.resolved})
          </Text>
        </Pressable>
      </View>

      {/* Threads List */}
      <FlatList
        data={threads}
        keyExtractor={(item) => item.thread_id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold700}
            colors={[colors.gold700]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title={
              searchQuery || filter !== 'all'
                ? 'Nenhuma conversa no filtro'
                : 'Nenhuma conversa na fila de revisão'
            }
            message={
              searchQuery || filter !== 'all'
                ? 'Tente alterar os termos da busca ou alternar a aba de filtro selecionada.'
                : 'As respostas ambíguas e confirmações via WhatsApp aparecerão aqui para triagem rápida.'
            }
            iconName="chatbubbles-outline"
            actionLabel={
              searchQuery || filter !== 'all' ? 'Limpar Filtros' : 'Atualizar Fila'
            }
            onAction={
              searchQuery || filter !== 'all'
                ? () => {
                    onSearchChange('');
                    onFilterChange('all');
                  }
                : onRefresh
            }
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  filterTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 8,
  },
  filterTab: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryStrong,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },
  threadCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  threadCardSelected: {
    borderColor: colors.gold600,
    borderWidth: 1.5,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  leaderName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  stateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  phoneText: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  snippetText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  windowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  windowBadgeOpen: {
    backgroundColor: '#DCFCE7',
  },
  windowBadgeClosed: {
    backgroundColor: '#FEF3C7',
  },
  windowBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  membersCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  membersCountText: {
    fontSize: 11,
    color: colors.mutedText,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 30,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 260,
  },
});
