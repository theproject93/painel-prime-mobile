import { PropsWithChildren, RefObject, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleProp, View, ViewStyle, useWindowDimensions } from 'react-native';

type AnchorRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  borderRadius: number;
};

type AnchorRegistryEntry = {
  ref: RefObject<View | null>;
  borderRadius: number;
};

type WalkthroughAnchorsContextValue = {
  anchors: Record<string, AnchorRect>;
  registerAnchor: (id: string, ref: RefObject<View | null>, borderRadius?: number) => void;
  unregisterAnchor: (id: string) => void;
  requestMeasure: (id?: string) => void;
};

type WalkthroughAnchorTargetProps = PropsWithChildren<{
  id: string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}>;

const DEFAULT_CONTEXT: WalkthroughAnchorsContextValue = {
  anchors: {},
  registerAnchor: () => {},
  unregisterAnchor: () => {},
  requestMeasure: () => {},
};

const WalkthroughAnchorsContext = createContext<WalkthroughAnchorsContextValue>(DEFAULT_CONTEXT);

function isSameRect(a: AnchorRect | undefined, b: AnchorRect) {
  if (!a) return false;
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.w === b.w &&
    a.h === b.h &&
    a.borderRadius === b.borderRadius
  );
}

export function WalkthroughAnchorsProvider({ children }: PropsWithChildren) {
  const [anchors, setAnchors] = useState<Record<string, AnchorRect>>({});
  const registryRef = useRef(new Map<string, AnchorRegistryEntry>());
  const pendingIdsRef = useRef(new Set<string>());
  const rafIdRef = useRef<number | null>(null);
  const { width, height } = useWindowDimensions();

  const measureAnchor = useCallback((id: string) => {
    const entry = registryRef.current.get(id);
    const node = entry?.ref.current;
    if (!entry || !node || typeof node.measureInWindow !== 'function') return;

    node.measureInWindow((x, y, w, h) => {
      if (!Number.isFinite(x) || !Number.isFinite(y) || w <= 0 || h <= 0) return;

      const nextRect: AnchorRect = {
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(w),
        h: Math.round(h),
        borderRadius: entry.borderRadius,
      };

      setAnchors((prev) => {
        if (isSameRect(prev[id], nextRect)) return prev;
        return { ...prev, [id]: nextRect };
      });
    });
  }, []);

  const flushPending = useCallback(() => {
    rafIdRef.current = null;
    const ids = Array.from(pendingIdsRef.current);
    pendingIdsRef.current.clear();
    ids.forEach(measureAnchor);
  }, [measureAnchor]);

  const scheduleMeasure = useCallback(
    (ids: string[]) => {
      ids.forEach((id) => pendingIdsRef.current.add(id));
      if (rafIdRef.current != null) return;
      rafIdRef.current = requestAnimationFrame(flushPending);
    },
    [flushPending],
  );

  const requestMeasure = useCallback(
    (id?: string) => {
      if (id) {
        if (registryRef.current.has(id)) {
          scheduleMeasure([id]);
        }
        return;
      }
      scheduleMeasure(Array.from(registryRef.current.keys()));
    },
    [scheduleMeasure],
  );

  const registerAnchor = useCallback(
    (id: string, ref: RefObject<View | null>, borderRadius = 14) => {
      registryRef.current.set(id, { ref, borderRadius });
      requestMeasure(id);
    },
    [requestMeasure],
  );

  const unregisterAnchor = useCallback((id: string) => {
    registryRef.current.delete(id);
    pendingIdsRef.current.delete(id);
    setAnchors((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  useEffect(() => {
    requestMeasure();
  }, [requestMeasure, width, height]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      anchors,
      registerAnchor,
      unregisterAnchor,
      requestMeasure,
    }),
    [anchors, registerAnchor, requestMeasure, unregisterAnchor],
  );

  return <WalkthroughAnchorsContext.Provider value={value}>{children}</WalkthroughAnchorsContext.Provider>;
}

export function useWalkthroughAnchors() {
  return useContext(WalkthroughAnchorsContext);
}

export function WalkthroughAnchorTarget({ id, borderRadius = 14, style, children }: WalkthroughAnchorTargetProps) {
  const { registerAnchor, unregisterAnchor, requestMeasure } = useWalkthroughAnchors();
  const ref = useRef<View | null>(null);

  useEffect(() => {
    registerAnchor(id, ref, borderRadius);
    return () => {
      unregisterAnchor(id);
    };
  }, [borderRadius, id, registerAnchor, unregisterAnchor]);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={style}
      onLayout={() => {
        requestMeasure(id);
      }}
    >
      {children}
    </View>
  );
}
