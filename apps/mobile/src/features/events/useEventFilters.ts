import { useMemo, useState } from 'react';

import {
  filterEventDocuments,
  filterEventExpenses,
  filterEventGuests,
  filterEventPayments,
  filterEventTasks,
  filterEventVendors,
} from './eventDetailsFilters';
import type {
  DocumentFilterRow,
  ExpenseFilterRow,
  GuestFilterRow,
  PaymentFilterRow,
  TaskFilterRow,
  VendorFilterRow,
} from './eventDetailsFilters';

type EventFilterData<
  Guest extends GuestFilterRow,
  Vendor extends VendorFilterRow,
  Expense extends ExpenseFilterRow,
  Payment extends PaymentFilterRow,
  Document extends DocumentFilterRow,
  Task extends TaskFilterRow,
> = {
  guests: readonly Guest[];
  vendors: readonly Vendor[];
  expenses: readonly Expense[];
  payments: readonly Payment[];
  documents: readonly Document[];
  tasks: readonly Task[];
};

export function useEventFilters<
  Guest extends GuestFilterRow,
  Vendor extends VendorFilterRow,
  Expense extends ExpenseFilterRow,
  Payment extends PaymentFilterRow,
  Document extends DocumentFilterRow,
  Task extends TaskFilterRow,
>(
  data: EventFilterData<Guest, Vendor, Expense, Payment, Document, Task>,
  isTaskOverdue: (dueDate: string | null | undefined) => boolean,
) {
  const [guestFilter, setGuestFilter] = useState<'all' | 'pending' | 'confirmed' | 'declined'>('all');
  const [guestSearch, setGuestSearch] = useState('');
  const [guestSort, setGuestSort] = useState<'name_asc' | 'name_desc'>('name_asc');
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorSort, setVendorSort] = useState<'name_asc' | 'name_desc' | 'status'>('name_asc');
  const [budgetVendorFilter, setBudgetVendorFilter] = useState('');
  const [budgetStatusFilter, setBudgetStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'paid' | 'cancelled'>('all');
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentVendorFilter, setDocumentVendorFilter] = useState('');
  const [documentCategoryFilter, setDocumentCategoryFilter] = useState('');
  const [documentReceiptFilterId, setDocumentReceiptFilterId] = useState('');
  const [taskView, setTaskView] = useState<'urgent' | 'pending' | 'overdue' | 'completed'>('pending');

  const filteredGuests = useMemo(
    () => filterEventGuests(data.guests, guestFilter, guestSearch, guestSort),
    [data.guests, guestFilter, guestSearch, guestSort],
  );
  const filteredVendors = useMemo(
    () => filterEventVendors(data.vendors, vendorSearch, vendorSort),
    [data.vendors, vendorSearch, vendorSort],
  );
  const filteredExpenses = useMemo(
    () => filterEventExpenses(data.expenses, budgetVendorFilter, budgetStatusFilter),
    [data.expenses, budgetStatusFilter, budgetVendorFilter],
  );
  const filteredPayments = useMemo(
    () => filterEventPayments(data.payments, filteredExpenses),
    [data.payments, filteredExpenses],
  );
  const filteredDocuments = useMemo(
    () => filterEventDocuments(
      data.documents,
      documentReceiptFilterId,
      documentVendorFilter,
      documentCategoryFilter,
      documentSearch,
    ),
    [data.documents, documentCategoryFilter, documentReceiptFilterId, documentSearch, documentVendorFilter],
  );
  const documentCategories = useMemo(
    () => Array.from(new Set(data.documents.map((document) => String(document.category ?? 'Outros')).filter(Boolean))),
    [data.documents],
  );
  const filteredTasks = useMemo(
    () => filterEventTasks(data.tasks, taskView, isTaskOverdue),
    [data.tasks, isTaskOverdue, taskView],
  );

  return {
    guestFilter,
    setGuestFilter,
    guestSearch,
    setGuestSearch,
    guestSort,
    setGuestSort,
    vendorSearch,
    setVendorSearch,
    vendorSort,
    setVendorSort,
    budgetVendorFilter,
    setBudgetVendorFilter,
    budgetStatusFilter,
    setBudgetStatusFilter,
    documentSearch,
    setDocumentSearch,
    documentVendorFilter,
    setDocumentVendorFilter,
    documentCategoryFilter,
    setDocumentCategoryFilter,
    documentReceiptFilterId,
    setDocumentReceiptFilterId,
    filteredGuests,
    filteredVendors,
    filteredExpenses,
    filteredPayments,
    filteredDocuments,
    documentCategories,
    taskView,
    setTaskView,
    filteredTasks,
  };
}
