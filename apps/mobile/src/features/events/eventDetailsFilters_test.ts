import { assertEquals, assertStrictEquals } from 'jsr:@std/assert@1';

import {
  filterEventDocuments,
  filterEventExpenses,
  filterEventGuests,
  filterEventPayments,
  filterEventVendors,
} from './eventDetailsFilters.ts';

Deno.test('guest filters preserve RSVP fallback, normalized search and name ordering', () => {
  const guests = [
    { id: '1', name: 'Zuleica', phone: '1199999', rsvp_status: 'confirmed', companion_count: 2 },
    { id: '2', name: 'ana', phone: '21 8888', rsvp_status: null, companion_count: 0 },
    { id: '3', name: 'Bruno', phone: '31 7777', rsvp_status: 'declined', companion_count: 1 },
  ];

  assertEquals(filterEventGuests(guests, 'pending', '  ANA  ', 'name_asc'), [guests[1]]);
  assertEquals(
    filterEventGuests(guests, 'all', '', 'name_desc').map((guest) => guest.id),
    ['1', '3', '2'],
  );
  assertEquals(filterEventGuests(guests, 'confirmed', '999', 'name_asc'), [guests[0]]);
  assertStrictEquals(guests[0].companion_count, 2);
});

Deno.test('vendor filters search name and category and retain all existing sort modes', () => {
  const vendors = [
    { id: '1', name: 'Zeta Som', category: 'DJ', status: 'confirmed', private_note: 'preserve' },
    { id: '2', name: 'Alfa Luz', category: 'Iluminação', status: 'pending' },
    { id: '3', name: 'Beta Foto', category: 'Fotografia', status: 'cancelled' },
  ];

  assertEquals(filterEventVendors(vendors, '  FOTO ', 'name_asc'), [vendors[2]]);
  assertEquals(filterEventVendors(vendors, '', 'name_asc').map((vendor) => vendor.id), ['2', '3', '1']);
  assertEquals(filterEventVendors(vendors, '', 'name_desc').map((vendor) => vendor.id), ['1', '3', '2']);
  assertEquals(filterEventVendors(vendors, '', 'status').map((vendor) => vendor.id), ['3', '1', '2']);
  assertEquals(vendors.map((vendor) => vendor.id), ['1', '2', '3']);
});

Deno.test('expense and payment filters keep financial rows in the same visible scope', () => {
  const expenses = [
    { id: 'e1', vendor_id: 'v1', status: 'paid', value: 100 },
    { id: 'e2', vendor_id: 'v1', status: null, value: 200 },
    { id: 'e3', vendor_id: 'v2', status: 'cancelled', value: 300 },
  ];
  const payments = [
    { id: 'p1', expense_id: 'e1', amount: 100 },
    { id: 'p2', expense_id: 'e2', amount: 50 },
    { id: 'p3', expense_id: 'missing', amount: 25 },
  ];

  const paidForVendor = filterEventExpenses(expenses, ' v1 ', 'paid');
  assertEquals(paidForVendor, [expenses[0]]);
  assertEquals(filterEventPayments(payments, paidForVendor), [payments[0]]);
  assertEquals(filterEventExpenses(expenses, '', 'pending'), [expenses[1]]);
  assertEquals(filterEventExpenses(expenses, 'v2', 'all'), [expenses[2]]);
});

Deno.test('document filters combine receipt, vendor, category and normalized search', () => {
  const documents = [
    { id: 'd1', vendor_id: 'v1', name: 'Contrato Banda', category: 'Contrato', file_id: 'private-1' },
    { id: 'd2', vendor_id: 'v1', name: 'Comprovante PIX', category: 'Recibo', file_id: 'private-2' },
    { id: 'd3', vendor_id: 'v2', name: 'Mapa', category: 'Produção', file_id: 'private-3' },
  ];

  assertEquals(filterEventDocuments(documents, '', ' v1 ', ' recibo ', ' PIX '), [documents[1]]);
  assertEquals(filterEventDocuments(documents, 'd1', '', '', ''), [documents[0]]);
  assertEquals(filterEventDocuments(documents, '', '', '', 'produção'), [documents[2]]);
});

Deno.test('filter helpers never mutate source arrays or clone their rows', () => {
  const guests = [
    { id: '2', name: 'B' },
    { id: '1', name: 'A' },
  ];

  const result = filterEventGuests(guests, 'all', '', 'name_asc');

  assertEquals(guests.map((guest) => guest.id), ['2', '1']);
  assertEquals(result.map((guest) => guest.id), ['1', '2']);
  assertStrictEquals(result[0], guests[1]);
});
