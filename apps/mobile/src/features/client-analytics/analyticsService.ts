import { supabase } from '../../lib/supabase';
export async function fetchAnalyticsRpcs() { const [funnel, forecast] = await Promise.all([supabase.rpc('get_crm_funnel_metrics'), supabase.rpc('get_crm_pipeline_forecast')]); return { funnel, forecast }; }
export async function fetchAnalyticsClients(userId: string) { return supabase.from('crm_clients').select('id,stage,budget_expected').eq('user_id', userId); }
