/**
 * Suíte de Testes Adversariais da Migração do SQLite para SQLCipher na Portaria Prime.
 * Valida resiliência contra quedas (SIGKILL), concorrência de WAL, integridade da reception_queue
 * e salvaguardas de chaves no Keystore.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import type {
  IFileSystem,
  ISecureKeyStorage,
  ISqliteConnection,
  QueueItemRecord,
} from '../receptionDatabaseTypes.ts';
import {
  DatabaseCorruptedOrUnknownError,
  DatabaseKeyMissingError,
  SQLCipherNativeMissingError,
  WalCheckpointBusyError,
} from '../receptionDatabaseTypes.ts';
import {
  detectDatabaseState,
  generate256BitKey,
  RECEPTION_DB_KEY_ALIAS,
  resolveKeyForState,
} from '../receptionDatabaseKeyManager.ts';
import {
  computeQueueChecksum,
  reconcileIncompleteMigration,
  runMigration,
} from '../receptionDatabaseMigrator.ts';

// Mock in-memory do SecureStore
class MockSecureKeyStorage implements ISecureKeyStorage {
  private store = new Map<string, string>();

  async getItemAsync(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async setItemAsync(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async deleteItemAsync(key: string): Promise<void> {
    this.store.delete(key);
  }
  has(key: string): boolean {
    return this.store.has(key);
  }
}

// Adaptador de FileSystem sobre o fs do Node
class NodeFileSystem implements IFileSystem {
  async exists(filePath: string): Promise<boolean> {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readHeader(filePath: string, bytes: number): Promise<Buffer> {
    const handle = await fsPromises.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(bytes);
      const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async rename(sourcePath: string, targetPath: string): Promise<void> {
    await fsPromises.rename(sourcePath, targetPath);
  }

  async delete(filePath: string): Promise<void> {
    try {
      await fsPromises.unlink(filePath);
    } catch {
      // Ignora se não existir
    }
  }

  async writeText(filePath: string, text: string): Promise<void> {
    await fsPromises.writeFile(filePath, text, 'utf-8');
  }

  async readText(filePath: string): Promise<string> {
    return await fsPromises.readFile(filePath, 'utf-8');
  }
}

// Mock simulador de conexão SQLite/SQLCipher para teste de integração
class MockSqliteConnection implements ISqliteConnection {
  public closed = false;
  public attachedDb: { path: string; key: string } | null = null;
  public userVersion = 1;
  public queueItems: QueueItemRecord[] = [];
  public cipherVersion = '4.5.5 community';
  public cipherErrors: { error: string }[] = [];
  public logicalIntegrity = 'ok';
  public walBusy = 0;
  public isEncrypted = false;
  public encryptionKey: string | null = null;

  public fullPath: string;

  constructor(fullPath: string, key?: string) {
    this.fullPath = fullPath;
    if (key) {
      this.isEncrypted = true;
      this.encryptionKey = key;
    }
  }

  async execAsync(query: string): Promise<void> {
    if (this.closed) throw new Error('Conexão fechada.');

    if (query.includes('PRAGMA user_version =')) {
      const match = query.match(/PRAGMA\s+user_version\s*=\s*(\d+)/i);
      if (match) this.userVersion = parseInt(match[1], 10);
      return;
    }

    if (query.includes('ATTACH DATABASE')) {
      const match = query.match(/ATTACH\s+DATABASE\s+'([^']+)'\s+AS\s+\w+\s+KEY\s+'([^']+)'/i);
      if (match) {
        this.attachedDb = { path: match[1], key: match[2] };
        try {
          await fsPromises.writeFile(match[1], Buffer.from('SQLCipher encrypted dummy page 1'));
        } catch {
          // ignora
        }
      }
      return;
    }

    if (query.includes('sqlcipher_export')) {
      // Simula a exportação transferindo os dados para o storage global compartilhado
      if (this.attachedDb) {
        globalTestRegistry.set(this.attachedDb.path, {
          userVersion: this.userVersion,
          queueItems: JSON.parse(JSON.stringify(this.queueItems)),
          isEncrypted: true,
          key: this.attachedDb.key,
        });
      }
      return;
    }

    if (query.includes('DETACH DATABASE')) {
      this.attachedDb = null;
      return;
    }
  }

  async runAsync(_query: string, ..._params: unknown[]): Promise<{ changes: number; lastInsertRowId: number }> {
    if (this.closed) throw new Error('Conexão fechada.');
    return { changes: 1, lastInsertRowId: 1 };
  }

  async getFirstAsync<T>(query: string, ..._params: unknown[]): Promise<T | null> {
    if (this.closed) throw new Error('Conexão fechada.');

    if (query.includes('PRAGMA cipher_version;')) {
      return { cipher_version: this.cipherVersion } as T;
    }

    if (query.includes('PRAGMA wal_checkpoint')) {
      return { busy: this.walBusy, log: 0, checkpointed: 0 } as T;
    }

    if (query.includes('PRAGMA user_version;')) {
      return { user_version: this.userVersion } as T;
    }

    if (query.includes('PRAGMA cipher_integrity_check;')) {
      return (this.cipherErrors.length > 0 ? this.cipherErrors[0] : null) as T;
    }

    if (query.includes('PRAGMA integrity_check;')) {
      return { integrity_check: this.logicalIntegrity } as T;
    }

    if (query.includes('SELECT count(*)')) {
      return { count: 1 } as T;
    }

    return null;
  }

  async getAllAsync<T>(query: string, ..._params: unknown[]): Promise<T[]> {
    if (this.closed) throw new Error('Conexão fechada.');

    if (query.includes('PRAGMA cipher_integrity_check;')) {
      return this.cipherErrors as unknown as T[];
    }

    if (query.includes('FROM reception_queue')) {
      // Se for um banco exportado no registry, recupera os dados sincronizados
      const reg = globalTestRegistry.get(this.fullPath);
      if (reg) {
        return reg.queueItems as unknown as T[];
      }
      return this.queueItems as unknown as T[];
    }

    return [];
  }

  async closeAsync(): Promise<void> {
    this.closed = true;
  }
}

// Registro global para simulação de exportação entre conexões em teste
const globalTestRegistry = new Map<
  string,
  { userVersion: number; queueItems: QueueItemRecord[]; isEncrypted: boolean; key: string }
>();

function createConnectionOpener(walBusy = 0, cipherVersion = '4.5.5 community') {
  return async (fullPath: string, key?: string): Promise<ISqliteConnection> => {
    const norm = fullPath.replace(/\\/g, '/');
    const conn = new MockSqliteConnection(norm, key);
    conn.walBusy = walBusy;
    conn.cipherVersion = cipherVersion;

    // Se já estiver registrado, hidrata estado
    const reg = globalTestRegistry.get(norm);
    if (reg) {
      conn.userVersion = reg.userVersion;
      conn.queueItems = reg.queueItems;
      conn.isEncrypted = reg.isEncrypted;
      conn.encryptionKey = reg.key;
    }
    return conn;
  };
}

// -------------------------------------------------------------
// CENÁRIOS DE TESTE ADVERSARIAL
// -------------------------------------------------------------

test('Cenário 1 — Banco Inexistente (NON_EXISTENT): gera nova chave e cria direto cifrado', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-test-'));
  const fs = new NodeFileSystem();
  const keyStorage = new MockSecureKeyStorage();
  const dbPath = path.join(tmpDir, 'reception_prime.db');

  const state = await detectDatabaseState(dbPath, keyStorage, fs, createConnectionOpener());
  assert.strictEqual(state, 'NON_EXISTENT');

  const key = await resolveKeyForState(state, keyStorage);
  assert.strictEqual(typeof key, 'string');
  assert.strictEqual(key.length, 64);
  assert.strictEqual(await keyStorage.getItemAsync(RECEPTION_DB_KEY_ALIAS), key);

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 2 — Migração de Banco Legado em WAL com 15 itens na reception_queue', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-test-'));
  const fs = new NodeFileSystem();
  const keyStorage = new MockSecureKeyStorage();
  const dbName = 'reception_prime.db';
  const dbPath = path.join(tmpDir, dbName);

  // Cria arquivo simulando cabeçalho de SQLite em texto claro
  const header = Buffer.from('SQLite format 3\0\0\0\0\0\0\0\0', 'utf-8');
  await fsPromises.writeFile(dbPath, header);

  // Registra 15 itens pendentes na fila do banco legado
  const queueItems: QueueItemRecord[] = Array.from({ length: 15 }, (_, i) => ({
    client_scan_id: `scan_uuid_${i.toString().padStart(3, '0')}`,
    event_id: 'event_wedding_vip',
    guest_id: `guest_id_${i}`,
    action: 'check_in',
    payload: JSON.stringify({ guest_name: `Convidado ${i}`, table: i + 1 }),
    state: 'pending',
    retry_count: 0,
    created_at: new Date().toISOString(),
    error_code: null,
    error_message: null,
    synced_at: null,
  }));

  globalTestRegistry.set(dbPath.replace(/\\/g, '/'), {
    userVersion: 3,
    queueItems,
    isEncrypted: false,
    key: '',
  });

  const state = await detectDatabaseState(dbPath, keyStorage, fs, createConnectionOpener());
  assert.strictEqual(state, 'LEGACY_PLAINTEXT_VALIDATED');

  const key = await resolveKeyForState(state, keyStorage);
  assert.ok(key);

  const result = await runMigration({
    dbDir: tmpDir,
    dbName,
    key,
    fs,
    connectionOpener: createConnectionOpener(),
  });

  assert.strictEqual(result.migrated, true);
  assert.strictEqual(result.queueItemsVerified, 15);
  assert.strictEqual(result.userVersionPreserved, 3);

  // Validação: o arquivo original foi substituído e backups removidos
  assert.strictEqual(await fs.exists(path.join(tmpDir, `${dbName}.bak`)), false);
  assert.strictEqual(await fs.exists(path.join(tmpDir, `${dbName}.tmp`)), false);
  assert.strictEqual(await fs.exists(path.join(tmpDir, 'migration.state.json')), false);

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 3 — Bloqueio e Aborto Seguro quando wal_checkpoint retornar busy !== 0', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-test-'));
  const fs = new NodeFileSystem();
  const dbName = 'reception_prime.db';
  const dbPath = path.join(tmpDir, dbName);

  await fsPromises.writeFile(dbPath, Buffer.from('SQLite format 3\0\0\0\0\0\0\0\0', 'utf-8'));

  await assert.rejects(
    async () => {
      await runMigration({
        dbDir: tmpDir,
        dbName,
        key: generate256BitKey(),
        fs,
        connectionOpener: createConnectionOpener(1), // WAL BUSY = 1
      });
    },
    (err: Error) => err instanceof WalCheckpointBusyError
  );

  // O arquivo legado continua intacto e nenhum .bak foi gerado
  assert.strictEqual(await fs.exists(dbPath), true);
  assert.strictEqual(await fs.exists(path.join(tmpDir, `${dbName}.bak`)), false);

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 4 — Banco Criptografado com Chave Perdida (KEY_LOST): bloqueio sem nova chave', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-test-'));
  const fs = new NodeFileSystem();
  const keyStorage = new MockSecureKeyStorage(); // Keystore vazio!
  const dbPath = path.join(tmpDir, 'reception_prime.db');

  // Cabeçalho cifrado (não contém "SQLite format 3\0")
  await fsPromises.writeFile(dbPath, Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10]));

  const state = await detectDatabaseState(dbPath, keyStorage, fs, createConnectionOpener());
  assert.strictEqual(state, 'KEY_LOST');

  await assert.rejects(
    async () => {
      await resolveKeyForState(state, keyStorage);
    },
    (err: Error) => err instanceof DatabaseKeyMissingError
  );

  // Nenhuma chave nova foi gravada no Keystore
  assert.strictEqual(keyStorage.has(RECEPTION_DB_KEY_ALIAS), false);

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 5 — Arquivo Corrompido ou Desconhecido: recusa modificações', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-test-'));
  const fs = new NodeFileSystem();
  const keyStorage = new MockSecureKeyStorage();
  const dbPath = path.join(tmpDir, 'reception_prime.db');

  // Arquivo truncado com apenas 4 bytes
  await fsPromises.writeFile(dbPath, Buffer.from([0x00, 0x01, 0x02, 0x03]));

  const state = await detectDatabaseState(dbPath, keyStorage, fs, createConnectionOpener());
  assert.strictEqual(state, 'CORRUPTED_OR_UNKNOWN');

  await assert.rejects(
    async () => {
      await resolveKeyForState(state, keyStorage);
    },
    (err: Error) => err instanceof DatabaseCorruptedOrUnknownError
  );

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 6 — Queda Abrupta (SIGKILL) durante EXPORTING: reconciliação limpa resíduos', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-test-'));
  const fs = new NodeFileSystem();
  const dbName = 'reception_prime.db';
  const dbPath = path.join(tmpDir, dbName);

  await fsPromises.writeFile(dbPath, Buffer.from('SQLite format 3\0\0\0\0\0\0\0\0', 'utf-8'));

  // Dispara migração simulando crash em EXPORTING
  await assert.rejects(
    async () => {
      await runMigration({
        dbDir: tmpDir,
        dbName,
        key: generate256BitKey(),
        fs,
        connectionOpener: createConnectionOpener(),
        simulateCrashAt: 'EXPORTING',
      });
    },
    /SIMULATED_CRASH:EXPORTING/
  );

  // O journal deve existir indicando interrupção
  assert.strictEqual(await fs.exists(path.join(tmpDir, 'migration.state.json')), true);

  // No boot seguinte, o reconciliador atua
  const reconciled = await reconcileIncompleteMigration(
    tmpDir,
    dbName,
    fs,
    generate256BitKey(),
    createConnectionOpener()
  );

  assert.strictEqual(reconciled, true);
  // O banco legado permanece intacto e resíduos .tmp/.journal foram limpos
  assert.strictEqual(await fs.exists(dbPath), true);
  assert.strictEqual(await fs.exists(path.join(tmpDir, `${dbName}.tmp`)), false);
  assert.strictEqual(await fs.exists(path.join(tmpDir, 'migration.state.json')), false);

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 7 — Queda Abrupta (SIGKILL) durante SWAPPING: reconciliação restaura backup', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-test-'));
  const fs = new NodeFileSystem();
  const dbName = 'reception_prime.db';
  const dbPath = path.join(tmpDir, dbName);

  await fsPromises.writeFile(dbPath, Buffer.from('SQLite format 3\0\0\0\0\0\0\0\0', 'utf-8'));

  await assert.rejects(
    async () => {
      await runMigration({
        dbDir: tmpDir,
        dbName,
        key: generate256BitKey(),
        fs,
        connectionOpener: createConnectionOpener(),
        simulateCrashAt: 'SWAPPING',
      });
    },
    /SIMULATED_CRASH:SWAPPING/
  );

  assert.strictEqual(await fs.exists(path.join(tmpDir, 'migration.state.json')), true);

  const reconciled = await reconcileIncompleteMigration(
    tmpDir,
    dbName,
    fs,
    generate256BitKey(),
    createConnectionOpener()
  );

  assert.strictEqual(reconciled, true);
  assert.strictEqual(await fs.exists(path.join(tmpDir, 'migration.state.json')), false);

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 8 — Rejeição em Binário sem SQLCipher nativo', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-test-'));
  const fs = new NodeFileSystem();
  const dbName = 'reception_prime.db';
  const dbPath = path.join(tmpDir, dbName);

  await fsPromises.writeFile(dbPath, Buffer.from('SQLite format 3\0\0\0\0\0\0\0\0', 'utf-8'));

  await assert.rejects(
    async () => {
      await runMigration({
        dbDir: tmpDir,
        dbName,
        key: generate256BitKey(),
        fs,
        connectionOpener: createConnectionOpener(0, ''), // PRAGMA cipher_version vazio!
      });
    },
    (err: Error) => err instanceof SQLCipherNativeMissingError
  );

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});
