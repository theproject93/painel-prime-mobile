import { routeHrefs } from '@painel-prime/app/navigation';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../lib/supabase';
import { goBackOrReplace } from '../lib/router';
import { colors } from '../theme/colors';

type Message = { role: 'assistant' | 'user'; content: string };

function stripInternalActionPayload(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed.action === 'capture_lead') {
        return {
          cleanText:
            'Perfeito, recebi seus dados e vou encaminhar seu atendimento para finalizarmos sua assinatura.',
          captured: true,
        };
      }
    } catch {
      // ignore
    }
  }

  const inlineMatch = text.match(/\{[\s\S]*"action"\s*:\s*"capture_lead"[\s\S]*\}/);
  if (inlineMatch) {
    const without = text.replace(inlineMatch[0], '').trim();
    return {
      cleanText:
        without ||
        'Perfeito, recebi seus dados e vou encaminhar seu atendimento para finalizarmos sua assinatura.',
      captured: true,
    };
  }

  return { cleanText: text, captured: false };
}

function getAssistantText(data: unknown) {
  if (!data || typeof data !== 'object') return '';
  const payload = data as Record<string, unknown>;
  const candidates = [payload.reply, payload.message, payload.assistant, payload.output_text, payload.text];
  for (const row of candidates) {
    if (typeof row === 'string' && row.trim()) return row.trim();
  }
  return '';
}

export function PublicAtendimentoIAScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Oi! Eu sou a Plan, IA comercial do Painel Prime. Vou te ajudar a escolher o melhor plano para sua operação. Qual seu nome e WhatsApp?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [leadCaptured, setLeadCaptured] = useState(false);

  const whatsappLink = useMemo(() => {
    const raw =
      process.env.EXPO_PUBLIC_WHATSAPP_SALES_URL ||
      'https://wa.me/?text=Oi%2C%20quero%20assinar%20o%20Painel%20Prime.';
    return raw;
  }, []);

  async function sendToSalesAI(nextMessages: Message[]) {
    setLoading(true);
    setError('');

    const conversation = nextMessages.slice(-8).map((message) => ({
      role: message.role,
      content: message.content,
    }));

    try {
      const invokePromise = supabase.functions.invoke('sales-ai', {
        body: {
          conversation,
          metadata: {
            source: 'landing-atendimento-ia-mobile',
          },
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 12000);
      });

      const { data, error: functionError } = await Promise.race([invokePromise, timeoutPromise]);

      if (functionError) {
        setError('A IA demorou para responder. Continue no WhatsApp para atendimento imediato.');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'Estou com alta demanda agora. Se preferir, toque em "Continuar no WhatsApp" e finalizamos seu plano mais rápido.',
          },
        ]);
        setLoading(false);
        return;
      }

      const raw = getAssistantText(data);
      const parsed = stripInternalActionPayload(raw);
      const payload = (data ?? {}) as Record<string, unknown>;
      const captured = Boolean(payload.lead_captured ?? payload.leadCaptured ?? payload.captured);
      setLeadCaptured(captured || parsed.captured);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: parsed.cleanText || 'Perfeito. Continue com mais detalhes para fechar sua assinatura.',
        },
      ]);
    } catch {
      setError('A IA demorou para responder. Continue no WhatsApp para atendimento imediato.');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Nosso atendimento IA está mais lento no momento. Clique em "Continuar no WhatsApp" para ser atendida agora.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: 'user', content: text } as Message];
    setMessages(next);
    setInput('');
    void sendToSalesAI(next);
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable onPress={() => goBackOrReplace(router, routeHrefs.landing())}>
        <Text style={styles.back}>Voltar</Text>
      </Pressable>
      <View style={styles.card}>
        <Text style={styles.title}>Atendimento IA</Text>
        <Text style={styles.sub}>Fluxo conectado ao `sales-ai` da aplicação WEB.</Text>
        {leadCaptured ? <Text style={styles.badge}>Lead capturado com sucesso</Text> : null}
      </View>

      <View style={styles.chatCard}>
        {messages.map((message, idx) => (
          <View key={`${message.role}-${idx}`} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
            <Text style={[styles.bubbleText, message.role === 'user' ? styles.userBubbleText : null]}>{message.content}</Text>
          </View>
        ))}

        {loading ? (
          <View style={styles.typingRow}>
            <ActivityIndicator color={colors.primaryStrong} />
            <Text style={styles.caption}>Plan está digitando...</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.err}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Digite sua resposta..."
          placeholderTextColor={colors.mutedText}
        />
        <View style={styles.row}>
          <Pressable style={styles.sendButton} onPress={send}>
            <Text style={styles.sendButtonText}>Enviar</Text>
          </Pressable>
          <Pressable style={styles.waButton} onPress={() => void Linking.openURL(whatsappLink)}>
            <Text style={styles.waButtonText}>Continuar no WhatsApp</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 10, paddingBottom: 28 },
  back: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: '#111827', borderRadius: 14, padding: 14, gap: 6 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  sub: { color: '#D1D5DB', fontSize: 13, lineHeight: 19 },
  badge: { alignSelf: 'flex-start', color: '#14532D', backgroundColor: '#DCFCE7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, fontWeight: '700' },
  chatCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, gap: 8 },
  bubble: { borderRadius: 12, padding: 10, maxWidth: '90%' },
  assistantBubble: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start' },
  userBubble: { backgroundColor: '#111827', alignSelf: 'flex-end' },
  bubbleText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  userBubbleText: { color: '#FFFFFF' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  caption: { color: colors.mutedText, fontSize: 12 },
  err: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: colors.text },
  row: { flexDirection: 'row', gap: 8 },
  sendButton: { flex: 1, minHeight: 42, borderRadius: 10, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  sendButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  waButton: { flex: 1, minHeight: 42, borderRadius: 10, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
  waButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
