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

let dbInstance: SQLiteDatabase | null = null;

/**
 * Gera UUIDv4 criptograficamente seguro com fallback compatível com Hermes/Node.
 */
export function generateUuidV4(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
 * Define ou reseta a instância do banco SQLite (utilizado em testes unitários).
 */
export function setDatabaseInstanceForTesting(db: SQLiteDatabase | null): void {
  dbInstance = db;
}

/**
 * Obtém ou inicializa a conexão com o banco SQLite local.
 */
export async function getDatabase(dbOverride?: SQLiteDatabase): Promise<SQLiteDatabase> {
  if (dbOverride) return dbOverride;
  if (dbInstance) return dbInstance;
  const SQLite = await import('expo-sqlite');
  const db = await SQLite.openDatabaseAsync(RECEPTION_DB_NAME);
  await runMigrations(db);
  dbInstance = db;
  return db;
}

/**
 * Inicializa o banco de dados e executa a auto-cura de startup.
 */
export async function initReceptionDatabase(): Promise<{
  db: SQLiteDatabase;
  autoHealedCount: number;
}> {
  const db = await getDatabase();
  const healResult = await autoHealInFlightOperations(db);
  return {
    db,
    autoHealedCount: healResult.healedCount,
  };
}

/**
 * Salva ou atualiza o snapshot completo do evento e seus convidados.
 */
export async function saveSnapshot(
  snapshot: ReceptionEventSnapshot,
  dbOverride?: SQLiteDatabase,
): Promise<void> {
  const db = await getDatabase(dbOverride);
  const now = new Date().toISOString();
  const event = snapshot.event;

  await db.withTransactionAsync(async () => {
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

    // 2. Salva convidados do snapshot
    for (const guest of snapshot.guests) {
      await db.runAsync(
        `INSERT INTO reception_guests (
          id, event_id, name, phone, qr_token, family_group_id,
          is_group_leader, group_leader_id, group_sort_order,
          checked_in_at, checked_in_by, table_id, table_name,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  });
}

/**
 * Consulta snapshot salvo por event_id.
 */
export async function getSnapshot(
  eventId: string,
  dbOverride?: SQLiteDatabase,
): Promise<ReceptionSnapshotRow | null> {
  const db = await getDatabase(dbOverride);
  return db.getFirstAsync<ReceptionSnapshotRow>(
    `SELECT * FROM reception_snapshots WHERE event_id = ?;`,
    eventId,
  );
}

/**
 * Localiza convidado por QR Token dentro do escopo do evento.
 */
export async function findGuestByQrToken(
  eventId: string,
  qrToken: string,
): Promise<ReceptionGuest | null> {
  const db = await getDatabase();
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
}

/**
 * Localiza convidado por ID dentro do escopo do evento.
 */
export async function findGuestById(
  eventId: string,
  guestId: string,
): Promise<ReceptionGuest | null> {
  const db = await getDatabase();
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
}

/**
 * Retorna todos os membros de um grupo familiar no evento.
 */
export async function getFamilyGroupMembers(
  eventId: string,
  familyGroupId: string,
): Promise<ReceptionGuest[]> {
  const db = await getDatabase();
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
}

/**
 * Busca convidados por nome no evento.
 */
export async function searchGuests(eventId: string, query: string): Promise<ReceptionGuest[]> {
  const db = await getDatabase();
  const term = `%${query.trim()}%`;
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
     WHERE event_id = ? AND name LIKE ?
     ORDER BY name ASC LIMIT 50;`,
    eventId,
    term,
  );

  return rows.map((r) => ({
    ...r,
    is_group_leader: Boolean(r.is_group_leader),
  }));
}

/**
 * Enfileira uma operação durável de check-in na reception_queue local.
 * Grava atomicamente ANTES de atualizar a UI.
 */
export async function enqueueCheckIn(
  input: CreateReceptionQueueInput,
): Promise<ReceptionQueueRow> {
  const db = await getDatabase();
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

  await db.withTransactionAsync(async () => {
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

    // 2. Atualiza status local nos convidados para resposta visual imediata (otimista)
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
  });

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
}

/**
 * Retorna operações pendentes de sincronização (ou in_flight / needs_attention).
 */
export async function getPendingQueue(
  eventId?: string,
  dbOverride?: SQLiteDatabase,
): Promise<ReceptionQueueRow[]> {
  const db = await getDatabase(dbOverride);
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
  const db = await getDatabase(dbOverride);
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
  const db = await getDatabase(dbOverride);
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
  const db = await getDatabase(dbOverride);
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
