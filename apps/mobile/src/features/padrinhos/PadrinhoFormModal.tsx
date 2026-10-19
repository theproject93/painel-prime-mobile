import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { AppHaptics } from '../../lib/haptics';
import { colors, radii, shadows } from '../../theme/colors';
import {
  ROLE_OPTIONS_DEBUTANTE,
  ROLE_OPTIONS_WEDDING,
  SPECIAL_ROLES,
  type AttireStatus,
  type EventPadrinhoGuest,
  type EventPadrinhoItem,
  type PadrinhoRole,
  type PadrinhoSide,
} from './padrinhosModel';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (payload: Partial<EventPadrinhoItem> & { event_id: string; guest_id: string }) => Promise<unknown>;
  eventId: string;
  isDebutante?: boolean;
  editingItem?: EventPadrinhoItem | null;
  companionTarget?: EventPadrinhoItem | null;
  existingPadrinhos: EventPadrinhoItem[];
  guests: EventPadrinhoGuest[];
};

export function PadrinhoFormModal({
  visible,
  onClose,
  onSave,
  eventId,
  isDebutante = false,
  editingItem,
  companionTarget,
  existingPadrinhos,
  guests,
}: Props) {
  const [guestId, setGuestId] = useState('');
  const [role, setRole] = useState<PadrinhoRole>(isDebutante ? 'dama' : 'padrinho');
  const [side, setSide] = useState<PadrinhoSide>(isDebutante ? 'debutante' : 'ambos');
  const [entryOrder, setEntryOrder] = useState('1');
  const [pairPadrinhoId, setPairPadrinhoId] = useState<string | null>(null);
  const [attireStatus, setAttireStatus] = useState<AttireStatus>('pending');
  const [attireColor, setAttireColor] = useState('');
  const [attireNotes, setAttireNotes] = useState('');
  const [specialRole, setSpecialRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');

  const roleOptions = isDebutante ? ROLE_OPTIONS_DEBUTANTE : ROLE_OPTIONS_WEDDING;

  useEffect(() => {
    if (editingItem) {
      setGuestId(editingItem.guest_id);
      setRole(editingItem.role);
      setSide(editingItem.side);
      setEntryOrder(String(editingItem.entry_order));
      setPairPadrinhoId(editingItem.pair_padrinho_id);
      setAttireStatus(editingItem.attire_status);
      setAttireColor(editingItem.attire_color || '');
      setAttireNotes(editingItem.attire_notes || '');
      setSpecialRole(editingItem.special_role || '');
      setGuestSearch(editingItem.guest?.name || '');
    } else if (companionTarget) {
      setGuestId('');
      setRole(isDebutante ? 'cavalheiro' : companionTarget.role === 'padrinho' ? 'madrinha' : 'padrinho');
      setSide(companionTarget.side);
      setEntryOrder(String(companionTarget.entry_order));
      setPairPadrinhoId(companionTarget.id);
      setAttireStatus('pending');
      setAttireColor(companionTarget.attire_color || '');
      setAttireNotes('');
      setSpecialRole('');
      setGuestSearch('');
    } else {
      setGuestId('');
      setRole(isDebutante ? 'dama' : 'padrinho');
      setSide(isDebutante ? 'debutante' : 'ambos');
      const maxOrder = existingPadrinhos.reduce((max, p) => Math.max(max, p.entry_order), 0);
      setEntryOrder(String(maxOrder + 1));
      setPairPadrinhoId(null);
      setAttireStatus('pending');
      setAttireColor('');
      setAttireNotes('');
      setSpecialRole('');
      setGuestSearch('');
    }
  }, [editingItem, companionTarget, existingPadrinhos, isDebutante, visible]);

  if (!visible) return null;

  // Filter available guests
  const filteredGuests = guests.filter((g) => {
    // If guest is already a padrinho, only allow if editing current item
    const isAlreadyPadrinho = existingPadrinhos.some(
      (p) => p.guest_id === g.id && p.id !== editingItem?.id
    );
    if (isAlreadyPadrinho) return false;
    if (!guestSearch.trim()) return true;
    return g.name.toLowerCase().includes(guestSearch.toLowerCase());
  });

  // Eligible pair candidates
  const pairCandidates = existingPadrinhos.filter((p) => p.id !== editingItem?.id);

  const handleSave = async () => {
    if (!guestId) {
      Alert.alert('Atenção', 'Selecione um convidado para o cortejo.');
      return;
    }

    const parsedOrder = parseInt(entryOrder, 10);
    if (Number.isNaN(parsedOrder) || parsedOrder < 1) {
      Alert.alert('Atenção', 'A ordem de entrada deve ser um número maior que zero.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...(editingItem?.id ? { id: editingItem.id } : {}),
        event_id: eventId,
        guest_id: guestId,
        role,
        side,
        entry_order: parsedOrder,
        pair_padrinho_id: pairPadrinhoId || null,
        attire_status: attireStatus,
        attire_color: attireColor.trim() || null,
        attire_notes: attireNotes.trim() || null,
        special_role: specialRole.trim() || null,
      });
      AppHaptics.success();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar membro do cortejo.';
      Alert.alert('Erro', msg);
    } finally {
      setSaving(false);
    }
  };

  const selectedGuestObj = guests.find((g) => g.id === guestId);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalBackdropTouch}>
            <View style={[styles.modalCard, shadows.elevated]}>
              {/* Header */}
              <View style={styles.header}>
                <View>
                  <Text style={styles.title}>
                    {editingItem
                      ? 'Editar Integrante do Cortejo'
                      : companionTarget
                      ? 'Adicionar Par de Cortejo'
                      : isDebutante
                      ? 'Adicionar à Corte de Honra'
                      : 'Adicionar Padrinho / Madrinha'}
                  </Text>
                  <Text style={styles.subtitle}>
                    Configure papéis, trajes e ordem de entrada
                  </Text>
                </View>
                <Pressable
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar formulário"
                >
                  <Ionicons name="close" size={20} color={colors.mutedText} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.body}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
            {/* 1. Guest Selector */}
            <Text style={styles.fieldLabel}>Convidado Vinculado *</Text>
            {selectedGuestObj ? (
              <View style={styles.selectedGuestCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedGuestName}>{selectedGuestObj.name}</Text>
                  {selectedGuestObj.phone ? (
                    <Text style={styles.selectedGuestPhone}>{selectedGuestObj.phone}</Text>
                  ) : (
                    <Text style={styles.selectedGuestNoPhone}>Sem telefone</Text>
                  )}
                </View>
                <Pressable
                  onPress={() => {
                    setGuestId('');
                    setGuestSearch('');
                  }}
                  style={styles.changeGuestBtn}
                >
                  <Text style={styles.changeGuestText}>Trocar</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.guestSearchContainer}>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={16} color={colors.mutedText} />
                  <TextInput
                    value={guestSearch}
                    onChangeText={setGuestSearch}
                    placeholder="Buscar convidado por nome..."
                    placeholderTextColor={colors.mutedText}
                    style={styles.searchInput}
                  />
                </View>
                <View style={styles.guestListMax}>
                  {filteredGuests.slice(0, 5).map((guest) => (
                    <Pressable
                      key={guest.id}
                      onPress={() => {
                        setGuestId(guest.id);
                        setGuestSearch(guest.name);
                      }}
                      style={styles.guestItem}
                    >
                      <Ionicons name="person-outline" size={16} color={colors.gold700} />
                      <Text style={styles.guestItemText}>{guest.name}</Text>
                    </Pressable>
                  ))}
                  {filteredGuests.length === 0 ? (
                    <Text style={styles.emptyGuests}>Nenhum convidado disponível encontrado.</Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* 2. Role Selector */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Papel Cerimonial</Text>
            <View style={styles.chipsRow}>
              {roleOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setRole(opt.value)}
                  style={[styles.chip, role === opt.value && styles.chipActive]}
                >
                  <Text style={[styles.chipText, role === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* 3. Side Selector (if not Debutante) */}
            {!isDebutante ? (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Lado Cerimonial</Text>
                <View style={styles.chipsRow}>
                  <Pressable
                    onPress={() => setSide('noiva')}
                    style={[styles.chip, side === 'noiva' && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, side === 'noiva' && styles.chipTextActive]}>
                      Lado da Noiva
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSide('noivo')}
                    style={[styles.chip, side === 'noivo' && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, side === 'noivo' && styles.chipTextActive]}>
                      Lado do Noivo
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSide('ambos')}
                    style={[styles.chip, side === 'ambos' && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, side === 'ambos' && styles.chipTextActive]}>
                      Ambos os Noivos
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            {/* 4. Entry Order */}
            <View style={{ marginTop: 14 }}>
              <Text style={styles.fieldLabel}>Ordem de Entrada no Cortejo</Text>
              <TextInput
                value={entryOrder}
                onChangeText={setEntryOrder}
                keyboardType="numeric"
                style={styles.input}
                placeholder="Ex: 1"
              />
            </View>

            {/* 5. Par / Companion Pairing */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Par Associado (Opcional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pairsScroll}>
              <Pressable
                onPress={() => setPairPadrinhoId(null)}
                style={[styles.chip, pairPadrinhoId === null && styles.chipActive]}
              >
                <Text style={[styles.chipText, pairPadrinhoId === null && styles.chipTextActive]}>
                  Sem Par (Solo)
                </Text>
              </Pressable>
              {pairCandidates.map((cand) => (
                <Pressable
                  key={cand.id}
                  onPress={() => setPairPadrinhoId(cand.id)}
                  style={[styles.chip, pairPadrinhoId === cand.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, pairPadrinhoId === cand.id && styles.chipTextActive]}>
                    Par com {cand.guest?.name || 'Integrante'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* 6. Attire Status */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Status do Traje</Text>
            <View style={styles.chipsRow}>
              <Pressable
                onPress={() => setAttireStatus('pending')}
                style={[styles.chip, attireStatus === 'pending' && styles.chipActive]}
              >
                <Text style={[styles.chipText, attireStatus === 'pending' && styles.chipTextActive]}>
                  Pendente
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAttireStatus('in_progress')}
                style={[styles.chip, attireStatus === 'in_progress' && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, attireStatus === 'in_progress' && styles.chipTextActive]}
                >
                  Em Busca
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAttireStatus('confirmed')}
                style={[styles.chip, attireStatus === 'confirmed' && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, attireStatus === 'confirmed' && styles.chipTextActive]}
                >
                  Traje Definido
                </Text>
              </Pressable>
            </View>

            {/* 7. Attire Color & Notes */}
            <View style={{ marginTop: 14 }}>
              <Text style={styles.fieldLabel}>Cor do Traje / Paleta de Cores</Text>
              <TextInput
                value={attireColor}
                onChangeText={setAttireColor}
                style={styles.input}
                placeholder="Ex: Terracota, Verde Oliva, Azul Serenity..."
                placeholderTextColor={colors.mutedText}
              />
            </View>

            <View style={{ marginTop: 14 }}>
              <Text style={styles.fieldLabel}>Observações do Traje</Text>
              <TextInput
                value={attireNotes}
                onChangeText={setAttireNotes}
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                multiline
                placeholder="Ex: Gravata borboleta, sapato marrom, vestido longo..."
                placeholderTextColor={colors.mutedText}
              />
            </View>

            {/* 8. Special Role */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Função Cerimonial Especial</Text>
            <View style={styles.chipsRow}>
              {SPECIAL_ROLES.map((roleOpt) => (
                <Pressable
                  key={roleOpt.value}
                  onPress={() => setSpecialRole(roleOpt.value)}
                  style={[styles.chip, specialRole === roleOpt.value && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      specialRole === roleOpt.value && styles.chipTextActive,
                    ]}
                  >
                    {roleOpt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              style={styles.cancelBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Cancelar"
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Salvar integrante"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Salvar Integrante</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  </KeyboardAvoidingView>
</Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 17, 21, 0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  modalBackdropTouch: {
    flex: 1,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: '#F1F5F9',
  },
  body: {
    padding: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedGuestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.gold50,
    borderWidth: 1,
    borderColor: colors.gold200,
    borderRadius: radii.md,
    padding: 12,
  },
  selectedGuestName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  selectedGuestPhone: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  selectedGuestNoPhone: {
    fontSize: 12,
    color: colors.mutedText,
    fontStyle: 'italic',
  },
  changeGuestBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.gold200,
  },
  changeGuestText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold700,
  },
  guestSearchContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: colors.text,
  },
  guestListMax: {
    maxHeight: 140,
  },
  guestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  guestItemText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  emptyGuests: {
    padding: 12,
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pairsScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryStrong,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelBtn: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  submitBtn: {
    backgroundColor: colors.primaryStrong,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
