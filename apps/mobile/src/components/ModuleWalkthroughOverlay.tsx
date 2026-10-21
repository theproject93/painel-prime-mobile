import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSegments } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { AppHaptics } from '../lib/haptics';
import { getVisibleSegments } from '../lib/router';
import { useWalkthroughAnchors } from './WalkthroughAnchors';

export type ModuleGuideKey =
  | 'dashboard'
  | 'events_list'
  | 'event_details'
  | 'clients'
  | 'finance'
  | 'more_home'
  | 'operational_health'
  | 'profile'
  | 'settings'
  | 'billing';

export type WalkthroughStep = {
  title: string;
  description: string;
  tip?: string;
  anchorKey?: string;
};

export type GuideSpec = {
  moduleLabel: string;
  steps: WalkthroughStep[];
};

export const MODULE_GUIDES: Record<ModuleGuideKey, GuideSpec> = {
  dashboard: {
    moduleLabel: 'Início',
    steps: [
      {
        title: 'Visão Geral Operacional',
        description: 'Centralize aqui a gestão do seu dia a dia, próximos eventos e pendências da semana.',
        tip: 'Acompanhe métricas rápidas e atalhos operacionais prioritários.',
        anchorKey: 'dashboard_overview',
      },
      {
        title: 'Assistente Plan IA',
        description: 'Acesse a inteligência artificial para tirar dúvidas sobre seus eventos e tarefas a qualquer momento.',
        tip: 'Toque no botão flutuante para abrir o assistente e otimizar seu tempo.',
        anchorKey: 'plan_assistant.fab',
      },
    ],
  },
  events_list: {
    moduleLabel: 'Eventos',
    steps: [
      {
        title: 'Gestão de Eventos',
        description: 'Visualize sua carteira completa de casamentos, aniversários e celebrações.',
        tip: 'Toque no botão de criação para adicionar um evento com capa e cronograma.',
        anchorKey: 'events_header_action',
      },
      {
        title: 'Busca e Filtros Rápidos',
        description: 'Encontre qualquer celebração facilmente por nome, data ou status operacional.',
        tip: 'Toque em um evento para abrir a central completa.',
      },
    ],
  },
  event_details: {
    moduleLabel: 'Evento',
    steps: [
      {
        title: 'Central do Evento',
        description: 'Gerencie todos os detalhes da celebração selecionada em um único ambiente.',
        tip: 'Navegue pelas abas superiores: cronograma, convidados, fornecedores e financeiro.',
      },
      {
        title: 'Roteiro e Equipe',
        description: 'Monitore o cortejo, horários dos fornecedores e confirmações de presença em tempo real.',
        tip: 'Mantenha toda a equipe de assessoria perfeitamente sincronizada.',
      },
    ],
  },
  clients: {
    moduleLabel: 'Clientes',
    steps: [
      {
        title: 'Pipeline Comercial',
        description: 'Acompanhe noivos e clientes em cada etapa do seu funil de atendimento.',
        tip: 'Monitore contatos iniciais, propostas enviadas e contratos fechados.',
      },
      {
        title: 'Orçamentos e Documentos',
        description: 'Envie orçamentos pelo WhatsApp e organize o histórico de atendimento dos noivos.',
        tip: 'Mantenha anotações e documentos importantes sempre acessíveis.',
      },
    ],
  },
  finance: {
    moduleLabel: 'Financeiro',
    steps: [
      {
        title: 'Controle de Caixa',
        description: 'Gerencie entradas, despesas, saldo previsto e saldo realizado da sua assessoria.',
        tip: 'Toque em Novo lançamento para registrar movimentos e anexar comprovantes.',
        anchorKey: 'finance_summary',
      },
      {
        title: 'Categorias e Comprovantes',
        description: 'Organize despesas por categorias personalizadas para manter o caixa transparente.',
        tip: 'Anexe comprovantes em PDF ou imagem para prestação de contas.',
      },
    ],
  },
  more_home: {
    moduleLabel: 'Mais Opções',
    steps: [
      {
        title: 'Central de Ajustes',
        description: 'Sua conta, segurança e preferências corporativas ficam reunidas aqui.',
        tip: 'Acesse Perfil ou Configurações para personalizar seu aplicativo.',
      },
    ],
  },
  operational_health: {
    moduleLabel: 'Saúde Operacional',
    steps: [
      {
        title: 'Radar de Riscos',
        description: 'Monitore gargalos operacionais e prazos críticos antes do dia do evento.',
        tip: 'Identifique desvios com antecedência para mitigar imprevistos.',
      },
    ],
  },
  profile: {
    moduleLabel: 'Perfil',
    steps: [
      {
        title: 'Perfil Profissional',
        description: 'Gerencie os dados cadastrais da assessoria e a personalização da sua conta.',
        tip: 'Mantenha foto e informações oficiais de contato sempre atualizadas.',
      },
    ],
  },
  settings: {
    moduleLabel: 'Configurações',
    steps: [
      {
        title: 'Preferências do Aplicativo',
        description: 'Configure opções de segurança biométrica, alertas e preferências de interface.',
        tip: 'Ajuste o comportamento do app de acordo com a rotina da sua equipe.',
      },
    ],
  },
  billing: {
    moduleLabel: 'Assinaturas',
    steps: [
      {
        title: 'Gestão do Plano',
        description: 'Supervisione seu plano ativo, recursos contratados e histórico de faturamento.',
        tip: 'Consulte os benefícios do seu nível de assinatura a qualquer momento.',
      },
    ],
  },
};

