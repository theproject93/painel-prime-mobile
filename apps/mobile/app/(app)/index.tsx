import { Redirect } from 'expo-router';
import { useUserRole } from '../../src/contexts/UserRoleContext';

export default function AuthenticatedIndex() {
  const { isTeamMemberOnly } = useUserRole();
  return <Redirect href={'/dashboard'} />;
}
