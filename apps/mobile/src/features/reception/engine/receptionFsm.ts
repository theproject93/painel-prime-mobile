import type { CheckInState, ReceptionBadgeColor } from '../types/receptionTypes';

/**
 * Matriz de transições permitidas para a máquina de estados local da Portaria.
 * Bloqueia estritamente regressões a partir de estados terminais.
 */
export const VALID_TRANSITIONS: Record<CheckInState, readonly CheckInState[]> = Object.freeze({
  pending: Object.freeze(['in_flight'] as CheckInState[]),
  in_flight: Object.freeze(['confirmed', 'already_checked_in', 'rejected', 'needs_attention', 'pending'] as CheckInState[]),
  confirmed: Object.freeze([] as CheckInState[]), // Estado terminal
  already_checked_in: Object.freeze([] as CheckInState[]), // Estado terminal
  rejected: Object.freeze([] as CheckInState[]), // Estado terminal
  needs_attention: Object.freeze(['pending'] as CheckInState[]), // Reprocessamento manual solicitado pelo operador
});

export class InvalidStateTransitionError extends Error {
  public readonly fromState: CheckInState;
  public readonly toState: CheckInState;

  constructor(fromState: CheckInState, toState: CheckInState) {
    super(
      `Transição de estado inválida na Portaria: não é permitido transitar de '${fromState}' para '${toState}'.`,
    );
    this.name = 'InvalidStateTransitionError';
    this.fromState = fromState;
    this.toState = toState;
  }
}

/**
 * Verifica se uma transição de estado é permitida.
 */
export function canTransition(from: CheckInState, to: CheckInState): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return Boolean(allowed && allowed.includes(to));
}

/**
 * Valida a transição e lança exceção descritiva caso seja ilegal.
 */
export function validateTransition(from: CheckInState, to: CheckInState): void {
  if (!canTransition(from, to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}

/**
 * Determina se o estado é terminal (imutável).
 */
export function isTerminalState(state: CheckInState): boolean {
  return state === 'confirmed' || state === 'already_checked_in' || state === 'rejected';
}

/**
 * Determina se a operação ainda precisa de sincronização com o servidor.
 */
export function isPendingSync(state: CheckInState): boolean {
  return state === 'pending' || state === 'in_flight' || state === 'needs_attention';
}

/**
 * Retorna a cor do badge visual multimodal para o estado.
 */
export function getStateBadgeColor(state: CheckInState): ReceptionBadgeColor {
  switch (state) {
    case 'confirmed':
      return 'green';
    case 'pending':
    case 'in_flight':
      return 'yellow';
    case 'already_checked_in':
      return 'orange';
    case 'rejected':
      return 'red';
    case 'needs_attention':
      return 'purple';
  }
}

/**
 * Rótulo em PT-BR com acentuação correta para exibição na UI.
 */
export function getStateLabel(state: CheckInState): string {
  switch (state) {
    case 'confirmed':
      return 'Confirmado';
    case 'pending':
      return 'Pendente (Local)';
    case 'in_flight':
      return 'Sincronizando...';
    case 'already_checked_in':
      return 'Já Registrado';
    case 'rejected':
      return 'Não Autorizado';
    case 'needs_attention':
      return 'Atenção Necessária';
  }
}
