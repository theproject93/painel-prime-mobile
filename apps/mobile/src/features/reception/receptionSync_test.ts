import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import type { SQLiteDatabase, SQLiteRunResult } from 'expo-sqlite';
import {
  syncReceptionQueue,
  downloadAndSaveEventSnapshot,
  startQueueSyncWatcher,
} from './sync/receptionSyncService';
import {
  type CheckInState,
  type ReceptionEventSnapshot,
  type ReceptionGuest,
  type ReceptionQueueRow,
  type ReceptionSnapshotRow,
  type ApplyReceptionResult,
} from './types/receptionTypes';
import {
  setDatabaseInstanceForTesting,
  enqueueCheckIn,
  getPendingQueue,
  updateGuestCheckedInStatus,
} from './storage/receptionDatabase';

/**
 * Banco de dados SQLite em memória com comportamento de tabela idêntico ao SQLite real.
 */
class InMemoryReceptionDb implements SQLiteDatabase {
  public queue = new Map<string, ReceptionQueueRow>();
  public guests = new Map<string, ReceptionGuest>();
  public snapshots = new Map<string, ReceptionSnapshotRow>();

  async execAsync(_source: string): Promise<void> {
    // Migrações no-op em memória
  }

  async withTransactionAsync<T>(task: () => Promise<T>): Promise<T> {
    return await task();
  }

  async closeAsync(): Promise<void> {
    this.queue.clear();
    this.guests.clear();
    this.snapshots.clear();
  }

  async eachAsync<T>(_source: string, _params: unknown[], _callback: (row: T) => void): Promise<void> {}

