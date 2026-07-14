import { useLocalSearchParams } from 'expo-router';

import { ClientWorkspaceScreen } from '../../../../src/screens/ClientWorkspaceScreen';

export default function ClientWorkspaceRoute() {
  const { clientId } = useLocalSearchParams<{ clientId?: string | string[] }>();
  const id = Array.isArray(clientId) ? clientId[0] : clientId;
  return <ClientWorkspaceScreen clientId={id ?? ''} />;
}
