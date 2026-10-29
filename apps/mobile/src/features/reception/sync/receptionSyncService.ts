import type { SQLiteDatabase } from 'expo-sqlite';
import {
  type ApplyReceptionOperationPayload,
  type ApplyReceptionResponse,
  type ApplyReceptionResult,
  type CheckInState,
  type ReceptionEventSnapshot,
  type ReceptionSnapshotRow,
} from '../types/receptionTypes';
import {
  getDatabase,
  getPendingQueue,
  getSnapshot,
  markQueueItemsInFlight,
  markQueueItemsNeedsAttention,
  saveSnapshot,
  updateGuestCheckedInStatus,
  updateQueueState,
} from '../storage/receptionDatabase';
import { autoHealInFlightOperations } from '../engine/receptionAutoHeal';

let customSupabaseClient: any = null;

/**
 * Define cliente Supabase padrão para injeção de dependência ou testes.
 */
export function setDefaultSupabaseClient(client: any): void {
  customSupabaseClient = client;
}

async function getDefaultSupabaseClient(): Promise<any> {
  if (customSupabaseClient) return customSupabaseClient;
  const mod = await import('../../../lib/supabase');
  return mod.supabase;
}

export interface SyncOptions {
  /** Limite máximo de tentativas antes de transicionar para 'needs_attention' (padrão: 5) */
  maxRetries?: number;
  /** Quantidade máxima de operações enviadas por lote na RPC (padrão: 50) */
  batchSize?: number;
  /** Se true, reseta itens em 'needs_attention' de volta para 'pending' para reprocessamento manual (padrão: false) */
  retryNeedsAttention?: boolean;
  /** Cliente Supabase alternativo (útil para testes unitários ou ambientes simulados) */
  supabaseClient?: any;
  /** Conexão SQLite alternativa (útil para testes unitários ou injeção de dependência) */
  db?: SQLiteDatabase;
}

export interface SyncResult {
  syncedCount: number;
  pendingCount: number;
  isOnline: boolean;
  error?: string | null;
  results?: ApplyReceptionResult[];
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  error: string | null;
}

// Mapa para evitar execuções simultâneas concorrentes da mesma fila de evento
const ongoingSyncPromises = new Map<string, Promise<SyncResult>>();

/**
 * Sincronizador resiliente e atômico da fila de check-in offline com o Supabase.
 * Executa em lote (chunks de até 50), marca itens em in_flight, mapeia respostas para a FSM,
 * e em caso de falha de rede ou timeout aciona auto-cura imediata para pending ou needs_attention.
 */
export async function syncReceptionQueue(
  eventId: string,
  options?: SyncOptions,
): Promise<SyncResult> {
  if (!eventId) {
    return {
      syncedCount: 0,
      pendingCount: 0,
      isOnline: false,
      error: 'ID do evento é obrigatório para sincronização.',
      results: [],
    };
  }

  // Deduplica chamadas sobrepostas para o mesmo evento
  if (ongoingSyncPromises.has(eventId)) {
    return ongoingSyncPromises.get(eventId)!;
  }

  const syncTask = executeQueueSync(eventId, options);
  ongoingSyncPromises.set(eventId, syncTask);

  try {
    return await syncTask;
  } finally {
    ongoingSyncPromises.delete(eventId);
  }
}

