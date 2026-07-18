import { EventEmptyState, EventModuleShell } from '../EventWorkspace';

type ClientPortalTabProps = { onOpenPortal: () => void };

export function ClientPortalTab({ onOpenPortal }: ClientPortalTabProps) {
  return (
    <EventModuleShell
      title="Portal do cliente"
      description="O espaço compartilhado com os responsáveis pelo evento."
      icon="person-circle-outline"
      actionLabel="Abrir portal do cliente"
      onAction={onOpenPortal}
    >
      <EventEmptyState
        icon="person-circle-outline"
        title="Tudo pronto para compartilhar"
        description="Abra o portal para revisar informações, documentos e aprovações visíveis ao cliente."
      />
    </EventModuleShell>
  );
}
