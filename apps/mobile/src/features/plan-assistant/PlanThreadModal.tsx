import { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { AppHaptics } from '../../lib/haptics';
import { useKeyboardBottomInset } from '../../lib/useKeyboardBottomInset';
import {
  filterThreadsByQuery,
  groupThreadsByPeriod,
  type PlanAiThread,
} from './planAssistantThreads';

export type PlanThreadModalProps = {
  visible: boolean;
  onClose: () => void;
  threads: PlanAiThread[];
  activeThreadId: string | null;
  onSelectThread: (thread: PlanAiThread) => void;
  onCreateNewThread: () => void;
  onRenameThread: (threadId: string, newTitle: string) => Promise<void>;
  onDeleteThread: (threadId: string) => Promise<void>;
};

export function PlanThreadModal({
  visible,
  onClose,
  threads,
  activeThreadId,
  onSelectThread,
  onCreateNewThread,
  onRenameThread,
  onDeleteThread,
}: PlanThreadModalProps) {
  const keyboardHeight = useKeyboardBottomInset();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingThread, setEditingThread] = useState<PlanAiThread | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const filtered = filterThreadsByQuery(threads, searchQuery);
  const grouped = groupThreadsByPeriod(filtered);

  const sections: Array<{ label: string; data: PlanAiThread[] }> = [
    { label: 'Hoje', data: grouped.today },
    { label: 'Ontem', data: grouped.yesterday },
    { label: 'Últimos 7 dias', data: grouped.last7Days },
    { label: 'Anteriores', data: grouped.older },
  ].filter((s) => s.data.length > 0);

  function handleStartRename(thread: PlanAiThread) {
    void AppHaptics.light();
    setEditingThread(thread);
    setEditTitle(thread.title);
  }

  async function handleConfirmRename() {
    if (!editingThread || !editTitle.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      await onRenameThread(editingThread.id, editTitle.trim());
      void AppHaptics.success();
      setEditingThread(null);
    } catch {
      Alert.alert('Erro', 'Não foi possível renomear a conversa.');
    } finally {
      setSavingEdit(false);
    }
  }

  function handleConfirmDelete(thread: PlanAiThread) {
    void AppHaptics.light();
    Alert.alert(
      'Excluir conversa',
      `Deseja realmente excluir permanentemente a conversa "${thread.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            void onDeleteThread(thread.id).then(() => {
              void AppHaptics.success();
            }).catch(() => {
              Alert.alert('Erro', 'Não foi possível excluir a conversa.');
            });
          },
        },
      ]
    );
  }

  function formatTime(isoString: string) {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
        d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.backdrop,
          Platform.OS === 'android' && keyboardHeight > 0 && { paddingBottom: keyboardHeight },
        ]}
      >
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheetContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Ionicons name="chatbubbles-outline" size={20} color={colors.gold700} />
                <Text style={styles.headerTitle}>Histórico de Conversas</Text>
              </View>
              <Pressable
                style={styles.closeButton}
                onPress={() => {
                  void AppHaptics.light();
                  onClose();
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Fechar histórico de conversas"
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Action Bar: New Chat & Search */}
            <View style={styles.topActions}>
              <Pressable
                style={styles.newChatButton}
                onPress={() => {
                  void AppHaptics.success();
                  onCreateNewThread();
                  onClose();
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Nova conversa"
              >
                <Ionicons name="add" size={20} color="#111113" />
                <Text style={styles.newChatButtonText}>Nova conversa</Text>
              </Pressable>

              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={18} color={colors.mutedText} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar conversas..."
                  placeholderTextColor={colors.mutedText}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  accessibilityLabel="Buscar conversas"
                />
                {searchQuery ? (
                  <Pressable
                    onPress={() => setSearchQuery('')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={16} color={colors.mutedText} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* Thread Sections */}
            {sections.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.mutedText} />
                <Text style={styles.emptyTitle}>Nenhuma conversa encontrada</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery
                    ? 'Tente ajustar os termos da busca.'
                    : 'Suas conversas com a Plan IA aparecerão salvas aqui.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={sections}
                keyExtractor={(item) => item.label}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                renderItem={({ item: section }) => (
                  <View style={styles.sectionWrap}>
                    <Text style={styles.sectionHeader}>{section.label}</Text>
                    {section.data.map((thread) => {
                      const isActive = thread.id === activeThreadId;
                      return (
                        <View
                          key={thread.id}
                          style={[styles.threadRow, isActive && styles.threadRowActive]}
                        >
                          <Pressable
                            style={styles.threadContentPressable}
                            onPress={() => {
                              void AppHaptics.light();
                              onSelectThread(thread);
                              onClose();
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Conversa: ${thread.title}`}
                          >
                            <Ionicons
                              name={isActive ? 'chatbubble' : 'chatbubble-outline'}
                              size={18}
                              color={isActive ? colors.gold700 : colors.mutedText}
                            />
                            <View style={styles.threadInfo}>
                              <Text
                                style={[styles.threadTitle, isActive && styles.threadTitleActive]}
                                numberOfLines={1}
                              >
                                {thread.title}
                              </Text>
                              <Text style={styles.threadTime}>
                                {formatTime(thread.updated_at)}
                              </Text>
                            </View>
                          </Pressable>

                          <View style={styles.threadActions}>
                            <Pressable
                              style={styles.actionIconBtn}
                              onPress={() => handleStartRename(thread)}
                              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                              accessibilityRole="button"
                              accessibilityLabel="Renomear conversa"
                            >
                              <Ionicons name="pencil-outline" size={17} color={colors.mutedText} />
                            </Pressable>

                            <Pressable
                              style={styles.actionIconBtn}
                              onPress={() => handleConfirmDelete(thread)}
                              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                              accessibilityRole="button"
                              accessibilityLabel="Excluir conversa"
                            >
                              <Ionicons name="trash-outline" size={17} color="#E05252" />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              />
            )}
          </View>
        </KeyboardAvoidingView>

        {/* Inline Rename Sub-Modal */}
        {editingThread ? (
          <Modal transparent animationType="fade" visible={Boolean(editingThread)}>
            <View
              style={[
                styles.renameBackdrop,
                Platform.OS === 'android' && keyboardHeight > 0 && { paddingBottom: keyboardHeight },
              ]}
            >
              <View style={styles.renameCard}>
                <Text style={styles.renameTitle}>Renomear conversa</Text>
                <TextInput
                  style={styles.renameInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Título da conversa"
                  placeholderTextColor={colors.mutedText}
                  autoFocus
                  maxLength={60}
                />
                <View style={styles.renameActions}>
                  <Pressable
                    style={styles.renameCancelBtn}
                    onPress={() => setEditingThread(null)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={styles.renameCancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={styles.renameSaveBtn}
                    onPress={() => void handleConfirmRename()}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={styles.renameSaveText}>
                      {savingEdit ? 'Salvando...' : 'Salvar'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  keyboardContainer: {
    width: '100%',
    maxHeight: '90%',
  },
  sheetContainer: {
    backgroundColor: '#111113',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#26262B',
    paddingBottom: 24,
    height: '100%',
    minHeight: 480,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E24',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1C1C22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topActions: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
  },
  newChatButton: {
    minHeight: 46,
    backgroundColor: colors.gold700,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  newChatButtonText: {
    color: '#111113',
    fontSize: 15,
    fontWeight: '700',
  },
  searchWrap: {
    minHeight: 44,
    backgroundColor: '#1A1A20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A32',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 40,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  sectionWrap: {
    marginTop: 14,
  },
  sectionHeader: {
    color: colors.gold700,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#17171C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#24242C',
    marginBottom: 8,
    paddingHorizontal: 12,
    minHeight: 52,
  },
  threadRowActive: {
    borderColor: colors.gold700,
    backgroundColor: '#1E1E26',
  },
  threadContentPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  threadInfo: {
    flex: 1,
  },
  threadTitle: {
    color: '#E5E5EA',
    fontSize: 14,
    fontWeight: '600',
  },
  threadTitleActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  threadTime: {
    color: colors.mutedText,
    fontSize: 11,
    marginTop: 2,
  },
  threadActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  actionIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 10,
    minHeight: 200,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: 'center',
  },
  renameBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  renameCard: {
    width: '100%',
    backgroundColor: '#1A1A20',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2F2F38',
    padding: 20,
    gap: 16,
  },
  renameTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  renameInput: {
    minHeight: 46,
    backgroundColor: '#111113',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#33333D',
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 14,
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  renameCancelBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameCancelText: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: '600',
  },
  renameSaveBtn: {
    minHeight: 44,
    paddingHorizontal: 20,
    backgroundColor: colors.gold700,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameSaveText: {
    color: '#111113',
    fontSize: 14,
    fontWeight: '700',
  },
});
