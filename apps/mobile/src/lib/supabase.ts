import 'react-native-url-polyfill/auto';

import * as SecureStore from 'expo-secure-store';
import { createNativeSupabaseClient } from '@painel-prime/app/supabase';

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createNativeSupabaseClient(
  {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
  secureStoreAdapter
);
