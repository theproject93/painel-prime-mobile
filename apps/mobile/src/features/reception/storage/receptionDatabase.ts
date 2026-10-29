import type { SQLiteDatabase } from 'expo-sqlite';

import {
  type CheckInState,
  type CreateReceptionQueueInput,
  type ReceptionEventSnapshot,
  type ReceptionGuest,
  type ReceptionQueueRow,
  type ReceptionSnapshotRow,
} from '../types/receptionTypes';
import { validateTransition } from '../engine/receptionFsm';
import { computeCanonicalPayloadHashSync } from '../engine/receptionHash';
import { autoHealInFlightOperations } from '../engine/receptionAutoHeal';

export const RECEPTION_DB_NAME = 'reception_prime.db';
const GLOBAL_RECEPTION_DB_KEY = '__painel_prime_reception_db__';

let dbInstance: SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLiteDatabase> | null = null;

/**
 * Gera UUIDv4 criptograficamente seguro com fallback via expo-crypto.
 */
export function generateUuidV4(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { randomUUID } = require('expo-crypto') as { randomUUID: () => string };
    return randomUUID();
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getRandomBytes } = require('expo-crypto') as {
        getRandomBytes: (n: number) => Uint8Array;
      };
      const bytes = getRandomBytes(16);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b: number) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    } catch {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
  }
}

/**
 * Cria ou atualiza as tabelas do SQLite na inicialização.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS reception_snapshots (
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

    CREATE TABLE IF NOT EXISTS reception_guests (
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

    CREATE INDEX IF NOT EXISTS idx_reception_guests_event ON reception_guests(event_id);
    CREATE INDEX IF NOT EXISTS idx_reception_guests_qr ON reception_guests(event_id, qr_token);
    CREATE INDEX IF NOT EXISTS idx_reception_guests_family ON reception_guests(event_id, family_group_id);

    CREATE TABLE IF NOT EXISTS reception_queue (
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

    CREATE INDEX IF NOT EXISTS idx_reception_queue_state ON reception_queue(state);
    CREATE INDEX IF NOT EXISTS idx_reception_queue_event ON reception_queue(event_id, state);
  `);
}

/**
 * Reseta ou invalida a conexão com o banco SQLite.
 */
export function invalidateDatabaseInstance(): void {
  const g = globalThis as unknown as { [GLOBAL_RECEPTION_DB_KEY]?: SQLiteDatabase };
  g[GLOBAL_RECEPTION_DB_KEY] = undefined;
  dbInstance = null;
  dbInitPromise = null;
}

/**
 * Define ou reseta a instância do banco SQLite (utilizado em testes unitários).
 */
export function setDatabaseInstanceForTesting(db: SQLiteDatabase | null): void {
  dbInstance = db;
  dbInitPromise = null;
  const g = globalThis as unknown as { [GLOBAL_RECEPTION_DB_KEY]?: SQLiteDatabase };
  g[GLOBAL_RECEPTION_DB_KEY] = db || undefined;
}

/**
 * Obtém ou inicializa a conexão com o banco SQLite local (com guard contra TOCTOU race).
 */
export async function getDatabase(dbOverride?: SQLiteDatabase): Promise<SQLiteDatabase> {
  if (dbOverride) return dbOverride;
  const g = globalThis as unknown as { [GLOBAL_RECEPTION_DB_KEY]?: SQLiteDatabase };
  if (g[GLOBAL_RECEPTION_DB_KEY]) {
    dbInstance = g[GLOBAL_RECEPTION_DB_KEY]!;
    return dbInstance;
  }
  if (dbInstance) {
    g[GLOBAL_RECEPTION_DB_KEY] = dbInstance;
    return dbInstance;
  }
  if (dbInitPromise) return dbInitPromise;
  dbInitPromise = (async () => {
    try {
      const SQLite = await import('expo-sqlite');
      const db = await SQLite.openDatabaseAsync(RECEPTION_DB_NAME, { useNewConnection: true });
      await runMigrations(db);
      dbInstance = db;
      g[GLOBAL_RECEPTION_DB_KEY] = db;
      return db;
    } finally {
      dbInitPromise = null;
    }
  })();
  return dbInitPromise;
}

