import 'react-native-url-polyfill/auto';

import * as SecureStore from 'expo-secure-store';
import { createNativeSupabaseClient } from '@painel-prime/app/supabase';
import { splitSecureValue } from './secureStoreChunks';

type SecureManifest = {
  version: 1;
  generation: string;
  chunks: number;
};

const manifestKey = (key: string) => `${key}__manifest`;
const chunkKey = (key: string, generation: string, index: number) =>
  `${key}__chunk_${generation}_${index}`;

function parseManifest(raw: string | null): SecureManifest | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SecureManifest>;
    return value.version === 1
      && typeof value.generation === 'string'
      && /^[a-z0-9_]+$/i.test(value.generation)
      && Number.isInteger(value.chunks)
      && Number(value.chunks) > 0
      && Number(value.chunks) <= 256
      ? value as SecureManifest
      : null;
  } catch {
    return null;
  }
}

async function removeGeneration(key: string, manifest: SecureManifest | null) {
  if (!manifest) return;
  await Promise.all(
    Array.from({ length: manifest.chunks }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, manifest.generation, index)),
    ),
  );
}

const secureStoreAdapter = {
  async getItem(key: string) {
    const manifest = parseManifest(await SecureStore.getItemAsync(manifestKey(key)));
    if (!manifest) return SecureStore.getItemAsync(key);

    const chunks = await Promise.all(
      Array.from({ length: manifest.chunks }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, manifest.generation, index)),
      ),
    );
    return chunks.every((chunk): chunk is string => chunk !== null) ? chunks.join('') : null;
  },
  async setItem(key: string, value: string) {
    const previous = parseManifest(await SecureStore.getItemAsync(manifestKey(key)));
    const generation = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const chunks = splitSecureValue(value);

    try {
      await Promise.all(
        chunks.map((chunk, index) =>
          SecureStore.setItemAsync(chunkKey(key, generation, index), chunk),
        ),
      );
      await SecureStore.setItemAsync(
        manifestKey(key),
        JSON.stringify({ version: 1, generation, chunks: chunks.length } satisfies SecureManifest),
      );
    } catch (error) {
      await Promise.allSettled(
        chunks.map((_, index) => SecureStore.deleteItemAsync(chunkKey(key, generation, index))),
      );
      throw error;
    }
    await SecureStore.deleteItemAsync(key);
    await removeGeneration(key, previous);
  },
  async removeItem(key: string) {
    const manifest = parseManifest(await SecureStore.getItemAsync(manifestKey(key)));
    await removeGeneration(key, manifest);
    await Promise.all([
      SecureStore.deleteItemAsync(manifestKey(key)),
      SecureStore.deleteItemAsync(key),
    ]);
  },
};

export const supabase = createNativeSupabaseClient(
  {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
  secureStoreAdapter
);
