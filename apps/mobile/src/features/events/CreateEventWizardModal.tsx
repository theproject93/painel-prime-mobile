import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { colors } from '../../theme/colors';
import { AppHaptics } from '../../lib/haptics';
import {
  MoneyField,
  PtBrDateField,
  formatPtBrDate,
} from '../../components/ui/PremiumInputs';
import {
  deleteStoredFile,
  getPrivateFileDownloadUrl,
  linkStoredFile,
  uploadPrivateAsset,
} from '../../lib/r2FileStorage';
import {
  EVENT_TYPE_CARDS,
  type EventType,
} from './eventsModel';

export type CreateEventFormData = {
  name: string;
  eventDate: string;
  location: string;
  eventType: EventType;
  coverExternalUrl: string;
  coverFileId?: string | null;
  budgetTotal?: number | null;
  guestsPlanned?: number | null;
};

export type CreateEventWizardModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (form: CreateEventFormData) => Promise<void>;
  creating: boolean;
  error?: string;
  onClearError: () => void;
};

export function CreateEventWizardModal({
  visible,
  onClose,
  onSubmit,
  creating,
  error,
  onClearError,
}: CreateEventWizardModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState<EventType>('wedding');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [coverExternalUrl, setCoverExternalUrl] = useState('');
  const [coverUpload, setCoverUpload] = useState<{
    fileId: string;
    objectKey: string;
    previewUrl: string;
  } | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Financial & guests
  const [budgetText, setBudgetText] = useState('');
  const [guestsText, setGuestsText] = useState('');

  const [stepError, setStepError] = useState('');

  function resetForm() {
    const pending = coverUpload;
    setStep(1);
    setName('');
    setEventType('wedding');
    setEventDate('');
    setEventTime('');
    setLocation('');
    setCoverExternalUrl('');
    setCoverUpload(null);
    setBudgetText('');
    setGuestsText('');
    setStepError('');
    onClearError();

    if (pending?.fileId) {
      void deleteStoredFile(pending.fileId).catch(() => {});
    }
    onClose();
  }

  function handleNextStep() {
    setStepError('');
    onClearError();

    if (step === 1) {
      if (!name.trim()) {
        setStepError('Informe o nome do evento para continuar.');
        return;
      }
      void AppHaptics.light();
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!eventDate.trim()) {
        setStepError('Selecione a data do evento no calendário.');
        return;
      }
      if (!location.trim()) {
        setStepError('Informe o local do evento.');
        return;
      }
      void AppHaptics.light();
      setStep(3);
      return;
    }

    if (step === 3) {
      void AppHaptics.light();
      setStep(4);
      return;
    }
  }

  function handlePrevStep() {
    setStepError('');
    onClearError();
    void AppHaptics.light();
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  }

  async function handlePickCover() {
    if (uploadingCover) return;
    setUploadingCover(true);
    setStepError('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Permissão da galeria negada.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || result.assets.length === 0) {
        setUploadingCover(false);
        return;
      }
      const asset = result.assets[0];
      const ext = (asset.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
      const previous = coverUpload;
      const upload = await uploadPrivateAsset({
        uri: asset.uri,
        fileName: `cover-${Date.now()}.${ext}`,
        contentType: asset.mimeType ?? 'image/jpeg',
        byteSize: asset.fileSize ?? null,
        entityType: 'event_photo',
      });
      const signedUrl = await getPrivateFileDownloadUrl(upload.fileId);
      if (previous?.fileId) {
        void deleteStoredFile(previous.fileId).catch(() => {});
      }
      setCoverExternalUrl('');
      setCoverUpload({
        fileId: upload.fileId,
        objectKey: upload.objectKey,
        previewUrl: signedUrl,
      });
      void AppHaptics.light();
    } catch (err: any) {
      setStepError(err?.message ?? 'Não foi possível carregar a imagem.');
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleFinalSubmit() {
    setStepError('');
    onClearError();

    const rawBudget = budgetText.replace(/[^\d]/g, '');
    const parsedBudget = rawBudget ? Number(rawBudget) / 100 : null;
    const rawGuests = guestsText.replace(/[^\d]/g, '');
    const parsedGuests = rawGuests ? parseInt(rawGuests, 10) : null;

    const payload: CreateEventFormData = {
      name: name.trim(),
      eventType,
      eventDate,
      location: eventTime ? `${location.trim()} às ${eventTime.trim()}` : location.trim(),
      coverExternalUrl: coverExternalUrl.trim(),
      coverFileId: coverUpload?.fileId ?? null,
      budgetTotal: parsedBudget,
      guestsPlanned: parsedGuests,
    };

    try {
      await onSubmit(payload);
      if (typeof (AppHaptics as any).notificationSuccess === 'function') {
        void (AppHaptics as any).notificationSuccess();
      } else {
        void AppHaptics.success();
      }
      resetForm();
    } catch (err: any) {
      setStepError(err?.message ?? 'Erro ao criar o evento.');
    }
  }

  const activeCoverUri =
    coverUpload?.previewUrl ||
    coverExternalUrl.trim() ||
    EVENT_TYPE_CARDS[eventType].image;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetForm}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.modalTitle}>Novo Evento</Text>
              <Text style={styles.stepIndicator}>Etapa {step} de 4</Text>
            </View>
            <Pressable
              style={styles.closeButton}
              onPress={resetForm}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Fechar cadastro"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Gamified Progress Bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
          </View>

          {/* Error Message */}
          {stepError || error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#E05252" />
              <Text style={styles.errorText}>{stepError || error}</Text>
            </View>
          ) : null}

          {/* Content Area */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* STEP 1: Identificação & Tipo */}
            {step === 1 ? (
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>Identificação do Evento</Text>
                <Text style={styles.stepSubtitle}>
                  Dê um nome especial e escolha a categoria da celebração.
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Nome do evento</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Casamento Isabella & Rafael"
                    placeholderTextColor={colors.mutedText}
                    value={name}
                    onChangeText={setName}
                    accessibilityLabel="Nome do evento"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Tipo de evento</Text>
                  <View style={styles.typeGrid}>
                    {(['wedding', 'birthday', 'debutante', 'corporate'] as const).map(
                      (typeOption) => {
                        const isSelected = eventType === typeOption;
                        return (
                          <Pressable
                            key={typeOption}
                            onPress={() => {
                              void AppHaptics.selection();
                              setEventType(typeOption);
                            }}
                            style={[styles.typeCard, isSelected && styles.typeCardOn]}
                            accessibilityRole="button"
                            accessibilityLabel={`Selecionar ${EVENT_TYPE_CARDS[typeOption].label}`}
                          >
                            <Image
                              source={{ uri: EVENT_TYPE_CARDS[typeOption].image }}
                              style={styles.typeImage}
                            />
                            <View style={styles.typeOverlay} />
                            {isSelected ? (
                              <View style={styles.typeCheck}>
                                <Ionicons name="checkmark-circle" size={18} color={colors.gold700} />
                              </View>
                            ) : null}
                            <Text style={styles.typeCardText}>
                              {EVENT_TYPE_CARDS[typeOption].label}
                            </Text>
                          </Pressable>
                        );
                      }
                    )}
                  </View>
                </View>
              </View>
            ) : null}

            {/* STEP 2: Data, Horário & Local */}
            {step === 2 ? (
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>Quando & Onde</Text>
                <Text style={styles.stepSubtitle}>
                  Selecione no calendário a data de realização e o local.
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Data do evento (calendário nativo)</Text>
                  <PtBrDateField
                    value={eventDate}
                    onChange={setEventDate}
                    placeholder="Toque para escolher no calendário"
                    label="Data do evento"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Horário de início (opcional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 19:30"
                    placeholderTextColor={colors.mutedText}
                    value={eventTime}
                    onChangeText={setEventTime}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Local do evento</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Villa Bisutti / Espaço Gardens, São Paulo"
                    placeholderTextColor={colors.mutedText}
                    value={location}
                    onChangeText={setLocation}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Capa do evento (preview)</Text>
                  <Image source={{ uri: activeCoverUri }} style={styles.previewImage} />
                  <Pressable
                    style={styles.ghostButton}
                    onPress={() => void handlePickCover()}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="image-outline" size={18} color={colors.gold700} />
                    <Text style={styles.ghostButtonText}>
                      {uploadingCover ? 'Enviando imagem...' : 'Selecionar imagem do celular'}
                    </Text>
                  </Pressable>
                  <TextInput
                    style={[styles.input, { marginTop: 6 }]}
                    placeholder="Ou cole a URL da capa (opcional)"
                    placeholderTextColor={colors.mutedText}
                    value={coverExternalUrl}
                    onChangeText={setCoverExternalUrl}
                  />
                </View>
              </View>
            ) : null}

            {/* STEP 3: Orçamento & Convidados */}
            {step === 3 ? (
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>Planejamento & Escala</Text>
                <Text style={styles.stepSubtitle}>
                  Defina o teto orçamentário e a estimativa de convidados.
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Orçamento total planejado (R$)</Text>
                  <MoneyField
                    value={budgetText}
                    onChangeValue={setBudgetText}
                    placeholder="R$ 0,00"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Convidados planejados (estimativa)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="Ex: 250"
                    placeholderTextColor={colors.mutedText}
                    value={guestsText}
                    onChangeText={setGuestsText}
                  />
                </View>

                <View style={styles.tipCard}>
                  <Ionicons name="sparkles" size={20} color={colors.gold700} />
                  <Text style={styles.tipText}>
                    A Plan IA utilizará estas métricas para monitorar o desembolso e sugerir
                    alocações inteligentes de mesas e fornecedores.
                  </Text>
                </View>
              </View>
            ) : null}

            {/* STEP 4: Revisão Resumida Dark Luxury */}
            {step === 4 ? (
              <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>Revisão & Confirmação</Text>
                <Text style={styles.stepSubtitle}>
                  Confira os dados do evento antes de oficializar a criação.
                </Text>

                <View style={styles.summaryCard}>
                  <Image source={{ uri: activeCoverUri }} style={styles.summaryCover} />
                  <View style={styles.summaryBadge}>
                    <Text style={styles.summaryBadgeText}>
                      {EVENT_TYPE_CARDS[eventType].label}
                    </Text>
                  </View>

                  <View style={styles.summaryBody}>
                    <Text style={styles.summaryName}>{name}</Text>

                    <View style={styles.summaryRow}>
                      <Ionicons name="calendar-outline" size={17} color={colors.gold700} />
                      <Text style={styles.summaryText}>
                        {formatPtBrDate(eventDate)} {eventTime ? `às ${eventTime}` : ''}
                      </Text>
                    </View>

                    <View style={styles.summaryRow}>
                      <Ionicons name="location-outline" size={17} color={colors.gold700} />
                      <Text style={styles.summaryText}>{location}</Text>
                    </View>

                    <View style={styles.summaryRow}>
                      <Ionicons name="cash-outline" size={17} color={colors.gold700} />
                      <Text style={styles.summaryText}>
                        Orçamento: {budgetText ? budgetText : 'Sob consulta'}
                      </Text>
                    </View>

                    <View style={styles.summaryRow}>
                      <Ionicons name="people-outline" size={17} color={colors.gold700} />
                      <Text style={styles.summaryText}>
                        Capacidade: {guestsText ? `${guestsText} convidados` : 'A definir'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Wizard Action Buttons */}
          <View style={styles.actionRow}>
            {step > 1 ? (
              <Pressable
                style={styles.backButton}
                onPress={handlePrevStep}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Voltar etapa"
              >
                <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
                <Text style={styles.backButtonText}>Voltar</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.backButton}
                onPress={resetForm}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Cancelar criação"
              >
                <Text style={styles.backButtonText}>Cancelar</Text>
              </Pressable>
            )}

            {step < 4 ? (
              <Pressable
                style={styles.nextButton}
                onPress={handleNextStep}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Avançar etapa"
              >
                <Text style={styles.nextButtonText}>Avançar</Text>
                <Ionicons name="arrow-forward" size={18} color="#111113" />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.nextButton, creating && styles.buttonDisabled]}
                onPress={() => void handleFinalSubmit()}
                disabled={creating}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Criar evento"
              >
                {creating ? (
                  <ActivityIndicator color="#111113" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={20} color="#111113" />
                    <Text style={styles.nextButtonText}>Criar Evento</Text>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#111113',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#26262B',
    maxHeight: '88%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  stepIndicator: {
    color: colors.gold700,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1C1C22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#1E1E24',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold700,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(224, 82, 82, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(224, 82, 82, 0.3)',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
  },
  errorText: {
    color: '#FF7B7B',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  stepContainer: {
    gap: 12,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  stepSubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 18,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: '#CCCCCC',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A32',
    backgroundColor: '#17171C',
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 15,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    width: '48%',
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#2A2A32',
    justifyContent: 'flex-end',
    padding: 8,
  },
  typeCardOn: {
    borderColor: colors.gold700,
    borderWidth: 2,
  },
  typeImage: {
    ...StyleSheet.absoluteFillObject,
  },
  typeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  typeCardText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    zIndex: 2,
  },
  typeCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 3,
  },
  previewImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A32',
  },
  ghostButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2A2A32',
    borderRadius: 12,
    backgroundColor: '#17171C',
    paddingHorizontal: 12,
  },
  ghostButtonText: {
    color: '#E5E5EA',
    fontSize: 14,
    fontWeight: '600',
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(222, 196, 121, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(222, 196, 121, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  tipText: {
    color: '#DEC479',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#17171C',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A32',
    overflow: 'hidden',
  },
  summaryCover: {
    width: '100%',
    height: 130,
  },
  summaryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(17, 17, 19, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gold700,
  },
  summaryBadgeText: {
    color: colors.gold700,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryBody: {
    padding: 16,
    gap: 10,
  },
  summaryName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryText: {
    color: '#CCCCCC',
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#1E1E24',
    gap: 12,
  },
  backButton: {
    minHeight: 46,
    minWidth: 90,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A32',
    backgroundColor: '#17171C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  backButtonText: {
    color: '#CCCCCC',
    fontSize: 14,
    fontWeight: '600',
  },
  nextButton: {
    minHeight: 46,
    flex: 1,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.gold700,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: {
    color: '#111113',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