/**
 * Executa uma operação contra o SQLite local com proteção e reconexão automática
 * em caso de perda de referência nativa (Hermes GC / NullPointerException no JNI).
 */
export async function withDatabase<T>(
  operation: (db: SQLiteDatabase) => Promise<T>,
  dbOverride?: SQLiteDatabase,
): Promise<T> {
  const db = await getDatabase(dbOverride);
  try {
    return await operation(db);
  } catch (error: any) {
    const errorStr = String(error?.message || error || '');
    const isNativeNpe =
      errorStr.includes('NullPointerException') ||
      errorStr.includes('NativeDatabase') ||
      errorStr.includes('prepareAsync') ||
      errorStr.includes('closed');

    if (isNativeNpe && !dbOverride) {
      console.warn('[ReceptionDb] Reconectando SQLite após erro nativo:', errorStr);
      invalidateDatabaseInstance();
      const freshDb = await getDatabase();
      return await operation(freshDb);
    }
    throw error;
  }
}

/**
 * Inicializa o banco de dados e executa a auto-cura de startup.
 */
export async function initReceptionDatabase(): Promise<{
  db: SQLiteDatabase;
  autoHealedCount: number;
}> {
  return withDatabase(async (db) => {
    const healResult = await autoHealInFlightOperations(db);
    return {
      db,
      autoHealedCount: healResult.healedCount,
    };
  });
}

/**
 * Salva ou atualiza o snapshot completo do evento e seus convidados em lotes.
 */
export async function saveSnapshot(
  snapshot: ReceptionEventSnapshot,
  dbOverride?: SQLiteDatabase,
): Promise<void> {
  return withDatabase(async (db) => {
    const now = new Date().toISOString();
    const event = snapshot.event;

    // 1. Salva metadados do snapshot
    await db.runAsync(
      `INSERT INTO reception_snapshots (
        event_id, name, event_date, status, location,
        reception_offline_expires_at, snapshot_at, raw_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id) DO UPDATE SET
        name = excluded.name,
        event_date = excluded.event_date,
        status = excluded.status,
        location = excluded.location,
        reception_offline_expires_at = excluded.reception_offline_expires_at,
        snapshot_at = excluded.snapshot_at,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at;`,
      event.id,
      event.name,
      event.event_date,
      event.status,
      event.location,
      event.reception_offline_expires_at,
      snapshot.snapshot_at || now,
      JSON.stringify(snapshot),
      now,
      now,
    );

    // 2. Salva convidados do snapshot em lotes (chunks de 50) para evitar sobrecarga de IPC/JNI
    const CHUNK_SIZE = 50;
    for (let i = 0; i < snapshot.guests.length; i += CHUNK_SIZE) {
      const chunk = snapshot.guests.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk
        .map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .join(', ');
      const params: (string | number | null)[] = [];

      for (const guest of chunk) {
        params.push(
          guest.id,
          guest.event_id || event.id,
          guest.name,
          guest.phone ?? null,
          guest.qr_token ? guest.qr_token.toLowerCase().trim() : null,
          guest.family_group_id ?? null,
          guest.is_group_leader ? 1 : 0,
          guest.group_leader_id ?? null,
          guest.group_sort_order ?? null,
          guest.checked_in_at ?? null,
          guest.checked_in_by ?? null,
          guest.table_id ?? null,
          guest.table_name ?? null,
          now,
          now,
        );
      }

      await db.runAsync(
        `INSERT INTO reception_guests (
          id, event_id, name, phone, qr_token, family_group_id,
          is_group_leader, group_leader_id, group_sort_order,
          checked_in_at, checked_in_by, table_id, table_name,
          created_at, updated_at
        ) VALUES ${placeholders}
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          phone = excluded.phone,
          qr_token = excluded.qr_token,
          family_group_id = excluded.family_group_id,
          is_group_leader = excluded.is_group_leader,
          group_leader_id = excluded.group_leader_id,
          group_sort_order = excluded.group_sort_order,
          checked_in_at = COALESCE(excluded.checked_in_at, reception_guests.checked_in_at),
          checked_in_by = COALESCE(excluded.checked_in_by, reception_guests.checked_in_by),
          table_id = excluded.table_id,
          table_name = excluded.table_name,
          updated_at = excluded.updated_at;`,
        ...params,
      );
    }
  }, dbOverride);
}

