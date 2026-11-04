/**
 * Máquina de Estados de Migração Durável e Reconciliação do SQLite para SQLCipher
 * na Portaria Prime (reception_prime.db).
 * Validação profunda com o esquema real da tabela reception_queue (14 colunas).
 */

import type {
  IFileSystem,
  ISqliteConnection,
  MigrationJournalState,
  MigrationStage,
  QueueItemRecord,
} from './receptionDatabaseTypes.ts';
import {
  CipherIntegrityError,
  MigrationIntegrityMismatchError,
  SQLCipherNativeMissingError,
  WalCheckpointBusyError,
} from './receptionDatabaseTypes.ts';
import { validateHexKey } from './receptionDatabaseKeyManager.ts';

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
  queueItemsVerified: number;
  userVersionPreserved: number;
}

/**
 * Consulta canônica da tabela reception_queue utilizando exatamente os 14 campos do esquema real.
 */
export const RECEPTION_QUEUE_SELECT_SQL = `
  SELECT client_scan_id, event_id, scanned_qr_token, scanned_guest_id,
         confirmed_guest_ids, canonical_payload_hash, state, retry_count,
         created_at, scanned_at, synced_at, error_code, error_message, server_response
  FROM reception_queue
  ORDER BY client_scan_id ASC;
`.trim();

/**
 * Calcula checksum determinístico simples de lista de itens da fila.
 */
export function computeQueueChecksum(items: QueueItemRecord[]): string {
  let hash = 0;
  const str = JSON.stringify(items);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(16);
}

/**
 * Lê os itens da fila de forma estrita, falhando abertamente caso ocorra erro SQL quando a tabela existir.
 */
async function fetchQueueItemsStrictly(conn: ISqliteConnection): Promise<QueueItemRecord[]> {
  const tableCheck = await conn.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='reception_queue';"
  );
  if (!tableCheck || !tableCheck.name) {
    // Tabela ainda não existe no banco
    return [];
  }

  // A tabela existe: executa consulta obrigatória SEM mascarar exceções
  return await conn.getAllAsync<QueueItemRecord>(RECEPTION_QUEUE_SELECT_SQL);
}

/**
 * Reconcilia e recupera o estado caso o aplicativo tenha sido interrompido (SIGKILL)
 * durante uma migração anterior. Examina fisicamente os arquivos em disco.
 */
