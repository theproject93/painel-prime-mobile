import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSegments } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { getVisibleSegments } from '../lib/router';
import { colors } from '../theme/colors';
import { useWalkthroughAnchors } from './WalkthroughAnchors';

const PLAN_FACE_IMAGE = require('../../assets/plan-face-real.png');
const STORAGE_PREFIX = 'planejarpro:walkthrough';

type ModuleGuideKey =
  | 'dashboard'
  | 'events_list'
  | 'event_details'
  | 'event_command'
  | 'clients'
  | 'finance'
  | 'more_home'
  | 'planning'
  | 'operational_health'
  | 'profile'
  | 'settings'
  | 'billing';
type GuideThemeKey = ModuleGuideKey | 'welcome';

type SpotlightPreset = {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  borderRadius?: number;
};

type GuideStep = {
  title: string;
  description: string;
  anchorId?: string;
  spotlight?: SpotlightPreset;
};

type GuideSpec = {
  moduleLabel: string;
  intro: string;
  steps: GuideStep[];
};

type ActiveGuide = {
  storageKey: string;
  themeKey: GuideThemeKey;
  spec: GuideSpec;
};

type SpotlightRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  borderRadius: number;
};

type GuideTheme = {
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  spotlight: string;
  spotlightPulse: string;
};

const WELCOME_GUIDE: GuideSpec = {
  moduleLabel: 'Primeiro login',
  intro: 'Vamos fazer um onboarding rápido para você dominar a operação no app.',
  steps: [
    {
      title: 'Visão geral da operação',
      description:
        'No Dashboard você acompanha pendências críticas, atalhos e entregas da semana para decidir prioridades com rapidez.',
      anchorId: 'dashboard.metrics',
      spotlight: { xPct: 0.04, yPct: 0.1, wPct: 0.92, hPct: 0.21, borderRadius: 16 },
    },
    {
      title: 'Navegação por módulos',
      description:
        'Use a barra inferior para alternar entre Eventos, Clientes, Financeiro e Mais sem sair do contexto de trabalho.',
      spotlight: { xPct: 0.03, yPct: 0.905, wPct: 0.94, hPct: 0.075, borderRadius: 18 },
    },
    {
      title: 'Apoio contínuo da Plan IA',
      description:
        'Toque no botão da Plan para receber orientações contextuais e atalhos para os pontos mais urgentes.',
      anchorId: 'plan_assistant.fab',
      spotlight: { xPct: 0.8, yPct: 0.79, wPct: 0.18, hPct: 0.12, borderRadius: 32 },
    },
  ],
};

