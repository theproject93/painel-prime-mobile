export type PadrinhoRole =
  | 'padrinho'
  | 'madrinha'
  | 'dama'
  | 'cavalheiro'
  | 'principe'
  | 'padrinho_valsa'
  | 'demoisselle'
  | 'pajem'
  | 'daminha'
  | 'outro';

export type PadrinhoSide = 'noiva' | 'noivo' | 'ambos' | 'debutante';

export type AttireStatus = 'pending' | 'in_progress' | 'confirmed';

export type EventPadrinhoGuest = {
  id: string;
  name: string;
  phone: string | null;
  confirmed: boolean;
  rsvp_status?: string | null;
  table_id?: string | null;
  family_group_id?: string | null;
};

export type EventPadrinhoItem = {
  id: string;
  event_id: string;
  guest_id: string;
  role: PadrinhoRole;
  side: PadrinhoSide;
  entry_order: number;
  pair_padrinho_id: string | null;
  attire_status: AttireStatus;
  attire_color: string | null;
  attire_notes: string | null;
  special_role: string | null;
  manual_sent_at: string | null;
  created_at: string;
  updated_at: string;
  guest?: EventPadrinhoGuest | null;
};

export type PadrinhoPairGroup = {
  pairKey: string;
  entryOrder: number;
  primary: EventPadrinhoItem;
  companion?: EventPadrinhoItem | null;
};

export function roleLabel(role: PadrinhoRole, isDebutante = false): string {
  if (isDebutante) {
    if (role === 'dama' || role === 'madrinha') return 'Dama de Honra';
    if (role === 'cavalheiro' || role === 'padrinho') return 'Cavalheiro de Honra';
    if (role === 'principe') return 'Príncipe da Valsa';
    if (role === 'padrinho_valsa') return 'Padrinho da Valsa';
    if (role === 'demoisselle') return 'Dama de Apoio';
    if (role === 'pajem') return 'Pajem';
    if (role === 'daminha') return 'Menina dos Anéis';
    return 'Corte de Honra';
  }

  if (role === 'madrinha') return 'Madrinha';
  if (role === 'padrinho') return 'Padrinho';
  if (role === 'demoisselle') return 'Demoiselle';
  if (role === 'pajem') return 'Pajem';
  if (role === 'daminha') return 'Daminha';
  if (role === 'dama') return 'Dama';
  if (role === 'cavalheiro') return 'Cavalheiro';
  return 'Padrinho';
}

export function sideLabel(side: PadrinhoSide, isDebutante = false): string {
  if (isDebutante) return 'Corte Debutante';
  if (side === 'noiva') return 'Lado da Noiva';
  if (side === 'noivo') return 'Lado do Noivo';
  return 'Ambos os Noivos';
}

export function attireStatusLabel(status: AttireStatus): string {
  if (status === 'confirmed') return 'Traje Definido';
  if (status === 'in_progress') return 'Em Busca';
  return 'Pendente';
}

export function specialRoleLabel(specialRole: string | null | undefined): string | null {
  if (!specialRole) return null;
  const map: Record<string, string> = {
    aliancas: '💍 Leva Alianças',
    testemunha: '📜 Testemunha Civil/Religiosa',
    brinde: '🥂 Discurso / Brinde',
    leitura: '📖 Leitura Cerimonial',
    lapela: '🌹 Lapela Especial',
    valsa: '💃 Valsa Especial',
  };
  return map[specialRole] ?? specialRole;
}

export function buildPadrinhoPairs(items: EventPadrinhoItem[]): PadrinhoPairGroup[] {
  const sorted = [...items].sort(
    (a, b) => a.entry_order - b.entry_order || a.role.localeCompare(b.role)
  );
  const visited = new Set<string>();
  const pairs: PadrinhoPairGroup[] = [];

  for (const item of sorted) {
    if (visited.has(item.id)) continue;

    visited.add(item.id);

    let companion: EventPadrinhoItem | null = null;
    if (item.pair_padrinho_id) {
      companion = sorted.find((cand) => cand.id === item.pair_padrinho_id) ?? null;
      if (companion) visited.add(companion.id);
    }

    pairs.push({
      pairKey: companion ? `${item.id}-${companion.id}` : item.id,
      entryOrder: item.entry_order,
      primary: item,
      companion,
    });
  }

  return pairs;
}

export const ROLE_OPTIONS_DEBUTANTE: { label: string; value: PadrinhoRole }[] = [
  { value: 'dama', label: 'Dama de Honra' },
  { value: 'cavalheiro', label: 'Cavalheiro de Honra' },
  { value: 'principe', label: 'Príncipe da Valsa' },
  { value: 'padrinho_valsa', label: 'Padrinho da Valsa' },
  { value: 'demoisselle', label: 'Dama de Apoio' },
  { value: 'daminha', label: 'Menina dos Anéis' },
  { value: 'pajem', label: 'Pajem' },
];

export const ROLE_OPTIONS_WEDDING: { label: string; value: PadrinhoRole }[] = [
  { value: 'padrinho', label: 'Padrinho' },
  { value: 'madrinha', label: 'Madrinha' },
  { value: 'demoisselle', label: 'Demoiselle' },
  { value: 'pajem', label: 'Pajem' },
  { value: 'daminha', label: 'Daminha' },
  { value: 'outro', label: 'Outro Papel' },
];

export const SPECIAL_ROLES = [
  { value: '', label: 'Nenhuma / Entrada padrão' },
  { value: 'aliancas', label: '💍 Leva as Alianças' },
  { value: 'testemunha', label: '📜 Testemunha da Ata' },
  { value: 'brinde', label: '🥂 Discurso / Brinde' },
  { value: 'leitura', label: '📖 Leitura Cerimonial' },
  { value: 'lapela', label: '🌹 Lapela de Destaque' },
  { value: 'valsa', label: '💃 Valsa Principal' },
];
