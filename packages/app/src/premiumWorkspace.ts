export const MOTIVATIONAL_QUOTES = [
  'Seu cuidado transforma detalhes em memórias que ficam para sempre.',
  'Um evento inesquecível começa com uma decisão tranquila de cada vez.',
  'Hoje você não organiza apenas tarefas: você aproxima pessoas de um sonho.',
  'Confie no seu olhar — ele enxerga soluções onde outros veem imprevistos.',
  'Cada detalhe bem cuidado abre espaço para celebrar com leveza.',
  'Grandes celebrações nascem da constância nos pequenos passos.',
] as const;

type GreetingInput = { displayName?: string | null; email?: string | null; hour?: number };

export function getHumanGreeting({ displayName, hour = new Date().getHours() }: GreetingInput) {
  const cleanName = String(displayName ?? '').trim();
  const firstName = cleanName && !cleanName.includes('@') ? cleanName.split(/\s+/)[0] : '';
  const period = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  return firstName ? `${period}, ${firstName}!` : `${period}!`;
}

export function pickMotivationalQuote(seed: number) {
  const normalized = Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : 0;
  return MOTIVATIONAL_QUOTES[normalized % MOTIVATIONAL_QUOTES.length];
}

type FinanceSummaryInput = { budgetTotal?: number | null; expenses?: Array<number | null | undefined> };

export function buildEventFinanceSummary({ budgetTotal, expenses = [] }: FinanceSummaryInput) {
  const planned = Math.max(0, Number(budgetTotal) || 0);
  const invested = expenses.reduce<number>((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  const available = planned - invested;
  return {
    planned,
    invested,
    available,
    progressPercent: planned > 0 ? Math.round((invested / planned) * 100) : 0,
    isOverBudget: invested > planned && planned > 0,
  };
}

type TaskSummaryItem = { completed?: boolean | null; due_date?: string | null; priority?: string | null };

export function buildTaskStatusSummary(tasks: TaskSummaryItem[], todayIso: string) {
  return tasks.reduce((summary, task) => {
    summary.total += 1;
    if (task.completed) summary.completed += 1;
    else if (String(task.priority ?? '').toLowerCase() === 'urgent') summary.urgent += 1;
    else if (task.due_date && task.due_date < todayIso) summary.overdue += 1;
    else summary.pending += 1;
    return summary;
  }, { urgent: 0, overdue: 0, pending: 0, completed: 0, total: 0 });
}
