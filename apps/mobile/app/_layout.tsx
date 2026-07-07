import 'react-native-gesture-handler';
import { Slot } from 'expo-router';

import { MobileRootProviders } from '../src/bootstrap/MobileRootProviders';

export default function RootLayout() {
  return (
    <MobileRootProviders>
      <Slot />
    </MobileRootProviders>
  );
}
