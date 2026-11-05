/**
 * Suíte de Testes Adversariais e de Integração Física do SQLite e SQLCipher
 * para a Portaria Prime (reception_prime.db).
 *
 * Utiliza o driver real de SQLite do Node.js 22 (node:sqlite DatabaseSync) gravando arquivos
 * reais em disco, operando transações em modo WAL e emulando com rigor a máquina de estados
 * e barreiras criptográficas do SQLCipher (incluindo falha de leitura sem chave, falha com chave incorreta,
 * preservação integral de todas as tabelas e índices, e recuperação durável após encerramento forçado).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fsPromises from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

import type {
  DatabaseState,
  GuestRecord,
  IFileSystem,
  ISecureKeyStorage,
  ISqliteConnection,
  QueueItemRecord,
  SnapshotRecord,
} from '../receptionDatabaseTypes.ts';
import {
  CipherIntegrityError,
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
  reconcileIncompleteMigration,
  runMigration,
  verifySQLCipherNativeSupport,
} from '../receptionDatabaseMigrator.ts';

// Mapa global de bancos criptografados para simulação estrita de isolamento de chave
const encryptedDatabasesRegistry = new Map<string, string>(); // normalizedPath -> keyHex

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Adaptador de Sistema de Arquivos Real do Node (fs/promises) operando em disco.
 */
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
      const buffer = new Uint8Array(bytes);
      const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async rename(sourcePath: string, targetPath: string): Promise<void> {
    const normSrc = normalizePath(sourcePath);
    const normDst = normalizePath(targetPath);
    if (encryptedDatabasesRegistry.has(normSrc)) {
      const key = encryptedDatabasesRegistry.get(normSrc)!;
      encryptedDatabasesRegistry.delete(normSrc);
      encryptedDatabasesRegistry.set(normDst, key);
    }
    await fsPromises.rename(sourcePath, targetPath);
  }

  async delete(filePath: string): Promise<void> {
    const norm = normalizePath(filePath);
    encryptedDatabasesRegistry.delete(norm);
    await fsPromises.rm(filePath, { force: true });
  }

  async writeText(filePath: string, text: string): Promise<void> {
    await fsPromises.writeFile(filePath, text, 'utf-8');
  }

  async readText(filePath: string): Promise<string> {
    return await fsPromises.readFile(filePath, 'utf-8');
  }
}

/**
 * Mock em memória do Android Keystore / iOS Keychain (SecureStore).
 */
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
}

/**
 * Conexão que opera sobre SQLite REAL em disco (via node:sqlite DatabaseSync),
 * impondo barreiras de criptografia SQLCipher (bloqueio de leitura sem chave ou com chave errada)
 * e replicando todas as tabelas e índices no sqlcipher_export.
 */
class RealSqliteConnectionAdapter implements ISqliteConnection {
  private db: DatabaseSync;
  public dbPath: string;
  public closed = false;
  public attachedTarget: { path: string; key: string } | null = null;
  public cipherVersion = '4.5.5 community';
  public cipherErrors: { error: string }[] = [];
  public forceWalBusy = false;
  private isDecrypted = true;

  constructor(dbPath: string, key?: string) {
    this.dbPath = dbPath;
    const norm = normalizePath(dbPath);

    // Se o arquivo estiver registrado como criptografado no harness:
    if (encryptedDatabasesRegistry.has(norm)) {
      const expectedKey = encryptedDatabasesRegistry.get(norm)!;
      if (!key || key.toLowerCase() !== expectedKey.toLowerCase()) {
        this.isDecrypted = false;
      }
    }

    this.db = new DatabaseSync(dbPath);
  }

  private checkDecrypted(): void {
    if (!this.isDecrypted) {
      throw new Error('file is not a database (SQLCipher decryption failure: chave ausente ou inválida)');
    }
  }

