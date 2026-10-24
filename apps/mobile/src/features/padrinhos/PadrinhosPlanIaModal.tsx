import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, shadows } from '../../theme/colors';
import { useKeyboardBottomInset } from '../../lib/useKeyboardBottomInset';
import type { EventPadrinhoItem } from './padrinhosModel';
import { InsufficientCreditsError } from './padrinhosService';

type Props = {
  visible: boolean;
  onClose: () => void;
  padrinhos: EventPadrinhoItem[];
  selectedItem?: EventPadrinhoItem | null;
  whatsappCredits: number;
  isDebutante?: boolean;
  onDispatch: (
    actionType: 'manual' | 'concentration' | 'attire',
    padrinhoIds?: string[]
  ) => Promise<unknown>;
};

export function PadrinhosPlanIaModal({
  visible,
  onClose,
  padrinhos,
  selectedItem,
  whatsappCredits,
  isDebutante = false,
  onDispatch,
}: Props) {
  const keyboardHeight = useKeyboardBottomInset();
  const [actionType, setActionType] = useState<'manual' | 'concentration' | 'attire'>('manual');
  const [targetScope, setTargetScope] = useState<'all' | 'selected' | 'pending_attire'>(
    selectedItem ? 'selected' : 'all'
  );
  const [loading, setLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  if (!visible) return null;

  // Compute eligible recipients based on targetScope
  const eligiblePadrinhos = () => {
    if (targetScope === 'selected' && selectedItem) {
      return [selectedItem];
    }
    if (targetScope === 'pending_attire') {
      return padrinhos.filter((p) => p.attire_status !== 'confirmed');
    }
    return padrinhos;
  };

  const targets = eligiblePadrinhos();
  const validPhoneCount = targets.filter((p) => Boolean(p.guest?.phone)).length;
  const isInsufficient = validPhoneCount > whatsappCredits;

  const handleExecute = async () => {
    setErrorNotice(null);
    if (validPhoneCount === 0) {
      Alert.alert('Nenhum destinatário', 'Nenhum integrante selecionado possui telefone cadastrado.');
      return;
    }

    if (isInsufficient) {
      setErrorNotice(
        `Saldo insuficiente de créditos de WhatsApp. Você possui ${whatsappCredits} crédito(s), mas este disparo requer ${validPhoneCount}. Recarregue seus créditos para continuar.`
      );
      return;
    }

    setLoading(true);
    try {
      const ids = targets.map((t) => t.id);
      await onDispatch(actionType, ids);
      Alert.alert(
        'Disparo Concluído',
        `Ação da Plan IA enviada com sucesso para ${validPhoneCount} integrante(s)!`
      );
      onClose();
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        setErrorNotice(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Falha ao processar o disparo da Plan IA.';
        setErrorNotice(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, Platform.OS === 'android' && keyboardHeight > 0 && { paddingBottom: keyboardHeight }]}>
        <View style={[styles.modalCard, shadows.elevated]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.botIcon}>
                <Ionicons name="sparkles" size={18} color={colors.gold700} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Automações Plan IA no WhatsApp</Text>
                <Text style={styles.subtitle}>
                  Envio inteligente e acolhedor para o cortejo
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.mutedText} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Wallet Balance Bar */}
            <View style={styles.walletBar}>
              <Ionicons name="wallet-outline" size={18} color={colors.gold700} />
              <Text style={styles.walletText}>
                Saldo na Carteira WhatsApp:{' '}
                <Text style={styles.walletBold}>{whatsappCredits} créditos</Text>
              </Text>
            </View>

            {/* Error / Insufficient Credits Notice */}
            {errorNotice ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={colors.dangerText} />
                <Text style={styles.errorBoxText}>{errorNotice}</Text>
              </View>
            ) : null}

            {/* Action Type Selection */}
            <Text style={styles.sectionLabel}>Selecione o Comunicado VIP</Text>
            <View style={styles.actionOptions}>
              {/* Option 1: Manual */}
              <Pressable
                onPress={() => setActionType('manual')}
                style={[
                  styles.optionCard,
                  actionType === 'manual' && styles.optionCardActive,
                ]}
              >
                <View style={styles.optionRadio}>
                  {actionType === 'manual' ? (
                    <View style={styles.optionRadioInner} />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>
                    {isDebutante ? 'Manual da Corte de Honra' : 'Guia dos Padrinhos'}
                  </Text>
                  <Text style={styles.optionDescription}>
                    Boas-vindas personalizadas, orientações de vestimenta, horários e link exclusivo.
                  </Text>
                </View>
              </Pressable>

              {/* Option 2: Concentration */}
              <Pressable
                onPress={() => setActionType('concentration')}
                style={[
                  styles.optionCard,
                  actionType === 'concentration' && styles.optionCardActive,
                ]}
              >
                <View style={styles.optionRadio}>
                  {actionType === 'concentration' ? (
                    <View style={styles.optionRadioInner} />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Lembrete de Concentração (45 min antes)</Text>
                  <Text style={styles.optionDescription}>
                    Aviso automático de concentração e pontualidade antes da entrada do cortejo.
                  </Text>
                </View>
              </Pressable>

              {/* Option 3: Attire */}
              <Pressable
                onPress={() => setActionType('attire')}
                style={[
                  styles.optionCard,
                  actionType === 'attire' && styles.optionCardActive,
                ]}
              >
                <View style={styles.optionRadio}>
                  {actionType === 'attire' ? (
                    <View style={styles.optionRadioInner} />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Solicitação de Status do Traje</Text>
                  <Text style={styles.optionDescription}>
                    Solicita confirmação, foto e ajustes na paleta de cores definida.
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Recipient Scope Selection */}
            <Text style={styles.sectionLabel}>Destinatários</Text>
            <View style={styles.scopeRow}>
              {selectedItem ? (
                <Pressable
                  onPress={() => setTargetScope('selected')}
                  style={[
                    styles.scopeChip,
                    targetScope === 'selected' && styles.scopeChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.scopeChipText,
                      targetScope === 'selected' && styles.scopeChipTextActive,
                    ]}
                  >
                    Apenas {selectedItem.guest?.name || 'Selecionado'}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => setTargetScope('all')}
                style={[
                  styles.scopeChip,
                  targetScope === 'all' && styles.scopeChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.scopeChipText,
                    targetScope === 'all' && styles.scopeChipTextActive,
                  ]}
                >
                  Todos ({padrinhos.length})
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setTargetScope('pending_attire')}
                style={[
                  styles.scopeChip,
                  targetScope === 'pending_attire' && styles.scopeChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.scopeChipText,
                    targetScope === 'pending_attire' && styles.scopeChipTextActive,
                  ]}
                >
                  Traje Pendente
                </Text>
              </Pressable>
            </View>

            {/* Summary info */}
            <View style={styles.summaryBox}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.summaryText}>
                {validPhoneCount} integrante(s) com WhatsApp válido receberão a mensagem. Consumo:{' '}
                <Text style={{ fontWeight: '700' }}>{validPhoneCount} crédito(s)</Text>.
              </Text>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleExecute}
              disabled={loading}
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={15} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Disparar WhatsApp</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
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
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    maxHeight: '90%',
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
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  botIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.gold50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold200,
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
    padding: 6,
    borderRadius: radii.full,
    backgroundColor: '#F1F5F9',
  },
  body: {
    padding: 16,
  },
  walletBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.gold50,
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.gold200,
    marginBottom: 14,
  },
  walletText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  walletBold: {
    fontWeight: '700',
    color: colors.gold700,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.danger100,
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dangerBg,
    marginBottom: 14,
  },
  errorBoxText: {
    flex: 1,
    fontSize: 12,
    color: colors.dangerText,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  actionOptions: {
    gap: 8,
    marginBottom: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
  },
  optionCardActive: {
    borderColor: colors.gold600,
    backgroundColor: colors.gold50,
  },
  optionRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  optionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold700,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  optionDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  scopeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  scopeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  scopeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryStrong,
  },
  scopeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  scopeChipTextActive: {
    color: '#FFFFFF',
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAF7F1',
    padding: 10,
    borderRadius: radii.md,
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.md,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryStrong,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radii.md,
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
