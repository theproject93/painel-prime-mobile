import type { ClientJourneyPresentation } from './clientJourney';

export type ClientRow = { id: string; name: string; email: string | null; phone: string | null; stage: string; event_type: string | null; event_date_expected: string | null; budget_expected: number | null; notes: string | null; updated_at: string };
export type DocumentRow = { id: string; client_id: string; doc_type: string; status: string; approval_status: string | null; external_url: string | null; external_status: string | null; signed_at: string | null; advisor_signed_at: string | null; updated_at: string };
export type SignatureRow = { id: string; client_id: string; document_id: string; status: string; external_status: string | null; external_url: string | null; signed_at: string | null; created_at: string };
export type ClientForm = { name: string; email: string; phone: string; eventType: string; eventDate: string; budget: string; notes: string };
export type ListFilter = 'active' | 'closed' | 'lost';
export type ClientJourneyMap = Map<string, ClientJourneyPresentation>;
export const EMPTY_CLIENT_FORM: ClientForm = { name: '', email: '', phone: '', eventType: '', eventDate: '', budget: '', notes: '' };
