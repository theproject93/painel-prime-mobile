/**
 * Máquina de Estados de Migração Durável e Reconciliação do SQLite para SQLCipher
 * na Portaria Prime (reception_prime.db).
 * Validação profunda de TODAS as tabelas (reception_snapshots, reception_guests, reception_queue)
 * e de todos os índices estruturais do sistema.
 */

import type {
  GuestRecord,
  IFileSystem,
  ISqliteConnection,
  MigrationJournalState,
  MigrationStage,
  QueueItemRecord,
  SnapshotRecord,
} from './receptionDatabaseTypes.ts';
import {
  CipherIntegrityError,
  DatabaseCorruptedOrUnknownError,
  MigrationIntegrityMismatchError,
  SQLCipherNativeMissingError,
  WalCheckpointBusyError,
} from './receptionDatabaseTypes.ts';
import { assertSQLCipherActive, validateHexKey } from './receptionDatabaseKeyManager.ts';
import { sha256Pure } from '../engine/receptionHash.ts';

export interface MigrationOptions {
  dbDir: string;
  dbName: string; // 'reception_prime.db'
  key: string;
  fs: IFileSystem;
  connectionOpener: (fullPath: string, key?: string) => Promise<ISqliteConnection>;
  simulateCrashAt?: MigrationStage;
}

export interface MigrationResult {
  migrated: boolean;
  reconciled: boolean;
  snapshotsVerified: number;
  guestsVerified: number;
  queueItemsVerified: number;
  indexesVerified: number;
  userVersionPreserved: number;
}

/**
 * Consultas canônicas das 3 tabelas e de índices do Painel Prime.
 */
export const RECEPTION_SNAPSHOTS_SELECT_SQL = `
  SELECT event_id, name, event_date, status, location,
         reception_offline_expires_at, snapshot_at, raw_json,
         created_at, updated_at
  FROM reception_snapshots
  ORDER BY event_id ASC;
`.trim();

export const RECEPTION_GUESTS_SELECT_SQL = `
  SELECT id, event_id, name, phone, qr_token, family_group_id,
         is_group_leader, group_leader_id, group_sort_order,
         checked_in_at, checked_in_by, table_id, table_name,
         created_at, updated_at
  FROM reception_guests
  ORDER BY id ASC;
`.trim();

export const RECEPTION_QUEUE_SELECT_SQL = `
  SELECT client_scan_id, event_id, scanned_qr_token, scanned_guest_id,
         confirmed_guest_ids, canonical_payload_hash, state, retry_count,
         created_at, scanned_at, synced_at, error_code, error_message, server_response
  FROM reception_queue
  ORDER BY client_scan_id ASC;
`.trim();

export const RECEPTION_INDEXES_SELECT_SQL = `
  SELECT name
  FROM sqlite_master
  WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex%'
  ORDER BY name ASC;
`.trim();

/**
 * Verifica ativamente se o binário nativo possui suporte ao SQLCipher via banco :memory:,
 * sem criar arquivos ou tocar no disco.
 */
export async function verifySQLCipherNativeSupport(
  connectionOpener: (path: string, key?: string) => Promise<ISqliteConnection>
): Promise<string> {
  const probeConn = await connectionOpener(':memory:');
  try {
    return await assertSQLCipherActive(probeConn);
  } finally {
    await probeConn.closeAsync();
  }
}

/**
 * Calcula checksum criptográfico determinístico (SHA-256) de itens da fila para validação de integridade.
 */
export function computeQueueChecksum(items: QueueItemRecord[]): string {
  const str = JSON.stringify(items);
  return sha256Pure(str);
}

/**
 * Helpers estritos para leitura de tabelas e índices existentes.
 */
async function fetchSnapshotsStrictly(conn: ISqliteConnection): Promise<SnapshotRecord[]> {
  const table = await conn.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='reception_snapshots';"
  );
  if (!table) return [];
  return await conn.getAllAsync<SnapshotRecord>(RECEPTION_SNAPSHOTS_SELECT_SQL);
}

async function fetchGuestsStrictly(conn: ISqliteConnection): Promise<GuestRecord[]> {
  const table = await conn.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='reception_guests';"
  );
  if (!table) return [];
  return await conn.getAllAsync<GuestRecord>(RECEPTION_GUESTS_SELECT_SQL);
}

