import * as Sentry from '@sentry/react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { withTimeout } from '../events/eventPresentation';
import { supabase } from '../../lib/supabase';
import { FIXTURE_LIBRARY, MAP_HEIGHT, MAP_WIDTH } from './constants';
import { buildInitialTablePositions, buildOccupancy, fixtureLabel, parseFixtureRows, snap } from './core';
import type { ActiveDragKeys, AutosaveState, FixtureItem, FixtureType, GuestRow, TablePositions, TableRow } from './types';

function friendlyMapError(error: unknown, fallback: string) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';
  Sentry.captureException(error instanceof Error ? error : new Error(message || fallback), {
    tags: { area: 'event_tables_visual_map' },
  });
  return message.includes('row-level security')
    ? 'Você não tem permissão para alterar este mapa.'
    : fallback;
}

type Params = {
  eventId: string;
  tables: TableRow[];
  guests: GuestRow[];
  activeDragKeys: ActiveDragKeys;
  onError: (message: string) => void;
  onTablePositionLocalUpdate?: (tableId: string, x: number, y: number) => void;
};

export function useTableMapModel(params: Params) {
  const { eventId, tables, guests, activeDragKeys, onTablePositionLocalUpdate } = params;
  const [tablePositions, setTablePositions] = useState<TablePositions>({});
  const [fixtures, setFixtures] = useState<FixtureItem[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [fixtureError, setFixtureError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [hasCustomLabelColumn, setHasCustomLabelColumn] = useState(true);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('saved');
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const [fixtureLabelDraft, setFixtureLabelDraft] = useState('');
  const [savingFixtureLabel, setSavingFixtureLabel] = useState(false);
  const tablePositionsRef = useRef(tablePositions);
  const fixturesRef = useRef(fixtures);
  const onErrorRef = useRef(params.onError);

  useEffect(() => { onErrorRef.current = params.onError; }, [params.onError]);
  useEffect(() => { tablePositionsRef.current = tablePositions; }, [tablePositions]);
  useEffect(() => { fixturesRef.current = fixtures; }, [fixtures]);
  useEffect(() => {
    setTablePositions((current) => buildInitialTablePositions(tables, current, activeDragKeys.current));
  }, [activeDragKeys, tables]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoadingFixtures(true);
      setFixtureError('');
      try {
        const full = await withTimeout(
          // egress-guard: allow-unbounded -- every event-scoped fixture is required to reconstruct the map.
          supabase.from('event_map_fixtures').select('id,type,x,y,w,h,custom_label').eq('event_id', eventId).order('created_at', { ascending: true }),
          12_000,
        );
        let rows: Array<Record<string, unknown>>;
        if (!full.error) {
          setHasCustomLabelColumn(true);
          rows = (full.data ?? []) as Array<Record<string, unknown>>;
        } else {
          const fallback = await withTimeout(
            // egress-guard: allow-unbounded -- legacy schema fallback must reconstruct the complete event map.
            supabase.from('event_map_fixtures').select('id,type,x,y,w,h').eq('event_id', eventId).order('created_at', { ascending: true }),
            12_000,
          );
          if (fallback.error) throw fallback.error;
          setHasCustomLabelColumn(false);
          rows = (fallback.data ?? []) as Array<Record<string, unknown>>;
        }
        if (alive) setFixtures(parseFixtureRows(rows));
      } catch (error) {
        if (!alive) return;
        const message = friendlyMapError(error, 'Não foi possível carregar o mapa agora.');
        setFixtureError(message);
        onErrorRef.current(message);
      } finally {
        if (alive) setLoadingFixtures(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, [eventId, loadAttempt]);

  const occupancy = useMemo(() => buildOccupancy(guests), [guests]);
  const selectedFixture = useMemo(
    () => fixtures.find((fixture) => fixture.id === selectedFixtureId) ?? null,
    [fixtures, selectedFixtureId],
  );
  useEffect(() => {
    setFixtureLabelDraft(selectedFixture ? fixtureLabel(selectedFixture) : '');
  }, [selectedFixture]);

  const persistTablePosition = useCallback(async (tableId: string) => {
    const current = tablePositionsRef.current[tableId];
    if (!current) return;
    const snapped = { x: snap(current.x), y: snap(current.y) };
    tablePositionsRef.current = { ...tablePositionsRef.current, [tableId]: snapped };
    setTablePositions(tablePositionsRef.current);
    onTablePositionLocalUpdate?.(tableId, snapped.x, snapped.y);
    setAutosaveState('saving');
    const { error } = await supabase.from('event_tables').update({ posx: snapped.x, posy: snapped.y }).eq('id', tableId);
    if (error) {
      setAutosaveState('error');
      onErrorRef.current(friendlyMapError(error, 'Não foi possível salvar a posição da mesa.'));
    } else setAutosaveState('saved');
  }, [onTablePositionLocalUpdate]);

  const persistFixturePosition = useCallback(async (fixtureId: string) => {
    const current = fixturesRef.current.find((fixture) => fixture.id === fixtureId);
    if (!current) return;
    const snapped = { x: snap(current.x), y: snap(current.y) };
    fixturesRef.current = fixturesRef.current.map((fixture) => fixture.id === fixtureId ? { ...fixture, ...snapped } : fixture);
    setFixtures(fixturesRef.current);
    setAutosaveState('saving');
    const { error } = await supabase.from('event_map_fixtures').update(snapped).eq('id', fixtureId);
    if (error) {
      setAutosaveState('error');
      onErrorRef.current(friendlyMapError(error, 'Não foi possível salvar a posição do item.'));
    } else setAutosaveState('saved');
  }, []);

  const addFixture = useCallback(async (type: FixtureType) => {
    setAutosaveState('saving');
    const config = FIXTURE_LIBRARY[type];
    const count = fixturesRef.current.length;
    const payload: Record<string, unknown> = {
      event_id: eventId,
      type,
      x: Math.min(60 + (count % 5) * 180, MAP_WIDTH - config.w),
      y: Math.min(50 + Math.floor(count / 5) * 120, MAP_HEIGHT - config.h),
      w: config.w,
      h: config.h,
    };
    if (hasCustomLabelColumn) payload.custom_label = null;
    const columns = hasCustomLabelColumn ? 'id,type,x,y,w,h,custom_label' : 'id,type,x,y,w,h';
    const result = await supabase.from('event_map_fixtures').insert(payload).select(columns).maybeSingle();
    if (result.error || !result.data) {
      setAutosaveState('error');
      onErrorRef.current(friendlyMapError(result.error, 'Não foi possível adicionar este item ao mapa. Tente novamente.'));
      return;
    }
    const [fixture] = parseFixtureRows([result.data as unknown as Record<string, unknown>]);
    if (fixture) setFixtures((current) => [...current, fixture]);
    setAutosaveState('saved');
  }, [eventId, hasCustomLabelColumn]);

  const deleteFixture = useCallback(async (fixtureId: string) => {
    setAutosaveState('saving');
    const { error } = await supabase.from('event_map_fixtures').delete().eq('id', fixtureId);
    if (error) {
      setAutosaveState('error');
      onErrorRef.current(error.message);
      return;
    }
    setFixtures((current) => current.filter((fixture) => fixture.id !== fixtureId));
    setSelectedFixtureId((current) => current === fixtureId ? null : current);
    setAutosaveState('saved');
  }, []);

  const saveFixtureLabel = useCallback(async () => {
    if (!selectedFixture) return;
    if (!hasCustomLabelColumn) {
      setSelectedFixtureId(null);
      return;
    }
    const draft = fixtureLabelDraft.trim();
    const fallback = FIXTURE_LIBRARY[selectedFixture.type].label;
    const customLabel = draft && draft !== fallback ? draft : null;
    setSavingFixtureLabel(true);
    setAutosaveState('saving');
    const { error } = await supabase.from('event_map_fixtures').update({ custom_label: customLabel }).eq('id', selectedFixture.id);
    setSavingFixtureLabel(false);
    if (error) {
      setAutosaveState('error');
      onErrorRef.current(error.message);
      return;
    }
    setFixtures((current) => current.map((fixture) => fixture.id === selectedFixture.id ? { ...fixture, custom_label: customLabel } : fixture));
    setSelectedFixtureId(null);
    setAutosaveState('saved');
  }, [fixtureLabelDraft, hasCustomLabelColumn, selectedFixture]);

  const resetMap = useCallback(async () => {
    setAutosaveState('saving');
    const { error } = await supabase.from('event_map_fixtures').delete().eq('event_id', eventId);
    if (error) {
      setAutosaveState('error');
      onErrorRef.current(error.message);
      return;
    }
    setFixtures([]);
    setSelectedFixtureId(null);
    setAutosaveState('saved');
  }, [eventId]);

  return {
    tablePositions, setTablePositions, tablePositionsRef,
    fixtures, setFixtures, fixturesRef,
    loadingFixtures, fixtureError, retryLoad: () => setLoadAttempt((value) => value + 1),
    occupancy, autosaveState,
    selectedFixture, setSelectedFixtureId,
    fixtureLabelDraft, setFixtureLabelDraft, savingFixtureLabel,
    persistTablePosition, persistFixturePosition,
    addFixture, deleteFixture, saveFixtureLabel, resetMap,
  };
}
