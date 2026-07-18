import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { supabase } from '../../lib/supabase';
import { friendlyFinanceError, normalizeExpenseRow } from './financeScreenHelpers';
import type { FinanceCategory, FinanceEntry, FinanceExpense } from './types';

export function useFinanceData(userId: string | null) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [baseBalance, setBaseBalance] = useState(0);
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [cashInput, setCashInput] = useState('0');

  const reload = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const [onboarding, balance, entryRows, expenseRows, categoryRows] = await Promise.all([
        supabase.from('user_finance_onboarding').select('completed_at').eq('user_id', userId).maybeSingle(),
        supabase.from('user_finance_balance').select('base_balance').eq('user_id', userId).maybeSingle(),
        supabase.from('user_finance_entries').select('id,user_id,client_name,title,amount,status,received_at,expected_at,payment_method,proof_file_id,proof_url,notes,created_at').eq('user_id', userId).order('received_at', { ascending: false, nullsFirst: false }),
        supabase.from('user_finance_expenses').select('id,user_id,title,amount,status,paid_at,expected_at,category_id,category_label,team_member_name,payment_method,proof_file_id,proof_url,notes,created_at,user_finance_categories(name,color)').eq('user_id', userId).order('paid_at', { ascending: false, nullsFirst: false }),
        supabase.from('user_finance_categories').select('id,user_id,name,type,color').eq('user_id', userId),
      ]);
      const requestError = entryRows.error || expenseRows.error || categoryRows.error || balance.error || onboarding.error;
      if (requestError) throw requestError;
      setEntries((entryRows.data ?? []) as FinanceEntry[]);
      setExpenses(((expenseRows.data ?? []) as unknown as FinanceExpense[]).map(normalizeExpenseRow));
      setCategories((categoryRows.data ?? []) as FinanceCategory[]);
      const nextBalance = Number(balance.data?.base_balance ?? 0);
      setBaseBalance(nextBalance);
      setCashInput(String(nextBalance));
      setOnboardingOpen(!onboarding.data?.completed_at);
    } catch {
      setError(friendlyFinanceError());
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  return {
    loading, error, setError, baseBalance, setBaseBalance,
    entries, setEntries, expenses, setExpenses, categories, setCategories,
    onboardingOpen, setOnboardingOpen, cashInput, setCashInput, reload,
  };
}
