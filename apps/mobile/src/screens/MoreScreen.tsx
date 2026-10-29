import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { useOperatingMode } from '../contexts/OperatingModeContext';
import { AppHaptics } from '../lib/haptics';
import { colors } from '../theme/colors';
import { fontSize, fontWeight, radii, shadows, spacing } from '../theme/tokens';

type MenuItem = {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

const ACCOUNT_ITEMS: MenuItem[] = [
  {
    label: 'Equipe',
    description: 'Pessoas, líderes e funções da sua assessoria',
    icon: 'people-circle-outline',
    route: '/mais/equipe',
  },
  {
    label: 'Perfil',
    description: 'Dados pessoais, contatos e assinatura',
    icon: 'person-outline',
    route: '/mais/perfil',
  },
  {
    label: 'Configurações',
    description: 'Segurança e preferências do aplicativo',
    icon: 'settings-outline',
    route: '/mais/configuracoes',
  },
];

const ADMIN_ITEMS: MenuItem[] = [
  {
    label: 'Assinaturas',
    description: 'Acompanhar planos e pagamentos',
    icon: 'shield-checkmark-outline',
    route: '/mais/assinaturas',
  },
  {
    label: 'Saúde operacional',
    description: 'Diagnóstico técnico da plataforma',
    icon: 'heart-outline',
    route: '/mais/saude-operacional',
  },
];

export function MoreScreen() {
  const router = useRouter();
  const { user, signOut, isSuperAdmin } = useAuth();
  const { mode, setMode, assignedEvents } = useOperatingMode();

  const sections: MenuSection[] = [
    { title: 'Sua conta', items: ACCOUNT_ITEMS },
    ...(isSuperAdmin ? [{ title: 'Administração', items: ADMIN_ITEMS }] : []),
  ];

  return (
    <Screen title="Mais" subtitle="Sua conta e preferências em um só lugar">
      <View style={styles.identityCard}>
        <View style={styles.identityIcon}>
          <Ionicons name="sparkles" size={22} color={colors.primaryStrong} />
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.identityTitle}>Painel Prime</Text>
          <Text style={styles.identityEmail} numberOfLines={1}>{user?.email ?? 'Conta conectada'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Modo de Operação</Text>
        <View style={styles.modeCard}>
          <Pressable
            style={({ pressed }) => [
              styles.modeRow,
              mode === 'assessoria' && styles.modeRowActive,
              pressed && styles.menuRowPressed,
            ]}
            onPress={() => {
              void AppHaptics.selection();
              setMode('assessoria');
            }}
            accessibilityRole="button"
            accessibilityLabel="Ativar Modo Assessoria. Visão completa da assessoria e eventos."
          >
            <View style={[styles.modeIcon, mode === 'assessoria' && styles.modeIconActive]}>
              <Ionicons
                name="briefcase-outline"
                size={20}
                color={mode === 'assessoria' ? colors.primaryStrong : colors.mutedText}
              />
            </View>
            <View style={styles.modeCopy}>
              <View style={styles.modeHeader}>
                <Text style={[styles.modeLabel, mode === 'assessoria' && styles.modeLabelActive]}>
                  Modo Assessoria
                </Text>
                {mode === 'assessoria' ? (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Ativo</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.modeDescription}>
                Visão administrativa com gestão completa de eventos, clientes e orçamentos.
              </Text>
            </View>
          </Pressable>

          <View style={styles.separator} />

          <Pressable
            style={({ pressed }) => [
              styles.modeRow,
              mode === 'equipe' && styles.modeRowActive,
              pressed && styles.menuRowPressed,
            ]}
            onPress={() => {
              void AppHaptics.selection();
              setMode('equipe');
            }}
            accessibilityRole="button"
            accessibilityLabel="Ativar Modo Equipe. Visão operacional focada na execução e portaria."
          >
            <View style={[styles.modeIcon, mode === 'equipe' && styles.modeIconActive]}>
              <Ionicons
                name="people-outline"
                size={20}
                color={mode === 'equipe' ? colors.primaryStrong : colors.mutedText}
              />
            </View>
            <View style={styles.modeCopy}>
              <View style={styles.modeHeader}>
                <Text style={[styles.modeLabel, mode === 'equipe' && styles.modeLabelActive]}>
                  Modo Equipe
                </Text>
                {mode === 'equipe' ? (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Ativo</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.modeDescription}>
                Visão operacional direta para escalas de trabalho, cronograma e Portaria Prime.
              </Text>
              {assignedEvents.length > 0 ? (
                <View style={styles.assignedBadge}>
                  <Text style={styles.assignedBadgeText}>
                    {assignedEvents.length === 1
                      ? '1 evento escalado'
                      : `${assignedEvents.length} eventos escalados`}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        </View>
      </View>

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionCard}>
            {section.items.map((item, index) => (
              <View key={item.route}>
                {index > 0 ? <View style={styles.separator} /> : null}
                <Pressable
                  style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
                  onPress={() => router.push(item.route as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.label}. ${item.description}`}
                >
                  <View style={styles.menuIcon}>
                    <Ionicons name={item.icon} size={21} color={colors.primaryStrong} />
                  </View>
                  <View style={styles.menuCopy}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Text style={styles.menuDescription}>{item.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ))}

      <Pressable
        onPress={() => void signOut()}
        style={({ pressed }) => [styles.logoutButton, pressed && styles.menuRowPressed]}
        accessibilityRole="button"
        accessibilityLabel="Sair da conta"
      >
        <Ionicons name="log-out-outline" size={20} color={colors.dangerText} />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.text,
    ...shadows.elevated,
  },
  identityIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  identityCopy: { flex: 1, gap: 3 },
  identityTitle: { color: colors.card, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  identityEmail: { color: '#C9CED8', fontSize: fontSize.sm },
  section: { marginTop: spacing.lg },
  sectionTitle: {
    color: colors.mutedText,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  modeCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  modeRow: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  modeRowActive: {
    backgroundColor: colors.primarySoft + '40',
  },
  modeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginTop: 2,
  },
  modeIconActive: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryStrong,
  },
  modeCopy: { flex: 1, gap: 4 },
  modeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modeLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  modeLabelActive: { color: colors.primaryStrong },
  modeDescription: { color: colors.mutedText, fontSize: fontSize.xs, lineHeight: 18 },
  activeBadge: {
    backgroundColor: colors.primaryStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  activeBadgeText: { color: colors.card, fontSize: 11, fontWeight: fontWeight.bold },
  assignedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    marginTop: 4,
  },
  assignedBadgeText: { color: colors.text, fontSize: 11, fontWeight: fontWeight.semibold },
  menuRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  menuRowPressed: { opacity: 0.72 },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  menuCopy: { flex: 1, gap: 3 },
  menuLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  menuDescription: { color: colors.mutedText, fontSize: fontSize.xs, lineHeight: 18 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 70 },
  logoutButton: {
    minHeight: 54,
    marginTop: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#F5C2C2',
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  logoutText: { color: colors.dangerText, fontWeight: fontWeight.bold, fontSize: fontSize.md },
});
