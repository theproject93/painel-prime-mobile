import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlanDecision } from './planDecisionModel';

const MAX_DECISIONS = 100;
const pendingWrites = new Map<string, Promise<void>>();

export function decisionStorageKey(userId: string) {
  return `painelprime.plan.decisions.v1.${userId}`;
}

export async function loadDecisions(userId: string): Promise<PlanDecision[]> {
  try {
    const raw = await AsyncStorage.getItem(decisionStorageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PlanDecision =>
      item && typeof item.proposalId === 'string' && typeof item.title === 'string'
      && typeof item.createdAt === 'string' && typeof item.expiresAt === 'string'
      && ['pending', 'executed', 'failed', 'cancelled', 'expired'].includes(item.status)
      && (item.threadId === null || typeof item.threadId === 'string')
      && (item.eventId === null || typeof item.eventId === 'string'))
      .slice(0, MAX_DECISIONS);
  } catch {
    return [];
  }
}

export async function saveDecisions(userId: string, items: PlanDecision[]): Promise<void> {
  const previous = pendingWrites.get(userId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() =>
    AsyncStorage.setItem(decisionStorageKey(userId), JSON.stringify(items.slice(0, MAX_DECISIONS))));
  pendingWrites.set(userId, next);
  try {
    await next;
  } finally {
    if (pendingWrites.get(userId) === next) pendingWrites.delete(userId);
  }
}
