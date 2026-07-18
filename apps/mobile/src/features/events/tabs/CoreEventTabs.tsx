import type { EventDetailsTab } from '../eventDetailsData';
import { CommandTab } from './CommandTab';
import type { CommandTabModel } from './CommandTab';
import { HistoryTab } from './HistoryTab';
import type { HistoryTabModel } from './HistoryTab';
import { OverviewTab } from './OverviewTab';
import type { OverviewTabModel } from './OverviewTab';

type Props = {
  activeTab: EventDetailsTab;
  overview: OverviewTabModel;
  command: CommandTabModel;
  history: HistoryTabModel;
};

export function CoreEventTabs({ activeTab, overview, command, history }: Props) {
  if (activeTab === 'overview') return <OverviewTab model={overview} />;
  if (activeTab === 'command') return <CommandTab model={command} />;
  if (activeTab === 'history') return <HistoryTab model={history} />;
  return null;
}
