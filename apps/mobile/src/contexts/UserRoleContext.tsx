import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type AppRole = 'owner' | 'team_member' | 'owner_and_team';
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

export interface UserAppContextResponse {
  role: AppRole;
  has_tenant: boolean;
  tenant_id: string | null;
  has_team_role: boolean;
  assigned_events_count: number;
}

export interface UserRoleContextValue {
  appRole: AppRole;
  isOwner: boolean;
  isTeamMemberOnly: boolean;
  effectiveMode: OperatingMode;
  assignedEvents: AssignedEvent[];
  loading: boolean;
  error: string | null;
  refreshRole: () => Promise<void>;
  refreshAssignedEvents: () => Promise<void>;
}

export const ROLE_CACHE_KEY = '@painelprime/user_app_role';

export function getUserRoleCacheKey(userId: string | null): string | null {
  return userId ? `@painelprime/user_app_role_${userId}` : null;
}

interface StoreState {
  userId: string | null;
  appRole: AppRole;
  hasTenant: boolean;
  tenantId: string | null;
  hasTeamRole: boolean;
  assignedEvents: AssignedEvent[];
  loading: boolean;
  error: string | null;
}

let storeState: StoreState = {
  userId: null,
  appRole: 'team_member',
  hasTenant: false,
  tenantId: null,
  hasTeamRole: false,
  assignedEvents: [],
  loading: true,
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

const UserRoleContext = createContext<UserRoleContextValue | null>(null);

export function UserRoleProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const activeUserId = useRef(userId);
  activeUserId.current = userId;

  const refreshAssignedEvents = useCallback(async () => {
    if (!userId) {
      updateStore({ assignedEvents: [] });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('list_team_member_events');
      if (error) {
        console.warn('Falha ao consultar list_team_member_events:', error.message);
        return;
      }
      if (activeUserId.current !== userId) return;

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

      if (activeUserId.current === userId) updateStore({ assignedEvents: parsed });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro inesperado';
      console.warn('Erro ao atualizar eventos escalados:', message);
    }
  }, [userId]);

  const refreshRole = useCallback(async () => {
    if (!userId) {
      updateStore({
        userId: null,
        appRole: 'team_member',
        hasTenant: false,
        tenantId: null,
        hasTeamRole: false,
        assignedEvents: [],
        loading: false,
        error: null,
      });
      await AsyncStorage.removeItem(ROLE_CACHE_KEY).catch(() => {});
      return;
    }

    updateStore({ userId, appRole: 'team_member', hasTenant: false, tenantId: null,
      hasTeamRole: false, assignedEvents: [], loading: true, error: null });
    const cacheKey = getUserRoleCacheKey(userId);
    if (cacheKey) {
      try {
        const saved = await AsyncStorage.getItem(cacheKey);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<UserAppContextResponse>;
          if (activeUserId.current !== userId) return;
          if (parsed.role === 'owner' || parsed.role === 'team_member' || parsed.role === 'owner_and_team') {
            updateStore({
              appRole: parsed.role,
              hasTenant: parsed.has_tenant ?? (parsed.role !== 'team_member'),
              tenantId: parsed.tenant_id ?? null,
              hasTeamRole: parsed.has_team_role ?? (parsed.role !== 'owner'),
            });
          }
        }
      } catch {
        // Ignora erro de leitura do cache local
      }
    }

    if (activeUserId.current !== userId) return;
    updateStore({ loading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('get_user_app_context');
      if (activeUserId.current !== userId) return;
      if (error) {
        console.warn('Falha ao obter contexto do usuário:', error.message);
        updateStore({ loading: false, error: error.message });
        return;
      }

      let ctx: UserAppContextResponse;
      if (typeof data === 'string') {
        ctx = JSON.parse(data) as UserAppContextResponse;
      } else {
        ctx = (data as unknown) as UserAppContextResponse;
      }

      const role: AppRole = ctx.role === 'team_member' ? 'team_member' : ctx.role === 'owner_and_team' ? 'owner_and_team' : 'owner';
      updateStore({
        appRole: role,
        hasTenant: ctx.has_tenant ?? (role !== 'team_member'),
        tenantId: ctx.tenant_id ?? null,
        hasTeamRole: ctx.has_team_role ?? (role !== 'owner'),
        loading: false,
        error: null,
      });

      // Salva no cache local segregado por usuário para inicializações offline subsequentes
      if (cacheKey) {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(ctx)).catch(() => {});
      }
      if (activeUserId.current !== userId) return;
      await AsyncStorage.removeItem(ROLE_CACHE_KEY).catch(() => {});

      // Se possui papel de equipe, busca a lista de eventos escalados
      if (role === 'team_member' || role === 'owner_and_team' || ctx.has_team_role) {
        await refreshAssignedEvents();
      }
    } catch (err: unknown) {
      if (activeUserId.current !== userId) return;
      const message = err instanceof Error ? err.message : 'Erro inesperado';
      updateStore({ loading: false, error: message });
    }
  }, [userId, refreshAssignedEvents]);

  useEffect(() => {
    void refreshRole();
  }, [refreshRole]);

  const state = useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    () => storeState,
  );

  const visibleState = state.userId === userId ? state : {
    ...state, appRole: 'team_member' as const, hasTenant: false, assignedEvents: [], loading: true,
  };
  const isOwner = visibleState.hasTenant || visibleState.appRole === 'owner' || visibleState.appRole === 'owner_and_team';
  const isTeamMemberOnly = visibleState.appRole === 'team_member';
  const effectiveMode: OperatingMode = isTeamMemberOnly ? 'equipe' : 'assessoria';

  const value: UserRoleContextValue = {
    appRole: visibleState.appRole,
    isOwner,
    isTeamMemberOnly,
    effectiveMode,
    assignedEvents: visibleState.assignedEvents,
    loading: visibleState.loading,
    error: visibleState.error,
    refreshRole,
    refreshAssignedEvents,
  };

  return (
    <UserRoleContext.Provider value={value}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole(): UserRoleContextValue {
  const context = useContext(UserRoleContext);

  const state = useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    () => storeState,
  );

  const isOwner = state.hasTenant || state.appRole === 'owner' || state.appRole === 'owner_and_team';
  const isTeamMemberOnly = state.appRole === 'team_member';
  const effectiveMode: OperatingMode = isTeamMemberOnly ? 'equipe' : 'assessoria';

  const refreshAssignedEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('list_team_member_events');
      if (error) return;
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
      updateStore({ assignedEvents: parsed });
    } catch {
      // Ignora erro
    }
  }, []);

  const refreshRole = useCallback(async () => {
    updateStore({ loading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('get_user_app_context');
      if (error) {
        updateStore({ loading: false, error: error.message });
        return;
      }
      let ctx: UserAppContextResponse;
      if (typeof data === 'string') {
        ctx = JSON.parse(data) as UserAppContextResponse;
      } else {
        ctx = (data as unknown) as UserAppContextResponse;
      }
      const role: AppRole = ctx.role === 'team_member' ? 'team_member' : ctx.role === 'owner_and_team' ? 'owner_and_team' : 'owner';
      updateStore({
        appRole: role,
        hasTenant: ctx.has_tenant ?? (role !== 'team_member'),
        tenantId: ctx.tenant_id ?? null,
        hasTeamRole: ctx.has_team_role ?? (role !== 'owner'),
        loading: false,
        error: null,
      });
      const { data: authData } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      const currentUserId = authData?.session?.user?.id ?? null;
      const cacheKey = getUserRoleCacheKey(currentUserId);
      if (cacheKey) {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(ctx)).catch(() => {});
      }
      await AsyncStorage.removeItem(ROLE_CACHE_KEY).catch(() => {});
      if (role === 'team_member' || role === 'owner_and_team' || ctx.has_team_role) {
        await refreshAssignedEvents();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro';
      updateStore({ loading: false, error: message });
    }
  }, [refreshAssignedEvents]);

  if (context) {
    return context;
  }

  return {
    appRole: state.appRole,
    isOwner,
    isTeamMemberOnly,
    effectiveMode,
    assignedEvents: state.assignedEvents,
    loading: state.loading,
    error: state.error,
    refreshRole,
    refreshAssignedEvents,
  };
}

/**
 * Hook de compatibilidade retroativa com o antigo OperatingModeContext
 */
export function useOperatingMode() {
  const roleContext = useUserRole();
  return {
    mode: roleContext.effectiveMode,
    setMode: (_newMode: OperatingMode) => {
      // No-op: o papel é derivado do contexto do usuário
    },
    toggleMode: () => {
      // No-op: o papel é derivado do contexto do usuário
    },
    assignedEvents: roleContext.assignedEvents,
    loading: roleContext.loading,
    error: roleContext.error,
    refreshAssignedEvents: roleContext.refreshAssignedEvents,
    hasTeamRole: !roleContext.isOwner || roleContext.appRole === 'owner_and_team',
  };
}
