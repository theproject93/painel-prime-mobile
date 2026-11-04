/**
 * Definições de Tipos e Contratos para Armazenamento e Migração Segura do SQLite (SQLCipher)
 * da Portaria Prime.
 */

export type DatabaseState =
  | 'NON_EXISTENT'
  | 'LEGACY_PLAINTEXT_VALIDATED'
  | 'ENCRYPTED_VALIDATED'
  | 'KEY_LOST'
  | 'CORRUPTED_OR_UNKNOWN';

export type MigrationStage =
  | 'IDLE'
  | 'CHECKPOINTING_WAL'
  | 'EXPORTING'
  | 'VALIDATING'
  | 'SWAPPING'
  | 'COMPLETED';

export interface MigrationJournalState {
  stage: MigrationStage;
  sourceVersion: number;
  sourceQueueCount: number;
  sourceQueueChecksum: string;
  timestamp: string;
  dbName: string;
}

export interface ISqliteConnection {
  execAsync(query: string): Promise<void>;
  runAsync(query: string, ...params: unknown[]): Promise<{ changes: number; lastInsertRowId: number }>;
  getFirstAsync<T>(query: string, ...params: unknown[]): Promise<T | null>;
  getAllAsync<T>(query: string, ...params: unknown[]): Promise<T[]>;
  closeAsync(): Promise<void>;
}

export interface ISecureKeyStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface IFileSystem {
  exists(filePath: string): Promise<boolean>;
  readHeader(filePath: string, bytes: number): Promise<Uint8Array>;
  rename(sourcePath: string, targetPath: string): Promise<void>;
  delete(filePath: string): Promise<void>;
  writeText(filePath: string, text: string): Promise<void>;
  readText(filePath: string): Promise<string>;
}

/**
 * Esquema canônico e exato da tabela reception_queue do Painel Prime.
 */
export interface QueueItemRecord {
  client_scan_id: string;
  event_id: string;
  scanned_qr_token: string | null;
  scanned_guest_id: string | null;
  confirmed_guest_ids: string;
  canonical_payload_hash: string;
  state: string;
  retry_count: number;
  created_at: string;
  scanned_at: string;
  synced_at: string | null;
  error_code: string | null;
  error_message: string | null;
  server_response: string | null;
}

export class DatabaseKeyMissingError extends Error {
  constructor(message = 'Chave do banco de dados ausente ou inválida no Keystore. Operação bloqueada para evitar destruição de dados.') {
    super(message);
    this.name = 'DatabaseKeyMissingError';
  }
}

export class DatabaseCorruptedOrUnknownError extends Error {
  constructor(message = 'Arquivo de banco de dados em estado desconhecido ou corrompido. Nenhuma alteração permitida.') {
    super(message);
    this.name = 'DatabaseCorruptedOrUnknownError';
  }
}

export class WalCheckpointBusyError extends Error {
  constructor(message = 'Não foi possível completar o checkpoint do WAL devido a conexões ocupadas.') {
    super(message);
    this.name = 'WalCheckpointBusyError';
  }
}

export class SQLCipherNativeMissingError extends Error {
  constructor(message = 'Suporte nativo ao SQLCipher ausente no binário da aplicação.') {
    super(message);
    this.name = 'SQLCipherNativeMissingError';
  }
}

export class MigrationIntegrityMismatchError extends Error {
  constructor(message = 'Inconsistência detectada entre os dados de origem e destino durante a validação da fila.') {
    super(message);
    this.name = 'MigrationIntegrityMismatchError';
  }
}

export class CipherIntegrityError extends Error {
  constructor(message = 'Falha no teste de integridade criptográfica do SQLCipher.') {
    super(message);
    this.name = 'CipherIntegrityError';
  }
}

export class SecureStorageUnavailableError extends Error {
  constructor(message = 'Módulo seguro de chaves (Keystore / SecureStore) indisponível. Inicialização bloqueada em modo fail-closed.') {
    super(message);
    this.name = 'SecureStorageUnavailableError';
  }
}
