import { useCallback, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { ClientRow, DocumentRow, SignatureRow } from './clientsScreenTypes';

const CLIENT_COLUMNS = 'id,name,email,phone,stage,event_type,event_date_expected,budget_expected,notes,updated_at';
const DOCUMENT_COLUMNS = 'id,client_id,doc_type,status,approval_status,external_url,external_status,signed_at,advisor_signed_at,updated_at';
const SIGNATURE_COLUMNS = 'id,client_id,document_id,status,external_status,external_url,signed_at,created_at';

export function useClientsData(userId?: string) {
  const [clients, setClients] = useState<ClientRow[]>([]), [documents, setDocuments] = useState<DocumentRow[]>([]), [signatures, setSignatures] = useState<SignatureRow[]>([]);
  const [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false), [error, setError] = useState('');
  const loadData = useCallback(async (silent = false) => {
    if (!userId) return;
    silent ? setRefreshing(true) : setLoading(true);
    setError('');
    // egress-guard: allow-unbounded -- the CRM journey and aggregate cards require the complete tenant client set.
    const clientResult = await supabase.from('crm_clients').select(CLIENT_COLUMNS).eq('user_id', userId).order('updated_at', { ascending: false });
    if (clientResult.error) { setError('Não foi possível carregar seus clientes. Tente novamente.'); setLoading(false); setRefreshing(false); return; }
    const nextClients = (clientResult.data ?? []) as ClientRow[], ids = nextClients.map(({ id }) => id);
    let nextDocuments: DocumentRow[] = [], nextSignatures: SignatureRow[] = [];
    if (ids.length) {
      const [docs, signs] = await Promise.all([
        // egress-guard: allow-unbounded -- only budget and contract artifacts for the already tenant-bounded clients are loaded.
        supabase.from('crm_client_documents').select(DOCUMENT_COLUMNS).in('client_id', ids).in('doc_type', ['budget', 'contract']).order('updated_at', { ascending: false }),
        // egress-guard: allow-unbounded -- every signature state is needed to derive each tenant client journey.
        (supabase.from('crm_signature_requests') as any).select(SIGNATURE_COLUMNS).in('client_id', ids).order('created_at', { ascending: false }),
      ]);
      if (docs.error || signs.error) setError('Alguns documentos não puderam ser atualizados. Puxe a tela para tentar novamente.');
      nextDocuments = (docs.data ?? []) as DocumentRow[];
      nextSignatures = (signs.data ?? []) as SignatureRow[];
    }
    setClients(nextClients); setDocuments(nextDocuments); setSignatures(nextSignatures); setLoading(false); setRefreshing(false);
  }, [userId]);
  const patchClient = useCallback((client: ClientRow) => setClients((current) => [client, ...current.filter(({ id }) => id !== client.id)]), []);
  const refreshArtifacts = useCallback(async (clientId: string) => {
    const [docs, signs] = await Promise.all([
      // egress-guard: allow-unbounded -- focused refresh needs all budget and contract artifacts for one client.
      supabase.from('crm_client_documents').select(DOCUMENT_COLUMNS).eq('client_id', clientId).in('doc_type', ['budget', 'contract']).order('updated_at', { ascending: false }),
      // egress-guard: allow-unbounded -- focused refresh needs the complete signature history for one client.
      (supabase.from('crm_signature_requests') as any).select(SIGNATURE_COLUMNS).eq('client_id', clientId).order('created_at', { ascending: false }),
    ]);
    if (docs.error || signs.error) { setError('Os documentos deste cliente não puderam ser atualizados.'); return; }
    setDocuments((current) => [...(docs.data ?? []) as DocumentRow[], ...current.filter((row) => row.client_id !== clientId)]);
    setSignatures((current) => [...(signs.data ?? []) as SignatureRow[], ...current.filter((row) => row.client_id !== clientId)]);
  }, []);
  return { clients, documents, signatures, loading, refreshing, error, setError, loadData, patchClient, refreshArtifacts };
}