  async runAsync(source: string, ...params: unknown[]): Promise<SQLiteRunResult> {
    const trimmed = source.trim();

    // 1. INSERT INTO reception_queue
    if (trimmed.startsWith('INSERT INTO reception_queue')) {
      const [
        client_scan_id,
        event_id,
        scanned_qr_token,
        scanned_guest_id,
        confirmed_guest_ids_json,
        canonical_payload_hash,
        now,
        scanned_at,
      ] = params as [string, string, string | null, string | null, string, string, string, string];

      const confirmedIds = JSON.parse(confirmed_guest_ids_json || '[]');
      this.queue.set(client_scan_id, {
        client_scan_id,
        event_id,
        scanned_qr_token: scanned_qr_token || null,
        scanned_guest_id: scanned_guest_id || null,
        confirmed_guest_ids: confirmedIds,
        canonical_payload_hash,
        state: 'pending',
        retry_count: 0,
        created_at: now,
        scanned_at: scanned_at,
        synced_at: null,
        error_code: null,
        error_message: null,
        server_response: null,
      });
      return { changes: 1, lastInsertRowId: 1 };
    }

    // 2. UPDATE reception_queue SET state = ?, synced_at = ... WHERE client_scan_id = ?
    if (trimmed.startsWith('UPDATE reception_queue') && trimmed.includes('WHERE client_scan_id = ?')) {
      const [state, synced_at, error_code, error_message, server_response_json, client_scan_id] =
        params as [CheckInState, string | null, string | null, string | null, string | null, string];

      const row = this.queue.get(client_scan_id);
      if (row) {
        row.state = state;
        if (synced_at) row.synced_at = synced_at;
        row.error_code = error_code;
        row.error_message = error_message;
        if (server_response_json) {
          row.server_response = JSON.parse(server_response_json);
        }
        return { changes: 1, lastInsertRowId: 1 };
      }
      return { changes: 0, lastInsertRowId: 0 };
    }

    // 3. AUTO HEAL: UPDATE reception_queue SET state = 'pending', retry_count = retry_count + 1 WHERE state = 'in_flight'
    if (trimmed.includes("SET state = 'pending'") && trimmed.includes("WHERE state = 'in_flight'")) {
      let changes = 0;
      for (const row of this.queue.values()) {
        if (row.state === 'in_flight') {
          row.state = 'pending';
          row.retry_count += 1;
          changes += 1;
        }
      }
      return { changes, lastInsertRowId: 0 };
    }

    // 4. NEEDS_ATTENTION: UPDATE reception_queue SET state = 'needs_attention' WHERE retry_count >= ? AND state = 'pending'
    if (trimmed.includes("state = 'needs_attention'") && trimmed.includes('retry_count >=')) {
      const [msg, maxRetries] = params as [string, number, ...unknown[]];
      let changes = 0;
      for (const row of this.queue.values()) {
        if (row.state === 'pending' && row.retry_count >= maxRetries) {
          row.state = 'needs_attention';
          row.error_code = 'max_retries_exceeded';
          row.error_message = msg;
          changes += 1;
        }
      }
      return { changes, lastInsertRowId: 0 };
    }

    // 5. RESET NEEDS_ATTENTION: UPDATE reception_queue SET state = 'pending' WHERE state = 'needs_attention'
    if (trimmed.includes("state = 'pending'") && trimmed.includes("state = 'needs_attention'")) {
      let changes = 0;
      for (const row of this.queue.values()) {
        if (row.state === 'needs_attention') {
          row.state = 'pending';
          row.error_code = null;
          row.error_message = null;
          changes += 1;
        }
      }
      return { changes, lastInsertRowId: 0 };
    }

    // 6. UPDATE reception_guests SET checked_in_at = ..., checked_in_by = ... WHERE id = ?
    if (trimmed.startsWith('UPDATE reception_guests')) {
      const [checkedInAt, checkedInBy, guestId] = params as [string, string, string];
      const g = this.guests.get(guestId);
      if (g) {
        g.checked_in_at = checkedInAt || g.checked_in_at;
        g.checked_in_by = checkedInBy || g.checked_in_by;
        return { changes: 1, lastInsertRowId: 1 };
      }
      return { changes: 0, lastInsertRowId: 0 };
    }

    // 7. INSERT INTO reception_snapshots
    if (trimmed.startsWith('INSERT INTO reception_snapshots')) {
      const [
        event_id,
        name,
        event_date,
        status,
        location,
        reception_offline_expires_at,
        snapshot_at,
        raw_json,
        created_at,
        updated_at,
      ] = params as [string, string, string, string, string | null, string | null, string, string, string, string];

      this.snapshots.set(event_id, {
        event_id,
        name,
        event_date,
        status,
        location,
        reception_offline_expires_at,
        snapshot_at,
        raw_json,
        created_at,
        updated_at,
      });
      return { changes: 1, lastInsertRowId: 1 };
    }

    // 8. INSERT INTO reception_guests
    if (trimmed.startsWith('INSERT INTO reception_guests')) {
      const [
        id,
        event_id,
        name,
        phone,
        qr_token,
        family_group_id,
        is_group_leader,
        group_leader_id,
        group_sort_order,
        checked_in_at,
        checked_in_by,
        table_id,
        table_name,
      ] = params as [
        string,
        string,
        string,
        string | null,
        string | null,
        string | null,
        number,
        string | null,
        number | null,
        string | null,
        string | null,
        string | null,
        string | null,
      ];

      this.guests.set(id, {
        id,
        event_id,
        name,
        phone,
        qr_token,
        family_group_id,
        is_group_leader: Boolean(is_group_leader),
        group_leader_id,
        group_sort_order,
        checked_in_at,
        checked_in_by,
        table_id,
        table_name,
      });
      return { changes: 1, lastInsertRowId: 1 };
    }

    return { changes: 0, lastInsertRowId: 0 };
  }

  async getFirstAsync<T = unknown>(source: string, ...params: unknown[]): Promise<T | null> {
    const trimmed = source.trim();

    if (trimmed.includes('FROM reception_queue WHERE client_scan_id = ?')) {
      const scanId = params[0] as string;
      const row = this.queue.get(scanId);
      if (!row) return null;
      return {
        ...row,
        confirmed_guest_ids: JSON.stringify(row.confirmed_guest_ids),
        server_response: row.server_response ? JSON.stringify(row.server_response) : null,
      } as unknown as T;
    }

    if (trimmed.includes('FROM reception_snapshots WHERE event_id = ?')) {
      const eventId = params[0] as string;
      const snap = this.snapshots.get(eventId);
      return (snap || null) as unknown as T;
    }

    if (trimmed.includes('FROM reception_guests WHERE event_id = ? AND qr_token = ?')) {
      const [eventId, token] = params as [string, string];
      for (const g of this.guests.values()) {
        if (g.event_id === eventId && g.qr_token === token) {
          return {
            ...g,
            is_group_leader: g.is_group_leader ? 1 : 0,
          } as unknown as T;
        }
      }
      return null;
    }

    if (trimmed.includes('FROM reception_guests WHERE event_id = ? AND id = ?')) {
      const [eventId, id] = params as [string, string];
      const g = this.guests.get(id);
      if (g && g.event_id === eventId) {
        return {
          ...g,
          is_group_leader: g.is_group_leader ? 1 : 0,
        } as unknown as T;
      }
      return null;
    }

    return null;
  }

