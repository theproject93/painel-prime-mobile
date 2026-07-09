import type { PropsWithChildren } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { WalkthroughAnchorsProvider } from '../components/WalkthroughAnchors';
import { AuthProvider } from '../contexts/AuthContext';
import { useAppFonts } from '../theme/fonts';
import { colors } from '../theme/colors';

export function MobileRootProviders({ children }: PropsWithChildren) {
  const [fontsLoaded] = useAppFonts();

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator color={colors.primaryStrong} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <WalkthroughAnchorsProvider>
          <StatusBar style="dark" backgroundColor={colors.background} translucent={false} />
          {children}
        </WalkthroughAnchorsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingPage: { flex: 1, backgroundColor: '#111113', alignItems: 'center', justifyContent: 'center' },
});