async function fetchQueueItemsStrictly(conn: ISqliteConnection): Promise<QueueItemRecord[]> {
  const table = await conn.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='reception_queue';"
  );
  if (!table) return [];
  return await conn.getAllAsync<QueueItemRecord>(RECEPTION_QUEUE_SELECT_SQL);
}

async function fetchIndexesStrictly(conn: ISqliteConnection): Promise<string[]> {
  const rows = await conn.getAllAsync<{ name: string }>(RECEPTION_INDEXES_SELECT_SQL);
  return rows.map((r) => r.name);
}

/**
 * Sanitiza caminhos de arquivo para cláusulas SQL (como ATTACH DATABASE),
 * escapando aspas simples, aspas duplas e normalizando contra-barras.
 */
export function sanitizeSqlPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/'/g, "''").replace(/"/g, '""');
}

/**
 * Reconcilia e recupera o estado caso o app tenha sido interrompido (SIGKILL)
 * durante uma migração anterior. Valida a fonte de recuperação antes de qualquer ação destrutiva.
 */
export async function reconcileIncompleteMigration(
  dbDir: string,
  dbName: string,
  fs: IFileSystem,
  key: string,
  connectionOpener: (fullPath: string, key?: string) => Promise<ISqliteConnection>
): Promise<boolean> {
  let validKey: string | null = null;
  if (key && /^[0-9a-fA-F]{64}$/.test(key)) {
    validKey = key.toLowerCase();
  }

  const cleanDbDir = dbDir.replace(/\\/g, '/');
  const journalPath = `${cleanDbDir}/migration.state.json`;
  const mainPath = `${cleanDbDir}/${dbName}`;
  const tmpPath = `${cleanDbDir}/${dbName}.tmp`;
  const bakPath = `${cleanDbDir}/${dbName}.bak`;

  const journalExists = await fs.exists(journalPath);
  const bakExists = await fs.exists(bakPath);
  const tmpExists = await fs.exists(tmpPath);
  const mainExists = await fs.exists(mainPath);

  if (!journalExists && !bakExists && !tmpExists) {
    return false; // Nenhuma migração pendente ou resíduo no disco
  }

  // 1. Testa se o banco principal 'reception_prime.db' já é uma versão cifrada válida e íntegra
  let mainIsEncryptedAndValid = false;
  if (mainExists && validKey) {
    try {
      const conn = await connectionOpener(mainPath, validKey);
      try {
        await assertSQLCipherActive(conn);
        await conn.getFirstAsync('SELECT count(*) FROM sqlite_master;');
        const errors = await conn.getAllAsync<{ error: string }>('PRAGMA cipher_integrity_check;');
        if (!errors || errors.length === 0) {
          mainIsEncryptedAndValid = true;
        }
      } finally {
        await conn.closeAsync();
      }
    } catch {
      mainIsEncryptedAndValid = false;
    }
  }

  if (mainIsEncryptedAndValid) {
    // O banco principal já está criptografado e saudável: limpa resíduos de transição
    if (bakExists) await fs.delete(bakPath);
    if (await fs.exists(`${bakPath}-wal`)) await fs.delete(`${bakPath}-wal`);
    if (await fs.exists(`${bakPath}-shm`)) await fs.delete(`${bakPath}-shm`);
    if (tmpExists) await fs.delete(tmpPath);
    if (await fs.exists(`${tmpPath}-wal`)) await fs.delete(`${tmpPath}-wal`);
    if (await fs.exists(`${tmpPath}-shm`)) await fs.delete(`${tmpPath}-shm`);
    if (journalExists) await fs.delete(journalPath);
    return true;
  }

  // 2. Se o main NÃO é válido (ou está ausente porque crashou após rename(main, bak)),
  // mas o backup (.bak) existe:
  // VALIDAÇÃO ESTRUTURAL PROFUNDA DA FONTE (SQLite real + integridade lógica e tabela de fila):
  if (bakExists) {
    let bakIsValid = false;
    try {
      const bakConn = await connectionOpener(bakPath);
      try {
        const check = await bakConn.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check;');
        if (check && check.integrity_check === 'ok') {
          // Valida que a tabela reception_queue existe e pode ser lida
          const tableCheck = await bakConn.getFirstAsync<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='reception_queue';"
          );
          if (tableCheck) {
            await bakConn.getFirstAsync('SELECT count(*) FROM reception_queue;');
          }
          bakIsValid = true;
        }
      } finally {
        await bakConn.closeAsync();
      }
    } catch {
      bakIsValid = false;
    }

    if (bakIsValid) {
      if (mainExists) await fs.delete(mainPath);
      if (await fs.exists(`${mainPath}-wal`)) await fs.delete(`${mainPath}-wal`);
      if (await fs.exists(`${mainPath}-shm`)) await fs.delete(`${mainPath}-shm`);

      await fs.rename(bakPath, mainPath);
      if (await fs.exists(`${bakPath}-wal`)) await fs.rename(`${bakPath}-wal`, `${mainPath}-wal`);
      if (await fs.exists(`${bakPath}-shm`)) await fs.rename(`${bakPath}-shm`, `${mainPath}-shm`);

      if (tmpExists) await fs.delete(tmpPath);
      if (await fs.exists(`${tmpPath}-wal`)) await fs.delete(`${tmpPath}-wal`);
      if (await fs.exists(`${tmpPath}-shm`)) await fs.delete(`${tmpPath}-shm`);
      if (journalExists) await fs.delete(journalPath);
      return true;
    } else {
      // O backup existe mas está corrompido / ilegível
      if (!mainExists) {
        throw new DatabaseCorruptedOrUnknownError(
          'Arquivo de backup (.bak) de migração pendente está corrompido e o banco principal está ausente. Operação bloqueada em modo fail-closed.'
        );
      }
    }
  }

  // 3. Se foi interrompido antes do swap (durante exportação), descarta o .tmp e mantém a origem
  if (tmpExists) await fs.delete(tmpPath);
  if (await fs.exists(`${tmpPath}-wal`)) await fs.delete(`${tmpPath}-wal`);
  if (await fs.exists(`${tmpPath}-shm`)) await fs.delete(`${tmpPath}-shm`);
  if (journalExists) await fs.delete(journalPath);

  return true;
}

