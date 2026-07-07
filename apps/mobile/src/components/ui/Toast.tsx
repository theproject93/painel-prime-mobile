import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { useToast, type ToastItem } from '../../contexts/ToastContext';

const TOAST_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  success: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  error: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  warning: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  info: { bg: '#f0f9ff', text: '#075985', border: '#bae6fd' },
};

function ToastItemView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onDismiss());
    }, 3900);
    return () => clearTimeout(timer);
  }, []);

  const scheme = TOAST_COLORS[item.type] ?? TOAST_COLORS.info;

  return (
    <Animated.View style={[styles.toast, { backgroundColor: scheme.bg, borderColor: scheme.border, opacity: fadeAnim }]}>
      <Text style={[styles.toastText, { color: scheme.text }]}>{item.message}</Text>
      <Pressable onPress={onDismiss} hitSlop={8}>
        <Text style={[styles.toastClose, { color: scheme.text }]}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

export function ToastContainer() {
  const { toasts, dismissToast } = useInternalToast();

  if (toasts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((t) => (
        <ToastItemView key={t.id} item={t} onDismiss={() => dismissToast(t.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  toastClose: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 10,
    paddingHorizontal: 4,
  },
});

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ToastType } from '../contexts/ToastContext';

type InternalToastContextType = {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string) => void;
  dismissToast: (id: number) => void;
};

const InternalToastContext = createContext<InternalToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => {
      if (prev.some((item) => item.type === type && item.message === message)) return prev;
      return [...prev, { id, type, message }];
    });
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(() => ({ toasts, showToast, dismissToast }), [toasts, showToast, dismissToast]);

  return (
    <InternalToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </InternalToastContext.Provider>
  );
}

function useInternalToast() {
  const ctx = useContext(InternalToastContext);
  if (!ctx) throw new Error('useInternalToast must be used inside ToastProvider');
  return ctx;
}
