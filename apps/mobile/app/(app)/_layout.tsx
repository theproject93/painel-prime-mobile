import { Redirect, Slot } from 'expo-router';

import { useAuth } from '../../src/contexts/AuthContext';
import { PrimeLogoLoader } from '../../src/components/PrimeLogoLoader';
import { ProfileWelcomeGate } from '../../src/components/ProfileWelcomeGate';

export default function AuthenticatedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PrimeLogoLoader variant="fullscreen" label="Protegendo seu espaço" />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return <ProfileWelcomeGate><Slot /></ProfileWelcomeGate>;
}
