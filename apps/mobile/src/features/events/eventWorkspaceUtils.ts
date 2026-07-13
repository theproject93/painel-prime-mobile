type TaskLike = {
  completed?: boolean | null;
  due_date?: string | null;
};

export function summarizeTasks(tasks: TaskLike[], now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return tasks.reduce(
    (summary, task) => {
      summary.total += 1;
      if (task.completed) {
        summary.completed += 1;
        return summary;
      }

      summary.pending += 1;
      if (task.due_date) {
        const dueDate = new Date(`${task.due_date.slice(0, 10)}T00:00:00`);
        if (!Number.isNaN(dueDate.getTime()) && dueDate < today) summary.overdue += 1;
      }
      return summary;
    },
    { total: 0, pending: 0, overdue: 0, completed: 0 },
  );
}

export function priorityLabel(priority: string | null | undefined) {
  const labels: Record<string, string> = {
    low: 'Baixa',
    normal: 'Normal',
    high: 'Alta',
    urgent: 'Urgente',
  };
  return labels[priority ?? 'normal'] ?? 'Normal';
}

export function guestStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    pending: 'Aguardando resposta',
    confirmed: 'Confirmado',
    declined: 'Não vai',
  };
  return labels[status ?? 'pending'] ?? 'Aguardando resposta';
}

export function vendorStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    pending: 'A confirmar',
    confirmed: 'Confirmado',
    paid: 'Pago',
    cancelled: 'Cancelado',
    en_route: 'A caminho',
    arrived: 'Chegou',
    done: 'Concluído',
  };
  return labels[status ?? 'pending'] ?? 'A confirmar';
}
