export type CashForecastTone = 'empty' | 'positive' | 'negative' | 'neutral';

export function parseBRLInput(value: string): number {
  const normalized = value.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function classifyCashForecast(expectedIn: number, expectedOut: number): CashForecastTone {
  if (expectedIn === 0 && expectedOut === 0) return 'empty';
  if (expectedIn === expectedOut) return 'neutral';
  return expectedIn > expectedOut ? 'positive' : 'negative';
}

export function shouldShowEmptyAnalytics(entriesTotal: number, expensesTotal: number): boolean {
  return entriesTotal === 0 && expensesTotal === 0;
}
