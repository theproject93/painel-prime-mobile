export type EventDetailsInitialTab =
  | 'overview'
  | 'command'
  | 'history'
  | 'tasks'
  | 'budget'
  | 'guests'
  | 'timeline'
  | 'vendors'
  | 'documents'
  | 'notes'
  | 'team'
  | 'tables'
  | 'invites';

export function isEventDetailsInitialTab(value: string): value is EventDetailsInitialTab {
  return [
    'overview',
    'command',
    'history',
    'tasks',
    'budget',
    'guests',
    'timeline',
    'vendors',
    'documents',
    'notes',
    'team',
    'tables',
    'invites',
  ].includes(value);
}
