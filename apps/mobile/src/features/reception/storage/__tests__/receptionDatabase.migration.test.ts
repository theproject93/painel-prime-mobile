/**
 * Suíte de Testes Adversariais e de Integração com SQLite Real (node:sqlite no Node 22).
 * Valida a migração atômica de reception_prime.db em modo WAL, verificação física da tabela
 * reception_queue (14 colunas reais), detecção de integridade e resiliência a falhas/SIGKILL.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';

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
  validateHexKey,
} from '../receptionDatabaseKeyManager.ts';
import {
  computeQueueChecksum,
  reconcileIncompleteMigration,
  runMigration,
  RECEPTION_QUEUE_SELECT_SQL,
} from '../receptionDatabaseMigrator.ts';

// Mock in-memory do SecureStore para isolamento de testes
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

// Adaptador de FileSystem sobre o fs do Node (opera em arquivos reais no disco)
class NodeFileSystem implements IFileSystem {
  async exists(filePath: string): Promise<boolean> {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readHeader(filePath: string, bytes: number): Promise<Uint8Array> {
    const handle = await fsPromises.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(bytes);
      const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
      return new Uint8Array(buffer.subarray(0, bytesRead));
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

/**
 * Conexão que opera sobre um banco SQLite REAL em disco (via node:sqlite DatabaseSync),
 * emulando extensões PRAGMA do SQLCipher (como cipher_version e cipher_integrity_check).
 */
class RealSqliteConnectionAdapter implements ISqliteConnection {
  private db: DatabaseSync;
  public dbPath: string;
  public closed = false;
  public attachedTarget: { path: string; key: string } | null = null;
  public cipherVersion = '4.5.5 community';
  public cipherErrors: { error: string }[] = [];
  public forceWalBusy = false;

  constructor(dbPath: string, key?: string) {
    this.dbPath = dbPath;
    this.db = new DatabaseSync(dbPath);
  }

  async execAsync(query: string): Promise<void> {
    if (this.closed) throw new Error('Conexão fechada.');

    // Intercepta ATTACH DATABASE com KEY do SQLCipher
    if (query.includes('ATTACH DATABASE') && query.includes('KEY')) {
      const match = query.match(/ATTACH\s+DATABASE\s+'([^']+)'\s+AS\s+(\w+)\s+KEY\s+'([^']+)'/i);
      if (match) {
        const targetPath = match[1];
        const alias = match[2];
        const key = match[3];
        this.attachedTarget = { path: targetPath, key };

        // Cria o banco destino real no disco via SQLite
        const targetDb = new DatabaseSync(targetPath);
        targetDb.close();

        // Anexa no banco fonte
        this.db.exec(`ATTACH DATABASE '${targetPath.replace(/'/g, "''")}' AS ${alias};`);
        return;
      }
    }

    if (query.includes('sqlcipher_export')) {
      if (this.attachedTarget) {
        // Clona as tabelas e dados reais entre os bancos SQLite reais no disco
        this.db.exec(`
          CREATE TABLE encrypted.reception_queue AS SELECT * FROM main.reception_queue;
        `);
      }
      return;
    }

    if (query.includes('DETACH DATABASE')) {
      this.db.exec('DETACH DATABASE encrypted;');
      this.attachedTarget = null;
      return;
    }

    if (query.includes('PRAGMA key')) {
      // Emula aceitação da chave no SQLCipher
      return;
    }

    this.db.exec(query);
  }

