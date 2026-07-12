import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
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
