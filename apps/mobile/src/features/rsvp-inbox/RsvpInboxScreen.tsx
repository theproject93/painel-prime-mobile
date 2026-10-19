import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { RsvpChatView } from './RsvpChatView';
import { RsvpThreadList } from './RsvpThreadList';
import { useRsvpInboxQueue } from './useRsvpInboxQueue';

type Props = {
  eventId: string;
};

export function RsvpInboxScreen({ eventId }: Props) {
  const {
    threads,
    selectedThread,
    selectedThreadId,
    setSelectedThreadId,
    filter,
    setFilter,
    stats,
    loading,
    refreshing,
    error,
    memberSelections,
    setMemberStatus,
    applyAttendance,
    sendClarification,
    markHandoff,
    sendFreeFormMessage,
    resendQrCode,
    refresh,
  } = useRsvpInboxQueue(eventId);

  const [searchQuery, setSearchQuery] = useState('');

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gold700} />
        <Text style={styles.loadingText}>Carregando mensagens do WhatsApp...</Text>
      </View>
    );
  }

  if (selectedThread) {
    return (
      <RsvpChatView
        thread={selectedThread}
        onBack={() => setSelectedThreadId(null)}
        selections={memberSelections}
        onSelectStatus={setMemberStatus}
        onApplyAttendance={applyAttendance}
        onSendClarification={sendClarification}
        onMarkHandoff={markHandoff}
        onSendFreeFormMessage={sendFreeFormMessage}
        onResendQr={resendQrCode}
      />
    );
  }

  return (
    <View style={styles.container}>
      <RsvpThreadList
        threads={threads}
        selectedThreadId={selectedThreadId}
        onSelectThread={(t) => setSelectedThreadId(t.thread_id)}
        filter={filter}
        onFilterChange={setFilter}
        stats={stats}
        refreshing={refreshing}
        onRefresh={refresh}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
