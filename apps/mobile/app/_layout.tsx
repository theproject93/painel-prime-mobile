import 'react-native-gesture-handler';
import { Slot } from 'expo-router';
import * as Sentry from '@sentry/react-native';

import { MobileRootProviders } from '../src/bootstrap/MobileRootProviders';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  _experiments: {
    profilesSampleRate: 1.0,
  },
});

function RootLayout() {
  return (
    <MobileRootProviders>
      <Slot />
    </MobileRootProviders>
  );
}

export default Sentry.wrap(RootLayout);
