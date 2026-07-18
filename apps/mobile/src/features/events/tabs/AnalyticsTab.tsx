import { EventEmptyState, EventModuleShell } from '../EventWorkspace';

export function AnalyticsTab() {
  return (
    <EventModuleShell
      title="Relatório final"
      description="Presença, financeiro e aprendizados depois do evento."
      icon="bar-chart-outline"
    >
      <EventEmptyState
        icon="bar-chart-outline"
        title="Relatório disponível após o encerramento"
        description="Quando o evento terminar, este espaço reunirá os principais resultados."
      />
    </EventModuleShell>
  );
}
