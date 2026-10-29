import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type OperatingMode = 'assessoria' | 'equipe';

export interface AssignedEvent {
  id: string;
  name: string;
  event_type: string;
  event_date: string;
  status: string;
  location: string | null;
  location_city: string | null;
  location_state: string | null;
  team_name: string | null;
  role: string | null;
  reception_offline_expires_at: string | null;
}

export interface OperatingModeContextValue {
  mode: OperatingMode;
  setMode: (mode: OperatingMode) => void;
  toggleMode: () => void;
  assignedEvents: AssignedEvent[];
  loading: boolean;
  error: string | null;
  refreshAssignedEvents: () => Promise<void>;
  hasTeamRole: boolean;
}

const STORAGE_KEY = '@painelprime/operating_mode';

interface StoreState {
  mode: OperatingMode;
  assignedEvents: AssignedEvent[];
  loading: boolean;
  error: string | null;
}

let storeState: StoreState = {
  mode: 'assessoria',
  assignedEvents: [],
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function updateStore(partial: Partial<StoreState>) {
  storeState = { ...storeState, ...partial };
  notify();
}

// Inicializa preferência persistida
AsyncStorage.getItem(STORAGE_KEY)
  .then((saved) => {
    if (saved === 'assessoria' || saved === 'equipe') {
      updateStore({ mode: saved });
    }
  })
  .catch(() => {});

const OperatingModeContext = createContext<OperatingModeContextValue | null>(null);

export function OperatingModeProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const refreshAssignedEvents = useCallback(async () => {
    if (!userId) {
      updateStore({ assignedEvents: [], loading: false, error: null });
      return;
    }

    updateStore({ loading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('list_team_member_events');
      if (error) {
        console.warn('Falha ao consultar list_team_member_events:', error.message);
        updateStore({ loading: false, error: error.message });
        return;
      }

      let parsed: AssignedEvent[] = [];
      if (Array.isArray(data)) {
        parsed = data as AssignedEvent[];
      } else if (typeof data === 'string') {
        try {
          parsed = JSON.parse(data) as AssignedEvent[];
        } catch {
          parsed = [];
        }
      }

      updateStore({ assignedEvents: parsed, loading: false, error: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro inesperado';
      updateStore({ loading: false, error: message });
    }
  }, [userId]);

  useEffect(() => {
    void refreshAssignedEvents();
  }, [refreshAssignedEvents]);

  const setMode = useCallback((newMode: OperatingMode) => {
    updateStore({ mode: newMode });
    AsyncStorage.setItem(STORAGE_KEY, newMode).catch(() => {});
  }, []);

  const toggleMode = useCallback(() => {
    const nextMode: OperatingMode = storeState.mode === 'assessoria' ? 'equipe' : 'assessoria';
    setMode(nextMode);
  }, [setMode]);

  // Lê estado reativo
  const state = useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    () => storeState,
  );

  const value: OperatingModeContextValue = {
    mode: state.mode,
    setMode,
    toggleMode,
    assignedEvents: state.assignedEvents,
    loading: state.loading,
    error: state.error,
    refreshAssignedEvents,
    hasTeamRole: state.assignedEvents.length > 0,
  };

  return (
    <OperatingModeContext.Provider value={value}>
      {children}
    </OperatingModeContext.Provider>
  );
}

export function useOperatingMode(): OperatingModeContextValue {
  const context = useContext(OperatingModeContext);

  // Hook reativo mesmo se chamado fora do provider
  const state = useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    () => storeState,
  );

  const setMode = useCallback((newMode: OperatingMode) => {
    updateStore({ mode: newMode });
    AsyncStorage.setItem(STORAGE_KEY, newMode).catch(() => {});
  }, []);

  const toggleMode = useCallback(() => {
    const nextMode: OperatingMode = storeState.mode === 'assessoria' ? 'equipe' : 'assessoria';
    setMode(nextMode);
  }, [setMode]);

  const refreshAssignedEvents = useCallback(async () => {
    updateStore({ loading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('list_team_member_events');
      if (error) {
        updateStore({ loading: false, error: error.message });
        return;
      }
      let parsed: AssignedEvent[] = [];
      if (Array.isArray(data)) {
        parsed = data as AssignedEvent[];
      } else if (typeof data === 'string') {
        try {
          parsed = JSON.parse(data) as AssignedEvent[];
        } catch {
          parsed = [];
        }
      }
      updateStore({ assignedEvents: parsed, loading: false, error: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro';
      updateStore({ loading: false, error: message });
    }
  }, []);

  if (context) {
    return context;
  }

  return {
    mode: state.mode,
    setMode,
    toggleMode,
    assignedEvents: state.assignedEvents,
    loading: state.loading,
    error: state.error,
    refreshAssignedEvents,
    hasTeamRole: state.assignedEvents.length > 0,
  };
}
