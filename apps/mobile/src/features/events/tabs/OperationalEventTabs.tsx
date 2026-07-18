import type { Dispatch, SetStateAction } from 'react';

import type { EventDataState, EventDetailsTab } from '../eventDetailsData';
import type { PaymentMethod, VisibleKey } from '../eventDetailsTypes';
import type { useEventOperationalActions } from '../useEventOperationalActions';
import { BudgetTab } from './BudgetTab';
import { DocumentsTab } from './DocumentsTab';
import { GuestsTab } from './GuestsTab';
import { TasksTab } from './TasksTab';
import { TimelineTab } from './TimelineTab';
import { VendorsTab } from './VendorsTab';

type FormState = {
  a: string;
  b: string;
  c: string;
  d: string;
  budgetTotal: string;
  inviteTemplate: string;
  inviteDress: string;
};

type PagingState = Record<'tasks' | 'timeline' | 'vendors' | 'documents', { hasMore: boolean }>;
type OperationalActions = ReturnType<typeof useEventOperationalActions>;

export type OperationalEventTabsProps = {
  activeTab: EventDetailsTab;
  data: EventDataState;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  composer: EventDetailsTab | null;
  setComposer: Dispatch<SetStateAction<EventDetailsTab | null>>;
  visible: Record<VisibleKey, number>;
  paging: PagingState;
  loadingMore: string | null;
  loadMoreKey: (key: any) => Promise<void>;
  showMore: (key: VisibleKey) => void;
  actions: OperationalActions;
  taskView: string;
  setTaskView: (value: any) => void;
  visibleTasks: any[];
  filteredTasks: any[];
  taskSummary: any;
  assigneeOptions: Array<{ value: string; label: string }>;
  budgetTotal: number;
  totalExpenses: number;
  hideFinancialValues: boolean;
  setHideFinancialValues: Dispatch<SetStateAction<boolean>>;
  personaDescription: string;
  filteredExpenses: any[];
  filteredPayments: any[];
  budgetVendorFilter: string;
  setBudgetVendorFilter: (value: string) => void;
  budgetStatusFilter: string;
  setBudgetStatusFilter: (value: any) => void;
  guestSummary: any;
  visibleGuests: any[];
  guestSearch: string;
  setGuestSearch: (value: string) => void;
  guestFilter: string;
  setGuestFilter: (value: any) => void;
  guestSort: string;
  setGuestSort: (value: any) => void;
  timelineSuggestions: any[];
  loadingAiTimelineSuggestions: boolean;
  lastAiTimelineRunAt: string | null;
  aiTimelineError: string | null;
  applySmartTimelineSuggestion: (item: any) => Promise<void>;
  generateHybridTimelineSuggestions: () => Promise<void>;
  visibleTimeline: any[];
  catalogVendors: any[];
  loadingCatalogVendors: boolean;
  filteredVendors: any[];
  visibleVendors: any[];
  vendorSearch: string;
  setVendorSearch: (value: string) => void;
  vendorSort: string;
  setVendorSort: (value: any) => void;
  paymentReceiptCountByVendor: Map<string, number>;
  setActiveTab: Dispatch<SetStateAction<EventDetailsTab>>;
  visibleDocuments: any[];
  filteredDocuments: any[];
  documentCategories: string[];
  documentReceiptFilterId: string;
  setDocumentReceiptFilterId: (value: string) => void;
  documentVendorFilter: string;
  setDocumentVendorFilter: (value: string) => void;
  documentSearch: string;
  setDocumentSearch: (value: string) => void;
  documentCategoryFilter: string;
  setDocumentCategoryFilter: (value: string) => void;
  uploadingDoc: boolean;
  pickAndUploadDocument: () => Promise<void>;
  timelinePlaceholder: string;
};

