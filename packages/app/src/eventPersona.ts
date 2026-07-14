export type InternalEventKind =
  | 'wedding'
  | 'birthday'
  | 'debutante'
  | 'corporate'
  | 'generic';

export type EventPersonaCopy = Readonly<{
  kind: InternalEventKind;
  eventTypeLabel: string;
  ownerSingular: string;
  ownerCollective: string;
  principalNameLabel: string;
  principalNamePlaceholder: string;
  budgetTitle: string;
  budgetDescription: string;
  budgetEditDescription: string;
  budgetContextDescription: string;
  timelineActivityPlaceholder: string;
}>;

const EVENT_KIND_ALIASES: Readonly<Record<string, InternalEventKind>> = {
  wedding: 'wedding',
  casamento: 'wedding',
  birthday: 'birthday',
  aniversario: 'birthday',
  aniversario_infantil: 'birthday',
  debutante: 'debutante',
  '15_anos': 'debutante',
  quinze_anos: 'debutante',
  corporate: 'corporate',
  corporativo: 'corporate',
  empresa: 'corporate',
  empresarial: 'corporate',
  evento_empresarial: 'corporate',
};

function normalizeAlias(value?: string | null) {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');
}

export function normalizeInternalEventKind(value?: string | null): InternalEventKind {
  return EVENT_KIND_ALIASES[normalizeAlias(value)] ?? 'generic';
}

const COPY_BY_KIND: Readonly<Record<InternalEventKind, EventPersonaCopy>> = {
  wedding: {
    kind: 'wedding',
    eventTypeLabel: 'Casamento',
    ownerSingular: 'casal',
    ownerCollective: 'noivos',
    principalNameLabel: 'Casal',
    principalNamePlaceholder: 'Nome do casal',
    budgetTitle: 'Quanto o casal pode investir',
    budgetDescription: 'O valor total reservado para realizar este casamento.',
    budgetEditDescription: 'Informe o limite que o casal separou para realizar este evento.',
    budgetContextDescription: 'Valores que o casal reservou e já comprometeu.',
    timelineActivityPlaceholder: 'Ex.: Entrada dos noivos',
  },
  debutante: {
    kind: 'debutante',
    eventTypeLabel: '15 anos',
    ownerSingular: 'debutante',
    ownerCollective: 'debutante e responsáveis',
    principalNameLabel: 'Debutante',
    principalNamePlaceholder: 'Nome da debutante',
    budgetTitle: 'Quanto foi reservado para a debutante',
    budgetDescription: 'O valor total reservado para realizar esta celebração de 15 anos.',
    budgetEditDescription: 'Informe o limite reservado para realizar esta celebração de 15 anos.',
    budgetContextDescription: 'Valores reservados para a debutante e já comprometidos.',
    timelineActivityPlaceholder: 'Ex.: Entrada da debutante',
  },
  birthday: {
    kind: 'birthday',
    eventTypeLabel: 'Aniversário',
    ownerSingular: 'aniversariante',
    ownerCollective: 'aniversariante e responsáveis',
    principalNameLabel: 'Aniversariante',
    principalNamePlaceholder: 'Nome do aniversariante',
    budgetTitle: 'Orçamento disponível para o aniversário',
    budgetDescription: 'O valor total reservado para realizar este aniversário.',
    budgetEditDescription: 'Informe o limite reservado para realizar este aniversário.',
    budgetContextDescription: 'Valores reservados para o aniversário e já comprometidos.',
    timelineActivityPlaceholder: 'Ex.: Entrada do aniversariante',
  },
  corporate: {
    kind: 'corporate',
    eventTypeLabel: 'Corporativo',
    ownerSingular: 'cliente',
    ownerCollective: 'cliente e representantes',
    principalNameLabel: 'Cliente ou empresa',
    principalNamePlaceholder: 'Nome do cliente ou empresa',
    budgetTitle: 'Quanto o cliente pode investir',
    budgetDescription: 'O valor total aprovado para realizar este evento corporativo.',
    budgetEditDescription: 'Informe o limite aprovado pelo cliente para realizar este evento.',
    budgetContextDescription: 'Valores aprovados pelo cliente e já comprometidos.',
    timelineActivityPlaceholder: 'Ex.: Chegada dos representantes',
  },
  generic: {
    kind: 'generic',
    eventTypeLabel: 'Evento',
    ownerSingular: 'cliente',
    ownerCollective: 'cliente e responsáveis',
    principalNameLabel: 'Cliente',
    principalNamePlaceholder: 'Nome do cliente',
    budgetTitle: 'Orçamento disponível para o evento',
    budgetDescription: 'O valor total reservado para realizar este evento.',
    budgetEditDescription: 'Informe o limite reservado para realizar este evento.',
    budgetContextDescription: 'Valores reservados para o evento e já comprometidos.',
    timelineActivityPlaceholder: 'Ex.: Entrada principal',
  },
};

export function getEventPersonaCopy(value?: string | null): EventPersonaCopy {
  return COPY_BY_KIND[normalizeInternalEventKind(value)];
}