export async function reconcileIncompleteMigration(
  dbDir: string,
  dbName: string,
  fs: IFileSystem,
  key: string,
  connectionOpener: (fullPath: string, key?: string) => Promise<ISqliteConnection>
): Promise<boolean> {
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

  // 1. Testa se o banco principal 'reception_prime.db' já está cifrado e 100% íntegro
  let mainIsEncryptedAndValid = false;
  if (mainExists) {
    try {
      const validKey = validateHexKey(key);
      const conn = await connectionOpener(mainPath, validKey);
      try {
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
    // O banco principal já é a versão criptografada e está saudável
    if (bakExists) await fs.delete(bakPath);
    if (await fs.exists(`${bakPath}-wal`)) await fs.delete(`${bakPath}-wal`);
    if (await fs.exists(`${bakPath}-shm`)) await fs.delete(`${bakPath}-shm`);
    if (tmpExists) await fs.delete(tmpPath);
    if (await fs.exists(`${tmpPath}-wal`)) await fs.delete(`${tmpPath}-wal`);
    if (await fs.exists(`${tmpPath}-shm`)) await fs.delete(`${tmpPath}-shm`);
    if (journalExists) await fs.delete(journalPath);
    return true;
  }

  // 2. Se o main NÃO é válido, mas o backup legado (.bak) existe, restaura o backup imediatamente
  if (bakExists) {
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
  }

  // 3. Se foi interrompido antes do swap, descarta o .tmp e mantém o banco legado intacto
  if (tmpExists) await fs.delete(tmpPath);
  if (await fs.exists(`${tmpPath}-wal`)) await fs.delete(`${tmpPath}-wal`);
  if (await fs.exists(`${tmpPath}-shm`)) await fs.delete(`${tmpPath}-shm`);
  if (journalExists) await fs.delete(journalPath);

  return true;
}

/**
 * Executa a migração do banco legado em texto claro para SQLCipher garantindo zero perda de dados.
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

  // 2. Validação obrigatória de suporte ao SQLCipher no binário
  const probeConn = await connectionOpener(mainPath);
  try {
    const cipherVersion = await probeConn.getFirstAsync<{ cipher_version?: string; 'cipher_version()'?: string }>(
      'PRAGMA cipher_version;'
    );
    const ver = cipherVersion?.cipher_version ?? cipherVersion?.['cipher_version()'];
    if (!ver || typeof ver !== 'string' || ver.trim().length === 0) {
      throw new SQLCipherNativeMissingError();
    }
  } finally {
    await probeConn.closeAsync();
  }

  // 3. Abre conexão de origem (banco legado) mantendo bloqueio de escritas
  const sourceConn = await connectionOpener(mainPath);

  let sourceUserVersion = 0;
  let queueItems: QueueItemRecord[] = [];
  let queueChecksum = '';

  try {
    // 4. Executa checkpoint estrito do WAL
    // PRAGMA wal_checkpoint(TRUNCATE) retorna busy, log, checkpointed
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

    // 6. Lê estritamente a tabela reception_queue com as 14 colunas reais
    queueItems = await fetchQueueItemsStrictly(sourceConn);
    queueChecksum = computeQueueChecksum(queueItems);

    // 7. Grava journal durável com estado EXPORTING
    const journal: MigrationJournalState = {
      stage: 'EXPORTING',
      sourceVersion: sourceUserVersion,
      sourceQueueCount: queueItems.length,
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

    const escapedTmpPath = tmpPath.replace(/'/g, "''");

    await sourceConn.execAsync(
      `ATTACH DATABASE '${escapedTmpPath}' AS encrypted KEY '${validKey}';`
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
    // Migra explicitamente o user_version
    await targetConn.execAsync(`PRAGMA user_version = ${sourceUserVersion};`);

    // Validação Profunda: Verifica tabela canônica reception_queue campo a campo
    const targetQueueItems = await fetchQueueItemsStrictly(targetConn);

    if (targetQueueItems.length !== queueItems.length) {
      throw new MigrationIntegrityMismatchError(
        `Discrepância na contagem da reception_queue (origem: ${queueItems.length}, destino: ${targetQueueItems.length})`
      );
    }

    // Validação profunda linha a linha
    for (let i = 0; i < queueItems.length; i++) {
      const src = queueItems[i];
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
    sourceQueueCount: queueItems.length,
    sourceQueueChecksum: queueChecksum,
    timestamp: new Date().toISOString(),
    dbName,
  };
  await fs.writeText(journalPath, JSON.stringify(swapJournal));

  if (simulateCrashAt === 'SWAPPING') {
    throw new Error('SIMULATED_CRASH:SWAPPING');
  }

  // 12. Substituição física defensiva dos arquivos
  await fs.rename(mainPath, bakPath);
  if (await fs.exists(`${mainPath}-wal`)) await fs.rename(`${mainPath}-wal`, `${bakPath}-wal`);
  if (await fs.exists(`${mainPath}-shm`)) await fs.rename(`${mainPath}-shm`, `${bakPath}-shm`);

  await fs.rename(tmpPath, mainPath);
  if (await fs.exists(`${tmpPath}-wal`)) await fs.rename(`${tmpPath}-wal`, `${mainPath}-wal`);
  if (await fs.exists(`${tmpPath}-shm`)) await fs.rename(`${tmpPath}-shm`, `${mainPath}-shm`);

  // 13. Verificação final do novo banco no destino final
  const finalConn = await connectionOpener(mainPath, validKey);
  try {
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
    queueItemsVerified: queueItems.length,
    userVersionPreserved: sourceUserVersion,
  };
}