const MODULE_GUIDES: Record<ModuleGuideKey, GuideSpec> = {
  dashboard: {
    moduleLabel: 'Início',
    intro: 'Este módulo centraliza o comando operacional diário.',
    steps: [
      {
        title: 'Cards de controle',
        description:
          'Aqui você monitora eventos em andamento, próximo evento e valor total sob gestão.',
        anchorId: 'dashboard.metrics',
        spotlight: { xPct: 0.03, yPct: 0.12, wPct: 0.94, hPct: 0.18, borderRadius: 14 },
      },
      {
        title: 'Top pendências',
        description:
          'Use o botão Resolver para abrir direto a aba correta do evento e reduzir risco.',
        anchorId: 'dashboard.pendencies',
        spotlight: { xPct: 0.03, yPct: 0.31, wPct: 0.94, hPct: 0.22, borderRadius: 14 },
      },
      {
        title: 'Atalhos e agenda curta',
        description:
          'Essas seções aceleram a execução de tarefas recorrentes e vencimentos de 7 dias.',
        anchorId: 'dashboard.shortcuts',
        spotlight: { xPct: 0.03, yPct: 0.54, wPct: 0.94, hPct: 0.33, borderRadius: 14 },
      },
    ],
  },
  events_list: {
    moduleLabel: 'Eventos',
    intro: 'Aqui você cria, busca e abre os eventos da assessoria.',
    steps: [
      {
        title: 'Criar novo evento',
        description: 'Use o botão Novo para abrir o cadastro de evento com capa, tipo e dados base.',
        anchorId: 'events.new_button',
        spotlight: { xPct: 0.72, yPct: 0.08, wPct: 0.24, hPct: 0.09, borderRadius: 14 },
      },
      {
        title: 'Busca e filtros',
        description: 'Refine por nome, local e status para encontrar rapidamente o evento certo.',
        anchorId: 'events.filters',
        spotlight: { xPct: 0.03, yPct: 0.18, wPct: 0.94, hPct: 0.14, borderRadius: 12 },
      },
      {
        title: 'Lista operacional',
        description: 'Toque no card do evento para entrar nas abas completas de execução.',
        anchorId: 'events.list',
        spotlight: { xPct: 0.03, yPct: 0.31, wPct: 0.94, hPct: 0.55, borderRadius: 14 },
      },
    ],
  },
  event_details: {
    moduleLabel: 'Evento',
    intro: 'Este contexto concentra toda a operação de um evento específico.',
    steps: [
      {
        title: 'Abas de execução',
        description: 'Navegue pelas abas para cronograma, convidados, fornecedores, financeiro e documentos.',
        anchorId: 'event_details.tabs',
        spotlight: { xPct: 0.02, yPct: 0.12, wPct: 0.96, hPct: 0.14, borderRadius: 12 },
      },
      {
        title: 'Área principal do módulo',
        description: 'Toda alteração desta área impacta diretamente o status do evento selecionado.',
        anchorId: 'event_details.content',
        spotlight: { xPct: 0.02, yPct: 0.27, wPct: 0.96, hPct: 0.58, borderRadius: 12 },
      },
    ],
  },
  event_command: {
    moduleLabel: 'Torre',
    intro: 'Painel de comando em tempo real para o dia do evento.',
    steps: [
      {
        title: 'Radar de alertas',
        description: 'Monitore alertas, SLA e incidentes para priorizar resposta rápida.',
        anchorId: 'event_command.alerts',
        spotlight: { xPct: 0.03, yPct: 0.12, wPct: 0.94, hPct: 0.24, borderRadius: 12 },
      },
      {
        title: 'Fluxo de decisão',
        description: 'Atualize o status e comunique noivos e equipe com rastreabilidade.',
        anchorId: 'event_command.workflow',
        spotlight: { xPct: 0.03, yPct: 0.38, wPct: 0.94, hPct: 0.48, borderRadius: 12 },
      },
    ],
  },
  clients: {
    moduleLabel: 'Clientes',
    intro: 'CRM comercial com funil, prioridade, follow-up e documentação.',
    steps: [
      {
        title: 'Ações principais',
        description: 'Use os botões do topo para follow-ups, playbook e novo cliente.',
        anchorId: 'clients.actions',
        spotlight: { xPct: 0.03, yPct: 0.09, wPct: 0.94, hPct: 0.15, borderRadius: 12 },
      },
      {
        title: 'Busca e pipeline',
        description: 'Filtre e revise o funil para manter previsibilidade de conversão.',
        anchorId: 'clients.pipeline',
        spotlight: { xPct: 0.03, yPct: 0.24, wPct: 0.94, hPct: 0.27, borderRadius: 12 },
      },
      {
        title: 'Detalhe do cliente',
        description: 'No painel de detalhe você registra interações, documentos e assinatura.',
        anchorId: 'clients.detail',
        spotlight: { xPct: 0.03, yPct: 0.52, wPct: 0.94, hPct: 0.35, borderRadius: 12 },
      },
    ],
  },
  finance: {
    moduleLabel: 'Financeiro',
    intro: 'Controle de caixa, entradas, saídas, categorias e comprovantes.',
    steps: [
      {
        title: 'Painel financeiro',
        description: 'Cards e gráficos mostram a situação atual e a tendência do caixa.',
        anchorId: 'finance.analytics',
        spotlight: { xPct: 0.03, yPct: 0.11, wPct: 0.94, hPct: 0.24, borderRadius: 12 },
      },
      {
        title: 'Abas e movimentações',
        description: 'Troque entre entradas e saídas para leitura operacional do período.',
        anchorId: 'finance.tabs_list',
        spotlight: { xPct: 0.03, yPct: 0.36, wPct: 0.94, hPct: 0.21, borderRadius: 12 },
      },
      {
        title: 'Lançamentos e comprovantes',
        description: 'Registre com status correto e anexe comprovantes para auditoria.',
        anchorId: 'finance.forms',
        spotlight: { xPct: 0.03, yPct: 0.58, wPct: 0.94, hPct: 0.29, borderRadius: 12 },
      },
    ],
  },
  more_home: {
    moduleLabel: 'Mais',
    intro: 'Atalhos administrativos e governança da conta.',
    steps: [
      {
        title: 'Navegação administrativa',
        description: 'Acesse Perfil, Planejamento, Saúde Operacional e Configurações.',
        anchorId: 'more.navigation',
        spotlight: { xPct: 0.03, yPct: 0.11, wPct: 0.94, hPct: 0.34, borderRadius: 12 },
      },
      {
        title: 'Resumo e ferramentas',
        description: 'Exporte resumo, limpe registros antigos e acompanhe indicadores.',
        anchorId: 'more.tools',
        spotlight: { xPct: 0.03, yPct: 0.46, wPct: 0.94, hPct: 0.32, borderRadius: 12 },
      },
      {
        title: 'Sessão de conta',
        description: 'Use este botão apenas para encerrar a sessão no dispositivo atual.',
        anchorId: 'more.logout',
        spotlight: { xPct: 0.17, yPct: 0.8, wPct: 0.66, hPct: 0.09, borderRadius: 12 },
      },
    ],
  },
  planning: {
    moduleLabel: 'Planejamento',
    intro: 'Visão transversal das tarefas de todos os eventos ativos.',
    steps: [
      {
        title: 'Filtro por prioridade',
        description: 'Foque primeiro no que vence antes e no que tem maior impacto operacional.',
        anchorId: 'planning.filters',
        spotlight: { xPct: 0.03, yPct: 0.12, wPct: 0.94, hPct: 0.2, borderRadius: 12 },
      },
      {
        title: 'Lista de execução',
        description: 'Marque a conclusão e mantenha a rastreabilidade da operação em dia.',
        anchorId: 'planning.list',
        spotlight: { xPct: 0.03, yPct: 0.33, wPct: 0.94, hPct: 0.55, borderRadius: 12 },
      },
    ],
  },
  operational_health: {
    moduleLabel: 'Saúde Operacional',
    intro: 'Radar de risco para antecipar gargalos antes do evento.',
    steps: [
      {
        title: 'Score geral e KPIs',
        description: 'Use os indicadores para decidir prioridades de mitigação.',
        anchorId: 'op_health.metrics',
        spotlight: { xPct: 0.03, yPct: 0.12, wPct: 0.94, hPct: 0.26, borderRadius: 12 },
      },
      {
        title: 'Ações de correção',
        description: 'Aplique correções sugeridas no módulo correspondente.',
        anchorId: 'op_health.details',
        spotlight: { xPct: 0.03, yPct: 0.39, wPct: 0.94, hPct: 0.49, borderRadius: 12 },
      },
    ],
  },
  profile: {
    moduleLabel: 'Perfil',
    intro: 'Dados da conta e relação com assinatura.',
    steps: [
      {
        title: 'Identidade e contatos',
        description: 'Mantenha os dados oficiais atualizados para operação e suporte.',
        anchorId: 'profile.identity',
        spotlight: { xPct: 0.03, yPct: 0.12, wPct: 0.94, hPct: 0.3, borderRadius: 12 },
      },
      {
        title: 'Assinatura e status',
        description: 'Valide o plano ativo e o fluxo de checkout quando necessário.',
        anchorId: 'profile.billing',
        spotlight: { xPct: 0.03, yPct: 0.43, wPct: 0.94, hPct: 0.43, borderRadius: 12 },
      },
    ],
  },
  settings: {
    moduleLabel: 'Configurações',
    intro: 'Preferências globais que afetam o comportamento da plataforma.',
    steps: [
      {
        title: 'Parâmetros principais',
        description: 'Revise e ajuste as preferências antes de escalar o uso para a equipe.',
        anchorId: 'settings.toggles',
        spotlight: { xPct: 0.03, yPct: 0.14, wPct: 0.94, hPct: 0.58, borderRadius: 12 },
      },
      {
        title: 'Salvar alterações',
        description: 'Confirme a persistência em toda alteração relevante.',
        anchorId: 'settings.sync',
        spotlight: { xPct: 0.26, yPct: 0.74, wPct: 0.48, hPct: 0.1, borderRadius: 12 },
      },
    ],
  },
  billing: {
    moduleLabel: 'Assinaturas',
    intro: 'Supervisão de pagamentos, planos e histórico de cobrança.',
    steps: [
      {
        title: 'Visão administrativa',
        description: 'Use filtros e tabelas para auditoria rápida de assinaturas.',
        anchorId: 'billing.metrics',
        spotlight: { xPct: 0.03, yPct: 0.12, wPct: 0.94, hPct: 0.32, borderRadius: 12 },
      },
      {
        title: 'Histórico financeiro',
        description: 'Valide a consistência dos pagamentos antes de qualquer ação manual.',
        anchorId: 'billing.history',
        spotlight: { xPct: 0.03, yPct: 0.45, wPct: 0.94, hPct: 0.43, borderRadius: 12 },
      },
    ],
  },
};

