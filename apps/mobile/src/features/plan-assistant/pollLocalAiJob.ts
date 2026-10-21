import type { SupabaseClient } from '@supabase/supabase-js';

export type LocalAiPollResult = Record<string, unknown> & {
  status?: string;
  error?: string;
  partial_answer?: string;
  answer?: string;
  suggested_actions?: Array<{ label?: string; path?: string }>;
};

const DEFAULT_POLL_INTERVAL_MS = 3_000;

/**
 * Polls local AI jobs when Edge Functions return HTTP 202 with a jobId.
 */
export async function pollLocalAiJob(
  supabase: SupabaseClient,
  functionName: 'plan-assistant-chat' | string,
  jobId: string,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
    onProgress?: (partialAnswer: string) => void;
  } = {}
): Promise<LocalAiPollResult> {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;
  let lastPartialAnswer = '';

  while (Date.now() < deadline) {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: { jobId },
    });
    if (error) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      continue;
    }
    const result = (data ?? {}) as LocalAiPollResult;
    if (result.status === 'completed' || result.answer) return result;
    if (result.status === 'failed') {
      throw new Error(result.error || 'Falha no processamento local da IA.');
    }
    const partialAnswer =
      typeof result.partial_answer === 'string'
        ? result.partial_answer.trim()
        : '';
    if (partialAnswer && partialAnswer !== lastPartialAnswer) {
      lastPartialAnswer = partialAnswer;
      options.onProgress?.(partialAnswer);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Tempo limite de resposta excedido.');
}