  async runAsync(query: string, ...params: unknown[]): Promise<{ changes: number; lastInsertRowId: number }> {
    if (this.closed) throw new Error('Conexão fechada.');
    const stmt = this.db.prepare(query);
    const result = stmt.run(...(params as any[]));
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async getFirstAsync<T>(query: string, ...params: unknown[]): Promise<T | null> {
    if (this.closed) throw new Error('Conexão fechada.');

    if (query.includes('PRAGMA cipher_version;')) {
      return { cipher_version: this.cipherVersion } as T;
    }

    if (query.includes('PRAGMA wal_checkpoint')) {
      if (this.forceWalBusy) {
        return { busy: 1, log: 5, checkpointed: 0 } as T;
      }
      const stmt = this.db.prepare('PRAGMA wal_checkpoint(TRUNCATE);');
      const row = stmt.get() as any;
      return {
        busy: row?.busy ?? 0,
        log: row?.log ?? 0,
        checkpointed: row?.checkpointed ?? 0,
      } as T;
    }

    if (query.includes('PRAGMA cipher_integrity_check;')) {
      return (this.cipherErrors.length > 0 ? this.cipherErrors[0] : null) as T;
    }

    const stmt = this.db.prepare(query);
    const row = stmt.get(...(params as any[]));
    return (row ?? null) as T;
  }

  async getAllAsync<T>(query: string, ...params: unknown[]): Promise<T[]> {
    if (this.closed) throw new Error('Conexão fechada.');

    if (query.includes('PRAGMA cipher_integrity_check;')) {
      return this.cipherErrors as unknown as T[];
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...(params as any[])) as unknown as T[];
  }

  async closeAsync(): Promise<void> {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }
}

function createRealConnectionOpener(options: { walBusy?: boolean; cipherVersion?: string } = {}) {
  return async (fullPath: string, key?: string): Promise<ISqliteConnection> => {
    const conn = new RealSqliteConnectionAdapter(fullPath, key);
    if (options.walBusy) conn.forceWalBusy = true;
    if (options.cipherVersion !== undefined) conn.cipherVersion = options.cipherVersion;
    return conn;
  };
}

/**
 * Cria banco legado real em modo WAL e popula 15 registros canônicos na reception_queue.
 */
async function setupLegacyRealDatabase(dbPath: string): Promise<QueueItemRecord[]> {
  const db = new DatabaseSync(dbPath);

  // Ativa modo WAL no disco
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA user_version = 5;');

  db.exec(`
    CREATE TABLE reception_queue (
      client_scan_id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      scanned_qr_token TEXT,
      scanned_guest_id TEXT,
      confirmed_guest_ids TEXT NOT NULL,
      canonical_payload_hash TEXT NOT NULL,
      state TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      synced_at TEXT,
      error_code TEXT,
      error_message TEXT,
      server_response TEXT
    );
  `);

  const queueItems: QueueItemRecord[] = [];
  const stmt = db.prepare(`
    INSERT INTO reception_queue (
      client_scan_id, event_id, scanned_qr_token, scanned_guest_id,
      confirmed_guest_ids, canonical_payload_hash, state, retry_count,
      created_at, scanned_at, synced_at, error_code, error_message, server_response
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  for (let i = 0; i < 15; i++) {
    const item: QueueItemRecord = {
      client_scan_id: `scan_uuid_${i.toString().padStart(3, '0')}`,
      event_id: 'event_casamento_luxury',
      scanned_qr_token: `token_jwt_qr_${i}`,
      scanned_guest_id: `guest_id_${i}`,
      confirmed_guest_ids: JSON.stringify([`guest_id_${i}`]),
      canonical_payload_hash: `sha256_hash_payload_${i}`,
      state: i % 2 === 0 ? 'pending' : 'synced',
      retry_count: i % 3,
      created_at: new Date(Date.now() - i * 1000).toISOString(),
      scanned_at: new Date(Date.now() - i * 500).toISOString(),
      synced_at: i % 2 === 0 ? null : new Date().toISOString(),
      error_code: null,
      error_message: null,
      server_response: i % 2 === 0 ? null : JSON.stringify({ ok: true, attendee: i }),
    };

    stmt.run(
      item.client_scan_id,
      item.event_id,
      item.scanned_qr_token,
      item.scanned_guest_id,
      item.confirmed_guest_ids,
      item.canonical_payload_hash,
      item.state,
      item.retry_count,
      item.created_at,
      item.scanned_at,
      item.synced_at,
      item.error_code,
      item.error_message,
      item.server_response
    );

    queueItems.push(item);
  }

  db.close();
  return queueItems;
}

// -------------------------------------------------------------
// CENÁRIOS DE TESTE ADVERSARIAL E DE INTEGRAÇÃO REAL
// -------------------------------------------------------------

test('Cenário 1 — Banco Inexistente (NON_EXISTENT): gera nova chave criptográfica segura e cria direto cifrado', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-real-'));
  const fs = new NodeFileSystem();
  const keyStorage = new MockSecureKeyStorage();
  const dbPath = path.join(tmpDir, 'reception_prime.db');

  const state = await detectDatabaseState(dbPath, keyStorage, fs, createRealConnectionOpener());
  assert.strictEqual(state, 'NON_EXISTENT');

  const key = await resolveKeyForState(state, keyStorage);
  assert.strictEqual(typeof key, 'string');
  assert.strictEqual(key.length, 64);
  assert.match(key, /^[0-9a-f]{64}$/); // Chave estritamente hexadecimal de 256 bits

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 2 — Migração REAL em WAL com 15 itens na reception_queue: integridade física total', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-real-'));
  const fs = new NodeFileSystem();
  const keyStorage = new MockSecureKeyStorage();
  const dbName = 'reception_prime.db';
  const dbPath = path.join(tmpDir, dbName);

  // 1. Cria banco real no disco com tabela e 15 registros
  const originalItems = await setupLegacyRealDatabase(dbPath);
  assert.strictEqual(originalItems.length, 15);

  // Valida que o arquivo real existe no disco e possui cabeçalho padrão
  assert.strictEqual(await fs.exists(dbPath), true);

  const state = await detectDatabaseState(dbPath, keyStorage, fs, createRealConnectionOpener());
  assert.strictEqual(state, 'LEGACY_PLAINTEXT_VALIDATED');

  const key = await resolveKeyForState(state, keyStorage);
  assert.ok(key);

  // 2. Executa a migração real
  const result = await runMigration({
    dbDir: tmpDir,
    dbName,
    key,
    fs,
    connectionOpener: createRealConnectionOpener(),
  });

  assert.strictEqual(result.migrated, true);
  assert.strictEqual(result.queueItemsVerified, 15);
  assert.strictEqual(result.userVersionPreserved, 5); // Schema version preservado

  // 3. Valida no disco real: arquivo principal existe, resíduos .bak e .tmp foram limpos
  assert.strictEqual(await fs.exists(dbPath), true);
  assert.strictEqual(await fs.exists(path.join(tmpDir, `${dbName}.bak`)), false);
  assert.strictEqual(await fs.exists(path.join(tmpDir, `${dbName}.tmp`)), false);
  assert.strictEqual(await fs.exists(path.join(tmpDir, 'migration.state.json')), false);

  // 4. Inspeciona o banco final resultante com conexão real
  const verifyDb = new DatabaseSync(dbPath);
  const rows = verifyDb.prepare(RECEPTION_QUEUE_SELECT_SQL).all() as unknown as QueueItemRecord[];
  assert.strictEqual(rows.length, 15);

  // Validação profunda campo a campo dos 15 itens
  for (let i = 0; i < 15; i++) {
    assert.strictEqual(rows[i].client_scan_id, originalItems[i].client_scan_id);
    assert.strictEqual(rows[i].confirmed_guest_ids, originalItems[i].confirmed_guest_ids);
    assert.strictEqual(rows[i].canonical_payload_hash, originalItems[i].canonical_payload_hash);
    assert.strictEqual(rows[i].state, originalItems[i].state);
    assert.strictEqual(rows[i].retry_count, originalItems[i].retry_count);
  }
  verifyDb.close();

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 3 — Bloqueio e Aborto Seguro quando wal_checkpoint retornar busy !== 0', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-real-'));
  const fs = new NodeFileSystem();
  const dbName = 'reception_prime.db';
  const dbPath = path.join(tmpDir, dbName);

  await setupLegacyRealDatabase(dbPath);

  await assert.rejects(
    async () => {
      await runMigration({
        dbDir: tmpDir,
        dbName,
        key: generate256BitKey(),
        fs,
        connectionOpener: createRealConnectionOpener({ walBusy: true }),
      });
    },
    (err: Error) => err instanceof WalCheckpointBusyError
  );

  // Banco legado no disco continua intacto e nenhum .bak foi gerado
  assert.strictEqual(await fs.exists(dbPath), true);
  assert.strictEqual(await fs.exists(path.join(tmpDir, `${dbName}.bak`)), false);

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 4 — Banco Criptografado com Chave Perdida (KEY_LOST): bloqueio sem nova chave', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-real-'));
  const fs = new NodeFileSystem();
  const keyStorage = new MockSecureKeyStorage(); // Keystore sem a chave
  const dbPath = path.join(tmpDir, 'reception_prime.db');

  // Grava arquivo com bytes cifrados (sem header de SQLite texto claro)
  const encryptedPayload = Buffer.alloc(1024, 0xef);
  await fsPromises.writeFile(dbPath, encryptedPayload);

  const state = await detectDatabaseState(dbPath, keyStorage, fs, createRealConnectionOpener());
  assert.strictEqual(state, 'KEY_LOST');

  await assert.rejects(
    async () => {
      await resolveKeyForState(state, keyStorage);
    },
    (err: Error) => err instanceof DatabaseKeyMissingError
  );

  // Nenhuma chave gerada, o Keystore permanece limpo
  assert.strictEqual(keyStorage.has(RECEPTION_DB_KEY_ALIAS), false);

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 5 — Arquivo Corrompido ou Desconhecido: recusa modificações', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-real-'));
  const fs = new NodeFileSystem();
  const keyStorage = new MockSecureKeyStorage();
  const dbPath = path.join(tmpDir, 'reception_prime.db');

  // Arquivo truncado inválido com 8 bytes
  await fsPromises.writeFile(dbPath, Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]));

  const state = await detectDatabaseState(dbPath, keyStorage, fs, createRealConnectionOpener());
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
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-real-'));
  const fs = new NodeFileSystem();
  const dbName = 'reception_prime.db';
  const dbPath = path.join(tmpDir, dbName);

  await setupLegacyRealDatabase(dbPath);

  // Simula queda com crash durante a exportação
  await assert.rejects(
    async () => {
      await runMigration({
        dbDir: tmpDir,
        dbName,
        key: generate256BitKey(),
        fs,
        connectionOpener: createRealConnectionOpener(),
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
    createRealConnectionOpener()
  );

  assert.strictEqual(reconciled, true);
  // O banco legado permanece intacto e resíduos .tmp/.journal foram limpos
  assert.strictEqual(await fs.exists(dbPath), true);
  assert.strictEqual(await fs.exists(path.join(tmpDir, `${dbName}.tmp`)), false);
  assert.strictEqual(await fs.exists(path.join(tmpDir, 'migration.state.json')), false);

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 7 — Queda Abrupta (SIGKILL) durante SWAPPING: reconciliação restaura backup', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-real-'));
  const fs = new NodeFileSystem();
  const dbName = 'reception_prime.db';
  const dbPath = path.join(tmpDir, dbName);

  await setupLegacyRealDatabase(dbPath);

  await assert.rejects(
    async () => {
      await runMigration({
        dbDir: tmpDir,
        dbName,
        key: generate256BitKey(),
        fs,
        connectionOpener: createRealConnectionOpener(),
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
    createRealConnectionOpener()
  );

  assert.strictEqual(reconciled, true);
  assert.strictEqual(await fs.exists(path.join(tmpDir, 'migration.state.json')), false);

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 8 — Rejeição em Binário sem SQLCipher nativo', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-real-'));
  const fs = new NodeFileSystem();
  const dbName = 'reception_prime.db';
  const dbPath = path.join(tmpDir, dbName);

  await setupLegacyRealDatabase(dbPath);

  await assert.rejects(
    async () => {
      await runMigration({
        dbDir: tmpDir,
        dbName,
        key: generate256BitKey(),
        fs,
        connectionOpener: createRealConnectionOpener({ cipherVersion: '' }), // Ausência de SQLCipher
      });
    },
    (err: Error) => err instanceof SQLCipherNativeMissingError
  );

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});
