import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Linking } from 'react-native';

import { parseBrlInput } from '../../components/ui/PremiumInputs';
import { deleteStoredFile, getPrivateFileDownloadUrl } from '../../lib/r2FileStorage';
import { supabase } from '../../lib/supabase';
import type { EventDataState, EventDetailsTab } from './eventDetailsData';
import type { PaymentMethod } from './eventDetailsTypes';
import { composePaymentNote, normalizePaymentMethod } from './eventDetailsUtils';

type Args = {
  eventId: string; data: EventDataState; form: any; setForm: Dispatch<SetStateAction<any>>;
  filteredExpenses: any[]; setComposer: Dispatch<SetStateAction<EventDetailsTab | null>>;
  setError: Dispatch<SetStateAction<string>>; act: (fn: () => Promise<void>, reload?: boolean) => Promise<void>;
};

export function useEventOperationalActions({ eventId, data, form, setForm, filteredExpenses, setComposer, setError, act }: Args) {
  const [budgetVendorInput, setBudgetVendorInput] = useState('');
  const [documentVendorInput, setDocumentVendorInput] = useState('');
  const [budgetPaymentMethod, setBudgetPaymentMethod] = useState<PaymentMethod>('pix');
  const [budgetPaymentReceiptDocId, setBudgetPaymentReceiptDocId] = useState('');
  const [budgetPaymentNote, setBudgetPaymentNote] = useState('');
  const [paymentExpenseId, setPaymentExpenseId] = useState<string | null>(null);
  const [newVendorPhone, setNewVendorPhone] = useState('');
  const [newVendorEmail, setNewVendorEmail] = useState('');
  const [newVendorArrival, setNewVendorArrival] = useState('');
  const [newVendorDone, setNewVendorDone] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [taskNotesDraft, setTaskNotesDraft] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');

  const run = (fn: () => Promise<void>, reload = true) => act(fn, reload);
  const toggleTask = (task: any) => run(async () => { const { error } = await supabase.from('event_tasks').update({ completed: !task.completed }).eq('id', task.id); if (error) throw new Error(error.message); });
  const cycleTaskPriority = (task: any) => run(async () => { const priority = task.priority === 'urgent' ? 'low' : task.priority === 'high' ? 'urgent' : task.priority === 'normal' ? 'high' : 'normal'; const { error } = await supabase.from('event_tasks').update({ priority }).eq('id', task.id); if (error) throw new Error(error.message); });
  const deleteTask = (id: string) => run(async () => { const { error } = await supabase.from('event_tasks').delete().eq('id', id); if (error) throw new Error(error.message); });
  const selectTask = (task: any) => { setSelectedTask(task); setTaskNotesDraft(String(task.notes ?? '')); };
  const createTask = () => run(async () => {
    if (!form.a.trim()) return;
    const { error } = await supabase.from('event_tasks').insert({ event_id: eventId, text: form.a.trim(), notes: newTaskNotes.trim() || null, completed: false, due_date: newTaskDueDate.trim() || null, priority: newTaskPriority, assignee_name: newTaskAssignee.trim() || null, position: data.tasks.length } as never);
    if (error) throw new Error(error.message);
    setForm((current: any) => ({ ...current, a: '' })); setNewTaskDueDate(''); setNewTaskNotes(''); setNewTaskAssignee(''); setNewTaskPriority('normal'); setComposer(null);
  });
  const saveSelectedTask = () => run(async () => {
    if (!selectedTask?.id) return;
    const { error } = await supabase.from('event_tasks').update({ notes: taskNotesDraft.trim() || null, due_date: selectedTask.due_date || null } as never).eq('id', selectedTask.id);
    if (error) throw new Error(error.message); setSelectedTask(null);
  });

  const advanceExpense = (expense: any) => run(async () => { const { error } = await supabase.from('event_expenses').update({ status: expense.status === 'confirmed' ? 'paid' : 'confirmed' }).eq('id', expense.id); if (error) throw new Error(error.message); });
  const deleteExpense = (id: string) => run(async () => { await supabase.from('expense_payments').delete().eq('expense_id', id); const { error } = await supabase.from('event_expenses').delete().eq('id', id); if (error) throw new Error(error.message); });
  const createExpense = () => run(async () => {
    const value = parseBrlInput(form.b); if (!form.a.trim() || !Number.isFinite(value) || value <= 0) return;
    const { error } = await supabase.from('event_expenses').insert({ event_id: eventId, name: form.a.trim(), value, color: '#D4AF37', status: 'pending', vendor_id: budgetVendorInput || null });
    if (error) throw new Error(error.message); setForm((current: any) => ({ ...current, a: '', b: '' })); setBudgetVendorInput(''); setComposer(null);
  });
  const createPayment = () => run(async () => {
    const expense = filteredExpenses.find((item) => String(item.id) === paymentExpenseId); if (!expense) return;
    const note = composePaymentNote(budgetPaymentNote, { receipt_document_id: budgetPaymentReceiptDocId.trim() || null });
    const { error } = await supabase.from('expense_payments').insert({ event_id: eventId, expense_id: expense.id, amount: Number(expense.value ?? 0), method: normalizePaymentMethod(budgetPaymentMethod), paid_at: new Date().toISOString(), note });
    if (error) throw new Error(error.message); setBudgetPaymentReceiptDocId(''); setBudgetPaymentNote(''); setPaymentExpenseId(null);
  });
  const deletePayment = (id: string) => run(async () => { const { error } = await supabase.from('expense_payments').delete().eq('id', id); if (error) throw new Error(error.message); });

  const setGuestStatus = (id: string, status: 'confirmed' | 'declined') => run(async () => { const { error } = await supabase.from('event_guests').update({ rsvp_status: status, confirmed: status === 'confirmed' }).eq('id', id); if (error) throw new Error(error.message); });
  const deleteGuest = (id: string) => run(async () => { const { error } = await supabase.from('event_guests').delete().eq('id', id); if (error) throw new Error(error.message); });
  const createGuest = () => run(async () => { if (!form.a.trim()) return; const { error } = await supabase.from('event_guests').insert({ event_id: eventId, name: form.a.trim(), phone: form.b.trim() || null, rsvp_status: 'pending', confirmed: false }); if (error) throw new Error(error.message); setForm((current: any) => ({ ...current, a: '', b: '' })); setComposer(null); });

  const deleteTimelineItem = (id: string) => run(async () => { const { error } = await supabase.from('event_timeline').delete().eq('id', id); if (error) throw new Error(error.message); });
  const createTimelineItem = () => run(async () => { if (!form.b.trim()) return; const { error } = await supabase.from('event_timeline').insert({ event_id: eventId, time: form.a.trim() || '00:00', activity: form.b.trim(), assignee_name: form.c.trim() || null, position: data.timeline.length }); if (error) throw new Error(error.message); setForm((current: any) => ({ ...current, a: '', b: '', c: '' })); setComposer(null); });

  const linkCatalogVendor = (id: string) => run(async () => { const { error } = await supabase.rpc('link_catalog_vendor_to_event', { p_event_id: eventId, p_vendor_id: id }); if (error) throw new Error(error.message); });
  const advanceVendor = (vendor: any) => run(async () => { const { error } = await supabase.from('event_vendors').update({ status: vendor.status === 'confirmed' ? 'paid' : 'confirmed' }).eq('id', vendor.id); if (error) throw new Error(error.message); });
  const deleteVendor = (id: string) => run(async () => { const { error } = await supabase.from('event_vendors').delete().eq('id', id); if (error) throw new Error(error.message); });
  const createVendor = () => run(async () => {
    if (!form.a.trim() || !form.b.trim()) return;
    const { error } = await supabase.from('event_vendors').insert({ event_id: eventId, name: form.a.trim(), category: form.b.trim(), status: 'pending', phone: newVendorPhone.trim() || null, email: newVendorEmail.trim() || null, expected_arrival_time: newVendorArrival.trim() || null, expected_done_time: newVendorDone.trim() || null });
    if (error) throw new Error(error.message); setForm((current: any) => ({ ...current, a: '', b: '' })); setNewVendorPhone(''); setNewVendorEmail(''); setNewVendorArrival(''); setNewVendorDone(''); setComposer(null);
  });

  async function openDocument(doc: any) { try { if (doc.file_id) { await Linking.openURL(await getPrivateFileDownloadUrl(String(doc.file_id))); return; } if (doc.file_url) await Linking.openURL(String(doc.file_url)); } catch (error: any) { setError(error?.message ?? 'Não foi possível abrir o documento.'); } }
  const deleteDocument = (doc: any) => run(async () => { if (doc.file_id) await deleteStoredFile(String(doc.file_id)).catch(() => undefined); const { error } = await supabase.from('event_documents').delete().eq('id', doc.id); if (error) throw new Error(error.message); });
  const createDocumentLink = () => run(async () => { if (!form.a.trim() || !form.b.trim()) return; const { error } = await supabase.from('event_documents').insert({ event_id: eventId, name: form.a.trim(), file_url: form.b.trim(), category: form.c.trim() || 'Outros', vendor_id: documentVendorInput || null }); if (error) throw new Error(error.message); setForm((current: any) => ({ ...current, a: '', b: '', c: '' })); setDocumentVendorInput(''); setComposer(null); });

  return { budgetVendorInput, setBudgetVendorInput, documentVendorInput, setDocumentVendorInput, budgetPaymentMethod, setBudgetPaymentMethod,
    budgetPaymentNote, setBudgetPaymentNote, paymentExpenseId, setPaymentExpenseId, newVendorPhone, setNewVendorPhone, newVendorEmail,
    setNewVendorEmail, newVendorArrival, setNewVendorArrival, newVendorDone, setNewVendorDone, newTaskDueDate, setNewTaskDueDate,
    newTaskNotes, setNewTaskNotes, selectedTask, setSelectedTask, taskNotesDraft, setTaskNotesDraft, newTaskPriority, setNewTaskPriority,
    newTaskAssignee, setNewTaskAssignee, toggleTask, cycleTaskPriority, deleteTask, selectTask, createTask, saveSelectedTask,
    advanceExpense, deleteExpense, createExpense, createPayment, deletePayment, setGuestStatus, deleteGuest, createGuest,
    deleteTimelineItem, createTimelineItem, linkCatalogVendor, advanceVendor, deleteVendor, createVendor, openDocument, deleteDocument, createDocumentLink };
}
