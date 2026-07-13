export type EventDetailsModuleGroup = 'essential' | 'more';

export const EVENT_MODULES = [
  { key: 'overview', label: 'Resumo', group: 'essential', icon: 'grid-outline' },
  { key: 'tasks', label: 'Tarefas', group: 'essential', icon: 'checkbox-outline' },
  { key: 'guests', label: 'Convidados', group: 'essential', icon: 'people-outline' },
  { key: 'meetings', label: 'Reuniões', group: 'essential', icon: 'videocam-outline' },
  { key: 'vendors', label: 'Fornecedores', group: 'essential', icon: 'storefront-outline' },
  { key: 'documents', label: 'Documentos', group: 'essential', icon: 'document-text-outline' },
  { key: 'history', label: 'Histórico', group: 'more', icon: 'time-outline' },
  { key: 'timeline', label: 'Cronograma do dia', group: 'more', icon: 'calendar-outline' },
  { key: 'invites', label: 'Convites', group: 'more', icon: 'mail-outline' },
  { key: 'reception', label: 'Recepção e QR Code', group: 'more', icon: 'qr-code-outline' },
  { key: 'portal', label: 'Portal do cliente', group: 'more', icon: 'person-circle-outline' },
  { key: 'presentes', label: 'Presentes', group: 'more', icon: 'gift-outline' },
  { key: 'team', label: 'Equipe', group: 'more', icon: 'people-circle-outline' },
  { key: 'budget', label: 'Orçamento', group: 'more', icon: 'wallet-outline' },
  { key: 'tables', label: 'Mesas', group: 'more', icon: 'restaurant-outline' },
  { key: 'notes', label: 'Notas', group: 'more', icon: 'create-outline' },
  { key: 'analytics', label: 'Relatório final', group: 'more', icon: 'bar-chart-outline' },
] as const;

export type EventDetailsInitialTab = typeof EVENT_MODULES[number]['key'];

export function isEventDetailsInitialTab(value: string): value is EventDetailsInitialTab {
  return EVENT_MODULES.some((m) => m.key === value);
}
