import { assertEquals } from 'jsr:@std/assert';
import { clientFormPayload, filterClients, indexClientJourneys, journeyCounts } from './clientsScreenSelectors.ts';
import type { ClientRow } from './clientsScreenTypes.ts';

const client = (id: string, stage = 'conhecendo_cliente'): ClientRow => ({ id, name: `Cliente ${id}`, email: `${id}@teste.local`, phone: null, stage, event_type: null, event_date_expected: null, budget_expected: null, notes: null, updated_at: '2026-07-18T00:00:00Z' });
Deno.test('client journey selectors index artifacts once and preserve filters', () => { const clients = [client('a'), client('b', 'cliente_fechado'), client('c', 'cliente_perdido')]; const journeys = indexClientJourneys(clients, [], []); assertEquals(journeyCounts(journeys), { active: 1, waiting: 0, closed: 1 }); assertEquals(filterClients(clients, journeys, 'cliente', 'active').map(({ id }) => id), ['a']); assertEquals(filterClients(clients, journeys, '', 'lost').map(({ id }) => id), ['c']); });
Deno.test('client form normalizes BRL and optional fields', () => { assertEquals(clientFormPayload({ name: ' Ana ', email: '', phone: '', eventType: '', eventDate: '', budget: '1.234,56', notes: ' ok ' }), { name: 'Ana', email: null, phone: null, event_type: null, event_date_expected: null, budget_expected: 1234.56, notes: 'ok' }); });
