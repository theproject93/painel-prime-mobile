import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from '../../lib/supabase';
import {
  DISMISS_COOLDOWN_MS,
  HINT_COOLDOWN_MS,
  HINT_REFRESH_TTL_MS,
  PROACTIVE_BUBBLE_MS,
  shouldTemporarilyHideHint,
} from './core';
import { buildPlanHints, type EventLite, type GuestLite, type TaskLite, type VendorLite } from './hintEngine';
import type { HintStateRow, PlanHint } from './types';

type CachedHints = {
  fetchedAt: number;
  hints: PlanHint[];
  state: Record<string, HintStateRow>;
};

const memoryCache = new Map<string, CachedHints>();

export function usePlanAssistantHints(userId: string | null, isOpen: boolean) {
  const [hints, setHints] = useState<PlanHint[]>([]);
  const [loading, setLoading] = useState(false);
  const [hintState, setHintState] = useState<Record<string, HintStateRow>>({});
  const [proactiveHint, setProactiveHint] = useState<PlanHint | null>(null);
  const [showProactiveBubble, setShowProactiveBubble] = useState(false);
  const shownThisSession = useRef(false);
  const requestGeneration = useRef(0);

  const applySnapshot = useCallback((snapshot: CachedHints) => {
    setHints(snapshot.hints);
    setHintState(snapshot.state);
  }, []);

  const loadHints = useCallback(async (force = false) => {
    if (!userId || AppState.currentState !== 'active') return;
    const cached = memoryCache.get(userId);
    if (!force && cached && Date.now() - cached.fetchedAt < HINT_REFRESH_TTL_MS) {
      applySnapshot(cached);
      return;
    }

    const generation = ++requestGeneration.current;
    setLoading(true);
    try {
      const eventsResult = await supabase
        .from('events')
        .select('id,name,event_date')
        .eq('user_id', userId)
        .or('status.is.null,status.neq.deleted')
        .order('event_date', { ascending: true })
        .limit(8);
      if (eventsResult.error) throw eventsResult.error;
      const events = (eventsResult.data as EventLite[]) ?? [];

      let nextHints: PlanHint[] = [];
      let nextState: Record<string, HintStateRow> = {};
      if (events.length > 0) {
        const eventIds = events.map((event) => event.id);
        const [vendorsResult, guestsResult, tasksResult] = await Promise.all([
          supabase.from('event_vendors').select('event_id,category,expected_arrival_time,expected_done_time').in('event_id', eventIds),
          supabase.from('event_guests').select('event_id,confirmed,rsvp_status').in('event_id', eventIds),
          supabase.from('event_tasks').select('event_id,completed,due_date').in('event_id', eventIds),
        ]);
        if (vendorsResult.error) throw vendorsResult.error;
        if (guestsResult.error) throw guestsResult.error;
        if (tasksResult.error) throw tasksResult.error;

        const selected = buildPlanHints(
          events,
          (vendorsResult.data as VendorLite[]) ?? [],
          (guestsResult.data as GuestLite[]) ?? [],
          (tasksResult.data as TaskLite[]) ?? [],
        ).slice(0, 6);
        if (selected.length > 0) {
          const stateResult = await supabase
            .from('user_plan_assistant_hint_state')
            .select('hint_id,last_action,last_action_at,last_shown_at,last_opened_at,last_dismissed_at')
            .eq('user_id', userId)
            .in('hint_id', selected.map((hint) => hint.id));
          if (stateResult.error) throw stateResult.error;
          nextState = ((stateResult.data as HintStateRow[]) ?? []).reduce<Record<string, HintStateRow>>(
            (acc, row) => ({ ...acc, [row.hint_id]: row }),
            {},
          );
          nextHints = selected.filter((hint) => !shouldTemporarilyHideHint(nextState[hint.id], Date.now())).slice(0, 1);
        }
      }

      if (generation !== requestGeneration.current) return;
      const snapshot = { fetchedAt: Date.now(), hints: nextHints, state: nextState };
      memoryCache.set(userId, snapshot);
      applySnapshot(snapshot);
      setProactiveHint((previous) => previous && nextHints.some((hint) => hint.id === previous.id) ? previous : null);
      setShowProactiveBubble((previous) => previous && nextHints.length > 0);
    } catch {
      if (generation === requestGeneration.current && !memoryCache.has(userId)) {
        setHints([]);
        setHintState({});
      }
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [applySnapshot, userId]);

  const registerAction = useCallback(async (
    hint: PlanHint,
    action: 'shown' | 'opened' | 'dismissed',
  ) => {
    if (!userId) return;
    const nowIso = new Date().toISOString();
    const current = hintState[hint.id];
    const row: HintStateRow = {
      hint_id: hint.id,
      last_action: action,
      last_action_at: nowIso,
      last_shown_at: action === 'shown' ? nowIso : current?.last_shown_at ?? null,
      last_opened_at: action === 'opened' ? nowIso : current?.last_opened_at ?? null,
      last_dismissed_at: action === 'dismissed' ? nowIso : current?.last_dismissed_at ?? null,
    };
    const { error } = await supabase.from('user_plan_assistant_hint_state').upsert(
      { user_id: userId, ...row, updated_at: nowIso },
      { onConflict: 'user_id,hint_id' },
    );
    if (error) return;
    setHintState((previous) => ({ ...previous, [hint.id]: row }));
    const cached = memoryCache.get(userId);
    if (cached) memoryCache.set(userId, { ...cached, state: { ...cached.state, [hint.id]: row } });
  }, [hintState, userId]);

  const consumeHint = useCallback(async (hint: PlanHint, action: 'opened' | 'dismissed') => {
    setShowProactiveBubble(false);
    await registerAction(hint, action);
    setHints((previous) => previous.filter((item) => item.id !== hint.id));
    setProactiveHint((previous) => previous?.id === hint.id ? null : previous);
    if (userId) {
      const cached = memoryCache.get(userId);
      if (cached) {
        memoryCache.set(userId, {
          ...cached,
          hints: cached.hints.filter((item) => item.id !== hint.id),
        });
      }
    }
  }, [registerAction, userId]);
  const hideProactiveBubble = useCallback(() => setShowProactiveBubble(false), []);

  useEffect(() => {
    requestGeneration.current += 1;
    shownThisSession.current = false;
    setProactiveHint(null);
    setShowProactiveBubble(false);
    if (!userId) {
      setHints([]);
      setHintState({});
      return;
    }
    const cached = memoryCache.get(userId);
    if (cached) applySnapshot(cached);
    void loadHints();
    return () => { requestGeneration.current += 1; };
  }, [applySnapshot, loadHints, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadHints();
    });
    return () => subscription.remove();
  }, [loadHints]);

  useEffect(() => {
    if (!userId || isOpen || hints.length === 0 || shownThisSession.current) return;
    const top = hints[0];
    const state = hintState[top.id];
    const now = Date.now();
    if (now - (state?.last_shown_at ? new Date(state.last_shown_at).getTime() : 0) < HINT_COOLDOWN_MS) return;
    if (now - (state?.last_dismissed_at ? new Date(state.last_dismissed_at).getTime() : 0) < DISMISS_COOLDOWN_MS) return;
    setProactiveHint(top);
    setShowProactiveBubble(true);
    shownThisSession.current = true;
    void registerAction(top, 'shown');
  }, [hintState, hints, isOpen, registerAction, userId]);

  useEffect(() => {
    if (!showProactiveBubble) return;
    const timeout = setTimeout(() => setShowProactiveBubble(false), PROACTIVE_BUBBLE_MS);
    return () => clearTimeout(timeout);
  }, [showProactiveBubble]);

  return {
    hints,
    loadingHints: loading,
    proactiveHint,
    showProactiveBubble,
    hideProactiveBubble,
    consumeHint,
  };
}
