/**
 * Máquina de Estados de Migração Durável e Reconciliação do SQLite para SQLCipher
 * na Portaria Prime (reception_prime.db).
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
 * Escapa caminho e chave para uso seguro em comandos SQL PRAGMA / ATTACH.
 */
function sanitizeSqlString(input: string): string {
  return input.replace(/'/g, "''");
}

/**
 * Recupera e reconcilia estado se o app foi interrompido (SIGKILL) durante uma migração anterior.
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
  const journalExists = await fs.exists(journalPath);
  if (!journalExists) {
    return false;
  }

  let journal: MigrationJournalState;
  try {
    const raw = await fs.readText(journalPath);
    journal = JSON.parse(raw);
  } catch {
    // Arquivo de journal corrompido: remove resíduos .tmp defensivamente
    const tmpPath = `${cleanDbDir}/${dbName}.tmp`;
    if (await fs.exists(tmpPath)) await fs.delete(tmpPath);
    await fs.delete(journalPath);
    return true;
  }

  const mainPath = `${cleanDbDir}/${dbName}`;
  const tmpPath = `${cleanDbDir}/${dbName}.tmp`;
  const bakPath = `${cleanDbDir}/${dbName}.bak`;

  if (journal.stage === 'SWAPPING' || journal.stage === 'COMPLETED') {
    // Interrompido durante a substituição: avalia qual versão está ativa
    const mainExists = await fs.exists(mainPath);
    let mainIsEncryptedAndValid = false;

    if (mainExists) {
      try {
        const conn = await connectionOpener(mainPath, key);
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

    if (!mainIsEncryptedAndValid && (await fs.exists(bakPath))) {
      // O swap falhou na metade e o main está quebrado: restaura backup
      if (mainExists) await fs.delete(mainPath);
      await fs.rename(bakPath, mainPath);
      if (await fs.exists(`${bakPath}-wal`)) await fs.rename(`${bakPath}-wal`, `${mainPath}-wal`);
      if (await fs.exists(`${bakPath}-shm`)) await fs.rename(`${bakPath}-shm`, `${mainPath}-shm`);
    } else if (mainIsEncryptedAndValid) {
      // Main já está íntegro e criptografado: limpa backups residuais
      if (await fs.exists(bakPath)) await fs.delete(bakPath);
      if (await fs.exists(`${bakPath}-wal`)) await fs.delete(`${bakPath}-wal`);
      if (await fs.exists(`${bakPath}-shm`)) await fs.delete(`${bakPath}-shm`);
    }
  } else {
    // Interrompido antes do swap (ex: EXPORTING ou CHECKPOINTING_WAL):
    // Descarta .tmp e preserva o banco legado
    if (await fs.exists(tmpPath)) await fs.delete(tmpPath);
    if (await fs.exists(`${tmpPath}-wal`)) await fs.delete(`${tmpPath}-wal`);
    if (await fs.exists(`${tmpPath}-shm`)) await fs.delete(`${tmpPath}-shm`);
  }

  await fs.delete(journalPath);
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

  // 1. Reconciliação prévia de boots interrompidos
  const reconciled = await reconcileIncompleteMigration(dbDir, dbName, fs, key, connectionOpener);

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
        `Checkpoint do WAL bloqueado por leitores/escritores concorrentes (busy: ${checkpointResult.busy}).`
      );
    }

    if (simulateCrashAt === 'CHECKPOINTING_WAL') {
      throw new Error('SIMULATED_CRASH:CHECKPOINTING_WAL');
    }

    // 5. Captura versão do schema
    const versionResult = await sourceConn.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    sourceUserVersion = versionResult?.user_version ?? 0;

    // 6. Lê integralmente a tabela reception_queue para validação profunda
    try {
      queueItems = await sourceConn.getAllAsync<QueueItemRecord>(
        `SELECT client_scan_id, event_id, guest_id, action, payload, state, retry_count, created_at, error_code, error_message, synced_at
         FROM reception_queue
         ORDER BY client_scan_id ASC;`
      );
    } catch {
      // Tabela pode ainda não ter sido criada se banco legado acabou de ser instanciado
      queueItems = [];
    }

    const queueChecksum = computeQueueChecksum(queueItems);

    // 7. Grava journal com estado EXPORTING
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

    const escapedTmpPath = sanitizeSqlString(tmpPath);
    const escapedKey = sanitizeSqlString(key);

    await sourceConn.execAsync(
      `ATTACH DATABASE '${escapedTmpPath}' AS encrypted KEY '${escapedKey}';`
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
  const targetConn = await connectionOpener(tmpPath, key);
  try {
    // Migra explicitamente o user_version (já que sqlcipher_export não o copia)
    await targetConn.execAsync(`PRAGMA user_version = ${sourceUserVersion};`);

    // Validação Profunda: Verifica tabela canônica reception_queue
    let targetQueueItems: QueueItemRecord[] = [];
    try {
      targetQueueItems = await targetConn.getAllAsync<QueueItemRecord>(
        `SELECT client_scan_id, event_id, guest_id, action, payload, state, retry_count, created_at, error_code, error_message, synced_at
         FROM reception_queue
         ORDER BY client_scan_id ASC;`
      );
    } catch {
      targetQueueItems = [];
    }

    if (targetQueueItems.length !== queueItems.length) {
      throw new MigrationIntegrityMismatchError(
        `Discrepância na contagem da reception_queue (origem: ${queueItems.length}, destino: ${targetQueueItems.length})`
      );
    }

    const targetChecksum = computeQueueChecksum(targetQueueItems);
    if (targetChecksum !== computeQueueChecksum(queueItems)) {
      throw new MigrationIntegrityMismatchError('Inconsistência de checksum nos itens da reception_queue.');
    }

    // Verificação oficial da Zetetic: PRAGMA cipher_integrity_check (espera 0 linhas)
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
    sourceQueueChecksum: computeQueueChecksum(queueItems),
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
  const finalConn = await connectionOpener(mainPath, key);
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
