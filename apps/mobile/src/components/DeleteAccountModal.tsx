import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../lib/supabase';
import { typography } from '../theme/fonts';
import { colors } from '../theme/colors';
import { useKeyboardBottomInset } from '../lib/useKeyboardBottomInset';

const REQUIRED_CONFIRMATION = 'EXCLUIR MINHA CONTA';
const PUBLIC_DELETION_URL = 'https://painelprime.com.br/privacidade/exclusao-de-dados';

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
}

export function DeleteAccountModal({ visible, onClose }: DeleteAccountModalProps) {
  const router = useRouter();
  const keyboardHeight = useKeyboardBottomInset();
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isConfirmed = confirmation.trim().toUpperCase() === REQUIRED_CONFIRMATION;

  function handleClose() {
    if (loading) return;
    setConfirmation('');
    setErrorMessage(null);
    onClose();
  }

  async function openWebInstructions() {
    try {
      await Linking.openURL(PUBLIC_DELETION_URL);
    } catch {
      Alert.alert(
        'Página de Exclusão',
        `Acesse pelo navegador: ${PUBLIC_DELETION_URL}`
      );
    }
  }

  async function executeDelete(token: string) {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://auth.painelprime.com.br';
    return await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ confirmation: REQUIRED_CONFIRMATION }),
    });
  }

  async function handleDeleteAccount() {
    if (!isConfirmed) {
      setErrorMessage(`Digite exatamente "${REQUIRED_CONFIRMATION}" para confirmar.`);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let token = sessionData?.session?.access_token;

      if (!token) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        token = refreshData?.session?.access_token;
      }

      if (!token) {
        setErrorMessage('Sua sessão expirou. Faça login novamente para prosseguir.');
        setLoading(false);
        return;
      }

      let response = await executeDelete(token);

      if (response.status === 401) {
        // Tenta renovar o token e repetir a chamada uma vez
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session?.access_token) {
          response = await executeDelete(refreshed.session.access_token);
        }
      }

      if (!response.ok) {
        let errDesc = 'Não foi possível concluir a exclusão da sua conta.';
        try {
          const json = await response.json();
          if (json?.error === 'invalid_confirmation') {
            errDesc = `Confirmação inválida. Digite exatamente "${REQUIRED_CONFIRMATION}".`;
          } else if (json?.error === 'unauthorized') {
            errDesc = 'Sessão não autorizada ou expirada. Efetue login novamente.';
          }
        } catch {
          // fallback para mensagem genérica
        }
        setErrorMessage(errDesc);
        setLoading(false);
        return;
      }

      // Sucesso na exclusão do usuário
      await supabase.auth.signOut();
      setLoading(false);
      handleClose();

      Alert.alert(
        'Conta Excluída',
        'Sua conta e dados pessoais foram excluídos com sucesso do Painel Prime.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/login' as never);
            },
          },
        ]
      );
    } catch {
      setLoading(false);
      setErrorMessage('Falha de conexão com a internet. Verifique sua rede e tente novamente.');
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.overlay,
          Platform.OS === 'android' && keyboardHeight > 0 && { paddingBottom: keyboardHeight + 12 },
        ]}
      >
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.dangerIconBadge}>
                <Ionicons name="warning-outline" size={20} color="#EF4444" />
              </View>
              <Text style={styles.title}>Excluir Conta e Dados</Text>
            </View>
            <Pressable
              onPress={handleClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Fechar modal de exclusão de conta"
              disabled={loading}
            >
              <Ionicons name="close" size={22} color="#A1A1AA" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.warningParagraph}>
              Esta ação é <Text style={styles.boldRed}>permanente e irreversível</Text>. Todos os seus dados pessoais, eventos, listas de convidados, cronogramas, propostas e configurações serão eliminados imediatamente dos nossos servidores.
            </Text>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>O que será excluído:</Text>
              <Text style={styles.infoItem}>• Perfil, contatos e credenciais de acesso</Text>
              <Text style={styles.infoItem}>• Eventos organizados, tarefas e atas de reunião</Text>
              <Text style={styles.infoItem}>• Listas de convidados, confirmações de RSVP e mesas</Text>
              <Text style={styles.infoItem}>• Histórico do CRM e preferências salvas</Text>
              <Text style={styles.legalNotice}>
                * Logs de acesso à aplicação são retidos sob sigilo por 6 meses conforme exigência do Artigo 15 do Marco Civil da Internet (Lei 12.965/2014).
              </Text>
            </View>

            <Pressable
              style={styles.webLinkBtn}
              onPress={() => void openWebInstructions()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Ver página pública de exclusão de dados e regras da LGPD"
            >
              <Ionicons name="open-outline" size={16} color="#DEC479" />
              <Text style={styles.webLinkText}>Ver página oficial de exclusão e retenção legal</Text>
            </Pressable>

            <View style={styles.confirmSection}>
              <Text style={styles.confirmInstruction}>
                Para confirmar a exclusão definitiva, digite exatamente <Text style={styles.codeText}>{REQUIRED_CONFIRMATION}</Text> abaixo:
              </Text>

              <TextInput
                style={[styles.input, isConfirmed && styles.inputValid]}
                value={confirmation}
                onChangeText={setConfirmation}
                placeholder={REQUIRED_CONFIRMATION}
                placeholderTextColor="#71717A"
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!loading}
                accessibilityLabel="Campo de digitação para confirmação de exclusão"
              />
            </View>

            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={handleClose}
                disabled={loading}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Cancelar exclusão e manter conta"
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.deleteBtn,
                  (!isConfirmed || loading) && styles.deleteBtnDisabled,
                ]}
                onPress={() => void handleDeleteAccount()}
                disabled={!isConfirmed || loading}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Confirmar exclusão definitiva da minha conta e dados"
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View style={styles.deleteBtnInner}>
                    <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.deleteBtnText}>Excluir definitivamente</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 13, 20, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    backgroundColor: '#0A0D14',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    padding: 20,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 12,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dangerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: typography.fontFamily.sansBold,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 8,
  },
  warningParagraph: {
    color: '#D4D4D8',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: typography.fontFamily.sans,
  },
  boldRed: {
    color: '#EF4444',
    fontFamily: typography.fontFamily.sansBold,
  },
  infoBox: {
    backgroundColor: '#141824',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    gap: 6,
  },
  infoTitle: {
    color: '#F4F4F5',
    fontSize: 13,
    fontFamily: typography.fontFamily.sansSemiBold,
    marginBottom: 2,
  },
  infoItem: {
    color: '#A1A1AA',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: typography.fontFamily.sans,
  },
  legalNotice: {
    color: '#71717A',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
    fontStyle: 'italic',
  },
  webLinkBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(222, 196, 121, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(222, 196, 121, 0.25)',
  },
  webLinkText: {
    color: '#DEC479',
    fontSize: 12,
    fontFamily: typography.fontFamily.sansSemiBold,
    flex: 1,
  },
  confirmSection: {
    gap: 8,
    marginTop: 4,
  },
  confirmInstruction: {
    color: '#D4D4D8',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.fontFamily.sansMedium,
  },
  codeText: {
    color: '#EF4444',
    fontFamily: typography.fontFamily.sansBold,
  },
  input: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: '#11141E',
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: typography.fontFamily.sansSemiBold,
    letterSpacing: 0.5,
  },
  inputValid: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 10,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
    fontFamily: typography.fontFamily.sansMedium,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: '#181C28',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  cancelBtnText: {
    color: '#D4D4D8',
    fontSize: 13,
    fontFamily: typography.fontFamily.sansSemiBold,
  },
  deleteBtn: {
    flex: 1.3,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  deleteBtnDisabled: {
    backgroundColor: 'rgba(239, 68, 68, 0.35)',
    opacity: 0.6,
  },
  deleteBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: typography.fontFamily.sansBold,
  },
});
