export type EventAssigneeGroup = 'Cliente' | 'Você' | 'Fornecedor' | 'Equipe';

export type EventAssigneeOption = {
  id: string;
  label: string;
  group: EventAssigneeGroup;
};

type NamedEntity = { id: string; name: string | null | undefined };

function normalizedName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function optionId(value: string) {
  return normalizedName(value).toLocaleLowerCase('pt-BR');
}

function coupleNames(couple: string | null | undefined) {
  const value = normalizedName(couple ?? '');
  if (!value) return [];
  return value
    .split(/\s*(?:&|\+|\/|,|\be\b)\s*/i)
    .map(normalizedName)
    .filter(Boolean);
}

export function buildEventAssigneeOptions(params: {
  couple?: string | null;
  advisorName?: string | null;
  vendors?: NamedEntity[];
  team?: NamedEntity[];
}): EventAssigneeOption[] {
  const options: EventAssigneeOption[] = [];
  const seen = new Set<string>();
  const add = (option: EventAssigneeOption) => {
    const key = option.label.toLocaleLowerCase('pt-BR');
    if (!option.label || seen.has(key)) return;
    seen.add(key);
    options.push(option);
  };

  coupleNames(params.couple).forEach((name) =>
    add({ id: `client:${optionId(name)}`, label: name, group: 'Cliente' }),
  );

  const advisorName = normalizedName(params.advisorName ?? 'Você (assessoria)');
  add({ id: 'advisor:self', label: advisorName, group: 'Você' });

  (params.vendors ?? []).forEach((vendor) => {
    const name = normalizedName(vendor.name ?? '');
    if (name) add({ id: `vendor:${vendor.id}`, label: name, group: 'Fornecedor' });
  });

  (params.team ?? []).forEach((member) => {
    const name = normalizedName(member.name ?? '');
    if (name) add({ id: `team:${member.id}`, label: name, group: 'Equipe' });
  });

  return options;
}
