import { assertEquals } from 'jsr:@std/assert';
import { availableGoals, earnedAchievement, goalMissions, missionStatus, visibleMissions, type AdoptionSnapshot, type Mission } from './adoptionModel.ts';

const mission: Mission = { id: 'guests', title: 'Convidados', instruction: '', route: 'guests', eventScoped: true, achievement: 'Lista iniciada' };
const base: AdoptionSnapshot = {
  tenant_id: 'assessoria-a', audience: 'agency', plan: 'elite', event_id: null,
  allowed: ['guests'], facts: {}, progress: [], achievements: [],
};

Deno.test('missões dependem da lista autorizada e de um evento selecionado', () => {
  assertEquals(visibleMissions(base).map(item => item.id), ['guests']);
  assertEquals(missionStatus(mission, base), 'Escolha um evento');
  assertEquals(missionStatus(mission, { ...base, event_id: 'evento-a', facts: { guests: true } }), 'Concluída');
  assertEquals(visibleMissions({ ...base, allowed: [] }), []);
});

Deno.test('conquistas de evento não atravessam contextos e as pessoais exigem escopo individual', () => {
  const snapshot: AdoptionSnapshot = { ...base, event_id: 'evento-b', achievements: [
    { mission_id: 'guests', earned_at: '2026-11-01T12:00:00Z', scope: 'event', context_key: 'evento-a' },
    { mission_id: 'ai', earned_at: '2026-11-01T12:00:00Z', scope: 'agency' },
  ] };
  assertEquals(earnedAchievement(mission, snapshot), undefined);
  assertEquals(earnedAchievement({ id: 'ai', title: '', instruction: '', route: null, achievement: 'IA' }, snapshot), undefined);
});

Deno.test('objetivos mostram apenas etapas autorizadas ao perfil', () => {
  assertEquals(availableGoals(base).map(goal => goal.id), ['event']);
  assertEquals(goalMissions(base, 'event').map(item => item.id), ['guests']);
  assertEquals(goalMissions(base, 'agency'), []);
  const team: AdoptionSnapshot = { ...base, audience: 'team', allowed: ['assigned-reception'] };
  assertEquals(availableGoals(team).map(goal => goal.id), ['assigned-reception']);
  assertEquals(goalMissions(team, 'event'), []);
});
