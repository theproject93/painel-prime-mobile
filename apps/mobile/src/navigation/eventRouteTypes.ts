export type EventDetailsModuleGroup = 'summary' | 'planning' | 'people' | 'finance' | 'operation' | 'files' | 'closure';

export const EVENT_MODULES = [
  { key: 'overview', label: 'Visão Geral', group: 'summary' },
  { key: 'history', label: 'Histórico', group: 'planning' },
  { key: 'tasks', label: 'Tarefas', group: 'planning' },
  { key: 'timeline', label: 'Timeline', group: 'planning' },
  { key: 'catalog', label: 'Catálogo', group: 'planning' },
  { key: 'guests', label: 'Convidados', group: 'people' },
  { key: 'invites', label: 'Convites', group: 'people' },
  { key: 'portal', label: 'Portal do Cliente', group: 'people' },
  { key: 'presentes', label: 'Presentes', group: 'people' },
  { key: 'team', label: 'Equipe', group: 'people' },
  { key: 'budget', label: 'Orçamento', group: 'finance' },
  { key: 'command', label: 'Torre de Comando', group: 'operation' },
  { key: 'vendors', label: 'Fornecedores', group: 'operation' },
  { key: 'tables', label: 'Mesas', group: 'operation' },
  { key: 'documents', label: 'Documentos', group: 'files' },
  { key: 'notes', label: 'Notas', group: 'files' },
  { key: 'analytics', label: 'Relatório de Encerramento', group: 'closure' },
] as const;

export type EventDetailsInitialTab = typeof EVENT_MODULES[number]['key'];

export function isEventDetailsInitialTab(value: string): value is EventDetailsInitialTab {
  return EVENT_MODULES.some((m) => m.key === value);
}