const GUIDE_THEMES: Record<GuideThemeKey, GuideTheme> = {
  welcome: {
    icon: 'sparkles-outline',
    accent: '#8B5CF6',
    accentSoft: '#F3E8FF',
    accentBorder: '#DDD6FE',
    spotlight: '#A78BFA',
    spotlightPulse: '#C4B5FD',
  },
  dashboard: {
    icon: 'speedometer-outline',
    accent: '#2563EB',
    accentSoft: '#EFF6FF',
    accentBorder: '#BFDBFE',
    spotlight: '#60A5FA',
    spotlightPulse: '#93C5FD',
  },
  events_list: {
    icon: 'calendar-outline',
    accent: '#0F766E',
    accentSoft: '#ECFEFF',
    accentBorder: '#99F6E4',
    spotlight: '#14B8A6',
    spotlightPulse: '#2DD4BF',
  },
  event_details: {
    icon: 'layers-outline',
    accent: '#7C3AED',
    accentSoft: '#F5F3FF',
    accentBorder: '#DDD6FE',
    spotlight: '#8B5CF6',
    spotlightPulse: '#A78BFA',
  },
  event_command: {
    icon: 'pulse-outline',
    accent: '#B45309',
    accentSoft: '#FFFBEB',
    accentBorder: '#FDE68A',
    spotlight: '#D97706',
    spotlightPulse: '#F59E0B',
  },
  clients: {
    icon: 'people-outline',
    accent: '#0369A1',
    accentSoft: '#F0F9FF',
    accentBorder: '#BAE6FD',
    spotlight: '#0EA5E9',
    spotlightPulse: '#38BDF8',
  },
  finance: {
    icon: 'wallet-outline',
    accent: '#0F766E',
    accentSoft: '#F0FDFA',
    accentBorder: '#99F6E4',
    spotlight: '#14B8A6',
    spotlightPulse: '#2DD4BF',
  },
  more_home: {
    icon: 'grid-outline',
    accent: '#334155',
    accentSoft: '#F8FAFC',
    accentBorder: '#CBD5E1',
    spotlight: '#64748B',
    spotlightPulse: '#94A3B8',
  },
  planning: {
    icon: 'list-outline',
    accent: '#1D4ED8',
    accentSoft: '#EFF6FF',
    accentBorder: '#BFDBFE',
    spotlight: '#3B82F6',
    spotlightPulse: '#60A5FA',
  },
  operational_health: {
    icon: 'heart-half-outline',
    accent: '#059669',
    accentSoft: '#ECFDF5',
    accentBorder: '#A7F3D0',
    spotlight: '#10B981',
    spotlightPulse: '#34D399',
  },
  profile: {
    icon: 'person-circle-outline',
    accent: '#7C3AED',
    accentSoft: '#F5F3FF',
    accentBorder: '#DDD6FE',
    spotlight: '#8B5CF6',
    spotlightPulse: '#A78BFA',
  },
  settings: {
    icon: 'settings-outline',
    accent: '#475569',
    accentSoft: '#F8FAFC',
    accentBorder: '#CBD5E1',
    spotlight: '#64748B',
    spotlightPulse: '#94A3B8',
  },
  billing: {
    icon: 'card-outline',
    accent: '#7C2D12',
    accentSoft: '#FFF7ED',
    accentBorder: '#FED7AA',
    spotlight: '#C2410C',
    spotlightPulse: '#EA580C',
  },
};

