import type { SQLiteDatabase } from 'expo-sqlite';

const HEAL_SQL = `
  UPDATE reception_queue
  SET state = 'pending'
  WHERE state = 'in_flight';
`.trim();

const HEAL_AND_INCREMENT_SQL = `
  UPDATE reception_queue
  SET state = 'pending',
      retry_count = retry_count + 1
  WHERE state = 'in_flight';
`.trim();

/**
 * @deprecated Use getAutoHealQuery(incrementRetry) em vez de referenciar diretamente.
 */
export const AUTO_HEAL_SQL = HEAL_SQL;

export function getAutoHealQuery(incrementRetry: boolean = false): string {
  return incrementRetry ? HEAL_AND_INCREMENT_SQL : HEAL_SQL;
}

export interface AutoHealResult {
  healedCount: number;
  timestamp: string;
}

/**
 * Executa a auto-cura no banco de dados SQLite local.
 *
 * @param incrementRetry true apenas quando a cura segue uma falha real de RPC.
 *   Na inicialização (cold start), deve ser false para não envenenar itens
 *   que nunca chegaram a ser enviados ao servidor.
 */
export async function autoHealInFlightOperations(
  db: SQLiteDatabase,
  options?: { incrementRetry?: boolean },
): Promise<AutoHealResult> {
  const sql = getAutoHealQuery(options?.incrementRetry ?? false);
  const result = await db.runAsync(sql);
  const healedCount = typeof result?.changes === 'number' ? result.changes : 0;

  return {
    healedCount,
    timestamp: new Date().toISOString(),
  };
}
