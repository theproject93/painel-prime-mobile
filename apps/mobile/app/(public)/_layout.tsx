import { Redirect, Slot } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../../src/contexts/AuthContext';
import { colors } from '../../src/theme/colors';

export default function PublicLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator color={colors.primaryStrong} size="large" />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(app)" />;
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  loadingPage: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
