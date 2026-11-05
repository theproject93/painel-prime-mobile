/**
 * Adaptadores de Produção para Expo (FileSystem, SecureStore e SQLite)
 * conectando os contratos de IFileSystem, ISecureKeyStorage e ISqliteConnection.
 * Compatível com Expo SDK 54 (expo-file-system/legacy e expo-sqlite modular).
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import type {
  IFileSystem,
  ISecureKeyStorage,
  ISqliteConnection,
} from './receptionDatabaseTypes.ts';
import { validateHexKey } from './receptionDatabaseKeyManager.ts';

/**
 * Retorna o diretório canônico padrão onde o expo-sqlite armazena bancos de dados.
 */
export function getCanonicalDatabaseDirectory(): string {
  const dir =
    (SQLite as { defaultDatabaseDirectory?: string }).defaultDatabaseDirectory ??
    (FileSystem.documentDirectory ? `${FileSystem.documentDirectory}SQLite` : 'SQLite');
  return dir.replace(/\/+$/, '');
}

/**
 * Retorna o caminho físico canônico absoluto de um banco no dispositivo.
 */
export function getCanonicalDatabasePath(dbName = 'reception_prime.db'): string {
  return `${getCanonicalDatabaseDirectory()}/${dbName}`;
}

/**
 * Adaptador sobre expo-file-system/legacy para operações atômicas em disco.
 */
export class ExpoFileSystemAdapter implements IFileSystem {
  async exists(filePath: string): Promise<boolean> {
    const info = await FileSystem.getInfoAsync(filePath);
    return info.exists;
  }

  async readHeader(filePath: string, bytes: number): Promise<Uint8Array> {
    const content = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
      length: bytes,
      position: 0,
    });

    // Decodifica Base64 para Uint8Array sem dependência de Buffer (compatível com Hermes / React Native)
    if (typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function') {
      const binaryStr = globalThis.atob(content);
      const u8 = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        u8[i] = binaryStr.charCodeAt(i);
      }
      return u8;
    }

    // Fallback manual puro para decodificação Base64
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const clean = content.replace(/[^A-Za-z0-9+/]/g, '');
    const len = clean.length;
    const byteLength = (len * 3) >> 2;
    const u8 = new Uint8Array(byteLength);
    let p = 0;
    for (let i = 0; i < len; i += 4) {
      const c0 = chars.indexOf(clean[i]);
      const c1 = chars.indexOf(clean[i + 1]);
      const c2 = chars.indexOf(clean[i + 2]);
      const c3 = chars.indexOf(clean[i + 3]);
      u8[p++] = (c0 << 2) | (c1 >> 4);
      if (c2 >= 0) u8[p++] = ((c1 & 15) << 4) | (c2 >> 2);
      if (c3 >= 0) u8[p++] = ((c2 & 3) << 6) | (c3 & 63);
    }
    return u8.subarray(0, p);
  }

  async rename(sourcePath: string, targetPath: string): Promise<void> {
    await FileSystem.moveAsync({ from: sourcePath, to: targetPath });
  }

  async delete(filePath: string): Promise<void> {
    await FileSystem.deleteAsync(filePath, { idempotent: true });
  }

  async writeText(filePath: string, text: string): Promise<void> {
    await FileSystem.writeAsStringAsync(filePath, text, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  async readText(filePath: string): Promise<string> {
    return await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }
}

/**
 * Adaptador sobre expo-secure-store (Android Keystore / iOS Keychain).
 */
export class ExpoSecureStoreAdapter implements ISecureKeyStorage {
  async getItemAsync(key: string): Promise<string | null> {
    return await SecureStore.getItemAsync(key);
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  }

  async deleteItemAsync(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }
}

/**
 * Encapsula uma instância nativa do SQLiteDatabase no contrato ISqliteConnection.
 */
export function createExpoSqliteConnection(db: SQLite.SQLiteDatabase): ISqliteConnection {
  return {
    execAsync: (q) => db.execAsync(q),
    runAsync: (q, ...p) => db.runAsync(q, ...p),
    getFirstAsync: (q, ...p) => db.getFirstAsync(q, ...p),
    getAllAsync: (q, ...p) => db.getAllAsync(q, ...p),
    closeAsync: () => db.closeAsync(),
  };
}

/**
 * Cria a função de abertura de conexões para o migrador e runtime Expo,
 * separando corretamente nome e diretório para suportar caminhos absolutos e arquivos temporários.
 */
export function createExpoConnectionOpener() {
  return async (pathOrName: string, key?: string): Promise<ISqliteConnection> => {
    let dbName = pathOrName;
    let dbDirectory: string | undefined = undefined;

    if (pathOrName !== ':memory:') {
      const normalized = pathOrName.replace(/\\/g, '/');
      const lastSlash = normalized.lastIndexOf('/');
      if (lastSlash !== -1) {
        dbDirectory = normalized.substring(0, lastSlash);
        dbName = normalized.substring(lastSlash + 1);
      }
    }

    const openFn = SQLite.openDatabaseAsync as (
      name: string,
      options?: SQLite.SQLiteOpenOptions,
      directory?: string
    ) => Promise<SQLite.SQLiteDatabase>;

    const db = await openFn(
      dbName,
      { useNewConnection: true },
      dbDirectory
    );

    if (key) {
      const validKey = validateHexKey(key);
      await db.execAsync(`PRAGMA key = "x'${validKey}'";`);
    }

    return createExpoSqliteConnection(db);
  };
}