/**
 * Consulta snapshot salvo por event_id.
 */
export async function getSnapshot(
  eventId: string,
  dbOverride?: SQLiteDatabase,
): Promise<ReceptionSnapshotRow | null> {
  return withDatabase(async (db) => {
    return db.getFirstAsync<ReceptionSnapshotRow>(
      `SELECT * FROM reception_snapshots WHERE event_id = ?;`,
      eventId,
    );
  }, dbOverride);
}

/**
 * Localiza convidado por QR Token dentro do escopo do evento.
 */
export async function findGuestByQrToken(
  eventId: string,
  qrToken: string,
  dbOverride?: SQLiteDatabase,
): Promise<ReceptionGuest | null> {
  return withDatabase(async (db) => {
    const normalizedToken = qrToken.toLowerCase().trim();

    const row = await db.getFirstAsync<{
      id: string;
      event_id: string;
      name: string;
      phone: string | null;
      qr_token: string | null;
      family_group_id: string | null;
      is_group_leader: number;
      group_leader_id: string | null;
      group_sort_order: number | null;
      checked_in_at: string | null;
      checked_in_by: string | null;
      table_id: string | null;
      table_name: string | null;
    }>(
      `SELECT * FROM reception_guests WHERE event_id = ? AND qr_token = ?;`,
      eventId,
      normalizedToken,
    );

    if (!row) return null;

    return {
      ...row,
      is_group_leader: Boolean(row.is_group_leader),
    };
  }, dbOverride);
}

/**
 * Localiza convidado por ID dentro do escopo do evento.
 */
export async function findGuestById(
  eventId: string,
  guestId: string,
  dbOverride?: SQLiteDatabase,
): Promise<ReceptionGuest | null> {
  return withDatabase(async (db) => {
    const row = await db.getFirstAsync<{
      id: string;
      event_id: string;
      name: string;
      phone: string | null;
      qr_token: string | null;
      family_group_id: string | null;
      is_group_leader: number;
      group_leader_id: string | null;
      group_sort_order: number | null;
      checked_in_at: string | null;
      checked_in_by: string | null;
      table_id: string | null;
      table_name: string | null;
    }>(
      `SELECT * FROM reception_guests WHERE event_id = ? AND id = ?;`,
      eventId,
      guestId,
    );

    if (!row) return null;

    return {
      ...row,
      is_group_leader: Boolean(row.is_group_leader),
    };
  }, dbOverride);
}

/**
 * Retorna todos os membros de um grupo familiar no evento.
 */
export async function getFamilyGroupMembers(
  eventId: string,
  familyGroupId: string,
  dbOverride?: SQLiteDatabase,
): Promise<ReceptionGuest[]> {
  return withDatabase(async (db) => {
    const rows = await db.getAllAsync<{
      id: string;
      event_id: string;
      name: string;
      phone: string | null;
      qr_token: string | null;
      family_group_id: string | null;
      is_group_leader: number;
      group_leader_id: string | null;
      group_sort_order: number | null;
      checked_in_at: string | null;
      checked_in_by: string | null;
      table_id: string | null;
      table_name: string | null;
    }>(
      `SELECT * FROM reception_guests
       WHERE event_id = ? AND family_group_id = ?
       ORDER BY is_group_leader DESC, group_sort_order ASC, name ASC;`,
      eventId,
      familyGroupId,
    );

    return rows.map((r) => ({
      ...r,
      is_group_leader: Boolean(r.is_group_leader),
    }));
  }, dbOverride);
}

