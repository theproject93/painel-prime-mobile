import { useEffect, type PropsWithChildren } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';

import { WalkthroughAnchorsProvider } from '../components/WalkthroughAnchors';
import { PrimeLogoLoader } from '../components/PrimeLogoLoader';
import { AuthProvider } from '../contexts/AuthContext';
import { BiometricAccessProvider } from '../contexts/BiometricAccessContext';
import { setupNotificationChannels, setupNotificationResponseListener } from '../services/notificationService';
import { useAppFonts } from '../theme/fonts';
import { colors } from '../theme/colors';

export function MobileRootProviders({ children }: PropsWithChildren) {
  const [fontsLoaded] = useAppFonts();

  useEffect(() => {
    setupNotificationChannels().catch((err) => {
      console.warn('Falha ao configurar canais de notificação:', err);
    });

    // Trata cold start de notificações quando o aplicativo é aberto a partir de uma notificação
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        const data = (response.notification.request.content.data || {}) as Record<string, unknown>;
        const url = typeof data.url === 'string' ? data.url : null;
        if (url) {
          Linking.openURL(url).catch((err) => {
            console.warn('Falha ao abrir deep link de cold start da notificação:', err);
          });
        }
      })
      .catch((err) => {
        console.warn('Falha ao obter última resposta de notificação (cold start):', err);
      });

    const unsubscribe = setupNotificationResponseListener((url) => {
      Linking.openURL(url).catch((err) => {
        console.warn('Falha ao abrir deep link da notificação:', err);
      });
    });

    return unsubscribe;
  }, []);

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
