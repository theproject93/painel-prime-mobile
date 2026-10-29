/**
 * @deprecated Use `UserRoleContext.tsx` e `useUserRole()`.
 * Este arquivo foi mantido para retrocompatibilidade com códigos e testes legados.
 */
export {
  UserRoleProvider as OperatingModeProvider,
  useOperatingMode,
  useUserRole,
  type AppRole,
  type OperatingMode,
  type AssignedEvent,
  type UserRoleContextValue,
  type UserRoleContextValue as OperatingModeContextValue,
} from './UserRoleContext';
