import { supabase } from '../../lib/supabase';
import type { AdoptionProgress, AdoptionSnapshot } from './adoptionModel';

type RpcResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => RpcResult<unknown>;

function snapshotFrom(value: unknown): AdoptionSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Resposta inválida da jornada.');
  const data = value as Partial<AdoptionSnapshot>;
  if (typeof data.tenant_id !== 'string' || !['agency', 'team', 'vendor'].includes(String(data.audience))
    || !Array.isArray(data.allowed) || !Array.isArray(data.progress) || !Array.isArray(data.achievements)
    || !data.facts || typeof data.facts !== 'object') throw new Error('Resposta inválida da jornada.');
  return data as AdoptionSnapshot;
}

export async function verifyAdoption(userId: string, eventId: string | null, operational: boolean): Promise<AdoptionSnapshot> {
  const { data, error } = await rpc('verify_product_adoption', { p_expected_user_id: userId, p_event_id: eventId, p_operational: operational });
  if (error) throw new Error(error.message);
  return snapshotFrom(data);
}

export async function saveAdoptionProgress(userId: string, eventId: string | null, operational: boolean,
  journeyId: string, status: AdoptionProgress['status'], current?: AdoptionProgress) {
  const { data, error } = await rpc('save_product_adoption_progress', {
    p_expected_user_id: userId, p_event_id: eventId, p_operational: operational,
    p_journey_id: journeyId, p_step: 0, p_status: status,
    p_expected_revision: current?.revision ?? 0, p_version: 2,
  });
  if (error) throw new Error(error.message);
  if (typeof data !== 'number') throw new Error('Não foi possível salvar sua orientação.');
}
