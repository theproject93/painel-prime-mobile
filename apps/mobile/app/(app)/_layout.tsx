import { Redirect, Slot, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/contexts/AuthContext';
import { PrimeLogoLoader } from '../../src/components/PrimeLogoLoader';
import { ProfileWelcomeGate } from '../../src/components/ProfileWelcomeGate';
import { useUserRole } from '../../src/contexts/UserRoleContext';
import { canTeamAccessPath } from '../../src/lib/teamRouteAccess';
import { colors } from '../../src/theme/colors';

export default function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const role = useUserRole();
  const pathname = usePathname();

  if (loading) {
    return <PrimeLogoLoader variant="fullscreen" label="Protegendo seu espaço" />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (pathname === '/atualizar-senha') {
    return <Slot />;
  }

  if (role.loading) {
    return <PrimeLogoLoader variant="fullscreen" label="Verificando seu acesso" />;
  }

  if (role.error) {
    return <View style={styles.unavailable}>
      <Text style={styles.title}>Não foi possível verificar seu acesso</Text>
      <Text style={styles.detail}>Verifique sua conexão e tente novamente.</Text>
      <Pressable accessibilityRole="button" style={styles.retry} onPress={() => void role.refreshRole()}>
        <Text style={styles.retryText}>Tentar novamente</Text>
      </Pressable>
    </View>;
  }

  if (role.isTeamMemberOnly && !canTeamAccessPath(pathname, role.assignedEvents.map(event => event.id))) {
    return <Redirect href="/dashboard" />;
  }

  return <ProfileWelcomeGate><Slot /></ProfileWelcomeGate>;
}

const styles = StyleSheet.create({
  unavailable: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  detail: { color: colors.textSecondary, fontSize: 15 },
  retry: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary },
  retryText: { color: colors.primaryTextOn, fontWeight: '700' },
});
