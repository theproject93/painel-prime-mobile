import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Utilitário padronizado de feedback háptico (tátil) para o Painel Prime Mobile.
 * Ignora silenciosamente em plataformas onde hápticos não são suportados (web/emuladores sem motor).
 */
export const AppHaptics = {
  /**
   * Disparo sutil ao selecionar abas, chips de filtros ou rolar carrosséis.
   */
  async selection(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.selectionAsync();
    } catch {
      // Falha silenciosa em dispositivos sem motor háptico
    }
  },

  /**
   * Impacto leve ao tocar em cards, botões secundários ou expandir seções.
   */
  async light(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  },

  /**
   * Impacto médio ao arrastar mesas no mapa, mover padrinhos na ordem do cortejo ou reordenar itens.
   */
  async medium(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  },

  /**
   * Impacto pesado em ações de alto impacto (exclusão, confirmação de presença em massa).
   */
  async heavy(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
  },

  /**
   * Notificação de sucesso ao salvar formulários, disparar mensagens Plan IA ou validar QR Code.
   */
  async success(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  },

  /**
   * Notificação de aviso para atenções não críticas (ex: janela 24h quase expirando).
   */
  async warning(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}
  },

  /**
   * Notificação de erro ao submeter campos inválidos ou falhas de requisição.
   */
  async error(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {}
  },
};
