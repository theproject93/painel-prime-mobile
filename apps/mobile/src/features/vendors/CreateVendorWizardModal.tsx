import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppHaptics } from '../../lib/haptics';
import { useKeyboardBottomInset } from '../../lib/useKeyboardBottomInset';
import { colors } from '../../theme/colors';
import {
  PRICE_RANGE_OPTIONS,
  VENDOR_CATEGORIES,
  type VendorForm,
  type VendorRecord,
} from './vendorCatalogModel';

type Props = {
  visible: boolean;
  editingVendor: VendorRecord | null;
  form: VendorForm;
  setForm: React.Dispatch<React.SetStateAction<VendorForm>>;
  onClose: () => void;
  onSave: () => Promise<void>;
  saving: boolean;
};

// Ícone representativo para cada categoria do catálogo
const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Assessoria/Cerimonial': 'ribbon-outline',
  'Espaço/Local': 'business-outline',
  'Buffet/Gastronomia': 'restaurant-outline',
  'Bar/Bebidas': 'wine-outline',
  'Bolo/Doces': 'gift-outline',
  'Decoração/Floral': 'flower-outline',
  'Foto': 'camera-outline',
  'Vídeo': 'videocam-outline',
  'Música/DJ/Banda': 'musical-notes-outline',
  'Som/Iluminação/Estrutura': 'flash-outline',
  'Locação/Mobiliário': 'bed-outline',
  'Beleza/Dia da noiva': 'sparkles-outline',
  'Trajes/Acessórios': 'shirt-outline',
  'Convites/Papelaria': 'mail-outline',
  'Celebrante': 'person-outline',
  'Transporte/Logística': 'car-outline',
  'Lembranças/Personalizados': 'heart-outline',
  'Entretenimento/Experiências': 'happy-outline',
  'Conteúdo/Redes sociais': 'phone-portrait-outline',
  'Outros': 'apps-outline',
};

