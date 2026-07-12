import { Redirect, Slot } from 'expo-router';

import { useAuth } from '../../src/contexts/AuthContext';
import { PrimeLogoLoader } from '../../src/components/PrimeLogoLoader';

export default function PublicLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PrimeLogoLoader variant="fullscreen" label="Abrindo o Painel Prime" />;
  }

  if (user) {
    return <Redirect href="/(app)" />;
  }

  return <Slot />;
}
