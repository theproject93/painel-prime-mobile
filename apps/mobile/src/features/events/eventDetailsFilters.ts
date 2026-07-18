export type EventGuestFilter = 'all' | 'pending' | 'confirmed' | 'declined';
export type EventGuestSort = 'name_asc' | 'name_desc';
export type EventVendorSort = 'name_asc' | 'name_desc' | 'status';
export type EventExpenseStatusFilter = 'all' | 'pending' | 'confirmed' | 'paid' | 'cancelled';

type GuestFilterRow = {
  name?: unknown;
  phone?: unknown;
  rsvp_status?: unknown;
};

type VendorFilterRow = {
  name?: unknown;
  category?: unknown;
  status?: unknown;
};

type ExpenseFilterRow = {
  id?: unknown;
  vendor_id?: unknown;
  status?: unknown;
};

type PaymentFilterRow = {
  expense_id?: unknown;
};

type DocumentFilterRow = {
  id?: unknown;
  vendor_id?: unknown;
  name?: unknown;
  category?: unknown;
};

export function filterEventGuests<T extends GuestFilterRow>(
  guests: readonly T[],
  filter: EventGuestFilter,
  searchValue: string,
  sort: EventGuestSort,
): T[] {
  const search = searchValue.trim().toLowerCase();
  const filtered = guests.filter((guest) => {
    if (filter !== 'all' && (guest.rsvp_status ?? 'pending') !== filter) return false;
    if (!search) return true;
    const name = String(guest.name ?? '').toLowerCase();
    const phone = String(guest.phone ?? '').toLowerCase();
    return name.includes(search) || phone.includes(search);
  });

  return [...filtered].sort((left, right) => {
    const leftName = String(left.name ?? '').toLowerCase();
    const rightName = String(right.name ?? '').toLowerCase();
    return sort === 'name_asc'
      ? leftName.localeCompare(rightName)
      : rightName.localeCompare(leftName);
  });
}

export function filterEventVendors<T extends VendorFilterRow>(
  vendors: readonly T[],
  searchValue: string,
  sort: EventVendorSort,
): T[] {
  const search = searchValue.trim().toLowerCase();
  const filtered = vendors.filter((vendor) => {
    if (!search) return true;
    return `${vendor.name ?? ''} ${vendor.category ?? ''}`.toLowerCase().includes(search);
  });

  return [...filtered].sort((left, right) => {
    if (sort === 'status') {
      return String(left.status ?? '').localeCompare(String(right.status ?? ''));
    }
    const leftName = String(left.name ?? '').toLowerCase();
    const rightName = String(right.name ?? '').toLowerCase();
    return sort === 'name_asc'
      ? leftName.localeCompare(rightName)
      : rightName.localeCompare(leftName);
  });
}

export function filterEventExpenses<T extends ExpenseFilterRow>(
  expenses: readonly T[],
  vendorFilter: string,
  statusFilter: EventExpenseStatusFilter,
): T[] {
  const vendorId = vendorFilter.trim();
  return expenses.filter((expense) => {
    if (vendorId && String(expense.vendor_id ?? '') !== vendorId) return false;
    if (statusFilter !== 'all' && String(expense.status ?? 'pending') !== statusFilter) return false;
    return true;
  });
}

export function filterEventPayments<T extends PaymentFilterRow>(
  payments: readonly T[],
  visibleExpenses: readonly ExpenseFilterRow[],
): T[] {
  const expenseIds = new Set(visibleExpenses.map((expense) => expense.id));
  return payments.filter((payment) => expenseIds.has(payment.expense_id));
}

export function filterEventDocuments<T extends DocumentFilterRow>(
  documents: readonly T[],
  receiptFilterId: string,
  vendorFilter: string,
  categoryFilter: string,
  searchValue: string,
): T[] {
  const vendorId = vendorFilter.trim();
  const category = categoryFilter.trim().toLowerCase();
  const search = searchValue.trim().toLowerCase();

  return documents.filter((document) => {
    if (receiptFilterId && String(document.id) !== receiptFilterId) return false;
    if (vendorId && String(document.vendor_id ?? '') !== vendorId) return false;
    if (category && String(document.category ?? '').toLowerCase() !== category) return false;
    if (!search) return true;
    return `${document.name ?? ''} ${document.category ?? ''}`.toLowerCase().includes(search);
  });
}