export function CreateVendorWizardModal({
  visible,
  editingVendor,
  form,
  setForm,
  onClose,
  onSave,
  saving,
}: Props) {
  const keyboardHeight = useKeyboardBottomInset();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [stepError, setStepError] = useState('');

  const isEditing = Boolean(editingVendor);

  function handleClose() {
    setStep(1);
    setStepError('');
    onClose();
  }

  function handleNext() {
    setStepError('');
    if (step === 1) {
      if (!form.name.trim()) {
        setStepError('Informe o nome da empresa ou profissional.');
        return;
      }
      if (!form.category.trim()) {
        setStepError('Selecione a categoria do fornecedor.');
        return;
      }
      void AppHaptics.light();
      setStep(2);
      return;
    }
    if (step === 2) {
      void AppHaptics.light();
      setStep(3);
      return;
    }
  }

  function handleBack() {
    setStepError('');
    void AppHaptics.light();
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  }

  function selectCategory(cat: string) {
    void AppHaptics.light();
    setForm((prev) => ({ ...prev, category: cat }));
    setStepError('');
  }

  function selectPriceRange(val: string) {
    void AppHaptics.light();
    setForm((prev) => ({ ...prev, price_range: val }));
  }

  function toggleVitrine() {
    void AppHaptics.light();
    setForm((prev) => ({ ...prev, is_visible_in_vitrine: !prev.is_visible_in_vitrine }));
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[
          styles.overlay,
          Platform.OS === 'android' && keyboardHeight > 0 && { paddingBottom: keyboardHeight },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {isEditing ? 'Editar fornecedor' : 'Novo fornecedor'}
              </Text>
              <Text style={styles.subtitle}>
                {step === 1 && 'Etapa 1 de 3: Identificação & Categoria'}
                {step === 2 && 'Etapa 2 de 3: Contatos & Localização'}
                {step === 3 && 'Etapa 3 de 3: Comercial & Vitrine'}
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Fechar cadastro"
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          {/* Stepper Progress Bar */}
          <View style={styles.progressBar}>
            <View style={[styles.progressStep, step >= 1 && styles.progressStepActive]} />
            <View style={[styles.progressStep, step >= 2 && styles.progressStepActive]} />
            <View style={[styles.progressStep, step >= 3 && styles.progressStepActive]} />
          </View>

          {/* Error Banner */}
          {stepError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.dangerText} />
              <Text style={styles.errorText}>{stepError}</Text>
            </View>
          ) : null}

          {/* Step 1: Identificação & Categoria */}
          {step === 1 && (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nome do parceiro ou empresa *</Text>
                <TextInput
                  style={styles.input}
                  value={form.name}
                  onChangeText={(v) => {
                    setForm((prev) => ({ ...prev, name: v }));
                    if (stepError) setStepError('');
                  }}
                  placeholder="Ex.: Lumière Filmes, Buffet Bela Vista..."
                  placeholderTextColor={colors.mutedText}
                  autoFocus={!isEditing}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Selecione a categoria de atuação *</Text>
                <Text style={styles.fieldHint}>
                  Toque na especialidade principal deste fornecedor:
                </Text>

                <View style={styles.categoryGrid}>
                  {VENDOR_CATEGORIES.map((cat) => {
                    const isSelected = form.category === cat;
                    const iconName = CATEGORY_ICONS[cat] ?? 'briefcase-outline';
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => selectCategory(cat)}
                        style={[
                          styles.categoryCard,
                          isSelected && styles.categoryCardSelected,
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`Categoria ${cat}`}
                      >
                        <Ionicons
                          name={iconName}
                          size={18}
                          color={isSelected ? colors.primaryStrong : colors.mutedText}
                        />
                        <Text
                          style={[
                            styles.categoryCardText,
                            isSelected && styles.categoryCardTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {cat}
                        </Text>
                        {isSelected && (
                          <View style={styles.categoryCheckBadge}>
                            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          )}

          {/* Step 2: Contatos & Localização */}
          {step === 2 && (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.infoBox}>
                <Ionicons name="call-outline" size={18} color={colors.primaryStrong} />
                <Text style={styles.infoBoxText}>
                  Estes dados entram automaticamente na ficha operacional dos eventos quando você vincular este parceiro.
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>WhatsApp com DDD</Text>
                <TextInput
                  style={styles.input}
                  value={form.whatsapp}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, whatsapp: v }))}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor={colors.mutedText}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Telefone comercial (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={form.phone}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, phone: v }))}
                  placeholder="(00) 0000-0000"
                  placeholderTextColor={colors.mutedText}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>E-mail de contato</Text>
                <TextInput
                  style={styles.input}
                  value={form.email}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, email: v }))}
                  placeholder="contato@fornecedor.com"
                  placeholderTextColor={colors.mutedText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.fieldGroup, { flex: 2 }]}>
                  <Text style={styles.fieldLabel}>Cidade</Text>
                  <TextInput
                    style={styles.input}
                    value={form.city}
                    onChangeText={(v) => setForm((prev) => ({ ...prev, city: v }))}
                    placeholder="Ex.: São Paulo"
                    placeholderTextColor={colors.mutedText}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Estado (UF)</Text>
                  <TextInput
                    style={styles.input}
                    value={form.state}
                    onChangeText={(v) => setForm((prev) => ({ ...prev, state: v.toUpperCase() }))}
                    placeholder="SP"
                    placeholderTextColor={colors.mutedText}
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                </View>
              </View>
            </ScrollView>
          )}

          {/* Step 3: Comercial & Vitrine */}
          {step === 3 && (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Faixa de investimento estimada</Text>
                <Text style={styles.fieldHint}>
                  Ajuda a equipe a indicar o parceiro certo para o orçamento do casal:
                </Text>

                <View style={styles.priceRow}>
                  {PRICE_RANGE_OPTIONS.map((opt) => {
                    const isSelected = form.price_range === opt.value;
                    const label = opt.value === '' ? 'A combinar' : opt.label;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => selectPriceRange(opt.value)}
                        style={[
                          styles.pricePill,
                          isSelected && styles.pricePillSelected,
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text
                          style={[
                            styles.pricePillText,
                            isSelected && styles.pricePillTextSelected,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable
                style={[
                  styles.vitrineCard,
                  form.is_visible_in_vitrine && styles.vitrineCardActive,
                ]}
                onPress={toggleVitrine}
                accessibilityRole="switch"
                accessibilityState={{ checked: form.is_visible_in_vitrine }}
              >
                <Ionicons
                  name={form.is_visible_in_vitrine ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={form.is_visible_in_vitrine ? colors.primaryStrong : colors.mutedText}
                />
                <View style={styles.vitrineCopy}>
                  <Text style={styles.vitrineTitle}>Exibir na vitrine pública</Text>
                  <Text style={styles.vitrineDesc}>
                    Recomende este parceiro na página pública da sua assessoria para os clientes visualizarem portfólio e contatos.
                  </Text>
                </View>
              </Pressable>

              {/* Summary Card */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Resumo do fornecedor</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Nome:</Text>
                  <Text style={styles.summaryVal}>{form.name || '-'}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Categoria:</Text>
                  <Text style={styles.summaryVal}>{form.category || '-'}</Text>
                </View>
                {(form.whatsapp || form.phone) ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Contato:</Text>
                    <Text style={styles.summaryVal}>{form.whatsapp || form.phone}</Text>
                  </View>
                ) : null}
                {form.city ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Região:</Text>
                    <Text style={styles.summaryVal}>
                      {form.city}{form.state ? ` / ${form.state}` : ''}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          )}

          {/* Footer Actions */}
          <View style={styles.footer}>
            {step > 1 ? (
              <Pressable
                onPress={handleBack}
                style={styles.backBtn}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Voltar etapa"
              >
                <Ionicons name="arrow-back" size={16} color={colors.text} />
                <Text style={styles.backBtnText}>Voltar</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleClose}
                style={styles.backBtn}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Cancelar cadastro"
              >
                <Text style={styles.backBtnText}>Cancelar</Text>
              </Pressable>
            )}

            {step < 3 ? (
              <Pressable
                onPress={handleNext}
                style={styles.nextBtn}
                accessibilityRole="button"
                accessibilityLabel="Avançar para a próxima etapa"
              >
                <Text style={styles.nextBtnText}>
                  {step === 1 ? 'Contatos & Região' : 'Comercial & Vitrine'}
                </Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primaryTextOn} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => void onSave()}
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={saving ? 'Salvando...' : 'Salvar fornecedor'}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.primaryTextOn} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.primaryTextOn} />
                    <Text style={styles.saveBtnText}>
                      {isEditing ? 'Salvar alterações' : 'Concluir cadastro'}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,17,21,0.65)',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    paddingBottom: 20,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 99,
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: colors.borderStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  progressStep: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressStepActive: {
    backgroundColor: colors.primaryStrong,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  errorText: {
    color: colors.dangerText,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  body: {
    flexGrow: 0,
    maxHeight: 460,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  fieldHint: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: colors.card,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryCardSelected: {
    borderColor: colors.primaryStrong,
    backgroundColor: colors.primarySoft,
  },
  categoryCardText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  categoryCardTextSelected: {
    color: colors.primaryStrong,
    fontWeight: '700',
  },
  categoryCheckBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primaryStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primarySoft,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  infoBoxText: {
    flex: 1,
    color: colors.primaryStrong,
    fontSize: 12,
    lineHeight: 17,
  },
  priceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  pricePill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pricePillSelected: {
    borderColor: colors.primaryStrong,
    backgroundColor: colors.primarySoft,
  },
  pricePillText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  pricePillTextSelected: {
    color: colors.primaryStrong,
    fontWeight: '700',
  },
  vitrineCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  vitrineCardActive: {
    borderColor: colors.primaryStrong,
    backgroundColor: colors.primarySoft,
  },
  vitrineCopy: {
    flex: 1,
    gap: 4,
  },
  vitrineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  vitrineDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  summaryCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryStrong,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    width: 70,
  },
  summaryVal: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  backBtn: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  backBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary,
  },
  nextBtnText: {
    color: colors.primaryTextOn,
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary,
  },
  saveBtnText: {
    color: colors.primaryTextOn,
    fontSize: 13,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
