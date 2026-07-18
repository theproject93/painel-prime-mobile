import { presentClientJourney, type ClientJourneyPresentation } from './clientJourney';
import type { ClientForm, ClientRow, DocumentRow, ListFilter, SignatureRow } from './clientsScreenTypes';

export function indexClientJourneys(clients: ClientRow[], documents: DocumentRow[], signatures: SignatureRow[]) {
  const latestDocuments = new Map<string, DocumentRow>();
  for (const document of documents) { const key = `${document.client_id}:${document.doc_type}`; if (!latestDocuments.has(key)) latestDocuments.set(key, document); }
  const latestSignatures = new Map<string, SignatureRow>();
  for (const signature of signatures) if (!latestSignatures.has(signature.client_id)) latestSignatures.set(signature.client_id, signature);
  const journeys = new Map<string, ClientJourneyPresentation>();
  for (const client of clients) {
    const budget = latestDocuments.get(`${client.id}:budget`);
    const contract = latestDocuments.get(`${client.id}:contract`);
    const signature = latestSignatures.get(client.id);
    journeys.set(client.id, presentClientJourney({ stage: client.stage, budgetApprovalStatus: budget?.approval_status, budgetExternalUrl: budget?.external_url, contractSignedAt: contract?.signed_at, signatureStatus: signature?.status || signature?.external_status, signatureExternalUrl: signature?.external_url }));
  }
  return journeys;
}

export function journeyCounts(journeys: Map<string, ClientJourneyPresentation>) {
  let active = 0, waiting = 0, closed = 0;
  for (const journey of journeys.values()) { if (journey.state === 'closed') closed += 1; else if (journey.state !== 'lost') { active += 1; if (journey.state === 'budget_pending' || journey.state === 'signature_pending') waiting += 1; } }
  return { active, waiting, closed };
}

export function filterClients(clients: ClientRow[], journeys: Map<string, ClientJourneyPresentation>, search: string, filter: ListFilter) {
  const term = search.trim().toLowerCase();
  return clients.filter((client) => { const state = journeys.get(client.id)?.state; const matchesSearch = !term || `${client.name} ${client.email ?? ''} ${client.phone ?? ''}`.toLowerCase().includes(term); const matchesFilter = filter === 'closed' ? state === 'closed' : filter === 'lost' ? state === 'lost' : state !== 'closed' && state !== 'lost'; return matchesSearch && matchesFilter; });
}

export function clientFormPayload(form: ClientForm) { const amount = Number(form.budget.replace(/\./g, '').replace(',', '.')); return { name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null, event_type: form.eventType.trim() || null, event_date_expected: form.eventDate.trim() || null, budget_expected: Number.isFinite(amount) ? amount : null, notes: form.notes.trim() || null }; }
export function currency(value: number | null | undefined) { return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
export function dateLabel(value: string | null | undefined) { if (!value) return 'Data a definir'; const [year, month, day] = value.slice(0, 10).split('-'); return year && month && day ? `${day}/${month}/${year}` : value; }
