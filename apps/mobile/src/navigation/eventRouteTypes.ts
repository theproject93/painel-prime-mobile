export type EventDetailsModuleGroup = 'summary' | 'planning' | 'people' | 'finance' | 'operation' | 'files' | 'closure';

export const EVENT_MODULES = [
  { key: 'overview', label: 'Visão Geral', group: 'summary', icon: 'grid-outline' },
  { key: 'history', label: 'Histórico', group: 'planning', icon: 'time-outline' },
  { key: 'tasks', label: 'Tarefas', group: 'planning', icon: 'checkbox-outline' },
  { key: 'timeline', label: 'Timeline', group: 'planning', icon: 'calendar-outline' },
  { key: 'catalog', label: 'Catálogo', group: 'planning', icon: 'albums-outline' },
  { key: 'guests', label: 'Convidados', group: 'people', icon: 'people-outline' },
  { key: 'invites', label: 'Convites', group: 'people', icon: 'mail-outline' },
  { key: 'portal', label: 'Portal do Cliente', group: 'people', icon: 'person-circle-outline' },
  { key: 'meetings', label: 'Reuniões', group: 'people', icon: 'videocam-outline' },
  { key: 'presentes', label: 'Presentes', group: 'people', icon: 'gift-outline' },
  { key: 'team', label: 'Equipe', group: 'people', icon: 'people-circle-outline' },
  { key: 'budget', label: 'Orçamento', group: 'finance', icon: 'wallet-outline' },
  { key: 'vendors', label: 'Fornecedores', group: 'operation', icon: 'storefront-outline' },
  { key: 'tables', label: 'Mesas', group: 'operation', icon: 'restaurant-outline' },
  { key: 'documents', label: 'Documentos', group: 'files', icon: 'document-text-outline' },
  { key: 'notes', label: 'Notas', group: 'files', icon: 'create-outline' },
  { key: 'analytics', label: 'Relatório de Encerramento', group: 'closure', icon: 'bar-chart-outline' },
] as const;

export type EventDetailsInitialTab = typeof EVENT_MODULES[number]['key'];

export function isEventDetailsInitialTab(value: string): value is EventDetailsInitialTab {
  return EVENT_MODULES.some((m) => m.key === value);
}
