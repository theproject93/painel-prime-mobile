import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Consulta SQL canônica de auto-cura executada na inicialização do aplicativo móvel.
 * Converte operações que ficaram presas em 'in_flight' (devido a crash,
 * encerramento forçado do Android ou falta de bateria) de volta para 'pending',
 * incrementando o contador de tentativas para auditoria.
 */
export const AUTO_HEAL_SQL = `
  UPDATE reception_queue
  SET state = 'pending',
      retry_count = retry_count + 1
  WHERE state = 'in_flight';
`.trim();

/**
 * Retorna a consulta canônica para fins de auditoria ou execução direta.
 */
export function getAutoHealQuery(): string {
  return AUTO_HEAL_SQL;
}

export interface AutoHealResult {
  healedCount: number;
  timestamp: string;
}

/**
 * Executa a auto-cura no banco de dados SQLite local.
 *
 * @param db Conexão ativa do SQLite
 * @returns Quantidade de registros restaurados para 'pending'
 */
export async function autoHealInFlightOperations(db: SQLiteDatabase): Promise<AutoHealResult> {
  const result = await db.runAsync(AUTO_HEAL_SQL);
  const healedCount = typeof result?.changes === 'number' ? result.changes : 0;

  return {
    healedCount,
    timestamp: new Date().toISOString(),
  };
}
