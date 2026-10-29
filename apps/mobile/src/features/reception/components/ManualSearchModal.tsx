import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReceptionGuest } from '../types/receptionTypes';
import { searchGuests } from '../storage/receptionDatabase';
import { AppHaptics } from '../../../lib/haptics';

export interface ManualSearchModalProps {
  visible: boolean;
  eventId: string;
  onSelectGuest: (guest: ReceptionGuest) => void;
  onClose: () => void;
}

export function ManualSearchModal({
  visible,
  eventId,
  onSelectGuest,
  onClose,
}: ManualSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ReceptionGuest[]>([]);
  const [loading, setLoading] = useState(false);

  const performSearch = useCallback(
    async (searchTerm: string) => {
      if (!eventId) return;
      setLoading(true);
      try {
        const found = await searchGuests(eventId, searchTerm);
        setResults(found);
      } catch (err) {
        console.error('Erro ao buscar convidados na base local:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [eventId],
  );

  useEffect(() => {
    if (visible) {
      setQuery('');
      void performSearch('');
    }
  }, [visible, performSearch]);

  // Debounce de 180ms para evitar concorrência desnecessária no SQLite durante digitação
  useEffect(() => {
    if (!visible || query === '') return;
    const timer = setTimeout(() => {
      void performSearch(query);
    }, 180);
    return () => clearTimeout(timer);
  }, [query, visible, performSearch]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      void performSearch('');
    }
  };

  const handleClear = () => {
    setQuery('');
    void performSearch('');
  };

  const handleSelect = (guest: ReceptionGuest) => {
    void AppHaptics.selection();
    onSelectGuest(guest);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Ionicons name="search" size={20} color="#023C69" />
              <Text style={styles.title}>Buscar Convidado</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748B" />
            </Pressable>
          </View>

          {/* Campo de Busca */}
          <View style={styles.searchBoxContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color="#94A3B8" style={styles.searchIcon} />
              <TextInput
                style={styles.input}
                placeholder="Digite o nome ou telefone..."
                placeholderTextColor="#94A3B8"
                value={query}
                onChangeText={handleQueryChange}
                autoFocus
                autoCapitalize="words"
                returnKeyType="search"
              />
              {Boolean(query) && (
                <Pressable onPress={handleClear} hitSlop={8} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </Pressable>
              )}
            </View>
          </View>

          {/* Lista de Resultados */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#023C69" />
              <Text style={styles.loadingText}>Buscando no banco local...</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="person-remove-outline" size={44} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>Nenhum convidado encontrado</Text>
              <Text style={styles.emptySubtitle}>
                {query
                  ? `Não encontramos resultados para "${query}".`
                  : 'Nenhum convidado sincronizado para este evento.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isCheckedIn = Boolean(item.checked_in_at);

                return (
                  <Pressable
                    style={styles.guestCard}
                    onPress={() => handleSelect(item)}
                  >
                    <View style={styles.guestInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.guestName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.is_group_leader && (
                          <View style={styles.leaderBadge}>
                            <Text style={styles.leaderBadgeText}>Líder</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.metaRow}>
                        {Boolean(item.phone) && (
                          <Text style={styles.metaText}>{item.phone}</Text>
                        )}
                        {Boolean(item.table_name) && (
                          <Text style={styles.metaText}>• Mesa: {item.table_name}</Text>
                        )}
                        {Boolean(item.family_group_id) && (
                          <Text style={styles.familyText}>• Família</Text>
                        )}
                      </View>
                    </View>

                    {/* Status ou Botão de Entrada */}
                    <View style={styles.actionColumn}>
                      {isCheckedIn ? (
                        <View style={styles.checkedInBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                          <Text style={styles.checkedInText}>Já entrou</Text>
                        </View>
                      ) : (
                        <View style={styles.checkInButton}>
                          <Text style={styles.checkInButtonText}>Check-in</Text>
                          <Ionicons name="arrow-forward" size={14} color="#023C69" />
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
  },
  searchBoxContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
  },
  clearBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  guestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  guestInfo: {
    flex: 1,
    gap: 4,
    paddingRight: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guestName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  leaderBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  leaderBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
  },
  familyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#023C69',
  },
  actionColumn: {
    alignItems: 'flex-end',
  },
  checkedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  checkedInText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  checkInButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#023C69',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
});
