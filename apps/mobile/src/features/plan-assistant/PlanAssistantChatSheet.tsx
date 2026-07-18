import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../../theme/colors';
import { PLAN_FACE_IMAGE } from './assets';
import { PlanComposer } from './PlanComposer';
import { PlanMessageList } from './PlanMessageList';
import type { ChatMessage, PlanHint } from './types';

type Props = {
  visible: boolean;
  bottom: number;
  hints: PlanHint[];
  loadingHints: boolean;
  messages: ChatMessage[];
  input: string;
  isReplying: boolean;
  onClose: () => void;
  onOpenHint: (hint: PlanHint) => void;
  onOpenCta: (path: string | undefined) => void;
  onChangeInput: (value: string) => void;
  onSend: () => void;
};

export function PlanAssistantChatSheet(props: Props) {
  const listRef = useRef<ScrollView | null>(null);
  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [props.isReplying, props.messages, props.visible]);

  return (
    <Modal visible={props.visible} animationType="fade" transparent onRequestClose={props.onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={props.onClose} />
        <KeyboardAvoidingView style={styles.modalContent} behavior="padding" keyboardVerticalOffset={0}>
          <View style={[styles.panel, { marginBottom: props.bottom }]}>
            <View style={styles.header}>
              <View style={styles.headerTitleWrap}>
                <Image source={PLAN_FACE_IMAGE} style={styles.avatar} resizeMode="cover" />
                <View>
                  <Text style={styles.title}>Plan</Text>
                  <Text style={styles.subtitle}>Assistente da plataforma</Text>
                </View>
              </View>
              <Pressable onPress={props.onClose} hitSlop={8}>
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.hintsWrap}>
              <Text style={styles.hintsTitle}>Alertas proativos</Text>
              {props.loadingHints ? <Text style={styles.hintsCaption}>Analisando operação...</Text> : null}
              {!props.loadingHints && props.hints.length === 0 ? (
                <Text style={styles.hintsCaption}>Sem pendências urgentes agora.</Text>
              ) : null}
              {!props.loadingHints && props.hints.length > 0 ? (
                <View style={styles.hintsRow}>
                  {props.hints.slice(0, 3).map((hint) => (
                    <Pressable key={hint.id} style={styles.hintChip} onPress={() => props.onOpenHint(hint)}>
                      <Text style={styles.hintChipText} numberOfLines={1}>{hint.title}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <ScrollView ref={listRef} style={styles.messagesArea} contentContainerStyle={styles.messagesContent}>
              <PlanMessageList
                messages={props.messages}
                isReplying={props.isReplying}
                onOpenCta={props.onOpenCta}
              />
            </ScrollView>
            <PlanComposer
              value={props.input}
              disabled={props.isReplying}
              onChange={props.onChangeInput}
              onSend={props.onSend}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
  modalContent: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 12 },
  panel: { width: '100%', height: '86%', maxHeight: '92%', backgroundColor: colors.card, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  header: { backgroundColor: colors.primaryStrong, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { height: 34, width: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  subtitle: { color: '#FFFFFF', fontSize: 11, opacity: 0.85, fontWeight: '500' },
  hintsWrap: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 6, backgroundColor: '#FCFCFD' },
  hintsTitle: { color: colors.mutedText, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  hintsCaption: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  hintsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hintChip: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '100%' },
  hintChipText: { color: colors.primaryStrong, fontSize: 11, fontWeight: '700' },
  messagesArea: { flex: 1, backgroundColor: colors.card },
  messagesContent: { paddingHorizontal: 10, paddingVertical: 10, gap: 8 },
});
