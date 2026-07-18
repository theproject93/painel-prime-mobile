import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { PanResponder } from 'react-native';

import { MAP_HEIGHT, MAP_WIDTH } from './constants';
import { clamp } from './core';
import type { ActiveDragKeys, FixtureItem, Point, TablePositions } from './types';

type Params = {
  activeDragKeys: ActiveDragKeys;
  tablePositionsRef: React.MutableRefObject<TablePositions>;
  fixturesRef: React.MutableRefObject<FixtureItem[]>;
  setTablePositions: Dispatch<SetStateAction<TablePositions>>;
  setFixtures: Dispatch<SetStateAction<FixtureItem[]>>;
  persistTablePosition: (id: string) => Promise<void>;
  persistFixturePosition: (id: string) => Promise<void>;
};

export function useMapDrag(params: Params) {
  const tableResponders = useRef<Record<string, ReturnType<typeof PanResponder.create>>>({});
  const fixtureResponders = useRef<Record<string, ReturnType<typeof PanResponder.create>>>({});
  const starts = useRef<Record<string, Point>>({});
  const pendingTable = useRef(new Map<string, Point>());
  const pendingFixture = useRef(new Map<string, Point>());
  const tableFrame = useRef<number | null>(null);
  const fixtureFrame = useRef<number | null>(null);
  const persistTableRef = useRef(params.persistTablePosition);
  const persistFixtureRef = useRef(params.persistFixturePosition);

  useEffect(() => { persistTableRef.current = params.persistTablePosition; }, [params.persistTablePosition]);
  useEffect(() => { persistFixtureRef.current = params.persistFixturePosition; }, [params.persistFixturePosition]);
  useEffect(() => () => {
    if (tableFrame.current !== null) cancelAnimationFrame(tableFrame.current);
    if (fixtureFrame.current !== null) cancelAnimationFrame(fixtureFrame.current);
  }, []);

  const scheduleTable = useCallback((id: string, point: Point) => {
    params.tablePositionsRef.current = { ...params.tablePositionsRef.current, [id]: point };
    pendingTable.current.set(id, point);
    if (tableFrame.current !== null) return;
    tableFrame.current = requestAnimationFrame(() => {
      tableFrame.current = null;
      if (pendingTable.current.size === 0) return;
      const updates = Object.fromEntries(pendingTable.current);
      pendingTable.current.clear();
      params.setTablePositions((current) => ({ ...current, ...updates }));
    });
  }, [params.setTablePositions, params.tablePositionsRef]);

  const scheduleFixture = useCallback((id: string, point: Point) => {
    params.fixturesRef.current = params.fixturesRef.current.map((fixture) => fixture.id === id ? { ...fixture, ...point } : fixture);
    pendingFixture.current.set(id, point);
    if (fixtureFrame.current !== null) return;
    fixtureFrame.current = requestAnimationFrame(() => {
      fixtureFrame.current = null;
      if (pendingFixture.current.size === 0) return;
      pendingFixture.current.clear();
      params.setFixtures(params.fixturesRef.current);
    });
  }, [params.fixturesRef, params.setFixtures]);

  const flushTable = useCallback((id: string) => {
    if (tableFrame.current !== null) cancelAnimationFrame(tableFrame.current);
    tableFrame.current = null;
    pendingTable.current.delete(id);
    params.setTablePositions(params.tablePositionsRef.current);
  }, [params.setTablePositions, params.tablePositionsRef]);

  const flushFixture = useCallback((id: string) => {
    if (fixtureFrame.current !== null) cancelAnimationFrame(fixtureFrame.current);
    fixtureFrame.current = null;
    pendingFixture.current.delete(id);
    params.setFixtures(params.fixturesRef.current);
  }, [params.fixturesRef, params.setFixtures]);

  const getTablePanResponder = useCallback((tableId: string) => {
    const key = `table:${tableId}`;
    if (tableResponders.current[key]) return tableResponders.current[key];
    tableResponders.current[key] = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        params.activeDragKeys.current.add(key);
        starts.current[key] = params.tablePositionsRef.current[tableId] ?? { x: 40, y: 140 };
      },
      onPanResponderMove: (_event, gesture) => {
        const start = starts.current[key] ?? { x: 40, y: 140 };
        scheduleTable(tableId, {
          x: clamp(start.x + gesture.dx, 0, MAP_WIDTH - 190),
          y: clamp(start.y + gesture.dy, 0, MAP_HEIGHT - 130),
        });
      },
      onPanResponderRelease: () => {
        params.activeDragKeys.current.delete(key);
        flushTable(tableId);
        delete starts.current[key];
        void persistTableRef.current(tableId);
      },
      onPanResponderTerminate: () => {
        params.activeDragKeys.current.delete(key);
        pendingTable.current.delete(tableId);
        const start = starts.current[key];
        if (start) {
          params.tablePositionsRef.current = { ...params.tablePositionsRef.current, [tableId]: start };
          params.setTablePositions(params.tablePositionsRef.current);
        }
        delete starts.current[key];
      },
    });
    return tableResponders.current[key];
  }, [flushTable, params.activeDragKeys, params.setTablePositions, params.tablePositionsRef, scheduleTable]);

  const getFixturePanResponder = useCallback((fixtureId: string) => {
    const key = `fixture:${fixtureId}`;
    if (fixtureResponders.current[key]) return fixtureResponders.current[key];
    fixtureResponders.current[key] = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        params.activeDragKeys.current.add(key);
        const fixture = params.fixturesRef.current.find((item) => item.id === fixtureId);
        starts.current[key] = { x: fixture?.x ?? 60, y: fixture?.y ?? 60 };
      },
      onPanResponderMove: (_event, gesture) => {
        const start = starts.current[key] ?? { x: 60, y: 60 };
        const fixture = params.fixturesRef.current.find((item) => item.id === fixtureId);
        if (!fixture) return;
        scheduleFixture(fixtureId, {
          x: clamp(start.x + gesture.dx, 0, MAP_WIDTH - fixture.w),
          y: clamp(start.y + gesture.dy, 0, MAP_HEIGHT - fixture.h),
        });
      },
      onPanResponderRelease: () => {
        params.activeDragKeys.current.delete(key);
        flushFixture(fixtureId);
        delete starts.current[key];
        void persistFixtureRef.current(fixtureId);
      },
      onPanResponderTerminate: () => {
        params.activeDragKeys.current.delete(key);
        pendingFixture.current.delete(fixtureId);
        const start = starts.current[key];
        if (start) {
          params.fixturesRef.current = params.fixturesRef.current.map((fixture) => fixture.id === fixtureId ? { ...fixture, ...start } : fixture);
          params.setFixtures(params.fixturesRef.current);
        }
        delete starts.current[key];
      },
    });
    return fixtureResponders.current[key];
  }, [flushFixture, params.activeDragKeys, params.fixturesRef, params.setFixtures, scheduleFixture]);

  return { getTablePanResponder, getFixturePanResponder };
}
