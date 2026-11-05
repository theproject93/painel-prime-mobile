/**
 * Gerenciador de Chaves e Detecção Estrutural de Estado do SQLite para a Portaria Prime.
 * Implementa classificação quadrivalente e geração estritamente criptográfica (zero Math.random).
 * Exige verificação ativa do PRAGMA cipher_version em todos os caminhos criptográficos.
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
  SQLCipherNativeMissingError,
} from './receptionDatabaseTypes.ts';

export const RECEPTION_DB_KEY_ALIAS = 'reception_prime_sqlcipher_key_v1';
const SQLITE_HEADER_STRING = 'SQLite format 3\0';

/**
 * Valida formato estrito de chave hex de 256 bits (64 caracteres hexadecimais).
 */
export function validateHexKey(key: string): string {
  if (typeof key !== 'string' || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('Chave de criptografia inválida: deve conter exatamente 64 caracteres hexadecimais (256 bits).');
  }
  return key.toLowerCase();
}

/**
 * Gera chave criptográfica de 256 bits usando entropia segura do sistema operacional.
 * Falha de forma controlada caso fontes seguras (crypto.getRandomValues) não estejam disponíveis.
 */
export function generate256BitKey(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  throw new Error('Fonte de entropia criptográfica segura (crypto.getRandomValues) não disponível no ambiente.');
}

/**
 * Valida de forma ativa se o binário nativo conectado possui suporte ao SQLCipher.
 * Nunca considera ausência de erros como prova de criptografia.
 */
export async function assertSQLCipherActive(conn: ISqliteConnection): Promise<string> {
  const row = await conn.getFirstAsync<{ cipher_version?: string; 'cipher_version()'?: string }>(
    'PRAGMA cipher_version;'
  );
  const version = row?.cipher_version ?? row?.['cipher_version()'];
  if (!version || typeof version !== 'string' || version.trim().length === 0) {
    throw new SQLCipherNativeMissingError(
      'Binário nativo não possui suporte ao SQLCipher. PRAGMA cipher_version retornou vazio.'
    );
  }
  return version.trim();
}

/**
 * Detecta o estado estrutural exato do arquivo de banco de dados em disco
 * SEM abrir o SQLite prematuramente caso o arquivo não exista.
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

  // 2. Não possui cabeçalho em texto claro (provável banco criptografado por SQLCipher)
  const existingKey = await keyStorage.getItemAsync(RECEPTION_DB_KEY_ALIAS);
  if (!existingKey) {
    // Banco cifrado existe mas a chave está ausente no Keystore
    return 'KEY_LOST';
  }

  try {
    const validKey = validateHexKey(existingKey);
    const conn = await connectionOpener(dbPath, validKey);
    try {
      // Exige comprovação ativa de suporte ao SQLCipher antes de validar integridade
      await assertSQLCipherActive(conn);

      // Força a leitura inicial para decifrar a página 1 (esquema)
      await conn.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM sqlite_master;');

      // Validação oficial Zetetic: zero linhas no cipher_integrity_check significa AUSÊNCIA de erros
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
      // Em ambos os casos, geramos uma nova chave criptográfica segura e persistimos no Keystore
      const newKey = validateHexKey(generateKeyFn());
      await keyStorage.setItemAsync(RECEPTION_DB_KEY_ALIAS, newKey);
      return newKey;
    }

    case 'ENCRYPTED_VALIDATED': {
      const existingKey = await keyStorage.getItemAsync(RECEPTION_DB_KEY_ALIAS);
      if (!existingKey) {
        throw new DatabaseKeyMissingError('Chave do banco de dados não encontrada no Keystore.');
      }
      return validateHexKey(existingKey);
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
