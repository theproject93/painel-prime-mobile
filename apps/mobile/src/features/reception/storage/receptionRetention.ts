import type { SQLiteDatabase } from 'expo-sqlite';
import type { ReceptionSnapshotRow } from '../types/receptionTypes';

/**
 * Portaria Prime Nativo - Política de Retenção e Expiração Offline
 *
 * R5 / AC #16:
 * - O snapshot offline é válido até as 12:00 do dia seguinte ao evento
 *   (date_trunc('day', event_date) + interval '1 day 12 hours').
 * - Ao expirar, novas leituras no scanner são bloqueadas.
 * - Regra Fundamental de Retenção: Operações pendentes de sincronização
 *   ('pending', 'in_flight', 'needs_attention') NUNCA são expurgadas enquanto
 *   não houver confirmação de recebimento pelo servidor.
 */

export interface PurgeReport {
  purgedEventIds: string[];
  preservedEventIds: string[];
  preservedPendingOperationsCount: number;
}

/**
 * Calcula a data e hora exata de expiração do snapshot da portaria:
 * 12:00 (meio-dia) do dia seguinte à data do evento.
 */
export function calculateReceptionExpiration(eventDateInput: string | Date): Date {
  let year: number;
  let month: number;
  let day: number;

  if (typeof eventDateInput === 'string') {
    // Trata YYYY-MM-DD ou ISO
    const datePart = eventDateInput.split('T')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1; // 0-indexed no Date
      day = parseInt(parts[2], 10);
    } else {
      const parsed = new Date(eventDateInput);
      year = parsed.getFullYear();
      month = parsed.getMonth();
      day = parsed.getDate();
    }
  } else {
    year = eventDateInput.getFullYear();
    month = eventDateInput.getMonth();
    day = eventDateInput.getDate();
  }

  // Dia seguinte às 12:00:00.000
  return new Date(year, month, day + 1, 12, 0, 0, 0);
}

/**
 * Avalia se um snapshot expirou considerando data do evento ou timestamp explícito.
 */
export function isSnapshotExpired(
  eventDateOrExpiry: string | Date,
  now: Date = new Date(),
): boolean {
  if (typeof eventDateOrExpiry === 'string' && eventDateOrExpiry.includes('T')) {
    // Se já é um timestamp completo com fuso horário (ex: reception_offline_expires_at)
    const expiryDate = new Date(eventDateOrExpiry);
    return now.getTime() >= expiryDate.getTime();
  }

  const expiryDate = calculateReceptionExpiration(eventDateOrExpiry);
  return now.getTime() >= expiryDate.getTime();
}

/**
 * Verifica se novas leituras no scanner são autorizadas para o evento.
 * Bloqueia leituras se o snapshot estiver expirado.
 */
export function canScanForEvent(
  snapshot: {
    reception_offline_expires_at?: string | null;
    event_date: string;
  } | null,
  now: Date = new Date(),
): { allowed: boolean; reason?: string } {
  if (!snapshot) {
    return {
      allowed: false,
      reason: 'Snapshot do evento não encontrado localmente.',
    };
  }

  const expirySource = snapshot.reception_offline_expires_at || snapshot.event_date;
  if (isSnapshotExpired(expirySource, now)) {
    return {
      allowed: false,
      reason:
        'Operação offline encerrada às 12:00 do dia seguinte ao evento. Novas leituras no scanner estão bloqueadas.',
    };
  }

  return { allowed: true };
}

/**
 * Executa a política de retenção estrita no banco SQLite local.
 *
 * Expurgar apenas snapshots expirados que NÃO possuam nenhuma operação pendente de sincronização.
 * Operações pendentes ('pending', 'in_flight', 'needs_attention') são ESTRITAMENTE preservadas.
 */
export async function purgeExpiredSnapshots(
  db: SQLiteDatabase,
  now: Date = new Date(),
): Promise<PurgeReport> {
  const snapshots = await db.getAllAsync<ReceptionSnapshotRow>(
    `SELECT event_id, event_date, reception_offline_expires_at FROM reception_snapshots;`,
  );

  const purgedEventIds: string[] = [];
  const preservedEventIds: string[] = [];
  let preservedPendingOperationsCount = 0;

  for (const snap of snapshots) {
    const expirySource = snap.reception_offline_expires_at || snap.event_date;
    const expired = isSnapshotExpired(expirySource, now);

    if (!expired) {
      // Evento ainda ativo, preserva normalmente
      continue;
    }

    // Evento expirou: verificar se existem operações não sincronizadas na fila
    const queueCheck = await db.getFirstAsync<{ count: number }>(
      `SELECT count(*) as count FROM reception_queue
       WHERE event_id = ? AND state IN ('pending', 'in_flight', 'needs_attention');`,
      snap.event_id,
    );

    const pendingCount = queueCheck ? Number(queueCheck.count) : 0;

    if (pendingCount > 0) {
      // REGRA FUNDAMENTAL: Há itens não sincronizados, NUNCA expurgar!
      preservedEventIds.push(snap.event_id);
      preservedPendingOperationsCount += pendingCount;
    } else {
      // Todos os itens foram confirmados/rejeitados pelo servidor: pode expurgar com segurança
      await db.withTransactionAsync(async () => {
        await db.runAsync(`DELETE FROM reception_guests WHERE event_id = ?;`, snap.event_id);
        await db.runAsync(`DELETE FROM reception_snapshots WHERE event_id = ?;`, snap.event_id);
        await db.runAsync(`DELETE FROM reception_queue WHERE event_id = ?;`, snap.event_id);
      });
      purgedEventIds.push(snap.event_id);
    }
  }

  return {
    purgedEventIds,
    preservedEventIds,
    preservedPendingOperationsCount,
  };
}