/**
 * Retorna todos os convidados de um evento do banco SQLite local.
 */
export async function getAllGuestsForEvent(
  eventId: string,
  dbOverride?: SQLiteDatabase,
): Promise<ReceptionGuest[]> {
  return withDatabase(async (db) => {
    const rows = await db.getAllAsync<{
      id: string;
      event_id: string;
      name: string;
      phone: string | null;
      qr_token: string | null;
      family_group_id: string | null;
      is_group_leader: number;
      group_leader_id: string | null;
      group_sort_order: number | null;
      checked_in_at: string | null;
      checked_in_by: string | null;
      table_id: string | null;
      table_name: string | null;
    }>(
      `SELECT * FROM reception_guests
       WHERE event_id = ?
       ORDER BY (checked_in_at IS NOT NULL) ASC, name ASC;`,
      eventId,
    );

    return rows.map((r) => ({
      ...r,
      is_group_leader: Boolean(r.is_group_leader),
    }));
  }, dbOverride);
}

/**
 * Retorna estatísticas de presença do evento a partir do SQLite local.
 */
export async function getReceptionStats(
  eventId: string,
  dbOverride?: SQLiteDatabase,
): Promise<{ total: number; checkedIn: number }> {
  return withDatabase(async (db) => {
    const row = await db.getFirstAsync<{ total: number; checkedIn: number }>(
      `SELECT 
         COUNT(*) as total,
         COUNT(checked_in_at) as checkedIn
       FROM reception_guests
       WHERE event_id = ?;`,
      eventId,
    );
    return {
      total: row?.total || 0,
      checkedIn: row?.checkedIn || 0,
    };
  }, dbOverride);
}

/**
 * Busca convidados por nome ou telefone no evento (escapando curingas LIKE).
 */
export async function searchGuests(
  eventId: string,
  query: string,
  dbOverride?: SQLiteDatabase,
): Promise<ReceptionGuest[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return getAllGuestsForEvent(eventId, dbOverride);
  }

  return withDatabase(async (db) => {
    const escaped = trimmed.replace(/[\\_%]/g, '\\$&');
    const term = `%${escaped}%`;
    const rows = await db.getAllAsync<{
      id: string;
      event_id: string;
      name: string;
      phone: string | null;
      qr_token: string | null;
      family_group_id: string | null;
      is_group_leader: number;
      group_leader_id: string | null;
      group_sort_order: number | null;
      checked_in_at: string | null;
      checked_in_by: string | null;
      table_id: string | null;
      table_name: string | null;
    }>(
      `SELECT * FROM reception_guests
       WHERE event_id = ? AND (name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR table_name LIKE ? ESCAPE '\\')
       ORDER BY (checked_in_at IS NOT NULL) ASC, name ASC LIMIT 60;`,
      eventId,
      term,
      term,
      term,
    );

    return rows.map((r) => ({
      ...r,
      is_group_leader: Boolean(r.is_group_leader),
    }));
  }, dbOverride);
}

/**
 * Enfileira uma operação durável de check-in na reception_queue local.
 * Grava antes de atualizar a UI.
 */