export function getPrimaryStorageKey(moduleId: string) {
  return `painelprime.walkthrough.completed.${moduleId}`;
}

export function getLegacyStorageKey(userId: string | null, moduleId: string) {
  return `painelprime:walkthrough:${userId ?? 'anonymous'}:module:${moduleId}`;
}

export async function resetModuleWalkthrough(moduleId?: ModuleGuideKey) {
  try {
    if (moduleId) {
      await AsyncStorage.removeItem(getPrimaryStorageKey(moduleId));
    } else {
      const keys = Object.keys(MODULE_GUIDES) as ModuleGuideKey[];
      await AsyncStorage.multiRemove(keys.map(getPrimaryStorageKey));
    }
  } catch {
    // Falha silenciosa
  }
}

function deriveModuleGuideKey(segments: readonly string[]): ModuleGuideKey | null {
  const chain = getVisibleSegments(segments);
  const root = chain[0] ?? '';
  const leaf = chain[1] ?? '';

  if (root === 'dashboard' || root === 'Dashboard') return 'dashboard';
  if (root === 'clientes' || root === 'Clients') return 'clients';
  if (root === 'financeiro' || root === 'Finance') return 'finance';

  if (root === 'eventos' || root === 'Events') {
    if (leaf === '[id]' || leaf === 'EventDetails') return 'event_details';
    return 'events_list';
  }

  if (root === 'mais' || root === 'More') {
    if (leaf === 'saude-operacional' || leaf === 'OperationalHealth') return 'operational_health';
    if (leaf === 'perfil' || leaf === 'Profile') return 'profile';
    if (leaf === 'configuracoes' || leaf === 'Settings') return 'settings';
    if (leaf === 'assinaturas' || leaf === 'SuperBilling') return 'billing';
    return 'more_home';
  }

  return null;
}

