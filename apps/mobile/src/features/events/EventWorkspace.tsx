import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, shadows } from '../../theme/colors';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Tone = 'neutral' | 'gold' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<Tone, { background: string; foreground: string }> = {
  neutral: { background: colors.surfaceSubtle, foreground: colors.textSecondary },
  gold: { background: colors.gold100, foreground: colors.gold700 },
  success: { background: colors.successBg, foreground: colors.successText },
  warning: { background: colors.warningBg, foreground: colors.warningText },
  danger: { background: colors.dangerBg, foreground: colors.dangerText },
  info: { background: colors.infoBg, foreground: colors.infoText },
};

export type EventMetric = {
  label: string;
  value: string | number;
  tone?: Tone;
};

export function EventModuleShell({
  title,
  description,
  icon,
  metrics,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  description: string;
  icon: IconName;
  metrics?: EventMetric[];
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.module}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name={icon} size={24} color={colors.gold700} accessible={false} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroDescription}>{description}</Text>
        </View>
      </View>

      {metrics?.length ? (
        <View style={styles.metrics}>
          {metrics.map((metric) => {
            const tone = TONES[metric.tone ?? 'neutral'];
            return (
              <View key={metric.label} style={[styles.metric, { backgroundColor: tone.background }]}>
                <Text style={[styles.metricValue, { color: tone.foreground }]}>{metric.value}</Text>
                <Text style={styles.metricLabel}>{metric.label}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" accessible={false} />
          <Text style={styles.primaryActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}

      {children}
    </View>
  );
}

export function EventSectionTitle({ title, actionLabel, onAction }: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EventFilterChips({ options, selected, onSelect }: {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function EventListCard({
  title,
  subtitle,
  meta,
  status,
  statusTone = 'neutral',
  actions,
  onPress,
}: {
  title: string;
  subtitle?: string;
  meta?: string[];
  status?: string;
  statusTone?: Tone;
  actions?: { label: string; onPress: () => void; tone?: 'normal' | 'danger'; icon?: IconName }[];
  onPress?: () => void;
}) {
  const tone = TONES[statusTone];
  const CardRoot = onPress ? Pressable : View;
  return (
    <CardRoot style={styles.listCard} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}>
      <View style={styles.listTop}>
        <View style={styles.listCopy}>
          <Text style={styles.listTitle}>{title}</Text>
          {subtitle ? <Text style={styles.listSubtitle}>{subtitle}</Text> : null}
        </View>
        {status ? (
          <View style={[styles.status, { backgroundColor: tone.background }]}>
            <Text style={[styles.statusText, { color: tone.foreground }]}>{status}</Text>
          </View>
        ) : null}
      </View>
      {meta?.length ? (
        <View style={styles.metaWrap}>
          {meta.filter(Boolean).map((item) => (
            <Text key={item} style={styles.metaText}>{item}</Text>
          ))}
        </View>
      ) : null}
      {actions?.length ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.itemAction,
                action.tone === 'danger' && styles.itemActionDanger,
                pressed && styles.pressed,
              ]}
            >
              {action.icon ? (
                <Ionicons
                  name={action.icon}
                  size={15}
                  color={action.tone === 'danger' ? colors.dangerText : colors.textSecondary}
                  accessible={false}
                />
              ) : null}
              <Text style={[styles.itemActionText, action.tone === 'danger' && styles.itemActionTextDanger]}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </CardRoot>
  );
}

export function EventEmptyState({ icon, title, description, actionLabel, onAction }: {
  icon: IconName;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.gold700} accessible={false} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.emptyAction} accessibilityRole="button">
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EventFormSheet({ visible, title, subtitle, onClose, children }: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar formulário" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetKeyboard}
        >
          <SafeAreaView style={styles.sheet} edges={['bottom']}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetCopy}>
                <Text style={styles.sheetTitle}>{title}</Text>
                {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}
              </View>
              <Pressable
                onPress={onClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} accessible={false} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetContent}
            >
              {children}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  module: { gap: 14 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.gold100, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, gap: 2 },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  heroDescription: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minHeight: 72, borderRadius: 14, padding: 10, justifyContent: 'center' },
  metricValue: { fontSize: 20, fontWeight: '800' },
  metricLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  primaryAction: { minHeight: 52, borderRadius: 14, backgroundColor: colors.ink950, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadows.card },
  primaryActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sectionAction: { color: colors.gold700, fontSize: 13, fontWeight: '700' },
  chips: { gap: 8, paddingRight: 12 },
  chip: { minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, justifyContent: 'center', paddingHorizontal: 14 },
  chipActive: { borderColor: colors.gold600, backgroundColor: colors.gold100 },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: colors.gold700 },
  listCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 10, ...shadows.sm },
  listTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  listCopy: { flex: 1, gap: 3 },
  listTitle: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  listSubtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: '800' },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaText: { color: colors.mutedText, fontSize: 11, backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2 },
  itemAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 11, backgroundColor: colors.surface },
  itemActionDanger: { borderColor: colors.danger100, backgroundColor: colors.dangerBg },
  itemActionText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  itemActionTextDanger: { color: colors.dangerText },
  empty: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 30 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.gold50, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 13 },
  emptyDescription: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 5 },
  emptyAction: { backgroundColor: colors.gold700, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 15 },
  emptyActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(15,17,21,0.46)', justifyContent: 'flex-end' },
  sheetKeyboard: { maxHeight: '90%', justifyContent: 'flex-end' },
  sheet: { maxHeight: '100%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  sheetHandle: { width: 42, height: 5, borderRadius: 999, backgroundColor: colors.borderStrong, alignSelf: 'center', marginTop: 9 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  sheetCopy: { flex: 1, gap: 2 },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  sheetSubtitle: { color: colors.textSecondary, fontSize: 12 },
  closeButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSubtle },
  sheetContent: { padding: 20, paddingBottom: 36, gap: 12 },
});