export async function enqueueCheckIn(
  input: CreateReceptionQueueInput,
  dbOverride?: SQLiteDatabase,
): Promise<ReceptionQueueRow> {
  return withDatabase(async (db) => {
    const scanId = input.client_scan_id || input.clientScanId || generateUuidV4();
    const scannedAt = input.scanned_at || new Date().toISOString();
    const now = new Date().toISOString();

    const canonicalHash =
      input.canonical_payload_hash ||
      computeCanonicalPayloadHashSync({
        client_scan_id: scanId,
        scanned_qr_token: input.scanned_qr_token ?? null,
        scanned_guest_id: input.scanned_guest_id ?? null,
        confirmed_guest_ids: input.confirmed_guest_ids,
      });

    const serializedConfirmed = JSON.stringify(input.confirmed_guest_ids);

    // 1. Grava na fila de operações duráveis
    await db.runAsync(
      `INSERT INTO reception_queue (
        client_scan_id, event_id, scanned_qr_token, scanned_guest_id,
        confirmed_guest_ids, canonical_payload_hash, state,
        retry_count, created_at, scanned_at, synced_at,
        error_code, error_message, server_response
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, NULL, NULL, NULL, NULL);`,
      scanId,
      input.event_id,
      input.scanned_qr_token ?? null,
      input.scanned_guest_id ?? null,
      serializedConfirmed,
      canonicalHash,
      now,
      scannedAt,
    );

    // 2. Atualiza status local nos convidados para resposta visual imediata
    for (const guestId of input.confirmed_guest_ids) {
      await db.runAsync(
        `UPDATE reception_guests
         SET checked_in_at = COALESCE(checked_in_at, ?),
             checked_in_by = COALESCE(checked_in_by, 'Portaria Nativa')
         WHERE id = ?;`,
        scannedAt,
        guestId,
      );
    }

    return {
      client_scan_id: scanId,
      event_id: input.event_id,
      scanned_qr_token: input.scanned_qr_token ?? null,
      scanned_guest_id: input.scanned_guest_id ?? null,
      confirmed_guest_ids: input.confirmed_guest_ids,
      canonical_payload_hash: canonicalHash,
      state: 'pending',
      retry_count: 0,
      created_at: now,
      scanned_at: scannedAt,
      synced_at: null,
      error_code: null,
      error_message: null,
      server_response: null,
    };
  }, dbOverride);
}

/**
 * Retorna operações pendentes de sincronização (ou in_flight / needs_attention).
 */
export async function getPendingQueue(
  eventId?: string,
  dbOverride?: SQLiteDatabase,
): Promise<ReceptionQueueRow[]> {
  return withDatabase(async (db) => {
    const query = eventId
      ? `SELECT * FROM reception_queue
         WHERE event_id = ? AND state IN ('pending', 'in_flight', 'needs_attention')
         ORDER BY created_at ASC;`
      : `SELECT * FROM reception_queue
         WHERE state IN ('pending', 'in_flight', 'needs_attention')
         ORDER BY created_at ASC;`;

    const params = eventId ? [eventId] : [];
    const rows = await db.getAllAsync<any>(query, ...params);

    return rows.map(mapQueueRow);
  }, dbOverride);
}

/**
 * Atualiza o estado de uma operação na fila respeitando a FSM.
 */
export async function updateQueueState(
  clientScanId: string,
  newState: CheckInState,
  details?: {
    synced_at?: string | null;
    error_code?: string | null;
    error_message?: string | null;
    server_response?: Record<string, unknown> | null;
  },
  dbOverride?: SQLiteDatabase,
): Promise<void> {
  return withDatabase(async (db) => {
    const existing = await db.getFirstAsync<{ state: CheckInState }>(
      `SELECT state FROM reception_queue WHERE client_scan_id = ?;`,
      clientScanId,
    );

    if (!existing) {
      throw new Error(`Operação ${clientScanId} não encontrada na fila SQLite.`);
    }

    // Valida regras da máquina de estados
    validateTransition(existing.state, newState);

    const syncedAt = details?.synced_at ?? null;
    const errorCode = details?.error_code ?? null;
    const errorMessage = details?.error_message ?? null;
    const serverResponse = details?.server_response ? JSON.stringify(details.server_response) : null;

    await db.runAsync(
      `UPDATE reception_queue
       SET state = ?,
           synced_at = COALESCE(?, synced_at),
           error_code = ?,
           error_message = ?,
           server_response = ?
       WHERE client_scan_id = ?;`,
      newState,
      syncedAt,
      errorCode,
      errorMessage,
      serverResponse,
      clientScanId,
    );
  }, dbOverride);
}

