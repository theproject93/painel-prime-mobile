import { useId, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, radii, shadows } from '../../../src/theme/colors';
import { AppHaptics } from '../../../src/lib/haptics';
import { SkeletonList } from '../../../src/components/ui/Skeleton';
import { AtaDocumentModal } from '../../../src/features/meetings/AtaDocumentModal';
import {
  formatMeetingDateTime,
  type Meeting,
} from '../../../src/features/meetings/meetingModel';
import {
  useGlobalMeetingsData,
  type MeetingFilterType,
} from '../../../src/features/meetings/useGlobalMeetingsData';

export default function GlobalMeetingsIndexRoute() {
  const router = useRouter();
  const id = useId();
  const {
    meetings,
    filter,
    setFilter,
    stats,
    loading,
    refreshing,
    error,
    busyAction,
    refresh,
    openHostRoom,
    shareGuestLink,
  } = useGlobalMeetingsData();

  const [viewingAtaMeeting, setViewingAtaMeeting] = useState<Meeting | null>(null);

  const renderStatusPill = (status: string, hasAta: boolean) => {
    if (status === 'active') {
      return (
        <View style={[styles.statusPill, { backgroundColor: '#DCFCE7' }]}>
          <View style={styles.pulseDot} />
          <Text style={[styles.statusPillText, { color: '#16A34A' }]}>Em andamento</Text>
        </View>
      );
    }
    if (status === 'completed') {
      return (
        <View style={[styles.statusPill, { backgroundColor: hasAta ? colors.gold50 : '#F1F5F9' }]}>
          <Ionicons
            name={hasAta ? 'document-text' : 'checkmark-circle-outline'}
            size={12}
            color={hasAta ? colors.gold700 : colors.mutedText}
          />
          <Text
            style={[
              styles.statusPillText,
              { color: hasAta ? colors.gold700 : colors.mutedText },
            ]}
          >
            {hasAta ? 'Ata pronta' : 'Concluída'}
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusPill, { backgroundColor: '#EFF6FF' }]}>
        <Ionicons name="calendar-outline" size={12} color="#2563EB" />
        <Text style={[styles.statusPillText, { color: '#2563EB' }]}>Agendada</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: Meeting }) => {
    const hasAta = Boolean(item.meeting_minutes && item.meeting_minutes.length > 0);
    const eventName = item.event?.name;
    const isBusy = busyAction === `host:${item.id}`;

    return (
      <Pressable
        onPress={() => router.push(`/reunioes/${item.id}` as any)}
        style={[styles.meetingCard, shadows.sm]}
      >
        {/* Top: Event Name and Status */}
        <View style={styles.cardHeader}>
          {eventName ? (
            <View style={styles.eventBadge}>
              <Ionicons name="sparkles" size={10} color={colors.gold700} />
              <Text style={styles.eventBadgeText} numberOfLines={1}>
                {eventName}
              </Text>
            </View>
          ) : (
            <View style={styles.eventBadge}>
              <Text style={styles.eventBadgeText}>Reunião Geral</Text>
            </View>
          )}
          {renderStatusPill(item.status, hasAta)}
        </View>

        {/* Title & DateTime */}
        <Text style={styles.cardTitle}>{item.title}</Text>
        <View style={styles.dateRow}>
          <Ionicons name="time-outline" size={14} color={colors.mutedText} />
          <Text style={styles.dateText}>{formatMeetingDateTime(item.scheduled_at)}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.cardActionsRow}>
          {item.status !== 'completed' ? (
            <Pressable
              onPress={() => void openHostRoom(item)}
              disabled={isBusy}
              style={styles.hostBtn}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="videocam" size={14} color="#FFFFFF" />
                  <Text style={styles.hostBtnText}>Entrar na Sala</Text>
                </>
              )}
            </Pressable>
          ) : null}

          {item.room_url && item.status !== 'completed' ? (
            <Pressable
              onPress={() => void shareGuestLink(item)}
              style={styles.shareBtn}
            >
              <Ionicons name="share-social-outline" size={14} color={colors.text} />
              <Text style={styles.shareBtnText}>Convite</Text>
            </Pressable>
          ) : null}

          {hasAta ? (
            <Pressable
              onPress={() => setViewingAtaMeeting(item)}
              style={styles.ataBtn}
            >
              <Ionicons name="document-text" size={14} color={colors.gold700} />
              <Text style={styles.ataBtnText}>Ver Ata</Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Bar */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Central de Reuniões</Text>
          <Text style={styles.headerSubtitle}>Videoconferências e Atas Plan IA</Text>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        {/* Total */}
        <Pressable
          onPress={() => {
            AppHaptics.selection();
            setFilter('all');
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.statCard, filter === 'all' && styles.statCardActive]}
        >
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{stats.total}</Text>
        </Pressable>

        {/* Agendadas */}
        <Pressable
          onPress={() => {
            AppHaptics.selection();
            setFilter('scheduled');
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.statCard, filter === 'scheduled' && styles.statCardActive]}
        >
          <Text style={styles.statLabel}>Agendadas</Text>
          <Text style={[styles.statValue, { color: '#2563EB' }]}>{stats.scheduled}</Text>
        </Pressable>

        {/* Ativas */}
        <Pressable
          onPress={() => {
            AppHaptics.selection();
            setFilter('active');
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.statCard, filter === 'active' && styles.statCardActive]}
        >
          <Text style={styles.statLabel}>Ao Vivo</Text>
          <Text style={[styles.statValue, { color: '#16A34A' }]}>{stats.active}</Text>
        </Pressable>

        {/* Concluídas */}
        <Pressable
          onPress={() => {
            AppHaptics.selection();
            setFilter('completed');
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.statCard, filter === 'completed' && styles.statCardActive]}
        >
          <Text style={styles.statLabel}>Com Ata</Text>
          <Text style={[styles.statValue, { color: colors.gold700 }]}>{stats.completed}</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.dangerText} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Meetings List */}
      {loading && !refreshing ? (
        <View style={{ paddingTop: 8 }}>
          <SkeletonList count={4} />
        </View>
      ) : (
        <FlatList
          data={meetings}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.gold700}
              colors={[colors.gold700]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="videocam-outline" size={44} color={colors.borderStrong} />
              <Text style={styles.emptyTitle}>Nenhuma reunião encontrada</Text>
              <Text style={styles.emptySubtitle}>
                Suas chamadas por Daily.co e atas geradas pela inteligência artificial aparecerão aqui.
              </Text>
            </View>
          }
        />
      )}

      {/* Ata Document Modal */}
      {viewingAtaMeeting ? (
        <AtaDocumentModal
          visible={Boolean(viewingAtaMeeting)}
          onClose={() => setViewingAtaMeeting(null)}
          meeting={viewingAtaMeeting}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardActive: {
    borderColor: colors.gold600,
    backgroundColor: colors.gold50,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.danger100,
    padding: 8,
    marginHorizontal: 16,
    borderRadius: radii.sm,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: colors.dangerText,
    flex: 1,
  },
  centerLoading: {
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
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  meetingCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 200,
  },
  eventBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold700,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 12,
    color: colors.mutedText,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  hostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryStrong,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  hostBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF7F1',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  ataBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold50,
    borderWidth: 1,
    borderColor: colors.gold200,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  ataBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold700,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 20,
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
