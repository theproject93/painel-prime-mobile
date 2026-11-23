import { assertEquals } from 'jsr:@std/assert';
import { canTeamAccessPath } from './teamRouteAccess.ts';

const assigned = ['8b243d59-9a31-4e0d-bbd2-93621adfab63'];

Deno.test('colaborador acessa somente as rotas operacionais do próprio evento', () => {
  for (const path of ['/dashboard', '/eventos', '/mais', '/mais/perfil', '/mais/configuracoes', '/missoes',
    `/eventos/${assigned[0]}`, `/eventos/${assigned[0]}/portaria`]) {
    assertEquals(canTeamAccessPath(path, assigned), true, path);
  }
  for (const path of ['/clientes', '/financeiro', '/fornecedores', '/reunioes', '/planos', '/mais/equipe',
    '/mais/assinaturas', '/eventos/5e17828f-0d8a-4e09-8044-dcfc7238474d',
    `/eventos/${assigned[0]}/rsvp-inbox`, `/eventos/${assigned[0]}/mesas`]) {
    assertEquals(canTeamAccessPath(path, assigned), false, path);
  }
});

Deno.test('sem evento escalado não há acesso direto ao briefing ou à portaria', () => {
  assertEquals(canTeamAccessPath(`/eventos/${assigned[0]}`, []), false);
  assertEquals(canTeamAccessPath(`/eventos/${assigned[0]}/portaria`, []), false);
});