function buildStorageKey(userId: string, slug: string) {
  return `${STORAGE_PREFIX}:${userId}:${slug}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function deriveModuleGuideKey(segments: readonly string[]): ModuleGuideKey | null {
  const chain = getVisibleSegments(segments);
  const root = chain[0] ?? '';
  const leaf = chain[1] ?? '';
  const subLeaf = chain[2] ?? '';

  if (root === 'dashboard' || root === 'Dashboard') return 'dashboard';
  if (root === 'clientes' || root === 'Clients') return 'clients';
  if (root === 'financeiro' || root === 'Finance') return 'finance';

  if (root === 'eventos' || root === 'Events') {
    if (leaf === '[id]' && subLeaf === 'torre') return 'event_command';
    if (leaf === '[id]' || leaf === 'EventDetails') return 'event_details';
    if (leaf === 'EventCommandCenter') return 'event_command';
    return 'events_list';
  }

  if (root === 'mais' || root === 'More') {
    if (leaf === 'planejamento' || leaf === 'Planning') return 'planning';
    if (leaf === 'saude-operacional' || leaf === 'OperationalHealth') return 'operational_health';
    if (leaf === 'perfil' || leaf === 'Profile') return 'profile';
    if (leaf === 'configuracoes' || leaf === 'Settings') return 'settings';
    if (leaf === 'assinaturas' || leaf === 'SuperBilling') return 'billing';
    return 'more_home';
  }

  return null;
}

function resolveSpotlightRect(
  preset: SpotlightPreset,
  screenWidth: number,
  screenHeight: number,
  topInset: number,
  bottomInset: number,
): SpotlightRect {
  const safeTop = topInset + 8;
  const safeBottom = screenHeight - (bottomInset + 78);
  const rawX = Math.round(screenWidth * preset.xPct);
  const rawY = Math.round(screenHeight * preset.yPct);
  const rawW = Math.round(screenWidth * preset.wPct);
  const rawH = Math.round(screenHeight * preset.hPct);

  const w = clamp(rawW, 60, screenWidth - 20);
  const h = clamp(rawH, 36, Math.max(36, safeBottom - safeTop));
  const x = clamp(rawX, 10, screenWidth - w - 10);
  const y = clamp(rawY, safeTop, Math.max(safeTop, safeBottom - h));

  return {
    x,
    y,
    w,
    h,
    borderRadius: preset.borderRadius ?? 14,
  };
}

function resolveMeasuredRect(
  measured: SpotlightRect,
  screenWidth: number,
  screenHeight: number,
  topInset: number,
  bottomInset: number,
): SpotlightRect {
  const safeTop = topInset + 6;
  const safeBottom = screenHeight - (bottomInset + 72);
  const w = clamp(Math.round(measured.w), 40, screenWidth - 12);
  const h = clamp(Math.round(measured.h), 30, Math.max(30, safeBottom - safeTop));
  const x = clamp(Math.round(measured.x), 6, screenWidth - w - 6);
  const y = clamp(Math.round(measured.y), safeTop, Math.max(safeTop, safeBottom - h));

  return {
    x,
    y,
    w,
    h,
    borderRadius: measured.borderRadius,
  };
}

export function ModuleWalkthroughOverlay() {
  const { user } = useAuth();
  const { anchors, requestMeasure } = useWalkthroughAnchors();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [activeGuide, setActiveGuide] = useState<ActiveGuide | null>(null);
  const [saving, setSaving] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [cardHeight, setCardHeight] = useState(260);

  const cacheRef = useRef<Record<string, boolean>>({});
  const checkingRef = useRef(false);

  const cardAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const spotlightXAnim = useRef(new Animated.Value(0)).current;
  const spotlightYAnim = useRef(new Animated.Value(0)).current;
  const spotlightWAnim = useRef(new Animated.Value(0)).current;
  const spotlightHAnim = useRef(new Animated.Value(0)).current;
  const hasSpotlightAnimSeedRef = useRef(false);
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const userId = user?.id ?? null;
  const userName = useMemo(() => {
    const metadata = (user?.user_metadata as Record<string, unknown> | undefined) ?? {};
    const metadataName = typeof metadata.name === 'string' ? metadata.name.trim() : '';
    if (metadataName) return metadataName;
    return user?.email?.split('@')[0] ?? 'assessora';
  }, [user?.email, user?.user_metadata]);

  const currentStep = useMemo(() => {
    if (!activeGuide) return null;
    const maxIdx = activeGuide.spec.steps.length - 1;
    const safeIdx = clamp(stepIndex, 0, maxIdx);
    return activeGuide.spec.steps[safeIdx] ?? null;
  }, [activeGuide, stepIndex]);

  const spotlightRect = useMemo(() => {
    const anchorId = currentStep?.anchorId;
    if (anchorId) {
      const measured = anchors[anchorId];
      if (measured) {
        return resolveMeasuredRect(measured, width, height, insets.top, insets.bottom);
      }
    }

    const preset = currentStep?.spotlight;
    if (!preset) return null;
    return resolveSpotlightRect(preset, width, height, insets.top, insets.bottom);
  }, [anchors, currentStep?.anchorId, currentStep?.spotlight, height, insets.bottom, insets.top, width]);

  const cardPositionStyle = useMemo(() => {
    if (!spotlightRect) {
      return { bottom: 14 + insets.bottom };
    }

    const spacing = 12;
    const canPlaceBelow = spotlightRect.y + spotlightRect.h + spacing + cardHeight <= height - (insets.bottom + 8);
    if (canPlaceBelow) {
      return { top: spotlightRect.y + spotlightRect.h + spacing };
    }

    const top = clamp(spotlightRect.y - cardHeight - spacing, insets.top + 8, height - cardHeight - (insets.bottom + 8));
    return { top };
  }, [cardHeight, height, insets.bottom, insets.top, spotlightRect]);

  const stepCount = activeGuide?.spec.steps.length ?? 0;
  const isLastStep = stepCount > 0 && stepIndex >= stepCount - 1;
  const activeTheme = GUIDE_THEMES[activeGuide?.themeKey ?? 'welcome'];

  async function hasSeen(storageKey: string) {
    if (cacheRef.current[storageKey]) return true;
    const value = await AsyncStorage.getItem(storageKey);
    const seen = value === '1';
    if (seen) cacheRef.current[storageKey] = true;
    return seen;
  }

  async function markSeen(storageKey: string) {
    cacheRef.current[storageKey] = true;
    await AsyncStorage.setItem(storageKey, '1');
  }

  async function closeGuide() {
    if (!activeGuide || saving) return;
    setSaving(true);
    try {
      await markSeen(activeGuide.storageKey);
      setActiveGuide(null);
      setStepIndex(0);
    } finally {
      setSaving(false);
    }
  }

  function nextStep() {
    if (!activeGuide || saving) return;
    if (isLastStep) {
      void closeGuide();
      return;
    }
    setStepIndex((prev) => prev + 1);
  }

  function prevStep() {
    if (saving) return;
    setStepIndex((prev) => Math.max(0, prev - 1));
  }

  useEffect(() => {
    cacheRef.current = {};
    checkingRef.current = false;
    setActiveGuide(null);
    setStepIndex(0);
  }, [userId]);

  useEffect(() => {
    const currentUserId = userId;
    if (!currentUserId || activeGuide || checkingRef.current) return;
    const resolvedUserId = currentUserId;

    let cancelled = false;

    async function maybeShowGuide() {
      checkingRef.current = true;
      try {
        const welcomeKey = buildStorageKey(resolvedUserId, 'first-login');
        const welcomeSeen = await hasSeen(welcomeKey);

        if (!welcomeSeen) {
          if (!cancelled) {
            setActiveGuide({
              storageKey: welcomeKey,
              themeKey: 'welcome',
              spec: WELCOME_GUIDE,
            });
            setStepIndex(0);
          }
          return;
        }

          const moduleKey = deriveModuleGuideKey(segments);
        if (!moduleKey) return;

        const moduleStorageKey = buildStorageKey(resolvedUserId, `module:${moduleKey}`);
        const moduleSeen = await hasSeen(moduleStorageKey);
        if (moduleSeen) return;

        if (!cancelled) {
          setActiveGuide({
            storageKey: moduleStorageKey,
            themeKey: moduleKey,
            spec: MODULE_GUIDES[moduleKey],
          });
          setStepIndex(0);
        }
      } catch {
        // Não bloqueia o app caso AsyncStorage falhe.
      } finally {
        checkingRef.current = false;
      }
    }

    void maybeShowGuide();

    return () => {
      cancelled = true;
    };
  }, [activeGuide, segments, userId]);

  useEffect(() => {
    if (!activeGuide) return;
    if (activeGuide.themeKey === 'welcome') return;

    const currentModule = deriveModuleGuideKey(segments);
    if (!currentModule) return;
    if (currentModule === activeGuide.themeKey) return;

    // Evita exibir guia de um modulo em outro contexto de tela.
    setActiveGuide(null);
    setStepIndex(0);
  }, [activeGuide, segments]);

  useEffect(() => {
    if (!activeGuide) return;
    requestMeasure();
  }, [activeGuide, requestMeasure]);

  useEffect(() => {
    const anchorId = currentStep?.anchorId;
    if (!anchorId) return;

    requestMeasure(anchorId);
    const timeoutId = setTimeout(() => {
      requestMeasure(anchorId);
    }, 180);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentStep?.anchorId, requestMeasure, stepIndex]);

  useEffect(() => {
    if (!spotlightRect) {
      hasSpotlightAnimSeedRef.current = false;
      return;
    }

    if (!hasSpotlightAnimSeedRef.current) {
      spotlightXAnim.setValue(spotlightRect.x);
      spotlightYAnim.setValue(spotlightRect.y);
      spotlightWAnim.setValue(spotlightRect.w);
      spotlightHAnim.setValue(spotlightRect.h);
      hasSpotlightAnimSeedRef.current = true;
      return;
    }

    Animated.parallel([
      Animated.timing(spotlightXAnim, {
        toValue: spotlightRect.x,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(spotlightYAnim, {
        toValue: spotlightRect.y,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(spotlightWAnim, {
        toValue: spotlightRect.w,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(spotlightHAnim, {
        toValue: spotlightRect.h,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start();
  }, [spotlightHAnim, spotlightRect, spotlightWAnim, spotlightXAnim, spotlightYAnim]);

  useEffect(() => {
    if (!activeGuide || stepCount <= 0) {
      progressAnim.setValue(0);
      return;
    }

    const target = (stepIndex + 1) / stepCount;
    Animated.timing(progressAnim, {
      toValue: target,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [activeGuide, progressAnim, stepCount, stepIndex]);

  useEffect(() => {
    if (!activeGuide) return;

    cardAnim.setValue(0);
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();

    pulseLoopRef.current?.stop();
    pulseAnim.setValue(0);
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 900, useNativeDriver: false }),
      ]),
    );
    pulseLoopRef.current.start();

    return () => {
      pulseLoopRef.current?.stop();
    };
  }, [activeGuide, cardAnim, pulseAnim, stepIndex]);

  if (!activeGuide || !currentStep) return null;

  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 0],
  });
  const cardScale = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.985, 1],
  });

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.045],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.06],
  });
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        void closeGuide();
      }}
    >
      <View style={styles.modalRoot}>
        {spotlightRect ? (
          <>
            <View style={[styles.mask, { top: 0, left: 0, right: 0, height: spotlightRect.y }]} />
            <View
              style={[
                styles.mask,
                {
                  top: spotlightRect.y + spotlightRect.h,
                  left: 0,
                  right: 0,
                  bottom: 0,
                },
              ]}
            />
            <View
              style={[
                styles.mask,
                {
                  top: spotlightRect.y,
                  left: 0,
                  width: spotlightRect.x,
                  height: spotlightRect.h,
                },
              ]}
            />
            <View
              style={[
                styles.mask,
                {
                  top: spotlightRect.y,
                  left: spotlightRect.x + spotlightRect.w,
                  right: 0,
                  height: spotlightRect.h,
                },
              ]}
            />

            <Animated.View
              pointerEvents="none"
              style={[
                styles.spotlightPulse,
                {
                  left: spotlightXAnim,
                  top: spotlightYAnim,
                  width: spotlightWAnim,
                  height: spotlightHAnim,
                  borderRadius: spotlightRect.borderRadius,
                  borderColor: activeTheme.spotlightPulse,
                  transform: [{ scale: pulseScale }],
                  opacity: pulseOpacity,
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.spotlightOutline,
                {
                  left: spotlightXAnim,
                  top: spotlightYAnim,
                  width: spotlightWAnim,
                  height: spotlightHAnim,
                  borderRadius: spotlightRect.borderRadius,
                  borderColor: activeTheme.spotlight,
                },
              ]}
            />
          </>
        ) : (
          <View style={styles.maskFull} />
        )}

        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            // Mantem o clique fora sem fechar automaticamente para evitar pulo acidental.
          }}
        />

        <Animated.View
          style={[
            styles.sheet,
            cardPositionStyle,
            {
              opacity: cardAnim,
              borderColor: activeTheme.accentBorder,
              transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
            },
          ]}
          onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
        >
          <View style={[styles.sheetAccentBar, { backgroundColor: activeTheme.accent }]} />

          <View style={[styles.themeBadge, { backgroundColor: activeTheme.accentSoft, borderColor: activeTheme.accentBorder }]}>
            <Ionicons name={activeTheme.icon} size={13} color={activeTheme.accent} />
            <Text style={[styles.themeBadgeText, { color: activeTheme.accent }]}>
              {`Guia do módulo ${activeGuide.spec.moduleLabel}`}
            </Text>
          </View>

          <View style={styles.sheetHeader}>
            <Image
              source={PLAN_FACE_IMAGE}
              style={[styles.avatar, { borderColor: activeTheme.accentBorder }]}
              resizeMode="cover"
            />
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Plan IA</Text>
              <Text style={[styles.headerSub, { color: activeTheme.accent }]}>{activeGuide.spec.moduleLabel}</Text>
            </View>
            <Pressable
              style={[styles.skipButton, { borderColor: activeTheme.accentBorder }]}
              onPress={() => {
                void closeGuide();
              }}
            >
              <Text style={[styles.skipButtonText, { color: activeTheme.accent }]}>Pular</Text>
            </Pressable>
          </View>

          <Text style={styles.introText}>{activeGuide.spec.intro}</Text>

          <Text style={styles.stepTitle}>{currentStep.title}</Text>
          <Text style={styles.stepText}>{currentStep.description}</Text>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressTrackFill,
                {
                  width: progressWidth,
                  backgroundColor: activeTheme.accent,
                },
              ]}
            />
          </View>

          <View style={styles.progressRow}>
            {activeGuide.spec.steps.map((step, idx) => (
              <View
                key={`${step.title}-${idx}`}
                style={[
                  styles.progressDot,
                  idx === stepIndex ? styles.progressDotOn : null,
                  idx === stepIndex ? { backgroundColor: activeTheme.accent } : null,
                ]}
              />
            ))}
          </View>

          <Text style={styles.stepCounter}>{`Passo ${stepIndex + 1} de ${activeGuide.spec.steps.length}`}</Text>

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.ghostButton, stepIndex === 0 ? styles.ghostButtonDisabled : null]}
              disabled={stepIndex === 0 || saving}
              onPress={prevStep}
            >
              <Text style={styles.ghostButtonText}>Voltar</Text>
            </Pressable>

            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: activeTheme.accent },
                saving ? styles.primaryButtonDisabled : null,
              ]}
              disabled={saving}
              onPress={nextStep}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primaryTextOn} />
              ) : (
                <Text style={styles.primaryButtonText}>{isLastStep ? 'Concluir' : 'Próximo'}</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footerHintRow}>
            <Ionicons name="information-circle-outline" size={14} color={colors.mutedText} />
            <Text style={styles.footerHintText}>{`Oi, ${userName}, este guia aparece só na primeira visita deste módulo.`}</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(3, 6, 15, 0.74)',
  },
  maskFull: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 6, 15, 0.74)',
  },
  spotlightOutline: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    backgroundColor: 'transparent',
  },
  spotlightPulse: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#A78BFA',
    backgroundColor: 'transparent',
  },
  sheet: {
    position: 'absolute',
    left: 14,
    right: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 9,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 10,
  },
  sheetAccentBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 4,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  themeBadge: {
    alignSelf: 'flex-start',
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    marginTop: 1,
    marginBottom: 2,
  },
  themeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  headerSub: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '600',
  },
  skipButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  skipButtonText: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '700',
  },
  introText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  progressTrack: {
    marginTop: 2,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressTrackFill: {
    height: '100%',
    borderRadius: 999,
  },
  stepTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  stepText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 99,
    backgroundColor: '#E5E7EB',
  },
  progressDotOn: {
    backgroundColor: colors.primaryStrong,
  },
  stepCounter: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  ghostButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonDisabled: {
    opacity: 0.5,
  },
  ghostButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: colors.primaryTextOn,
    fontSize: 13,
    fontWeight: '700',
  },
  footerHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 2,
  },
  footerHintText: {
    flex: 1,
    color: colors.mutedText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
});
