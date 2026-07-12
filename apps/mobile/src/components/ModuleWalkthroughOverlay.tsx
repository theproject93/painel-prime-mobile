import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSegments } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { getVisibleSegments } from '../lib/router';
import { colors } from '../theme/colors';

const STORAGE_PREFIX = 'painelprime:walkthrough';

type ModuleGuideKey =
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

type GuideSpec = {
  moduleLabel: string;
  intro: string;
  tip: string;
};

const MODULE_GUIDES: Record<ModuleGuideKey, GuideSpec> = {
  dashboard: {
    moduleLabel: 'Início',
    intro: 'Este módulo centraliza o comando operacional diário.',
    tip: 'Monitore pendências, atalhos e entregas da semana.',
  },
  events_list: {
    moduleLabel: 'Eventos',
    intro: 'Aqui você cria, busca e abre os eventos da assessoria.',
    tip: 'Use o botão Novo para criar um evento com capa e tipo.',
  },
  event_details: {
    moduleLabel: 'Evento',
    intro: 'Este contexto concentra toda a operação de um evento específico.',
    tip: 'Navegue pelas abas: cronograma, convidados, fornecedores, financeiro.',
  },
  clients: {
    moduleLabel: 'Clientes',
    intro: 'CRM comercial com funil, prioridade, follow-up e documentação.',
    tip: 'Filtre o funil; use as ações do topo para follow-ups e playbook.',
  },
  finance: {
    moduleLabel: 'Financeiro',
    intro: 'Controle de caixa, entradas, saídas, categorias e comprovantes.',
    tip: 'Troque abas entre entradas/saídas; anexe comprovantes.',
  },
  more_home: {
    moduleLabel: 'Mais',
    intro: 'Sua conta, segurança e preferências ficam reunidas aqui.',
    tip: 'Acesse Perfil ou Configurações quando precisar.',
  },
  operational_health: {
    moduleLabel: 'Saúde Operacional',
    intro: 'Radar de risco para antecipar gargalos antes do evento.',
    tip: 'Use os indicadores para decidir prioridades de mitigação.',
  },
  profile: {
    moduleLabel: 'Perfil',
    intro: 'Dados da conta e relação com assinatura.',
    tip: 'Mantenha dados oficiais atualizados para operação e suporte.',
  },
  settings: {
    moduleLabel: 'Configurações',
    intro: 'Preferências globais que afetam o comportamento da plataforma.',
    tip: 'Revise antes de escalar o uso para a equipe.',
  },
  billing: {
    moduleLabel: 'Assinaturas',
    intro: 'Supervisão de pagamentos, planos e histórico de cobrança.',
    tip: 'Use filtros e tabelas para auditoria rápida de assinaturas.',
  },
};

function buildStorageKey(userId: string | null, slug: string) {
  return `${STORAGE_PREFIX}:${userId ?? 'anonymous'}:${slug}`;
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

export function ModuleWalkthroughBanner() {
  const { user } = useAuth();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const cacheRef = useRef<Record<string, boolean>>({});
  const checkingRef = useRef(false);

  const userId = user?.id ?? null;
  const currentUserId = userId;
  const moduleKey = useMemo(() => deriveModuleGuideKey(segments), [segments]);
  const guideSpec = moduleKey ? MODULE_GUIDES[moduleKey] : null;

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

  useEffect(() => {
    cacheRef.current = {};
    checkingRef.current = false;
    setVisible(false);
  }, [userId]);

  useEffect(() => {
    const currentUserId = userId;
    if (!currentUserId || visible || dismissing || checkingRef.current || !moduleKey || !guideSpec) return;

    let cancelled = false;

    async function maybeShowBanner() {
      checkingRef.current = true;
      try {
        const moduleStorageKey = buildStorageKey(currentUserId, `module:${moduleKey}`);
        const moduleSeen = await hasSeen(moduleStorageKey);
        if (moduleSeen) return;

        if (!cancelled) {
          setVisible(true);
        }
      } catch {
        // Não bloqueia o app caso AsyncStorage falhe.
      } finally {
        checkingRef.current = false;
      }
    }

    void maybeShowBanner();

    return () => {
      cancelled = true;
    };
  }, [userId, moduleKey, guideSpec, visible, dismissing]);

  if (!visible || !guideSpec || dismissing) return null;

  const handleDismiss = async () => {
    setDismissing(true);
    await markSeen(buildStorageKey(currentUserId, `module:${moduleKey}`));
    setVisible(false);
    setDismissing(false);
  };

  return (
    <View style={[styles.banner, { top: insets.top + 8 }]}>
      <View style={styles.bannerInner}>
        <Ionicons name="sparkles-outline" size={20} color={colors.primaryStrong} />
        <View style={[styles.textWrap, { flex: 1 }]}>
          <Text style={styles.title}>{`Conheça: ${guideSpec.moduleLabel}`}</Text>
          <Text style={styles.subtitle}>{guideSpec.intro}</Text>
          <Text style={styles.tip}>{guideSpec.tip}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.ghostBtn} onPress={handleDismiss} disabled={dismissing}>
            <Text style={styles.ghostBtnText}>Entendi</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={handleDismiss} disabled={dismissing}>
            <Text style={styles.primaryBtnText}>Não mostrar novamente</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  bannerInner: {
    padding: 14,
    gap: 10,
  },
  textWrap: {
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  tip: {
    color: colors.mutedText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  ghostBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  ghostBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    color: colors.primaryTextOn,
    fontSize: 12,
    fontWeight: '700',
  },
});
