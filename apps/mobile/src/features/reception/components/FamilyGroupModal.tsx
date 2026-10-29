import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReceptionGuest } from '../types/receptionTypes';
import { AppHaptics } from '../../../lib/haptics';

export interface FamilyGroupModalProps {
  visible: boolean;
  familyMembers: ReceptionGuest[];
  onConfirm: (confirmedGuestIds: string[]) => void;
  onCancel: () => void;
}

export function FamilyGroupModal({
  visible,
  familyMembers,
  onConfirm,
  onCancel,
}: FamilyGroupModalProps) {
  // Inicializa checkboxes: pré-seleciona membros que ainda não fizeram check-in
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible && familyMembers.length > 0) {
      // Pré-seleciona todos os membros (ou os que ainda não entraram)
      const initial = new Set<string>();
      familyMembers.forEach((member) => {
        // Se ainda não deu check-in, pré-seleciona para agilizar a entrada
        if (!member.checked_in_at) {
          initial.add(member.id);
        }
      });
      // Se todos já deram check-in, marca todos por padrão
      if (initial.size === 0) {
        familyMembers.forEach((m) => initial.add(m.id));
      }
      setSelectedIds(initial);
    }
  }, [visible, familyMembers]);

  const toggleMember = (id: string) => {
    void AppHaptics.selection();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    void AppHaptics.selection();
    const all = new Set(familyMembers.map((m) => m.id));
    setSelectedIds(all);
  };

  const deselectAll = () => {
    void AppHaptics.selection();
    setSelectedIds(new Set());
  };

  const handleConfirm = () => {
    const confirmedList = Array.from(selectedIds);
    void AppHaptics.success();
    onConfirm(confirmedList);
  };

  const selectedCount = selectedIds.size;
  const totalCount = familyMembers.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="people" size={24} color="#023C69" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Grupo Familiar</Text>
              <Text style={styles.subtitle}>
                Desmarque quem não compareceu antes de confirmar
              </Text>
            </View>
            <Pressable onPress={onCancel} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748B" />
            </Pressable>
          </View>

          {/* Atalhos de Seleção Rápida */}
          <View style={styles.actionBar}>
            <Text style={styles.countText}>
              <Text style={styles.countNumber}>{selectedCount}</Text> de {totalCount} selecionados
            </Text>
            <View style={styles.quickButtons}>
              <Pressable onPress={selectAll} style={styles.quickBtn}>
                <Text style={styles.quickBtnText}>Marcar Todos</Text>
              </Pressable>
              <Text style={styles.quickDivider}>•</Text>
              <Pressable onPress={deselectAll} style={styles.quickBtn}>
                <Text style={styles.quickBtnText}>Desmarcar Todos</Text>
              </Pressable>
            </View>
          </View>

          {/* Lista de Integrantes do Grupo */}
          <FlatList
            data={familyMembers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSelected = selectedIds.has(item.id);
              const isAlreadyCheckedIn = Boolean(item.checked_in_at);

              return (
                <Pressable
                  style={[
                    styles.memberCard,
                    isSelected && styles.memberCardSelected,
                  ]}
                  onPress={() => toggleMember(item.id)}
                >
                  <View style={styles.checkboxContainer}>
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={isSelected ? '#023C69' : '#94A3B8'}
                    />
                  </View>

                  <View style={styles.memberInfo}>
                    <View style={styles.nameRow}>
                      <Text
                        style={[
                          styles.memberName,
                          isSelected && styles.memberNameSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {item.is_group_leader && (
                        <View style={styles.leaderBadge}>
                          <Text style={styles.leaderBadgeText}>Líder</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.metaRow}>
                      {item.table_name ? (
                        <Text style={styles.metaLabel}>
                          Mesa: {item.table_name}
                        </Text>
                      ) : null}

                      {isAlreadyCheckedIn && (
                        <View style={styles.alreadyBadge}>
                          <Ionicons name="checkmark-done" size={12} color="#F97316" />
                          <Text style={styles.alreadyBadgeText}>Já chegou</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />

          {/* Rodapé de Ações */}
          <View style={styles.footer}>
            <Pressable
              style={styles.cancelButton}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>

            <Pressable
              style={[
                styles.confirmButton,
                selectedCount === 0 && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={selectedCount === 0}
            >
              <Ionicons name="checkmark-sharp" size={18} color="#FFFFFF" />
              <Text style={styles.confirmButtonText}>
                Confirmar Entrada ({selectedCount})
              </Text>
            </Pressable>
          </View>
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
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  countText: {
    fontSize: 13,
    color: '#475569',
  },
  countNumber: {
    fontWeight: '800',
    color: '#023C69',
  },
  quickButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#023C69',
  },
  quickDivider: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  memberCardSelected: {
    borderColor: '#023C69',
    backgroundColor: '#F0F7FF',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
  },
  memberNameSelected: {
    color: '#0F172A',
  },
  leaderBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
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
    gap: 10,
  },
  metaLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  alreadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  alreadyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#023C69',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