export function OperationalEventTabs(props: OperationalEventTabsProps) {
  const { actions: a, data, form, setForm, composer, setComposer, visible, paging, loadingMore } = props;
  const closeComposer = () => setComposer(null);

  if (props.activeTab === 'tasks') {
    return <TasksTab tasks={props.visibleTasks} filteredCount={props.filteredTasks.length} visibleLimit={visible.tasks}
      summary={props.taskSummary} view={props.taskView} composerOpen={composer === 'tasks'} draftText={form.a}
      dueDate={a.newTaskDueDate} notes={a.newTaskNotes} assignee={a.newTaskAssignee} priority={a.newTaskPriority}
      assigneeOptions={props.assigneeOptions} selectedTask={a.selectedTask} taskNotes={a.taskNotesDraft}
      hasMore={paging.tasks.hasMore} loadingMore={loadingMore === 'tasks'} onViewChange={props.setTaskView}
      onOpenComposer={() => setComposer('tasks')} onCloseComposer={closeComposer}
      onDraftTextChange={(value) => setForm((state) => ({ ...state, a: value }))} onDueDateChange={a.setNewTaskDueDate}
      onNotesChange={a.setNewTaskNotes} onAssigneeChange={a.setNewTaskAssignee} onPriorityChange={(value) => a.setNewTaskPriority(value as typeof a.newTaskPriority)}
      onSelectTask={a.selectTask} onSelectedTaskChange={a.setSelectedTask} onTaskNotesChange={a.setTaskNotesDraft}
      onToggle={(task) => void a.toggleTask(task)} onCyclePriority={(task) => void a.cycleTaskPriority(task)}
      onDelete={(id) => void a.deleteTask(id)} onCreate={() => void a.createTask()} onSaveSelected={() => void a.saveSelectedTask()}
      onShowMore={() => props.showMore('tasks')} onLoadMore={() => void props.loadMoreKey('tasks')} />;
  }

  if (props.activeTab === 'budget') {
    return <BudgetTab model={{ budgetTotal: props.budgetTotal, totalExpenses: props.totalExpenses, hidden: props.hideFinancialValues,
      personaDescription: props.personaDescription, vendors: data.vendors, expenses: props.filteredExpenses,
      payments: props.filteredPayments, vendorFilter: props.budgetVendorFilter, statusFilter: props.budgetStatusFilter,
      vendorInput: a.budgetVendorInput, composerOpen: composer === 'budget', draftName: form.a, draftValue: form.b,
      paymentExpenseId: a.paymentExpenseId, paymentMethod: a.budgetPaymentMethod, paymentNote: a.budgetPaymentNote,
      onTogglePrivacy: () => props.setHideFinancialValues((value) => !value), onVendorFilterClear: () => props.setBudgetVendorFilter(''),
      onStatusFilterChange: props.setBudgetStatusFilter, onOpenComposer: () => setComposer('budget'), onCloseComposer: closeComposer,
      onDraftNameChange: (value) => setForm((state) => ({ ...state, a: value })), onDraftValueChange: (value) => setForm((state) => ({ ...state, b: value })),
      onVendorInputChange: a.setBudgetVendorInput, onCreateExpense: () => void a.createExpense(), onOpenPayment: a.setPaymentExpenseId,
      onClosePayment: () => a.setPaymentExpenseId(null), onPaymentMethodChange: (value) => a.setBudgetPaymentMethod(value as PaymentMethod),
      onPaymentNoteChange: a.setBudgetPaymentNote, onCreatePayment: () => void a.createPayment(), onAdvanceExpense: (expense) => void a.advanceExpense(expense),
      onDeleteExpense: (id) => void a.deleteExpense(id), onDeletePayment: (id) => void a.deletePayment(id),
      onOpenReceipt: (id) => { props.setDocumentReceiptFilterId(id); props.setActiveTab('documents'); },
    }} />;
  }

  if (props.activeTab === 'guests') {
    return <GuestsTab model={{ summary: props.guestSummary, guests: props.visibleGuests, search: props.guestSearch,
      filter: props.guestFilter, sort: props.guestSort, composerOpen: composer === 'guests', name: form.a, phone: form.b,
      onSearchChange: props.setGuestSearch, onFilterChange: props.setGuestFilter,
      onToggleSort: () => props.setGuestSort(props.guestSort === 'name_asc' ? 'name_desc' : 'name_asc'),
      onOpenComposer: () => setComposer('guests'), onCloseComposer: closeComposer,
      onNameChange: (value) => setForm((state) => ({ ...state, a: value })), onPhoneChange: (value) => setForm((state) => ({ ...state, b: value })),
      onConfirm: (id) => void a.setGuestStatus(id, 'confirmed'), onDecline: (id) => void a.setGuestStatus(id, 'declined'),
      onDelete: (id) => void a.deleteGuest(id), onCreate: () => void a.createGuest(),
    }} />;
  }

  if (props.activeTab === 'timeline') {
    return <TimelineTab model={{ timeline: props.visibleTimeline, total: data.timeline.length, suggestions: props.timelineSuggestions,
      loadingSuggestions: props.loadingAiTimelineSuggestions, error: props.aiTimelineError, lastRunAt: props.lastAiTimelineRunAt,
      composerOpen: composer === 'timeline', time: form.a, activity: form.b, assignee: form.c,
      assigneeOptions: props.assigneeOptions, hasMore: paging.timeline.hasMore, loadingMore: loadingMore === 'timeline',
      placeholder: props.timelinePlaceholder, onGenerate: () => void props.generateHybridTimelineSuggestions(),
      onApply: (item) => void props.applySmartTimelineSuggestion(item), onDelete: (id) => void a.deleteTimelineItem(id),
      onShowMore: () => props.showMore('timeline'), onLoadMore: () => void props.loadMoreKey('timeline'),
      onOpenComposer: () => setComposer('timeline'), onCloseComposer: closeComposer,
      onTimeChange: (value) => setForm((state) => ({ ...state, a: value })), onActivityChange: (value) => setForm((state) => ({ ...state, b: value })),
      onAssigneeChange: (value) => setForm((state) => ({ ...state, c: value })), onCreate: () => void a.createTimelineItem(),
    }} />;
  }

  if (props.activeTab === 'vendors') {
    return <VendorsTab model={{ vendors: data.vendors, visibleVendors: props.visibleVendors, filteredCount: props.filteredVendors.length,
      visibleLimit: visible.vendors, catalog: props.catalogVendors, loadingCatalog: props.loadingCatalogVendors,
      search: props.vendorSearch, sort: props.vendorSort, composerOpen: composer === 'vendors', name: form.a, category: form.b,
      phone: a.newVendorPhone, email: a.newVendorEmail, arrival: a.newVendorArrival, done: a.newVendorDone,
      receiptCounts: props.paymentReceiptCountByVendor, hasMore: paging.vendors.hasMore, loadingMore: loadingMore === 'vendors',
      onSearchChange: props.setVendorSearch, onSortChange: props.setVendorSort, onOpenComposer: () => setComposer('vendors'), onCloseComposer: closeComposer,
      onLinkCatalog: (id) => void a.linkCatalogVendor(id), onAdvance: (vendor) => void a.advanceVendor(vendor),
      onOpenBudget: (id) => { props.setBudgetVendorFilter(id); props.setActiveTab('budget'); },
      onOpenDocuments: (id) => { props.setDocumentVendorFilter(id); props.setActiveTab('documents'); },
      onDelete: (id) => void a.deleteVendor(id), onShowMore: () => props.showMore('vendors'), onLoadMore: () => void props.loadMoreKey('vendors'),
      onNameChange: (value) => setForm((state) => ({ ...state, a: value })), onCategoryChange: (value) => setForm((state) => ({ ...state, b: value })),
      onPhoneChange: a.setNewVendorPhone, onEmailChange: a.setNewVendorEmail, onArrivalChange: a.setNewVendorArrival,
      onDoneChange: a.setNewVendorDone, onCreate: () => void a.createVendor(),
    }} />;
  }

  if (props.activeTab === 'documents') {
    return <DocumentsTab model={{ documents: props.visibleDocuments, filteredCount: props.filteredDocuments.length,
      visibleLimit: visible.documents, vendors: data.vendors, categories: props.documentCategories,
      receiptFilter: props.documentReceiptFilterId, vendorFilter: props.documentVendorFilter, categoryFilter: props.documentCategoryFilter,
      search: props.documentSearch, composerOpen: composer === 'documents', uploading: props.uploadingDoc,
      name: form.a, link: form.b, category: form.c, vendorInput: a.documentVendorInput,
      hasMore: paging.documents.hasMore, loadingMore: loadingMore === 'documents',
      onClearReceipt: () => props.setDocumentReceiptFilterId(''), onClearVendor: () => props.setDocumentVendorFilter(''),
      onSearchChange: props.setDocumentSearch, onCategoryFilterChange: props.setDocumentCategoryFilter,
      onOpen: (doc) => void a.openDocument(doc), onDelete: (doc) => void a.deleteDocument(doc),
      onShowMore: () => props.showMore('documents'), onLoadMore: () => void props.loadMoreKey('documents'),
      onOpenComposer: () => setComposer('documents'), onCloseComposer: closeComposer,
      onUpload: () => void props.pickAndUploadDocument(), onNameChange: (value) => setForm((state) => ({ ...state, a: value })),
      onLinkChange: (value) => setForm((state) => ({ ...state, b: value })), onCategoryChange: (value) => setForm((state) => ({ ...state, c: value })),
      onVendorInputChange: a.setDocumentVendorInput, onCreateLink: () => void a.createDocumentLink(),
    }} />;
  }

  return null;
}
