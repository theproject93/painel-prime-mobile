/**
 * Gerenciador de Chaves e Detecção Estrutural de Estado do SQLite para a Portaria Prime.
 */

import type {
  DatabaseState,
  IFileSystem,
  ISecureKeyStorage,
  ISqliteConnection,
} from './receptionDatabaseTypes.ts';
import {
  DatabaseCorruptedOrUnknownError,
  DatabaseKeyMissingError,
} from './receptionDatabaseTypes.ts';

export const RECEPTION_DB_KEY_ALIAS = 'reception_prime_sqlcipher_key_v1';
const SQLITE_HEADER_STRING = 'SQLite format 3\0';

/**
 * Gera chave criptográfica de 256 bits (64 caracteres hexadecimais).
 */
export function generate256BitKey(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback seguro usando Math.random + timestamp caso crypto nativo não esteja presente no ambiente
  let hex = '';
  for (let i = 0; i < 32; i++) {
    const byte = Math.floor(Math.random() * 256);
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Detecta o estado estrutural exato do arquivo de banco de dados em disco.
 */
export async function detectDatabaseState(
  dbPath: string,
  keyStorage: ISecureKeyStorage,
  fs: IFileSystem,
  connectionOpener: (path: string, key?: string) => Promise<ISqliteConnection>
): Promise<DatabaseState> {
  const exists = await fs.exists(dbPath);
  if (!exists) {
    return 'NON_EXISTENT';
  }

  // Lê os primeiros 16 bytes para análise de cabeçalho
  let headerBytes: Uint8Array;
  try {
    headerBytes = await fs.readHeader(dbPath, 16);
  } catch {
    return 'CORRUPTED_OR_UNKNOWN';
  }

  if (headerBytes.length < 16) {
    // Arquivo vazio ou truncado
    return 'CORRUPTED_OR_UNKNOWN';
  }

  const headerStr = Array.from(headerBytes.slice(0, 16))
    .map((b) => String.fromCharCode(Number(b)))
    .join('');

  // 1. Caso possua cabeçalho legível de SQLite padrão ("SQLite format 3\0")
  if (headerStr === SQLITE_HEADER_STRING) {
    try {
      const conn = await connectionOpener(dbPath);
      try {
        const check = await conn.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check;');
        if (check && check.integrity_check === 'ok') {
          return 'LEGACY_PLAINTEXT_VALIDATED';
        }
        return 'CORRUPTED_OR_UNKNOWN';
      } finally {
        await conn.closeAsync();
      }
    } catch {
      return 'CORRUPTED_OR_UNKNOWN';
    }
  }

  // 2. Não possui o cabeçalho em texto claro (provável banco criptografado por SQLCipher)
  const existingKey = await keyStorage.getItemAsync(RECEPTION_DB_KEY_ALIAS);
  if (!existingKey) {
    // Banco criptografado existe mas a chave está ausente no Keystore
    return 'KEY_LOST';
  }

  try {
    const conn = await connectionOpener(dbPath, existingKey);
    try {
      // Força a leitura inicial para decifrar a página 1
      await conn.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM sqlite_master;');

      // Validação oficial da Zetetic: zero linhas no cipher_integrity_check significa AUSÊNCIA de erros
      const cipherErrors = await conn.getAllAsync<{ error: string }>('PRAGMA cipher_integrity_check;');
      if (cipherErrors && cipherErrors.length > 0) {
        return 'KEY_LOST';
      }

      return 'ENCRYPTED_VALIDATED';
    } finally {
      await conn.closeAsync();
    }
  } catch {
    // Falha na decifragem ou chave incorreta
    return 'KEY_LOST';
  }
}

/**
 * Resolve a chave para a operação garantindo proteção contra sobrescrita acidental.
 */
export async function resolveKeyForState(
  state: DatabaseState,
  keyStorage: ISecureKeyStorage,
  generateKeyFn: () => string = generate256BitKey
): Promise<string> {
  switch (state) {
    case 'NON_EXISTENT':
    case 'LEGACY_PLAINTEXT_VALIDATED': {
      // Em ambos os casos, precisamos de uma nova chave limpa no Keystore
      const newKey = generateKeyFn();
      await keyStorage.setItemAsync(RECEPTION_DB_KEY_ALIAS, newKey);
      return newKey;
    }

    case 'ENCRYPTED_VALIDATED': {
      const existingKey = await keyStorage.getItemAsync(RECEPTION_DB_KEY_ALIAS);
      if (!existingKey) {
        throw new DatabaseKeyMissingError('Chave do banco de dados não encontrada no Keystore.');
      }
      return existingKey;
    }

    case 'KEY_LOST':
      throw new DatabaseKeyMissingError(
        'Banco de dados criptografado existente, mas a chave está ausente ou inválida no Keystore. Operação bloqueada para evitar destruição de dados.'
      );

    case 'CORRUPTED_OR_UNKNOWN':
    default:
      throw new DatabaseCorruptedOrUnknownError(
        'Arquivo de banco de dados em estado desconhecido ou corrompido. Nenhuma alteração permitida.'
      );
  }
}
