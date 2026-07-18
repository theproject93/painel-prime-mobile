import { useEffect, useState } from 'react';

import { supabase } from '../../lib/supabase';
import {
  EVENT_DATA_PAGE_SIZE,
  EVENT_DATA_TABLES,
  EVENT_TAB_DATA_KEYS,
  createEventDataState,
  createEventLoadedState,
  createEventPagingState,
  mergeEventDataPage,
} from './eventDetailsData';
import type {
  EventDataKey,
  EventDataLoadMode,
  EventDetailsTab,
} from './eventDetailsData';

export function useEventDetailsData(
  eventId: string,
  activeTab: EventDetailsTab,
  loadingEvent: boolean,
) {
  const [loadingTab, setLoadingTab] = useState(false);
  const [loadingMore, setLoadingMore] = useState<EventDataKey | null>(null);
  const [error, setError] = useState('');
  const [data, setData] = useState(createEventDataState);
  const [loaded, setLoaded] = useState(createEventLoadedState);
  const [paging, setPaging] = useState(createEventPagingState);

  async function fetchKey(key: EventDataKey, page: number) {
    const order = key === 'payments' ? 'paid_at' : 'created_at';
    const from = page * EVENT_DATA_PAGE_SIZE;
    const to = from + EVENT_DATA_PAGE_SIZE - 1;
    const { data: rows, error: queryError } = await supabase
      .from(EVENT_DATA_TABLES[key])
      .select('*')
      .eq('event_id', eventId)
      .order(order, { ascending: false })
      .range(from, to);
    if (queryError) throw new Error(queryError.message);
    return (rows ?? []) as any[];
  }

  async function loadKey(key: EventDataKey, mode: EventDataLoadMode) {
    const page = mode === 'reset' ? 0 : paging[key].page + 1;
    const rows = await fetchKey(key, page);
    setData((current) => ({
      ...current,
      [key]: mergeEventDataPage(current[key], rows, mode),
    }));
    setPaging((current) => ({
      ...current,
      [key]: { page, hasMore: rows.length === EVENT_DATA_PAGE_SIZE },
    }));
    setLoaded((current) => ({ ...current, [key]: true }));
  }

  async function loadTab(tab: EventDetailsTab, force = false) {
    const wanted = EVENT_TAB_DATA_KEYS[tab];
    const todo = force ? wanted : wanted.filter((key) => !loaded[key]);
    if (todo.length === 0) return;
    setLoadingTab(true);
    setError('');
    try {
      await Promise.all(todo.map((key) => loadKey(key, 'reset')));
    } catch (loadError: any) {
      setError(loadError?.message ?? 'Erro ao carregar aba');
    } finally {
      setLoadingTab(false);
    }
  }

  async function loadMoreKey(key: EventDataKey) {
    if (!paging[key].hasMore || loadingMore === key) return;
    setLoadingMore(key);
    setError('');
    try {
      await loadKey(key, 'append');
    } catch (loadError: any) {
      setError(loadError?.message ?? 'Erro ao carregar mais registros');
    } finally {
      setLoadingMore(null);
    }
  }

  useEffect(() => {
    if (!loadingEvent) void loadTab(activeTab);
  }, [activeTab, loadingEvent]);

  return {
    loadingTab,
    loadingMore,
    error,
    setError,
    data,
    setData,
    paging,
    loadKey,
    loadTab,
    loadMoreKey,
  };
}