async function executeQueueSync(
  eventId: string,
  options?: SyncOptions,
): Promise<SyncResult> {
  const db = options?.db ?? (await getDatabase());
  const client = options?.supabaseClient ?? (await getDefaultSupabaseClient());
  const maxRetries = options?.maxRetries ?? 5;
  const batchSize = options?.batchSize ?? 50;

  // 1. Reprocessamento manual: se solicitado, reseta operações 'needs_attention' para 'pending'
  if (options?.retryNeedsAttention) {
    await db.runAsync(
      `UPDATE reception_queue
       SET state = 'pending',
           error_code = NULL,
           error_message = NULL
       WHERE event_id = ? AND state = 'needs_attention';`,
      eventId,
    );
  }

  // 2. Consulta itens pendentes na fila do evento
  const pendingRows = await getPendingQueue(eventId, db);
  const eligibleItems = pendingRows.filter((i) => i.state === 'pending');

  if (eligibleItems.length === 0) {
    const remainingNeedsAttention = pendingRows.filter(
      (i) => i.state === 'needs_attention',
    ).length;
    return {
      syncedCount: 0,
      pendingCount: remainingNeedsAttention,
      isOnline: true,
      results: [],
    };
  }

  let totalSynced = 0;
  const allResults: ApplyReceptionResult[] = [];

  // 3. Processamento em chunks para não estourar payload da RPC
  for (let i = 0; i < eligibleItems.length; i += batchSize) {
    const chunk = eligibleItems.slice(i, i + batchSize);
    const scanIds = chunk.map((item) => item.client_scan_id);

    // Marca o lote como in_flight no SQLite
    await markQueueItemsInFlight(scanIds, db);

    const operationsPayload: ApplyReceptionOperationPayload[] = chunk.map((item) => ({
      client_scan_id: item.client_scan_id,
      scanned_qr_token: item.scanned_qr_token,
      scanned_guest_id: item.scanned_guest_id,
      confirmed_guest_ids: item.confirmed_guest_ids,
      scanned_at: item.scanned_at,
    }));

    try {
      const { data, error } = await client.rpc('apply_reception_checkins', {
        p_event_id: eventId,
        p_operations: operationsPayload,
      });

      if (error || !data || !Array.isArray(data.results)) {
        const errorMsg = error?.message || 'Resposta inválida do servidor ao sincronizar check-ins.';

        await autoHealInFlightOperations(db, { incrementRetry: true });
        await markQueueItemsNeedsAttention(maxRetries, eventId, errorMsg, db);

        const currentQueue = await getPendingQueue(eventId, db);
        return {
          syncedCount: totalSynced,
          pendingCount: currentQueue.length,
          isOnline: false,
          error: errorMsg,
          results: allResults,
        };
      }

      const response = data as ApplyReceptionResponse;
      const syncedAt = response.synced_at || new Date().toISOString();

      // Processa os resultados individuais do lote
      for (const res of response.results) {
        let nextState: CheckInState = 'confirmed';
        if (res.status === 'already_checked_in') {
          nextState = 'already_checked_in';
        } else if (res.status === 'rejected') {
          nextState = 'rejected';
        } else if (res.status === 'applied') {
          nextState = 'confirmed';
        }

        // Atualiza estado do scan na fila SQLite respeitando a FSM
        await updateQueueState(
          res.client_scan_id,
          nextState,
          {
            synced_at: syncedAt,
            error_code: res.error,
            error_message: res.error,
            server_response: res as unknown as Record<string, unknown>,
          },
          db,
        );

        // Atualiza status do convidado no SQLite se confirmado no servidor
        if (res.status === 'applied' || res.status === 'already_checked_in') {
          const guestIds = res.newly_checked_in_ids?.length
            ? res.newly_checked_in_ids
            : res.confirmed_guest_ids || [];
          if (guestIds.length > 0) {
            await updateGuestCheckedInStatus(
              guestIds,
              res.scanned_at || syncedAt,
              res.checked_in_by || 'Portaria Nativa',
              db,
            );
          }
        }

        totalSynced += 1;
        allResults.push(res);
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Falha de conexão com a rede ao sincronizar.';

      await autoHealInFlightOperations(db, { incrementRetry: true });
      await markQueueItemsNeedsAttention(maxRetries, eventId, errorMsg, db);

      const currentQueue = await getPendingQueue(eventId, db);
      return {
        syncedCount: totalSynced,
        pendingCount: currentQueue.length,
        isOnline: false,
        error: errorMsg,
        results: allResults,
      };
    }
  }

  const finalQueue = await getPendingQueue(eventId, db);
  return {
    syncedCount: totalSynced,
    pendingCount: finalQueue.length,
    isOnline: true,
    results: allResults,
  };
}

/**
 * Baixa o snapshot do evento e convidados via RPC e salva atomicamente no SQLite local.
 */
export async function downloadAndSaveEventSnapshot(
  eventId: string,
  options?: { supabaseClient?: any; db?: SQLiteDatabase },
): Promise<ReceptionSnapshotRow | null> {
  if (!eventId) return null;
  const client = options?.supabaseClient ?? (await getDefaultSupabaseClient());
  const db = options?.db;

  const { data, error } = await client.rpc('get_reception_event_snapshot', {
    p_event_id: eventId,
  });

  if (error) {
    throw new Error(`Falha ao baixar snapshot do evento: ${error.message}`);
  }

  if (!data || !(data as ReceptionEventSnapshot).event) {
    return null;
  }

  await saveSnapshot(data as ReceptionEventSnapshot, db);
  return getSnapshot(eventId, db);
}

/**
 * Inicia watcher periódico de drenagem da fila em segundo plano.
 * Retorna função para cancelar o intervalo (unsubscribe).
 */
export function startQueueSyncWatcher(
  eventId: string,
  intervalMs: number = 10000,
  onStatusChange?: (status: SyncStatus) => void,
  options?: SyncOptions,
): () => void {
  let isRunning = false;
  let active = true;

  const tick = async () => {
    if (!active || isRunning) return;
    isRunning = true;
    try {
      const result = await syncReceptionQueue(eventId, options);
      if (active && onStatusChange) {
        onStatusChange({
          isOnline: result.isOnline,
          isSyncing: false,
          pendingCount: result.pendingCount,
          lastSyncedAt: result.syncedCount > 0 ? new Date().toISOString() : null,
          error: result.error ?? null,
        });
      }
    } catch (err: any) {
      if (active && onStatusChange) {
        onStatusChange({
          isOnline: false,
          isSyncing: false,
          pendingCount: 0,
          lastSyncedAt: null,
          error: err?.message || 'Erro inesperado no monitor de sincronização.',
        });
      }
    } finally {
      isRunning = false;
    }
  };

  void tick();

  const timerId = setInterval(() => {
    void tick();
  }, intervalMs);

  return () => {
    active = false;
    clearInterval(timerId);
  };
}
