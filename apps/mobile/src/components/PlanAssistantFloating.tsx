import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { buildRouteContext, extractEventTabFromPath, normalizeText } from '../features/plan-assistant/core';
import { PlanAssistantChatSheet } from '../features/plan-assistant/PlanAssistantChatSheet';
import { PlanAssistantFab } from '../features/plan-assistant/PlanAssistantFab';
import { ProactiveHintBubble } from '../features/plan-assistant/ProactiveHintBubble';
import type { PlanHint } from '../features/plan-assistant/types';
import { useFloatingAssistantPosition } from '../features/plan-assistant/useFloatingAssistantPosition';
import { usePlanAssistantChat } from '../features/plan-assistant/usePlanAssistantChat';
import { usePlanAssistantHints } from '../features/plan-assistant/usePlanAssistantHints';
import { useWalkthroughAnchors } from './WalkthroughAnchors';

function navigateByCtaPath(router: ReturnType<typeof useRouter>, rawPath: string | undefined) {
  if (!rawPath?.trim()) return false;
  const path = normalizeText(rawPath.trim().split('?')[0]);
  const eventMatch = path.match(/\/dashboard\/eventos\/([0-9a-f-]{8,})/i);
  if (eventMatch) {
    const initialTab = extractEventTabFromPath(path);
    router.push(`/eventos/${eventMatch[1]}${initialTab ? `?initialTab=${initialTab}` : ''}`);
    return true;
  }
  if (path.startsWith('/dashboard/eventos')) router.push('/eventos');
  else if (path.startsWith('/dashboard/financeiro')) router.push('/financeiro');
  else if (path.startsWith('/dashboard/clientes') || path.startsWith('/dashboard/crm')) router.push('/clientes');
  else if (path.startsWith('/dashboard/planejamento')) router.push('/eventos');
  else if (path.startsWith('/dashboard/saude')) router.push('/mais/saude-operacional');
  else if (path.startsWith('/dashboard/perfil')) router.push('/mais/perfil');
  else if (path.startsWith('/dashboard/configuracoes')) router.push('/mais/configuracoes');
  else if (path.startsWith('/dashboard/faturamento') || path.startsWith('/dashboard/billing')) router.push('/mais/assinaturas');
  else if (path.startsWith('/dashboard/mais')) router.push('/mais');
  else if (path.startsWith('/dashboard')) router.push('/dashboard');
  else return false;
  return true;
}

export function PlanAssistantFloating() {
  const { user } = useAuth();
  const { requestMeasure } = useWalkthroughAnchors();
  const router = useRouter();
  const segments = useSegments();
  const params = useLocalSearchParams<{ id?: string | string[]; eventId?: string | string[] }>();
  const [isOpen, setIsOpen] = useState(false);
  const userId = user?.id ?? null;
  const userName = useMemo(() => {
    const metadata = (user?.user_metadata as Record<string, unknown> | undefined) ?? {};
    return typeof metadata.name === 'string' && metadata.name.trim()
      ? metadata.name.trim()
      : user?.email?.split('@')[0] ?? 'assessora';
  }, [user?.email, user?.user_metadata]);
  const route = useMemo(() => buildRouteContext(segments, params), [params, segments]);

  const hints = usePlanAssistantHints(userId, isOpen);
  const chat = usePlanAssistantChat({
    userId,
    userName,
    currentPath: route.currentPath,
    currentEventId: route.currentEventId,
    hints: hints.hints,
  });
  const closeChat = useCallback(() => setIsOpen(false), []);
  const openChat = useCallback(() => {
    setIsOpen(true);
    hints.hideProactiveBubble();
  }, [hints.hideProactiveBubble]);
  const floating = useFloatingAssistantPosition(userId, isOpen, openChat, closeChat);

  useEffect(() => {
    requestMeasure('plan_assistant.fab');
  }, [floating.position.x, floating.position.y, requestMeasure]);

  const openHint = useCallback(async (hint: PlanHint) => {
    setIsOpen(true);
    await hints.consumeHint(hint, 'opened');
    chat.appendHintMessage(hint);
  }, [chat.appendHintMessage, hints.consumeHint]);
  const dismissHint = useCallback(() => {
    if (hints.proactiveHint) void hints.consumeHint(hints.proactiveHint, 'dismissed');
  }, [hints.consumeHint, hints.proactiveHint]);
  const openCta = useCallback((path: string | undefined) => {
    if (navigateByCtaPath(router, path)) closeChat();
  }, [closeChat, router]);

  return (
    <View pointerEvents="box-none" style={styles.root}>
      {hints.showProactiveBubble && hints.proactiveHint && !isOpen ? (
        <ProactiveHintBubble
          hint={hints.proactiveHint}
          bottom={floating.fabBottom + 70}
          onDismiss={dismissHint}
          onOpen={() => void openHint(hints.proactiveHint as PlanHint)}
        />
      ) : null}
      <PlanAssistantFab isOpen={isOpen} position={floating.position} panHandlers={floating.panHandlers} />
      <PlanAssistantChatSheet
        visible={isOpen}
        bottom={floating.chatBottom}
        hints={hints.hints}
        loadingHints={hints.loadingHints}
        messages={chat.messages}
        input={chat.input}
        isReplying={chat.isReplying}
        onClose={closeChat}
        onOpenHint={(hint) => void openHint(hint)}
        onOpenCta={openCta}
        onChangeInput={chat.setInput}
        onSend={() => void chat.sendMessage()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 80, elevation: 80 },
});
