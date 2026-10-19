import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../theme/colors';
import type { GuestRow, TableRow } from './types';

export type TableGuestDrawerProps = {
  visible: boolean;
  table: TableRow | null;
  guests: GuestRow[];
  onClose: () => void;
  onAllocateGuest: (guestId: string, tableId: string) => Promise<void> | void;
  onUnallocateGuest?: (guestId: string) => Promise<void> | void;
  onAllocateFamilyGroup?: (familyGroupId: string, tableId: string) => Promise<void> | void;
  onSaveNote?: (tableId: string, note: string | null) => Promise<void> | void;
};

export function TableGuestDrawer({
  visible,
  table,
  guests,
  onClose,
  onAllocateGuest,
  onUnallocateGuest,
  onAllocateFamilyGroup,
  onSaveNote,
}: TableGuestDrawerProps) {
  const [search, setSearch] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [busyGuestId, setBusyGuestId] = useState<string | null>(null);

  // Convidados alocados na mesa atual
  const seatedGuests = useMemo(() => {
    if (!table) return [];
    return guests.filter((g) => g.table_id === table.id);
  }, [guests, table]);

  // Convidados confirmados sem mesa
  const unallocatedConfirmedGuests = useMemo(() => {
    return guests.filter((g) => {
      const isConfirmed = g.confirmed === true || g.rsvp_status === 'confirmed';
      const isUnallocated = !g.table_id || g.table_id === '';
      return isConfirmed && isUnallocated;
    });
  }, [guests]);

  // Contagem geral
  const totalConfirmed = useMemo(() => {
    return guests.filter((g) => g.confirmed === true || g.rsvp_status === 'confirmed').length;
  }, [guests]);

  // Filtragem por busca
  const filteredUnallocated = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return unallocatedConfirmedGuests;
    return unallocatedConfirmedGuests.filter((g) => {
      const name = (g.name || '').toLowerCase();
      const phone = (g.phone || '').toLowerCase();
      return name.includes(query) || phone.includes(query);
    });
  }, [search, unallocatedConfirmedGuests]);

  // Agrupamento por família para cálculo de botões em lote
  const familyGroupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of unallocatedConfirmedGuests) {
      if (g.family_group_id) {
        counts[g.family_group_id] = (counts[g.family_group_id] ?? 0) + 1;
      }
    }
    return counts;
  }, [unallocatedConfirmedGuests]);

  const seatsTotal = Number(table?.seats ?? 0);
  const seatsOccupied = seatedGuests.length;
  const freeSeats = Math.max(0, seatsTotal - seatsOccupied);
  const isFull = seatsTotal > 0 && seatsOccupied >= seatsTotal;

  async function handleAllocate(guestId: string) {
    if (!table) return;
    try {
      Vibration.vibrate(35);
      setBusyGuestId(guestId);
      await onAllocateGuest(guestId, table.id);
    } finally {
      setBusyGuestId(null);
    }
  }

  async function handleAllocateFamily(familyGroupId: string) {
    if (!table) return;
    try {
      Vibration.vibrate(45);
      setBusyGuestId(`family:${familyGroupId}`);
      if (onAllocateFamilyGroup) {
        await onAllocateFamilyGroup(familyGroupId, table.id);
      } else {
        // Fallback: aloca individualmente os membros do grupo
        const members = unallocatedConfirmedGuests.filter((g) => g.family_group_id === familyGroupId);
        for (const member of members) {
          await onAllocateGuest(member.id, table.id);
        }
      }
    } finally {
      setBusyGuestId(null);
    }
  }

  async function handleUnallocate(guestId: string) {
    if (!onUnallocateGuest) return;
    try {
      Vibration.vibrate(35);
      setBusyGuestId(guestId);
      await onUnallocateGuest(guestId);
    } finally {
      setBusyGuestId(null);
    }
  }

  async function handleSaveNote() {
    if (!table || !onSaveNote) return;
    await onSaveNote(table.id, noteDraft.trim() || null);
    setEditingNote(false);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissOverlay} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheetContainer}>
          {/* Barra de arraste visual */}
          <View style={styles.dragHandleWrap}>
            <View style={styles.dragHandle} />
          </View>

          {/* Cabeçalho */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.tableBadge}>
                <MaterialCommunityIcons name="table-chair" size={20} color={colors.primaryStrong} />
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {table ? (table.name || 'Mesa sem nome') : 'Alocação de Convidados'}
                </Text>
                {table ? (
                  <View style={styles.occupancyRow}>
                    <Text style={styles.occupancyText}>
                      {seatsOccupied}/{seatsTotal} lugares
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        isFull
                          ? styles.statusPillFull
                          : seatsOccupied > 0
                          ? styles.statusPillPartial
                          : styles.statusPillEmpty,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          isFull
                            ? styles.statusPillTextFull
                            : seatsOccupied > 0
                            ? styles.statusPillTextPartial
                            : styles.statusPillTextEmpty,
                        ]}
                      >
                        {isFull ? 'Lotada' : `${freeSeats} livres`}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.headerSubtitle}>
                    {unallocatedConfirmedGuests.length} sem mesa de {totalConfirmed} confirmados
                  </Text>
                )}
              </View>
            </View>

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={20} color={colors.mutedText} />
            </Pressable>
          </View>

          {/* Nota da mesa */}
          {table && onSaveNote ? (
            <View style={styles.noteSection}>
              {editingNote ? (
                <View style={styles.noteEditor}>
                  <TextInput
                    style={styles.noteInput}
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    placeholder="Ex.: Família da noiva, perto da pista..."
                    placeholderTextColor={colors.mutedText}
                    autoFocus
                  />
                  <View style={styles.noteActions}>
                    <Pressable style={styles.noteCancelBtn} onPress={() => setEditingNote(false)}>
                      <Text style={styles.noteCancelText}>Cancelar</Text>
                    </Pressable>
                    <Pressable style={styles.noteSaveBtn} onPress={() => void handleSaveNote()}>
                      <Text style={styles.noteSaveText}>Salvar</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  style={styles.noteDisplay}
                  onPress={() => {
                    setNoteDraft(table.note || '');
                    setEditingNote(true);
                  }}
                >
                  <MaterialCommunityIcons name="note-text-outline" size={14} color={colors.mutedText} />
                  <Text style={styles.noteDisplayText} numberOfLines={1}>
                    {table.note ? table.note : 'Toque para adicionar observação nesta mesa'}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {/* Campo de Busca */}
          <View style={styles.searchWrap}>
            <MaterialCommunityIcons name="magnify" size={18} color={colors.mutedText} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar convidado confirmado..."
              placeholderTextColor={colors.mutedText}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')}>
                <MaterialCommunityIcons name="close-circle" size={16} color={colors.mutedText} />
              </Pressable>
            ) : null}
          </View>

          {/* Conteúdo com rolagem */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Seção 1: Convidados já sentados nesta mesa */}
            {table && seatedGuests.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Alocados nesta mesa ({seatedGuests.length})
                </Text>
                {seatedGuests.map((guest) => (
                  <View key={guest.id} style={styles.guestItem}>
                    <View style={styles.guestInfo}>
                      <Text style={styles.guestName}>{guest.name || 'Convidado'}</Text>
                      {guest.phone ? <Text style={styles.guestPhone}>{guest.phone}</Text> : null}
                    </View>
                    {onUnallocateGuest ? (
                      <Pressable
                        style={styles.unassignBtn}
                        disabled={busyGuestId === guest.id}
                        onPress={() => void handleUnallocate(guest.id)}
                      >
                        {busyGuestId === guest.id ? (
                          <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                          <Text style={styles.unassignBtnText}>Remover</Text>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {/* Seção 2: Convidados confirmados aguardando lugar */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>
                  Aguardando mesa ({filteredUnallocated.length})
                </Text>
                <Text style={styles.sectionBadge}>
                  {unallocatedConfirmedGuests.length} de {totalConfirmed} confirmados
                </Text>
              </View>

              {filteredUnallocated.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <MaterialCommunityIcons name="check-all" size={32} color={colors.primaryStrong} />
                  <Text style={styles.emptyTitle}>
                    {unallocatedConfirmedGuests.length === 0
                      ? 'Todos os convidados confirmados estão alocados!'
                      : 'Nenhum convidado encontrado com este termo.'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {unallocatedConfirmedGuests.length === 0
                      ? 'Excelente organização! Seu salão está completamente preenchido.'
                      : 'Tente buscar por outro nome ou número de telefone.'}
                  </Text>
                </View>
              ) : (
                filteredUnallocated.map((guest) => {
                  const familyCount = guest.family_group_id ? familyGroupCounts[guest.family_group_id] ?? 0 : 0;
                  const isBusy = busyGuestId === guest.id;
                  const isFamilyBusy = guest.family_group_id && busyGuestId === `family:${guest.family_group_id}`;

                  return (
                    <View key={guest.id} style={styles.guestItem}>
                      <View style={styles.guestInfo}>
                        <Text style={styles.guestName}>{guest.name || 'Convidado'}</Text>
                        {guest.phone ? <Text style={styles.guestPhone}>{guest.phone}</Text> : null}
                        {guest.family_group_id && familyCount > 1 ? (
                          <View style={styles.familyPill}>
                            <MaterialCommunityIcons name="account-group" size={12} color="#0369A1" />
                            <Text style={styles.familyPillText}>
                              Grupo familiar com {familyCount} membros
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {table ? (
                        <View style={styles.actionButtonsCol}>
                          <Pressable
                            style={[styles.assignBtn, isFull ? styles.assignBtnDisabled : null]}
                            disabled={Boolean(isBusy || isFamilyBusy)}
                            onPress={() => void handleAllocate(guest.id)}
                          >
                            {isBusy ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <MaterialCommunityIcons name="plus" size={14} color="#FFFFFF" />
                                <Text style={styles.assignBtnText}>Alocar</Text>
                              </>
                            )}
                          </Pressable>

                          {guest.family_group_id && familyCount > 1 ? (
                            <Pressable
                              style={styles.batchFamilyBtn}
                              disabled={Boolean(isBusy || isFamilyBusy)}
                              onPress={() => void handleAllocateFamily(guest.family_group_id!)}
                            >
                              {isFamilyBusy ? (
                                <ActivityIndicator size="small" color={colors.primaryStrong} />
                              ) : (
                                <Text style={styles.batchFamilyBtnText}>
                                  + Família ({familyCount})
                                </Text>
                              )}
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  dismissOverlay: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '84%',
    minHeight: '48%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tableBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.mutedText,
    fontWeight: '500',
  },
  occupancyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  occupancyText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedText,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusPillFull: {
    backgroundColor: '#FEE2E2',
  },
  statusPillPartial: {
    backgroundColor: '#E0E7FF',
  },
  statusPillEmpty: {
    backgroundColor: '#F1F5F9',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPillTextFull: {
    color: '#B91C1C',
  },
  statusPillTextPartial: {
    color: '#4338CA',
  },
  statusPillTextEmpty: {
    color: '#64748B',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  noteSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  noteDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteDisplayText: {
    fontSize: 12,
    color: colors.mutedText,
    flex: 1,
  },
  noteEditor: {
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteInput: {
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  noteCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  noteCancelText: {
    fontSize: 12,
    color: colors.mutedText,
    fontWeight: '600',
  },
  noteSaveBtn: {
    backgroundColor: colors.primaryStrong,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  noteSaveText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    padding: 0,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
  },
  section: {
    gap: 8,
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBadge: {
    fontSize: 11,
    color: colors.mutedText,
    fontWeight: '600',
  },
  guestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  guestInfo: {
    flex: 1,
    gap: 2,
  },
  guestName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  guestPhone: {
    fontSize: 12,
    color: colors.mutedText,
  },
  familyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  familyPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369A1',
  },
  actionButtonsCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryStrong,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  assignBtnDisabled: {
    opacity: 0.75,
  },
  assignBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  batchFamilyBtn: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  batchFamilyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  unassignBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  unassignBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 16,
  },
});