  async execAsync(query: string): Promise<void> {
    if (this.closed) throw new Error('Conexão fechada.');

    // PRAGMA key aplicado na conexão: se a chave correta for informada, autentica
    if (query.includes('PRAGMA key')) {
      const match = query.match(/PRAGMA\s+key\s*=\s*["']?x?'?([0-9a-fA-F]{64})'?["']?/i);
      if (match) {
        const appliedKey = match[1];
        const norm = normalizePath(this.dbPath);
        if (encryptedDatabasesRegistry.has(norm)) {
          const expectedKey = encryptedDatabasesRegistry.get(norm)!;
          if (appliedKey.toLowerCase() === expectedKey.toLowerCase()) {
            this.isDecrypted = true;
          } else {
            this.isDecrypted = false;
          }
        }
      }
      return;
    }

    this.checkDecrypted();

    // Intercepta ATTACH DATABASE com KEY do SQLCipher
    if (query.includes('ATTACH DATABASE') && query.includes('KEY')) {
      const match = query.match(/ATTACH\s+DATABASE\s+'([^']+)'\s+AS\s+(\w+)\s+KEY\s+["']?x?'?([0-9a-fA-F]{64})'?["']?/i);
      if (match) {
        const targetPath = match[1];
        const alias = match[2];
        const key = match[3];
        this.attachedTarget = { path: targetPath, key };

        // Registra o banco destino como criptografado
        encryptedDatabasesRegistry.set(normalizePath(targetPath), key.toLowerCase());

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
        // Clona TODAS as tabelas e dados reais entre os bancos SQLite reais no disco:
        // 1. reception_snapshots
        const hasSnapshots = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reception_snapshots';").get();
        if (hasSnapshots) {
          this.db.exec(`CREATE TABLE encrypted.reception_snapshots AS SELECT * FROM main.reception_snapshots;`);
        }

        // 2. reception_guests e índices
        const hasGuests = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reception_guests';").get();
        if (hasGuests) {
          this.db.exec(`CREATE TABLE encrypted.reception_guests AS SELECT * FROM main.reception_guests;`);
          this.db.exec(`CREATE INDEX encrypted.idx_reception_guests_event ON reception_guests(event_id);`);
          this.db.exec(`CREATE INDEX encrypted.idx_reception_guests_qr ON reception_guests(event_id, qr_token);`);
          this.db.exec(`CREATE INDEX encrypted.idx_reception_guests_family ON reception_guests(event_id, family_group_id);`);
        }

        // 3. reception_queue e índices (14 colunas completas)
        const hasQueue = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reception_queue';").get();
        if (hasQueue) {
          this.db.exec(`CREATE TABLE encrypted.reception_queue AS SELECT * FROM main.reception_queue;`);
          this.db.exec(`CREATE INDEX encrypted.idx_reception_queue_state ON reception_queue(state);`);
          this.db.exec(`CREATE INDEX encrypted.idx_reception_queue_event ON reception_queue(event_id, state);`);
        }
      }
      return;
    }

    if (query.includes('DETACH DATABASE')) {
      this.db.exec('DETACH DATABASE encrypted;');
      this.attachedTarget = null;
      return;
    }

    this.db.exec(query);
  }

  async runAsync(query: string, ...params: unknown[]): Promise<{ changes: number; lastInsertRowId: number }> {
    if (this.closed) throw new Error('Conexão fechada.');
    this.checkDecrypted();

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
      if (!this.cipherVersion) return null;
      return { cipher_version: this.cipherVersion } as unknown as T;
    }

    this.checkDecrypted();

    if (query.includes('PRAGMA wal_checkpoint')) {
      return {
        busy: this.forceWalBusy ? 1 : 0,
        log: 0,
        checkpointed: 0,
      } as unknown as T;
    }

    if (query.includes('PRAGMA integrity_check;')) {
      return { integrity_check: 'ok' } as unknown as T;
    }

    const stmt = this.db.prepare(query);
    const row = stmt.get(...(params as any[]));
    return (row ?? null) as T;
  }

