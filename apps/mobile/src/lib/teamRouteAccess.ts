/** Rotas operacionais disponíveis ao colaborador convidado. */
export function canTeamAccessPath(pathname: string, assignedEventIds: readonly string[]): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (['/', '/dashboard', '/eventos', '/mais', '/mais/perfil', '/mais/configuracoes', '/missoes', '/atualizar-senha'].includes(path)) {
    return true;
  }

  const eventPath = /^\/eventos\/([^/]+)(?:\/(portaria))?$/.exec(path);
  if (!eventPath) return false;
  try {
    const eventId = decodeURIComponent(eventPath[1]);
    return assignedEventIds.includes(eventId);
  } catch {
    return false;
  }
}