/**
 * Marca uma lista de IDs como 'in_flight' antes do envio à RPC.
 */
export async function markQueueItemsInFlight(
  clientScanIds: string[],
  dbOverride?: SQLiteDatabase,
): Promise<void> {
  if (clientScanIds.length === 0) return;
  for (const scanId of clientScanIds) {
    await updateQueueState(scanId, 'in_flight', undefined, dbOverride);
  }
}

/**
 * Atualiza o status de check-in de uma lista de convidados no SQLite local.
 */
export async function updateGuestCheckedInStatus(
  guestIds: string[],
  checkedInAt: string,
  checkedInBy?: string | null,
  dbOverride?: SQLiteDatabase,
): Promise<void> {
  if (guestIds.length === 0) return;
  return withDatabase(async (db) => {
    for (const guestId of guestIds) {
      await db.runAsync(
        `UPDATE reception_guests
         SET checked_in_at = COALESCE(?, checked_in_at),
             checked_in_by = COALESCE(?, checked_in_by)
         WHERE id = ?;`,
        checkedInAt,
        checkedInBy ?? 'Portaria Nativa',
        guestId,
      );
    }
  }, dbOverride);
}

/**
 * Marca como 'needs_attention' operações que atingiram ou excederam o limite de retries no SQLite local.
 */
export async function markQueueItemsNeedsAttention(
  maxRetries: number,
  eventId?: string,
  errorMessage?: string,
  dbOverride?: SQLiteDatabase,
): Promise<number> {
  return withDatabase(async (db) => {
    const msg = errorMessage || 'Limite de tentativas de sincronização excedido.';
    const query = eventId
      ? `UPDATE reception_queue
         SET state = 'needs_attention',
             error_code = COALESCE(error_code, 'max_retries_exceeded'),
             error_message = ?
         WHERE retry_count >= ? AND state = 'pending' AND event_id = ?;`
      : `UPDATE reception_queue
         SET state = 'needs_attention',
             error_code = COALESCE(error_code, 'max_retries_exceeded'),
             error_message = ?
         WHERE retry_count >= ? AND state = 'pending';`;
    const params = eventId ? [msg, maxRetries, eventId] : [msg, maxRetries];
    const result = await db.runAsync(query, ...params);
    return typeof result?.changes === 'number' ? result.changes : 0;
  }, dbOverride);
}

function mapQueueRow(row: any): ReceptionQueueRow {
  let confirmedIds: string[] = [];
  try {
    confirmedIds = typeof row.confirmed_guest_ids === 'string'
      ? JSON.parse(row.confirmed_guest_ids)
      : row.confirmed_guest_ids || [];
  } catch {
    confirmedIds = [];
  }

  let serverResp: Record<string, unknown> | null = null;
  if (row.server_response) {
    try {
      serverResp = typeof row.server_response === 'string'
        ? JSON.parse(row.server_response)
        : row.server_response;
    } catch {
      serverResp = null;
    }
  }

  return {
    client_scan_id: row.client_scan_id,
    event_id: row.event_id,
    scanned_qr_token: row.scanned_qr_token,
    scanned_guest_id: row.scanned_guest_id,
    confirmed_guest_ids: confirmedIds,
    canonical_payload_hash: row.canonical_payload_hash,
    state: row.state as CheckInState,
    retry_count: Number(row.retry_count || 0),
    created_at: row.created_at,
    scanned_at: row.scanned_at,
    synced_at: row.synced_at,
    error_code: row.error_code,
    error_message: row.error_message,
    server_response: serverResp,
  };
}
