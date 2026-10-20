import { Redirect, Slot, useSegments } from 'expo-router';

import { useAuth } from '../../src/contexts/AuthContext';
import { PrimeLogoLoader } from '../../src/components/PrimeLogoLoader';

export default function PublicLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();

  if (loading) {
    return <PrimeLogoLoader variant="fullscreen" label="Abrindo o Painel Prime" />;
  }

  const isAuthEntryRoute =
    segments.includes('login') ||
    segments.includes('cadastro') ||
    segments.includes('landing') ||
    segments[segments.length - 1] === '(public)';

  if (user && isAuthEntryRoute) {
    return <Redirect href="/(app)" />;
  }

  return <Slot />;
}
