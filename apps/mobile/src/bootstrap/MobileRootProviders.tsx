import type { PropsWithChildren } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WalkthroughAnchorsProvider } from '../components/WalkthroughAnchors';
import { PrimeLogoLoader } from '../components/PrimeLogoLoader';
import { AuthProvider } from '../contexts/AuthContext';
import { BiometricAccessProvider } from '../contexts/BiometricAccessContext';
import { useAppFonts } from '../theme/fonts';
import { colors } from '../theme/colors';

export function MobileRootProviders({ children }: PropsWithChildren) {
  const [fontsLoaded] = useAppFonts();

  if (!fontsLoaded) {
    return <PrimeLogoLoader variant="fullscreen" label="Preparando o Painel Prime" />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <BiometricAccessProvider>
          <WalkthroughAnchorsProvider>
            <StatusBar style="dark" backgroundColor={colors.background} translucent={false} />
            {children}
          </WalkthroughAnchorsProvider>
        </BiometricAccessProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
