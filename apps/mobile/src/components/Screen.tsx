import { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';
import { AppHaptics } from '../lib/haptics';

type ScreenProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
}>;

export function Screen({ title, subtitle, showBack, onBack, children }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  function handleBack() {
    void AppHaptics.light();
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 140 },
        ]}
      >
        {showBack ? (
          <Pressable
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Voltar para a tela anterior"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
            <Text style={styles.backButtonText}>Voltar</Text>
          </Pressable>
        ) : null}
        {title || subtitle ? (
          <View style={styles.header}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 14,
  },
  header: {
    marginTop: 10,
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: colors.mutedText,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 44,
    minWidth: 44,
    paddingRight: 8,
    gap: 4,
    marginBottom: 4,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
