import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clampNumber, getNearestFabCorner } from './core';
import type { Bounds, Point } from './types';

const BOTTOM_TAB_BAR_HEIGHT = 56;
const FAB_VERTICAL_GAP = 14;
const FAB_SIZE = 56;
const FAB_SIDE_SAFE_MARGIN = 28;
const FAB_POSITION_STORAGE_PREFIX = 'painelprime:plan_assistant_fab_position';

export function useFloatingAssistantPosition(
  userId: string | null,
  isOpen: boolean,
  onOpen: () => void,
  onClose: () => void,
) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [position, setPosition] = useState<Point | null>(null);
  const positionRef = useRef<Point | null>(null);
  const boundsRef = useRef<Bounds | null>(null);
  const dragStartRef = useRef<Point | null>(null);
  const draggingRef = useRef(false);
  const touchStartRef = useRef(0);
  const isOpenRef = useRef(isOpen);

  const floatingBaseBottom = insets.bottom + BOTTOM_TAB_BAR_HEIGHT + FAB_VERTICAL_GAP;
  const fabBottom = floatingBaseBottom;
  const chatBottom = Math.max(18 + insets.bottom, floatingBaseBottom - 8);
  const bounds = useMemo(() => ({
    minX: FAB_SIDE_SAFE_MARGIN,
    maxX: Math.max(FAB_SIDE_SAFE_MARGIN, width - FAB_SIZE - FAB_SIDE_SAFE_MARGIN),
    minY: insets.top + 8,
    maxY: Math.max(insets.top + 8, height - floatingBaseBottom - FAB_SIZE),
  }), [floatingBaseBottom, height, insets.top, width]);
  const defaultPosition = useMemo(() => ({
    x: clampNumber(width - FAB_SIZE - FAB_SIDE_SAFE_MARGIN, bounds.minX, bounds.maxX),
    y: clampNumber(height - fabBottom - FAB_SIZE, bounds.minY, bounds.maxY),
  }), [bounds, fabBottom, height, width]);
  const resolvedPosition = position ?? defaultPosition;
  const storageKey = `${FAB_POSITION_STORAGE_PREFIX}:${userId ?? 'guest'}`;
  const persistPosition = useCallback((next: Point) => {
    void AsyncStorage.setItem(storageKey, JSON.stringify(next));
  }, [storageKey]);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { boundsRef.current = bounds; }, [bounds]);
  useEffect(() => { positionRef.current = resolvedPosition; }, [resolvedPosition]);

  useEffect(() => {
    setPosition((previous) => {
      const seed = previous ?? defaultPosition;
      const next = {
        x: clampNumber(seed.x, bounds.minX, bounds.maxX),
        y: clampNumber(seed.y, bounds.minY, bounds.maxY),
      };
      return previous?.x === next.x && previous.y === next.y ? previous : next;
    });
  }, [bounds, defaultPosition]);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(storageKey).then((raw) => {
      if (!raw || cancelled) return;
      const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
      const x = Number(parsed.x);
      const y = Number(parsed.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      setPosition({
        x: clampNumber(x, bounds.minX, bounds.maxX),
        y: clampNumber(y, bounds.minY, bounds.maxY),
      });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [bounds, storageKey]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !isOpenRef.current,
    onStartShouldSetPanResponderCapture: () => !isOpenRef.current,
    onMoveShouldSetPanResponder: () => !isOpenRef.current,
    onMoveShouldSetPanResponderCapture: () => !isOpenRef.current,
    onPanResponderGrant: () => {
      draggingRef.current = false;
      touchStartRef.current = Date.now();
      dragStartRef.current = positionRef.current ?? defaultPosition;
    },
    onPanResponderMove: (_event, gesture) => {
      const origin = dragStartRef.current ?? positionRef.current ?? defaultPosition;
      const currentBounds = boundsRef.current ?? bounds;
      const next = {
        x: clampNumber(origin.x + gesture.dx, currentBounds.minX, currentBounds.maxX),
        y: clampNumber(origin.y + gesture.dy, currentBounds.minY, currentBounds.maxY),
      };
      if (Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6) draggingRef.current = true;
      positionRef.current = next;
      setPosition((previous) => previous?.x === next.x && previous.y === next.y ? previous : next);
    },
    onPanResponderRelease: (_event, gesture) => {
      const isTap = !draggingRef.current && Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) < 6 && Date.now() - touchStartRef.current < 280;
      if (isTap) {
        if (isOpenRef.current) onClose(); else onOpen();
      } else {
        const snapped = getNearestFabCorner(positionRef.current ?? defaultPosition, boundsRef.current ?? bounds);
        positionRef.current = snapped;
        setPosition(snapped);
        persistPosition(snapped);
      }
      dragStartRef.current = null;
      setTimeout(() => { draggingRef.current = false; }, 80);
    },
    onPanResponderTerminate: () => {
      dragStartRef.current = null;
      draggingRef.current = false;
    },
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }), [bounds, defaultPosition, onClose, onOpen, persistPosition]);

  return { position: resolvedPosition, fabBottom, chatBottom, panHandlers: panResponder.panHandlers };
}
