import { EventDetailsScreen } from '../../../../src/screens/EventDetailsScreen';
import { TeamEventBriefingScreen } from '../../../../src/features/team-dashboard/TeamEventBriefingScreen';
import { useUserRole } from '../../../../src/contexts/UserRoleContext';

export default function EventDetailsRoute() {
  const { isTeamMemberOnly } = useUserRole();

  if (isTeamMemberOnly) {
    return <TeamEventBriefingScreen />;
  }

  return <EventDetailsScreen />;
}