  async getAllAsync<T = unknown>(source: string, ...params: unknown[]): Promise<T[]> {
    const trimmed = source.trim();

    if (trimmed.includes('FROM reception_queue')) {
      const eventId = params.length > 0 ? (params[0] as string) : undefined;
      const allowedStates = ['pending', 'in_flight', 'needs_attention'];
      const filtered = Array.from(this.queue.values()).filter((r) => {
        if (eventId && r.event_id !== eventId) return false;
        return allowedStates.includes(r.state);
      });

      return filtered.map((r) => ({
        ...r,
        confirmed_guest_ids: JSON.stringify(r.confirmed_guest_ids),
        server_response: r.server_response ? JSON.stringify(r.server_response) : null,
      })) as unknown as T[];
    }

    return [];
  }
}

/**
 * Cria mock do Supabase client para controlar respostas da RPC
 */
function createMockSupabase(
  rpcHandler: (fnName: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>,
) {
  return {
    rpc: rpcHandler,
  };
}

describe('Milestone 4 — Queue Sync & Integration (receptionSyncService)', () => {
  let db: InMemoryReceptionDb;
  const eventId = 'evt-wedding-2026';
  const guest1Id = 'guest-0000-0001';
  const guest2Id = 'guest-0000-0002';

  beforeEach(() => {
    db = new InMemoryReceptionDb();
    setDatabaseInstanceForTesting(db);

    // Semeia 2 convidados no banco
    db.guests.set(guest1Id, {
      id: guest1Id,
      event_id: eventId,
      name: 'Arthur Pendelton',
      qr_token: 'token-arthur',
      family_group_id: 'fam-pendelton',
      is_group_leader: true,
      group_leader_id: null,
      checked_in_at: null,
      checked_in_by: null,
      table_id: 'tab-1',
      table_name: 'Mesa Real',
    });

    db.guests.set(guest2Id, {
      id: guest2Id,
      event_id: eventId,
      name: 'Guinevere Pendelton',
      qr_token: 'token-guinevere',
      family_group_id: 'fam-pendelton',
      is_group_leader: false,
      group_leader_id: guest1Id,
      checked_in_at: null,
      checked_in_by: null,
      table_id: 'tab-1',
      table_name: 'Mesa Real',
    });
  });

  it('1. Fluxo de sincronização feliz: applied -> confirmed (AC #10)', async () => {
    // 1. Enfileira check-in no SQLite local
    const scanId = 'scan-happy-1001';
    await enqueueCheckIn({
      client_scan_id: scanId,
      event_id: eventId,
      scanned_guest_id: guest1Id,
      confirmed_guest_ids: [guest1Id, guest2Id],
      scanned_at: new Date().toISOString(),
    });

    const pendingBefore = await getPendingQueue(eventId);
    assert.equal(pendingBefore.length, 1);
    assert.equal(pendingBefore[0].state, 'pending');

    // 2. Mock do Supabase retornando status 'applied'
    const mockSupabase = createMockSupabase(async (fnName, args) => {
      assert.equal(fnName, 'apply_reception_checkins');
      assert.equal(args.p_event_id, eventId);
      const ops = args.p_operations as any[];
      assert.equal(ops.length, 1);
      assert.equal(ops[0].client_scan_id, scanId);

      return {
        data: {
          success: true,
          synced_at: '2026-10-27T16:00:00.000Z',
          results: [
            {
              client_scan_id: scanId,
              status: 'applied',
              idempotent_replay: false,
              scanned_at: ops[0].scanned_at,
              checked_in_by: 'Operador VIP',
              confirmed_guest_ids: [guest1Id, guest2Id],
              newly_checked_in_ids: [guest1Id, guest2Id],
              already_checked_in_ids: [],
              error: null,
            },
          ],
        },
        error: null,
      };
    });

    // 3. Executa a sincronização da fila
    const syncResult = await syncReceptionQueue(eventId, {
      supabaseClient: mockSupabase,
      db,
    });

    // 4. Valida retorno do serviço
    assert.equal(syncResult.isOnline, true);
    assert.equal(syncResult.syncedCount, 1);
    assert.equal(syncResult.pendingCount, 0);
    assert.equal(syncResult.results?.length, 1);

    // 5. Valida estado final no SQLite local
    const finalRow = db.queue.get(scanId);
    assert.ok(finalRow);
    assert.equal(finalRow?.state, 'confirmed');
    assert.equal(finalRow?.synced_at, '2026-10-27T16:00:00.000Z');

    // 6. Valida que os convidados foram atualizados no banco local
    const g1 = db.guests.get(guest1Id);
    assert.equal(g1?.checked_in_by, 'Operador VIP');
  });

  it('2. Fluxo de convidado já confirmado: already_checked_in -> already_checked_in (AC #14)', async () => {
    const scanId = 'scan-already-1002';
    await enqueueCheckIn({
      client_scan_id: scanId,
      event_id: eventId,
      scanned_guest_id: guest1Id,
      confirmed_guest_ids: [guest1Id],
    });

    const mockSupabase = createMockSupabase(async () => ({
      data: {
        success: true,
        synced_at: new Date().toISOString(),
        results: [
          {
            client_scan_id: scanId,
            status: 'already_checked_in',
            idempotent_replay: false,
            scanned_at: new Date().toISOString(),
            checked_in_by: 'Portaria Anterior',
            confirmed_guest_ids: [guest1Id],
            newly_checked_in_ids: [],
            already_checked_in_ids: [guest1Id],
            error: null,
          },
        ],
      },
      error: null,
    }));

    const result = await syncReceptionQueue(eventId, { supabaseClient: mockSupabase, db });

    assert.equal(result.isOnline, true);
    assert.equal(result.syncedCount, 1);
    assert.equal(result.pendingCount, 0);

    const row = db.queue.get(scanId);
    assert.equal(row?.state, 'already_checked_in');
  });

  it('3. Fluxo de rejeição de escopo: rejected -> rejected (AC #7, #8, #9)', async () => {
    const scanId = 'scan-rejected-1003';
    await enqueueCheckIn({
      client_scan_id: scanId,
      event_id: eventId,
      scanned_guest_id: 'guest-foreign-999',
      confirmed_guest_ids: ['guest-foreign-999'],
    });

    const mockSupabase = createMockSupabase(async () => ({
      data: {
        success: true,
        synced_at: new Date().toISOString(),
        results: [
          {
            client_scan_id: scanId,
            status: 'rejected',
            idempotent_replay: false,
            scanned_at: new Date().toISOString(),
            checked_in_by: null,
            confirmed_guest_ids: ['guest-foreign-999'],
            newly_checked_in_ids: [],
            already_checked_in_ids: [],
            error: 'scanned_guest_event_mismatch',
          },
        ],
      },
      error: null,
    }));

    const result = await syncReceptionQueue(eventId, { supabaseClient: mockSupabase, db });

    assert.equal(result.isOnline, true);
    assert.equal(result.syncedCount, 1);
    assert.equal(result.pendingCount, 0);

    const row = db.queue.get(scanId);
    assert.equal(row?.state, 'rejected');
    assert.equal(row?.error_code, 'scanned_guest_event_mismatch');
  });

  it('4. Falha de rede: reversão para pending com incremento de retry_count', async () => {
    const scanId = 'scan-fail-1004';
    await enqueueCheckIn({
      client_scan_id: scanId,
      event_id: eventId,
      scanned_guest_id: guest1Id,
      confirmed_guest_ids: [guest1Id],
    });

    // Simula queda de rede / timeout lançando exceção
    const mockSupabase = createMockSupabase(async () => {
      throw new Error('Network request failed: ECONNREFUSED');
    });

    const result = await syncReceptionQueue(eventId, { supabaseClient: mockSupabase, db });

    // Deve reportar offline e erro
    assert.equal(result.isOnline, false);
    assert.equal(result.syncedCount, 0);
    assert.equal(result.pendingCount, 1);
    assert.ok(result.error?.includes('ECONNREFUSED'));

    // Operação deve ter sido auto-curada de in_flight para pending com retry_count = 1
    const row = db.queue.get(scanId);
    assert.equal(row?.state, 'pending');
    assert.equal(row?.retry_count, 1);
  });

  it('5. Limite de retries excedido: transição para needs_attention (badge roxo)', async () => {
    const scanId = 'scan-attention-1005';
    await enqueueCheckIn({
      client_scan_id: scanId,
      event_id: eventId,
      scanned_guest_id: guest1Id,
      confirmed_guest_ids: [guest1Id],
    });

    // Configura item já com 4 retries prévios (limite maxRetries = 5)
    const existing = db.queue.get(scanId)!;
    existing.retry_count = 4;

    const mockSupabase = createMockSupabase(async () => ({
      data: null,
      error: { message: '500 Internal Server Error' },
    }));

    const result = await syncReceptionQueue(eventId, {
      supabaseClient: mockSupabase,
      db,
      maxRetries: 5,
    });

    assert.equal(result.isOnline, false);

    // Com o 5º retry com falha, deve transicionar para 'needs_attention'
    const row = db.queue.get(scanId);
    assert.equal(row?.state, 'needs_attention');
    assert.equal(row?.retry_count, 5);
    assert.equal(row?.error_code, 'max_retries_exceeded');
  });

  it('6. Reprocessamento manual com options.retryNeedsAttention', async () => {
    const scanId = 'scan-retry-1006';
    await enqueueCheckIn({
      client_scan_id: scanId,
      event_id: eventId,
      scanned_guest_id: guest1Id,
      confirmed_guest_ids: [guest1Id],
    });

    // Coloca diretamente em needs_attention
    const existing = db.queue.get(scanId)!;
    existing.state = 'needs_attention';
    existing.retry_count = 5;

    const mockSupabase = createMockSupabase(async () => ({
      data: {
        success: true,
        synced_at: new Date().toISOString(),
        results: [
          {
            client_scan_id: scanId,
            status: 'applied',
            idempotent_replay: false,
            scanned_at: new Date().toISOString(),
            checked_in_by: 'Operador Manual',
            confirmed_guest_ids: [guest1Id],
            newly_checked_in_ids: [guest1Id],
            already_checked_in_ids: [],
            error: null,
          },
        ],
      },
      error: null,
    }));

    // Sem retryNeedsAttention: item é ignorado
    const ignored = await syncReceptionQueue(eventId, {
      supabaseClient: mockSupabase,
      db,
      retryNeedsAttention: false,
    });
    assert.equal(ignored.syncedCount, 0);

    // Com retryNeedsAttention: item é reprocessado e confirmado
    const recovered = await syncReceptionQueue(eventId, {
      supabaseClient: mockSupabase,
      db,
      retryNeedsAttention: true,
    });
    assert.equal(recovered.syncedCount, 1);
    assert.equal(db.queue.get(scanId)?.state, 'confirmed');
  });

  it('7. Recuperação de timeout pós-commit via idempotent replay (AC #15)', async () => {
    const scanId = 'scan-idempotent-1007';
    await enqueueCheckIn({
      client_scan_id: scanId,
      event_id: eventId,
      scanned_guest_id: guest1Id,
      confirmed_guest_ids: [guest1Id, guest2Id],
    });

    // Servidor retorna idempotent_replay = true com status 'applied'
    const mockSupabase = createMockSupabase(async () => ({
      data: {
        success: true,
        synced_at: '2026-10-27T16:15:00.000Z',
        results: [
          {
            client_scan_id: scanId,
            status: 'applied',
            idempotent_replay: true, // Idempotent replay detectado pelo backend
            scanned_at: new Date().toISOString(),
            checked_in_by: 'Operador Rede',
            confirmed_guest_ids: [guest1Id, guest2Id],
            newly_checked_in_ids: [],
            already_checked_in_ids: [guest1Id, guest2Id],
            error: null,
          },
        ],
      },
      error: null,
    }));

    const result = await syncReceptionQueue(eventId, { supabaseClient: mockSupabase, db });

    assert.equal(result.isOnline, true);
    assert.equal(result.syncedCount, 1);
    assert.equal(result.results?.[0].idempotent_replay, true);

    // Transição para confirmed
    const row = db.queue.get(scanId);
    assert.equal(row?.state, 'confirmed');
  });

  it('8. Fila vazia retorna online com syncedCount 0 sem disparar RPC', async () => {
    let rpcCalled = false;
    const mockSupabase = createMockSupabase(async () => {
      rpcCalled = true;
      return { data: { success: true, results: [] }, error: null };
    });

    const result = await syncReceptionQueue(eventId, { supabaseClient: mockSupabase, db });

    assert.equal(result.isOnline, true);
    assert.equal(result.syncedCount, 0);
    assert.equal(result.pendingCount, 0);
    assert.equal(rpcCalled, false, 'RPC não deve ser chamada se a fila estiver vazia');
  });

  it('9. Loteamento (chunks) respeita batchSize de forma determinística', async () => {
    // Enfileira 5 itens com batchSize = 2 -> deve gerar 3 chamadas RPC
    for (let i = 1; i <= 5; i++) {
      await enqueueCheckIn({
        client_scan_id: `scan-chunk-${i}`,
        event_id: eventId,
        scanned_guest_id: guest1Id,
        confirmed_guest_ids: [guest1Id],
      });
    }

    let rpcBatchesReceived: number[] = [];
    const mockSupabase = createMockSupabase(async (_fn, args) => {
      const ops = args.p_operations as any[];
      rpcBatchesReceived.push(ops.length);
      return {
        data: {
          success: true,
          synced_at: new Date().toISOString(),
          results: ops.map((op) => ({
            client_scan_id: op.client_scan_id,
            status: 'applied',
            idempotent_replay: false,
            scanned_at: op.scanned_at,
            checked_in_by: 'Operador Lote',
            confirmed_guest_ids: op.confirmed_guest_ids,
            newly_checked_in_ids: op.confirmed_guest_ids,
            already_checked_in_ids: [],
            error: null,
          })),
        },
        error: null,
      };
    });

    const result = await syncReceptionQueue(eventId, {
      supabaseClient: mockSupabase,
      db,
      batchSize: 2,
    });

    assert.equal(result.syncedCount, 5);
    assert.deepEqual(rpcBatchesReceived, [2, 2, 1]);
  });

  it('10. downloadAndSaveEventSnapshot baixa da RPC e persiste no SQLite', async () => {
    const mockSnapshotData: ReceptionEventSnapshot = {
      event: {
        id: eventId,
        name: 'Casamento Arthur & Guinevere',
        event_date: '2026-10-27',
        status: 'active',
        location: 'Castelo de Camelot',
        reception_offline_expires_at: '2026-10-28T12:00:00Z',
      },
      operator: {
        id: 'op-001',
        name: 'Merlin',
        role: 'Coordenador',
      },
      guests: [
        {
          id: guest1Id,
          name: 'Arthur Pendelton',
          qr_token: 'token-arthur',
          family_group_id: 'fam-pendelton',
          is_group_leader: true,
          group_leader_id: null,
          checked_in_at: null,
          checked_in_by: null,
          table_id: 'tab-1',
          table_name: 'Mesa Real',
        },
      ],
      tables: [],
      snapshot_at: new Date().toISOString(),
    };

    const mockSupabase = createMockSupabase(async (fnName, args) => {
      assert.equal(fnName, 'get_reception_event_snapshot');
      assert.equal(args.p_event_id, eventId);
      return { data: mockSnapshotData, error: null };
    });

    const saved = await downloadAndSaveEventSnapshot(eventId, {
      supabaseClient: mockSupabase,
      db,
    });

    assert.ok(saved);
    assert.equal(saved?.event_id, eventId);
    assert.equal(saved?.name, 'Casamento Arthur & Guinevere');
    assert.equal(db.snapshots.has(eventId), true);
  });

  it('11. startQueueSyncWatcher executa sincronização e cleanup via unsubscribe', async () => {
    let watcherCallCount = 0;
    const mockSupabase = createMockSupabase(async () => {
      watcherCallCount += 1;
      return { data: { success: true, results: [] }, error: null };
    });

    let lastStatus: any = null;
    const unsubscribe = startQueueSyncWatcher(
      eventId,
      100, // 100ms
      (status) => {
        lastStatus = status;
      },
      { supabaseClient: mockSupabase, db },
    );

    // Aguarda o primeiro tick imediato
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(lastStatus !== null);
    assert.equal(lastStatus.isOnline, true);

    // Cancela o timer
    unsubscribe();
  });
});