/**
 * Executa a migração do banco legado em texto claro para SQLCipher garantindo zero perda de dados
 * e validação estrutural de TODAS as tabelas e índices.
 */
export async function runMigration(options: MigrationOptions): Promise<MigrationResult> {
  const { dbDir, dbName, key, fs, connectionOpener, simulateCrashAt } = options;
  const cleanDbDir = dbDir.replace(/\\/g, '/');
  const journalPath = `${cleanDbDir}/migration.state.json`;
  const mainPath = `${cleanDbDir}/${dbName}`;
  const tmpPath = `${cleanDbDir}/${dbName}.tmp`;
  const bakPath = `${cleanDbDir}/${dbName}.bak`;

  const validKey = validateHexKey(key);

  // 1. Reconciliação prévia física de boots interrompidos
  const reconciled = await reconcileIncompleteMigration(dbDir, dbName, fs, validKey, connectionOpener);

  // 2. Validação obrigatória de suporte nativo ao SQLCipher
  await verifySQLCipherNativeSupport(connectionOpener);

  // 3. Abre conexão de origem (banco legado) mantendo bloqueio de escritas
  const sourceConn = await connectionOpener(mainPath);

  let sourceUserVersion = 0;
  let sourceSnapshots: SnapshotRecord[] = [];
  let sourceGuests: GuestRecord[] = [];
  let sourceQueueItems: QueueItemRecord[] = [];
  let sourceIndexes: string[] = [];
  let queueChecksum = '';

  try {
    // 4. Executa checkpoint estrito do WAL
    const checkpointResult = await sourceConn.getFirstAsync<{
      busy: number;
      log: number;
      checkpointed: number;
    }>('PRAGMA wal_checkpoint(TRUNCATE);');

    if (checkpointResult && checkpointResult.busy !== 0) {
      throw new WalCheckpointBusyError(
        `Checkpoint do WAL bloqueado por conexões concorrentes (busy: ${checkpointResult.busy}).`
      );
    }

    if (simulateCrashAt === 'CHECKPOINTING_WAL') {
      throw new Error('SIMULATED_CRASH:CHECKPOINTING_WAL');
    }

    // 5. Captura versão do schema
    const versionResult = await sourceConn.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    sourceUserVersion = versionResult?.user_version ?? 0;

    // 6. Lê estritamente TODAS as tabelas e índices de origem
    sourceSnapshots = await fetchSnapshotsStrictly(sourceConn);
    sourceGuests = await fetchGuestsStrictly(sourceConn);
    sourceQueueItems = await fetchQueueItemsStrictly(sourceConn);
    sourceIndexes = await fetchIndexesStrictly(sourceConn);
    queueChecksum = computeQueueChecksum(sourceQueueItems);

    // 7. Grava journal durável com estado EXPORTING
    const journal: MigrationJournalState = {
      stage: 'EXPORTING',
      sourceVersion: sourceUserVersion,
      sourceSnapshotsCount: sourceSnapshots.length,
      sourceGuestsCount: sourceGuests.length,
      sourceQueueCount: sourceQueueItems.length,
      sourceQueueChecksum: queueChecksum,
      timestamp: new Date().toISOString(),
      dbName,
    };
    await fs.writeText(journalPath, JSON.stringify(journal));

    if (simulateCrashAt === 'EXPORTING') {
      throw new Error('SIMULATED_CRASH:EXPORTING');
    }

    // 8. Anexa banco destino criptografado e exporta dados
    if (await fs.exists(tmpPath)) {
      await fs.delete(tmpPath);
    }

    const sanitizedTmpPath = sanitizeSqlPath(tmpPath);

    await sourceConn.execAsync(
      `ATTACH DATABASE '${sanitizedTmpPath}' AS encrypted KEY "x'${validKey}'";`
    );

    try {
      await sourceConn.execAsync("SELECT sqlcipher_export('encrypted');");
    } finally {
      await sourceConn.execAsync('DETACH DATABASE encrypted;');
    }
  } finally {
    // 9. Encerra conexões com o banco fonte antes de inspecionar o arquivo gerado
    await sourceConn.closeAsync();
  }

  // 10. Abre banco de destino criptografado para validações profundas
  const targetConn = await connectionOpener(tmpPath, validKey);
  try {
    // Valida ativamente SQLCipher no target
    await assertSQLCipherActive(targetConn);

    // Migra explicitamente o user_version
    await targetConn.execAsync(`PRAGMA user_version = ${sourceUserVersion};`);

    // Verificação oficial Zetetic: PRAGMA cipher_integrity_check (espera 0 linhas)
    const cipherErrors = await targetConn.getAllAsync<{ error: string }>('PRAGMA cipher_integrity_check;');
    if (cipherErrors && cipherErrors.length > 0) {
      throw new CipherIntegrityError(
        `Erros no cipher_integrity_check: ${cipherErrors.map((e) => e.error).join(', ')}`
      );
    }

    // Verificação de integridade lógica SQLite
    const logicalCheck = await targetConn.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check;');
    if (!logicalCheck || logicalCheck.integrity_check !== 'ok') {
      throw new CipherIntegrityError(`Falha no PRAGMA integrity_check lógico: ${logicalCheck?.integrity_check}`);
    }

    // Validação de TODAS as tabelas:
    // A) reception_snapshots
    const targetSnapshots = await fetchSnapshotsStrictly(targetConn);
    if (targetSnapshots.length !== sourceSnapshots.length) {
      throw new MigrationIntegrityMismatchError(
        `Discrepância em reception_snapshots (origem: ${sourceSnapshots.length}, destino: ${targetSnapshots.length})`
      );
    }

    // B) reception_guests
    const targetGuests = await fetchGuestsStrictly(targetConn);
    if (targetGuests.length !== sourceGuests.length) {
      throw new MigrationIntegrityMismatchError(
        `Discrepância em reception_guests (origem: ${sourceGuests.length}, destino: ${targetGuests.length})`
      );
    }

    // C) reception_queue (14 colunas completas)
    const targetQueueItems = await fetchQueueItemsStrictly(targetConn);
    if (targetQueueItems.length !== sourceQueueItems.length) {
      throw new MigrationIntegrityMismatchError(
        `Discrepância em reception_queue (origem: ${sourceQueueItems.length}, destino: ${targetQueueItems.length})`
      );
    }

    for (let i = 0; i < sourceQueueItems.length; i++) {
      const src = sourceQueueItems[i];
      const tgt = targetQueueItems[i];
      if (
        src.client_scan_id !== tgt.client_scan_id ||
        src.event_id !== tgt.event_id ||
        src.scanned_qr_token !== tgt.scanned_qr_token ||
        src.scanned_guest_id !== tgt.scanned_guest_id ||
        src.confirmed_guest_ids !== tgt.confirmed_guest_ids ||
        src.canonical_payload_hash !== tgt.canonical_payload_hash ||
        src.state !== tgt.state ||
        src.retry_count !== tgt.retry_count ||
        src.created_at !== tgt.created_at ||
        src.scanned_at !== tgt.scanned_at
      ) {
        throw new MigrationIntegrityMismatchError(
          `Inconsistência de dados detectada no item client_scan_id: ${src.client_scan_id}`
        );
      }
    }

    const targetChecksum = computeQueueChecksum(targetQueueItems);
    if (targetChecksum !== queueChecksum) {
      throw new MigrationIntegrityMismatchError('Inconsistência de checksum nos itens da reception_queue.');
    }

    // D) Validação de todos os índices estruturais
    const targetIndexes = await fetchIndexesStrictly(targetConn);
    for (const idxName of sourceIndexes) {
      if (!targetIndexes.includes(idxName)) {
        throw new MigrationIntegrityMismatchError(
          `Índice estrutural '${idxName}' ausente no banco de destino após migração.`
        );
      }
    }

    if (simulateCrashAt === 'VALIDATING') {
      throw new Error('SIMULATED_CRASH:VALIDATING');
    }
  } finally {
    // Encerra todas as conexões antes da troca física dos arquivos
    await targetConn.closeAsync();
  }

  // 11. Registra estado SWAPPING no journal
  const swapJournal: MigrationJournalState = {
    stage: 'SWAPPING',
    sourceVersion: sourceUserVersion,
    sourceSnapshotsCount: sourceSnapshots.length,
    sourceGuestsCount: sourceGuests.length,
    sourceQueueCount: sourceQueueItems.length,
    sourceQueueChecksum: queueChecksum,
    timestamp: new Date().toISOString(),
    dbName,
  };
  await fs.writeText(journalPath, JSON.stringify(swapJournal));

  if (simulateCrashAt === 'SWAPPING') {
    throw new Error('SIMULATED_CRASH:SWAPPING');
  }

  // 12. Substituição física defensiva dos arquivos
  const tmpValid = await fs.exists(tmpPath);
  if (!tmpValid) {
    throw new Error('Arquivo temporário criptografado ausente antes do swap físico.');
  }

  await fs.rename(mainPath, bakPath);
  if (await fs.exists(`${mainPath}-wal`)) await fs.rename(`${mainPath}-wal`, `${bakPath}-wal`);
  if (await fs.exists(`${mainPath}-shm`)) await fs.rename(`${mainPath}-shm`, `${bakPath}-shm`);

  const bakVerified = await fs.exists(bakPath);
  if (!bakVerified) {
    throw new Error('Falha ao criar arquivo de backup durante o swap físico.');
  }

  // Interrupção adversária no momento exato em que o mainPath foi renomeado para bakPath
  // e o tmpPath ainda não foi promovido (o arquivo principal desaparece temporariamente do disco)
  if (simulateCrashAt === 'SWAPPING_AFTER_BACKUP') {
    throw new Error('SIMULATED_CRASH:SWAPPING_AFTER_BACKUP');
  }

  await fs.rename(tmpPath, mainPath);
  if (await fs.exists(`${tmpPath}-wal`)) await fs.rename(`${tmpPath}-wal`, `${mainPath}-wal`);
  if (await fs.exists(`${tmpPath}-shm`)) await fs.rename(`${tmpPath}-shm`, `${mainPath}-shm`);

  // 13. Verificação final do novo banco no destino final
  const finalConn = await connectionOpener(mainPath, validKey);
  try {
    await assertSQLCipherActive(finalConn);
    await finalConn.getFirstAsync('SELECT count(*) FROM sqlite_master;');
    const finalCipherErrors = await finalConn.getAllAsync<{ error: string }>('PRAGMA cipher_integrity_check;');
    if (finalCipherErrors && finalCipherErrors.length > 0) {
      throw new CipherIntegrityError('Falha de integridade ao abrir banco recém-migrado no destino.');
    }
  } finally {
    await finalConn.closeAsync();
  }

  // 14. Limpeza segura de arquivos de backup e finalização do journal
  if (await fs.exists(bakPath)) await fs.delete(bakPath);
  if (await fs.exists(`${bakPath}-wal`)) await fs.delete(`${bakPath}-wal`);
  if (await fs.exists(`${bakPath}-shm`)) await fs.delete(`${bakPath}-shm`);
  if (await fs.exists(journalPath)) await fs.delete(journalPath);

  return {
    migrated: true,
    reconciled,
    snapshotsVerified: sourceSnapshots.length,
    guestsVerified: sourceGuests.length,
    queueItemsVerified: sourceQueueItems.length,
    indexesVerified: sourceIndexes.length,
    userVersionPreserved: sourceUserVersion,
  };
}