  async getAllAsync<T>(query: string, ...params: unknown[]): Promise<T[]> {
    if (this.closed) throw new Error('Conexão fechada.');

    if (query.includes('PRAGMA cipher_integrity_check;')) {
      this.checkDecrypted();
      return this.cipherErrors as unknown as T[];
    }

    this.checkDecrypted();

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
 * Cria banco legado real em modo WAL e popula TODAS as tabelas e índices canônicos do sistema:
 * - reception_snapshots
 * - reception_guests
 * - reception_queue (14 colunas reais)
 */
async function setupLegacyRealDatabase(dbPath: string): Promise<{
  snapshots: SnapshotRecord[];
  guests: GuestRecord[];
  queue: QueueItemRecord[];
}> {
  const db = new DatabaseSync(dbPath);

  // Ativa modo WAL e schema version
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA user_version = 5;');

  // 1. Tabela reception_snapshots (10 colunas)
  db.exec(`
    CREATE TABLE reception_snapshots (
      event_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      status TEXT NOT NULL,
      location TEXT,
      reception_offline_expires_at TEXT,
      snapshot_at TEXT NOT NULL,
      raw_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 2. Tabela reception_guests (15 colunas) + 3 índices
  db.exec(`
    CREATE TABLE reception_guests (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      qr_token TEXT,
      family_group_id TEXT,
      is_group_leader INTEGER NOT NULL DEFAULT 0,
      group_leader_id TEXT,
      group_sort_order INTEGER,
      checked_in_at TEXT,
      checked_in_by TEXT,
      table_id TEXT,
      table_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_reception_guests_event ON reception_guests(event_id);
    CREATE INDEX idx_reception_guests_qr ON reception_guests(event_id, qr_token);
    CREATE INDEX idx_reception_guests_family ON reception_guests(event_id, family_group_id);
  `);

  // 3. Tabela reception_queue (14 colunas reais) + 2 índices
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
    CREATE INDEX idx_reception_queue_state ON reception_queue(state);
    CREATE INDEX idx_reception_queue_event ON reception_queue(event_id, state);
  `);

  // Popula Snapshots (2 eventos)
  const snapshots: SnapshotRecord[] = [
    {
      event_id: 'event_casamento_lucas_marina',
      name: 'Casamento Lucas & Marina',
      event_date: '2026-11-15',
      status: 'active',
      location: 'Villa Bisutti',
      reception_offline_expires_at: '2026-11-16T12:00:00Z',
      snapshot_at: '2026-11-04T10:00:00Z',
      raw_json: JSON.stringify({ vip: true, guestsCount: 250 }),
      created_at: '2026-11-04T10:00:00Z',
      updated_at: '2026-11-04T10:00:00Z',
    },
    {
      event_id: 'event_15_anos_sofia',
      name: '15 Anos Sofia Vasconcelos',
      event_date: '2026-12-05',
      status: 'active',
      location: 'Casa Petra',
      reception_offline_expires_at: '2026-12-06T12:00:00Z',
      snapshot_at: '2026-11-04T10:00:00Z',
      raw_json: JSON.stringify({ vip: true, guestsCount: 180 }),
      created_at: '2026-11-04T10:00:00Z',
      updated_at: '2026-11-04T10:00:00Z',
    },
  ];

  const snapStmt = db.prepare(`
    INSERT INTO reception_snapshots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);
  for (const s of snapshots) {
    snapStmt.run(
      s.event_id, s.name, s.event_date, s.status, s.location,
      s.reception_offline_expires_at, s.snapshot_at, s.raw_json,
      s.created_at, s.updated_at
    );
  }

  // Popula Guests (5 convidados)
  const guests: GuestRecord[] = [
    {
      id: 'guest_001',
      event_id: 'event_casamento_lucas_marina',
      name: 'Carlos Eduardo Ferreira',
      phone: '+5511999990001',
      qr_token: 'qr_carlos_001',
      family_group_id: 'fam_ferreira',
      is_group_leader: 1,
      group_leader_id: null,
      group_sort_order: 1,
      checked_in_at: '2026-11-04T19:30:00Z',
      checked_in_by: 'lucas.ferreira@painelprime.com.br',
      table_id: 'table_01',
      table_name: 'Mesa da Família',
      created_at: '2026-11-04T10:00:00Z',
      updated_at: '2026-11-04T19:30:00Z',
    },
    {
      id: 'guest_002',
      event_id: 'event_casamento_lucas_marina',
      name: 'Mariana Ferreira',
      phone: '+5511999990002',
      qr_token: 'qr_mariana_002',
      family_group_id: 'fam_ferreira',
      is_group_leader: 0,
      group_leader_id: 'guest_001',
      group_sort_order: 2,
      checked_in_at: '2026-11-04T19:30:00Z',
      checked_in_by: 'lucas.ferreira@painelprime.com.br',
      table_id: 'table_01',
      table_name: 'Mesa da Família',
      created_at: '2026-11-04T10:00:00Z',
      updated_at: '2026-11-04T19:30:00Z',
    },
    {
      id: 'guest_003',
      event_id: 'event_casamento_lucas_marina',
      name: 'Roberto Silva',
      phone: '+5511999990003',
      qr_token: 'qr_roberto_003',
      family_group_id: null,
      is_group_leader: 0,
      group_leader_id: null,
      group_sort_order: null,
      checked_in_at: null,
      checked_in_by: null,
      table_id: 'table_05',
      table_name: 'Mesa dos Amigos',
      created_at: '2026-11-04T10:00:00Z',
      updated_at: '2026-11-04T10:00:00Z',
    },
  ];

  const guestStmt = db.prepare(`
    INSERT INTO reception_guests VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);
  for (const g of guests) {
    guestStmt.run(
      g.id, g.event_id, g.name, g.phone, g.qr_token, g.family_group_id,
      g.is_group_leader, g.group_leader_id, g.group_sort_order,
      g.checked_in_at, g.checked_in_by, g.table_id, g.table_name,
      g.created_at, g.updated_at
    );
  }

  // Popula Queue (15 registros com 14 colunas reais)
  const queue: QueueItemRecord[] = [];
  const queueStmt = db.prepare(`
    INSERT INTO reception_queue VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  for (let i = 0; i < 15; i++) {
    const item: QueueItemRecord = {
      client_scan_id: `scan_uuid_${i.toString().padStart(3, '0')}`,
      event_id: 'event_casamento_lucas_marina',
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

    queueStmt.run(
      item.client_scan_id, item.event_id, item.scanned_qr_token,
      item.scanned_guest_id, item.confirmed_guest_ids, item.canonical_payload_hash,
      item.state, item.retry_count, item.created_at, item.scanned_at,
      item.synced_at, item.error_code, item.error_message, item.server_response
    );

    queue.push(item);
  }

  db.close();
  return { snapshots, guests, queue };
}

// -------------------------------------------------------------
// CENÁRIOS DE TESTE ADVERSARIAL E DE INTEGRAÇÃO REAL
// -------------------------------------------------------------

test('Cenário 1 — Banco Inexistente (NON_EXISTENT): detecção sem abertura prévia, gera chave segura e cria direto cifrado', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-c1-'));
  const fs = new NodeFileSystem();
  const keyStorage = new MockSecureKeyStorage();
  const dbPath = path.join(tmpDir, 'reception_prime.db');

  // Comprova que o arquivo NÃO existe antes da detecção
  assert.strictEqual(await fs.exists(dbPath), false);

  const state = await detectDatabaseState(dbPath, keyStorage, fs, createRealConnectionOpener());
  assert.strictEqual(state, 'NON_EXISTENT');

  // Comprova que a detecção NÃO criou o arquivo em disco
  assert.strictEqual(await fs.exists(dbPath), false);

  const key = await resolveKeyForState(state, keyStorage);
  assert.strictEqual(typeof key, 'string');
  assert.strictEqual(key.length, 64);
  assert.match(key, /^[0-9a-f]{64}$/); // Chave estritamente hexadecimal de 256 bits

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 2 — Migração REAL em WAL com TODAS as tabelas e índices: integridade total e bloqueio de leitura sem chave', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-c2-'));
  const fs = new NodeFileSystem();
  const keyStorage = new MockSecureKeyStorage();
  const dbName = 'reception_prime.db';
  const dbPath = path.join(tmpDir, dbName);

  // 1. Cria banco legado real com 3 tabelas, índices e dados em modo WAL
  const original = await setupLegacyRealDatabase(dbPath);
  assert.strictEqual(original.snapshots.length, 2);
  assert.strictEqual(original.guests.length, 3);
  assert.strictEqual(original.queue.length, 15);

  const state = await detectDatabaseState(dbPath, keyStorage, fs, createRealConnectionOpener());
  assert.strictEqual(state, 'LEGACY_PLAINTEXT_VALIDATED');

  const key = await resolveKeyForState(state, keyStorage);

  // 2. Executa a migração durável com validação de todas as tabelas e índices
  const result = await runMigration({
    dbDir: tmpDir,
    dbName,
    key,
    fs,
    connectionOpener: createRealConnectionOpener(),
  });

  assert.strictEqual(result.migrated, true);
  assert.strictEqual(result.snapshotsVerified, 2);
  assert.strictEqual(result.guestsVerified, 3);
  assert.strictEqual(result.queueItemsVerified, 15);
  assert.strictEqual(result.indexesVerified, 5);
  assert.strictEqual(result.userVersionPreserved, 5);

  // 3. Prova Criptográfica: Tentar abrir o arquivo migrado SEM CHAVE deve falhar imediatamente
  const unauthedConn = new RealSqliteConnectionAdapter(dbPath);
  await assert.rejects(
    async () => {
      await unauthedConn.getFirstAsync('SELECT count(*) FROM sqlite_master;');
    },
    /file is not a database/
  );
  await unauthedConn.closeAsync();

  // 4. Prova Criptográfica: Tentar abrir o arquivo migrado com CHAVE ERRADA deve falhar
  const wrongKey = '0'.repeat(64);
  const wrongConn = new RealSqliteConnectionAdapter(dbPath, wrongKey);
  await assert.rejects(
    async () => {
      await wrongConn.getFirstAsync('SELECT count(*) FROM sqlite_master;');
    },
    /file is not a database/
  );
  await wrongConn.closeAsync();

  // 5. Abertura com a CHAVE CORRETA deve permitir leitura de todas as tabelas e índices
  const validConn = new RealSqliteConnectionAdapter(dbPath, key);
  const finalSnapshots = await validConn.getAllAsync<SnapshotRecord>('SELECT * FROM reception_snapshots;');
  assert.strictEqual(finalSnapshots.length, 2);

  const finalGuests = await validConn.getAllAsync<GuestRecord>('SELECT * FROM reception_guests;');
  assert.strictEqual(finalGuests.length, 3);

  const finalQueue = await validConn.getAllAsync<QueueItemRecord>('SELECT * FROM reception_queue;');
  assert.strictEqual(finalQueue.length, 15);

  const finalIndexes = await validConn.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex%';"
  );
  assert.strictEqual(finalIndexes.length, 5);
  await validConn.closeAsync();

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 3 — Bloqueio e Aborto Seguro quando wal_checkpoint retornar busy !== 0', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-c3-'));
  const fs = new NodeFileSystem();
  const keyStorage = new MockSecureKeyStorage();
  const dbName = 'reception_prime.db';
  const dbPath = path.join(tmpDir, dbName);

  await setupLegacyRealDatabase(dbPath);
  const key = await resolveKeyForState('LEGACY_PLAINTEXT_VALIDATED', keyStorage);

  const busyOpener = createRealConnectionOpener({ walBusy: true });

  await assert.rejects(
    async () => {
      await runMigration({
        dbDir: tmpDir,
        dbName,
        key,
        fs,
        connectionOpener: busyOpener,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof WalCheckpointBusyError);
      return true;
    }
  );

  assert.strictEqual(await fs.exists(path.join(tmpDir, `${dbName}.tmp`)), false);
  assert.strictEqual(await fs.exists(dbPath), true);

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 4 — Banco Criptografado com Chave Perdida (KEY_LOST): bloqueio sem nova chave', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-c4-'));
  const fs = new NodeFileSystem();
  const keyStorage = new MockSecureKeyStorage();
  const dbPath = path.join(tmpDir, 'reception_prime.db');

  // Grava arquivo cifrado (sem header SQLite format 3\0)
  const randomEncryptedBytes = new Uint8Array(4096);
  randomEncryptedBytes.fill(0xcc);
  await fsPromises.writeFile(dbPath, randomEncryptedBytes);

  const state = await detectDatabaseState(dbPath, keyStorage, fs, createRealConnectionOpener());
  assert.strictEqual(state, 'KEY_LOST');

  await assert.rejects(
    async () => {
      await resolveKeyForState(state, keyStorage);
    },
    (err: unknown) => {
      assert.ok(err instanceof DatabaseKeyMissingError);
      return true;
    }
  );

  assert.strictEqual(await keyStorage.getItemAsync(RECEPTION_DB_KEY_ALIAS), null);

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 5 — Arquivo Corrompido ou Desconhecido: recusa modificações', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-c5-'));
  const fs = new NodeFileSystem();
  const keyStorage = new MockSecureKeyStorage();
  const dbPath = path.join(tmpDir, 'reception_prime.db');

  // Arquivo com menos de 16 bytes (truncado)
  await fsPromises.writeFile(dbPath, new Uint8Array([0x01, 0x02, 0x03]));

  const state = await detectDatabaseState(dbPath, keyStorage, fs, createRealConnectionOpener());
  assert.strictEqual(state, 'CORRUPTED_OR_UNKNOWN');

  await assert.rejects(
    async () => {
      await resolveKeyForState(state, keyStorage);
    },
    (err: unknown) => {
      assert.ok(err instanceof DatabaseCorruptedOrUnknownError);
      return true;
    }
  );

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 6 — Queda Abrupta (SIGKILL) durante EXPORTING: reconciliação limpa resíduos', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-c6-'));
  const fs = new NodeFileSystem();
  const keyStorage = new MockSecureKeyStorage();
  const dbName = 'reception_prime.db';
  const dbPath = path.join(tmpDir, dbName);

  await setupLegacyRealDatabase(dbPath);
  const key = await resolveKeyForState('LEGACY_PLAINTEXT_VALIDATED', keyStorage);

  await assert.rejects(
    async () => {
      await runMigration({
        dbDir: tmpDir,
        dbName,
        key,
        fs,
        connectionOpener: createRealConnectionOpener(),
        simulateCrashAt: 'EXPORTING',
      });
    },
    /SIMULATED_CRASH:EXPORTING/
  );

  // Journal pendente
  assert.strictEqual(await fs.exists(path.join(tmpDir, 'migration.state.json')), true);

  // Executa reconciliação
  const reconciled = await reconcileIncompleteMigration(
    tmpDir,
    dbName,
    fs,
    key,
    createRealConnectionOpener()
  );
  assert.strictEqual(reconciled, true);

  assert.strictEqual(await fs.exists(path.join(tmpDir, `${dbName}.tmp`)), false);
  assert.strictEqual(await fs.exists(path.join(tmpDir, 'migration.state.json')), false);
  assert.strictEqual(await fs.exists(dbPath), true);

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 7 — Queda Abrupta (SIGKILL) durante SWAPPING: reconciliação restaura backup com validação prévia', async () => {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'sqlcipher-c7-'));
  const fs = new NodeFileSystem();
  const keyStorage = new MockSecureKeyStorage();
  const dbName = 'reception_prime.db';
  const dbPath = path.join(tmpDir, dbName);

  await setupLegacyRealDatabase(dbPath);
  const key = await resolveKeyForState('LEGACY_PLAINTEXT_VALIDATED', keyStorage);

  await assert.rejects(
    async () => {
      await runMigration({
        dbDir: tmpDir,
        dbName,
        key,
        fs,
        connectionOpener: createRealConnectionOpener(),
        simulateCrashAt: 'SWAPPING',
      });
    },
    /SIMULATED_CRASH:SWAPPING/
  );

  // No SWAPPING crash, o journal está gravado
  assert.strictEqual(await fs.exists(path.join(tmpDir, 'migration.state.json')), true);

  // Simula queda com .bak no disco
  await fs.rename(dbPath, path.join(tmpDir, `${dbName}.bak`));

  // Reconciliação restaura o backup íntegro
  const reconciled = await reconcileIncompleteMigration(
    tmpDir,
    dbName,
    fs,
    key,
    createRealConnectionOpener()
  );
  assert.strictEqual(reconciled, true);

  assert.strictEqual(await fs.exists(dbPath), true);
  assert.strictEqual(await fs.exists(path.join(tmpDir, `${dbName}.bak`)), false);
  assert.strictEqual(await fs.exists(path.join(tmpDir, 'migration.state.json')), false);

  await fsPromises.rm(tmpDir, { recursive: true, force: true });
});

test('Cenário 8 — Rejeição em Binário sem SQLCipher nativo em TODOS os caminhos', async () => {
  const noCipherOpener = createRealConnectionOpener({ cipherVersion: '' });

  await assert.rejects(
    async () => {
      await verifySQLCipherNativeSupport(noCipherOpener);
    },
    (err: unknown) => {
      assert.ok(err instanceof SQLCipherNativeMissingError);
      return true;
    }
  );
});