export function ModuleWalkthroughOverlay() {
  const { user } = useAuth();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { anchors } = useWalkthroughAnchors();

  const [visible, setVisible] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [dismissing, setDismissing] = useState(false);

  const seenCacheRef = useRef<Record<string, boolean>>({});
  const checkingRef = useRef(false);

  const userId = user?.id ?? null;
  const moduleKey = useMemo(() => deriveModuleGuideKey(segments), [segments]);
  const guideSpec = moduleKey ? MODULE_GUIDES[moduleKey] : null;

  async function checkHasSeen(modKey: string, uId: string | null): Promise<boolean> {
    const primaryKey = getPrimaryStorageKey(modKey);
    const legacyKey = getLegacyStorageKey(uId, modKey);

    if (seenCacheRef.current[primaryKey] || seenCacheRef.current[legacyKey]) {
      return true;
    }

    try {
      const [primaryVal, legacyVal] = await Promise.all([
        AsyncStorage.getItem(primaryKey),
        AsyncStorage.getItem(legacyKey),
      ]);
      const seen = primaryVal === '1' || legacyVal === '1';
      if (seen) {
        seenCacheRef.current[primaryKey] = true;
        seenCacheRef.current[legacyKey] = true;
      }
      return seen;
    } catch {
      return false;
    }
  }

  async function persistDismissal(modKey: string, uId: string | null) {
    const primaryKey = getPrimaryStorageKey(modKey);
    const legacyKey = getLegacyStorageKey(uId, modKey);
    seenCacheRef.current[primaryKey] = true;
    seenCacheRef.current[legacyKey] = true;

    try {
      await Promise.all([
        AsyncStorage.setItem(primaryKey, '1'),
        AsyncStorage.setItem(legacyKey, '1'),
      ]);
    } catch {
      // Ignora erro de gravação para não impactar navegação
    }
  }

  useEffect(() => {
    seenCacheRef.current = {};
    checkingRef.current = false;
    setVisible(false);
    setCurrentStepIndex(0);
  }, [userId]);

  useEffect(() => {
    if (!userId || visible || dismissing || checkingRef.current || !moduleKey || !guideSpec) {
      return;
    }

    const activeModuleKey = moduleKey;
    const activeUserId = userId;
    let cancelled = false;

    async function evaluateVisibility() {
      checkingRef.current = true;
      try {
        const alreadySeen = await checkHasSeen(activeModuleKey, activeUserId);
        if (alreadySeen || cancelled) return;

        setCurrentStepIndex(0);
        setVisible(true);
      } finally {
        checkingRef.current = false;
      }
    }

    void evaluateVisibility();

    return () => {
      cancelled = true;
    };
  }, [userId, moduleKey, guideSpec, visible, dismissing]);

  if (!visible || !guideSpec || dismissing) {
    return null;
  }

  const steps = guideSpec.steps;
  const currentStep = steps[currentStepIndex] ?? steps[0];
  const totalSteps = steps.length;
  const isLastStep = currentStepIndex >= totalSteps - 1;

  const currentAnchor = currentStep.anchorKey ? anchors[currentStep.anchorKey] : undefined;

  const handleSkip = async () => {
    void AppHaptics.light();
    setDismissing(true);
    if (moduleKey) {
      await persistDismissal(moduleKey, userId);
    }
    setVisible(false);
    setDismissing(false);
  };

  const handleNext = async () => {
    if (isLastStep) {
      void AppHaptics.success();
      setDismissing(true);
      if (moduleKey) {
        await persistDismissal(moduleKey, userId);
      }
      setVisible(false);
      setDismissing(false);
    } else {
      void AppHaptics.light();
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  // Posicionamento inteligente para evitar qualquer obstrução de cabeçalho
  let cardPositionStyle: object;
  if (currentAnchor && currentAnchor.y > 0 && currentAnchor.h > 0) {
    const isTopHalf = currentAnchor.y < windowHeight / 2;
    if (isTopHalf) {
      cardPositionStyle = {
        top: Math.min(currentAnchor.y + currentAnchor.h + 12, windowHeight - 280),
        left: 16,
        right: 16,
      };
    } else {
      cardPositionStyle = {
        bottom: Math.max(windowHeight - currentAnchor.y + 12, insets.bottom + 16),
        left: 16,
        right: 16,
      };
    }
  } else {
    // Posição padrão: card inferior elegante, deixando o topo e meio 100% desobstruídos
    cardPositionStyle = {
      bottom: insets.bottom + 16,
      left: 16,
      right: 16,
    };
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleSkip}
      statusBarTranslucent
    >
      <View style={styles.modalRoot} pointerEvents="box-none">
        {/* Backdrop suave e elegante que dá foco ao tour */}
        <Pressable
          style={styles.backdrop}
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="Fechar tour interativo"
        />

        {/* Efeito holofote ao redor da âncora ativa */}
        {currentAnchor && currentAnchor.w > 0 && currentAnchor.h > 0 ? (
          <View
            pointerEvents="none"
            style={[
              styles.spotlightRing,
              {
                left: Math.max(0, currentAnchor.x - 4),
                top: Math.max(0, currentAnchor.y - 4),
                width: currentAnchor.w + 8,
                height: currentAnchor.h + 8,
                borderRadius: Math.max(8, (currentAnchor.borderRadius || 14) + 4),
              },
            ]}
          />
        ) : null}

        {/* Card do Walkthrough Dark Luxury */}
        <View style={[styles.card, cardPositionStyle]}>
          {/* Cabeçalho do Card */}
          <View style={styles.cardHeader}>
            <View style={styles.badgeRow}>
              <View style={styles.badgeIcon}>
                <Ionicons name="sparkles" size={13} color="#DEC479" />
              </View>
              <Text style={styles.badgeText}>
                {`GUIA · ${guideSpec.moduleLabel.toUpperCase()} (${currentStepIndex + 1}/${totalSteps})`}
              </Text>
            </View>

            <Pressable
              style={styles.closeBtn}
              onPress={handleSkip}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Fechar tour"
            >
              <Ionicons name="close" size={20} color="#A1A1AA" />
            </Pressable>
          </View>

          {/* Conteúdo do Passo Atual */}
          <View style={styles.cardBody}>
            <Text style={styles.stepTitle}>{currentStep.title}</Text>
            <Text style={styles.stepDescription}>{currentStep.description}</Text>

            {currentStep.tip ? (
              <View style={styles.tipBox}>
                <Ionicons name="bulb-outline" size={15} color="#DEC479" style={styles.tipIcon} />
                <Text style={styles.tipText}>{currentStep.tip}</Text>
              </View>
            ) : null}
          </View>

          {/* Indicador de Passos (Pills) */}
          {totalSteps > 1 ? (
            <View style={styles.stepsIndicator}>
              {steps.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.stepPill,
                    index === currentStepIndex && styles.stepPillActive,
                    index < currentStepIndex && styles.stepPillCompleted,
                  ]}
                />
              ))}
            </View>
          ) : null}

          {/* Ações com Alvos de Toque Mínimos de 44x44pt */}
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.skipButton}
              onPress={handleSkip}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Pular tour e fechar instruções"
            >
              <Text style={styles.skipButtonText}>Pular tour</Text>
            </Pressable>

            <Pressable
              style={styles.nextButton}
              onPress={handleNext}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={isLastStep ? 'Concluir tour' : 'Avançar para o próximo passo'}
            >
              <Text style={styles.nextButtonText}>{isLastStep ? 'Entendi' : 'Próximo'}</Text>
              <Ionicons
                name={isLastStep ? 'checkmark' : 'arrow-forward'}
                size={16}
                color="#111113"
              />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Alias de retrocompatibilidade com importações existentes
export const ModuleWalkthroughBanner = ModuleWalkthroughOverlay;

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 10, 13, 0.72)',
  },
  spotlightRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#DEC479',
    backgroundColor: 'rgba(222, 196, 121, 0.12)',
    shadowColor: '#DEC479',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  card: {
    position: 'absolute',
    backgroundColor: '#18181B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(222, 196, 121, 0.35)',
    padding: 18,
    gap: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  badgeIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(222, 196, 121, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#DEC479',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
    marginTop: -10,
  },
  cardBody: {
    gap: 8,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  stepDescription: {
    color: '#E4E4E7',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#111113',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#DEC479',
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 4,
    gap: 8,
  },
  tipIcon: {
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    color: '#D4D4D8',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  stepsIndicator: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  stepPill: {
    height: 4,
    flex: 1,
    borderRadius: 2,
    backgroundColor: '#2A2A30',
  },
  stepPillActive: {
    backgroundColor: '#DEC479',
  },
  stepPillCompleted: {
    backgroundColor: '#9A7A2E',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 2,
  },
  skipButton: {
    minHeight: 44,
    minWidth: 90,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A30',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  skipButtonText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
  },
  nextButton: {
    minHeight: 44,
    minWidth: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#DEC479',
    gap: 6,
  },
  nextButtonText: {
    color: '#111113',
    fontSize: 14,
    fontWeight: '800',
  },
});
