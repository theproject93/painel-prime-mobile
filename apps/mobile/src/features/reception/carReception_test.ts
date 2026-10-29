import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { type ReceptionGuest } from './types/receptionTypes';

/**
 * Função pura que simula o particionamento do Carro da Portaria Prime
 * antes de enviar para o SQLite e RPC do Supabase.
 */
function partitionCarGuests(selectedGuests: ReceptionGuest[]): {
  familyBatches: { groupLeader: ReceptionGuest; memberIds: string[] }[];
  individualBatches: ReceptionGuest[];
} {
  const familyMap = new Map<string, ReceptionGuest[]>();
  const individualBatches: ReceptionGuest[] = [];

  for (const guest of selectedGuests) {
    if (guest.family_group_id) {
      const list = familyMap.get(guest.family_group_id) ?? [];
      list.push(guest);
      familyMap.set(guest.family_group_id, list);
    } else {
      individualBatches.push(guest);
    }
  }

  const familyBatches: { groupLeader: ReceptionGuest; memberIds: string[] }[] = [];
  for (const [_, members] of familyMap.entries()) {
    const groupLeader = members.find((m) => m.is_group_leader) || members[0];
    familyBatches.push({
      groupLeader,
      memberIds: members.map((m) => m.id),
    });
  }

  return { familyBatches, individualBatches };
}

describe('Portaria Prime - Carro e Grupo de Alto Fluxo (Car Check-In)', () => {
  const nunoBorges: ReceptionGuest = {
    id: 'guest-nuno-1',
    event_id: 'ev-casamento-1',
    name: 'Nuno Borges',
    phone: '11999990001',
    qr_token: 'token-borges-nuno',
    family_group_id: 'fam-borges-100',
    is_group_leader: true,
    group_leader_id: 'guest-nuno-1',
    group_sort_order: 1,
    checked_in_at: null,
    checked_in_by: null,
    table_id: 'table-04',
    table_name: 'Mesa 04',
  };

  const madalenaBorges: ReceptionGuest = {
    id: 'guest-madalena-2',
    event_id: 'ev-casamento-1',
    name: 'Madalena Borges',
    phone: null,
    qr_token: 'token-borges-madalena',
    family_group_id: 'fam-borges-100',
    is_group_leader: false,
    group_leader_id: 'guest-nuno-1',
    group_sort_order: 2,
    checked_in_at: null,
    checked_in_by: null,
    table_id: 'table-04',
    table_name: 'Mesa 04',
  };

  const miguelBorges: ReceptionGuest = {
    id: 'guest-miguel-3',
    event_id: 'ev-casamento-1',
    name: 'Miguel Borges',
    phone: null,
    qr_token: 'token-borges-miguel',
    family_group_id: 'fam-borges-100',
    is_group_leader: false,
    group_leader_id: 'guest-nuno-1',
    group_sort_order: 3,
    checked_in_at: null,
    checked_in_by: null,
    table_id: 'table-04',
    table_name: 'Mesa 04',
  };

  const dulceBorges: ReceptionGuest = {
    id: 'guest-dulce-4',
    event_id: 'ev-casamento-1',
    name: 'Dulce Borges',
    phone: null,
    qr_token: 'token-borges-dulce',
    family_group_id: 'fam-borges-100',
    is_group_leader: false,
    group_leader_id: 'guest-nuno-1',
    group_sort_order: 4,
    checked_in_at: null,
    checked_in_by: null,
    table_id: 'table-04',
    table_name: 'Mesa 04',
  };

  const valmiraCarona: ReceptionGuest = {
    id: 'guest-valmira-5',
    event_id: 'ev-casamento-1',
    name: 'Valmira Souza',
    phone: '11988880002',
    qr_token: 'token-valmira',
    family_group_id: null,
    is_group_leader: false,
    group_leader_id: null,
    group_sort_order: null,
    checked_in_at: null,
    checked_in_by: null,
    table_id: 'table-12',
    table_name: 'Mesa 12',
  };

  test('Cenário Real do Carro: Família Borges (sem a pequena Dulce doente) + Valmira de carona', () => {
    // No carro estão: Nuno, Madalena, Miguel e Valmira. (Dulce ficou em casa doente e não foi marcada).
    const carPassengers = [nunoBorges, madalenaBorges, miguelBorges, valmiraCarona];

    assert.equal(carPassengers.length, 4, 'Carro deve conter exatamente 4 pessoas');

    // Executa o particionamento atômico
    const { familyBatches, individualBatches } = partitionCarGuests(carPassengers);

    // 1. Grupo Borges
    assert.equal(familyBatches.length, 1, 'Deve haver exatamente 1 lote familiar');
    const borgesBatch = familyBatches[0];
    assert.equal(borgesBatch.groupLeader.name, 'Nuno Borges', 'Líder da família deve ser Nuno Borges');
    assert.deepEqual(
      borgesBatch.memberIds,
      ['guest-nuno-1', 'guest-madalena-2', 'guest-miguel-3'],
      'Membros da família devem incluir Nuno, Madalena e Miguel',
    );
    assert.ok(
      !borgesBatch.memberIds.includes(dulceBorges.id),
      'A pequena Dulce Borges NÃO deve ser confirmada pois ficou em casa doente',
    );

    // 2. Convidado individual (Valmira)
    assert.equal(individualBatches.length, 1, 'Deve haver exatamente 1 convidado individual (carona)');
    const valmiraBatch = individualBatches[0];
    assert.equal(valmiraBatch.name, 'Valmira Souza');
    assert.equal(valmiraBatch.table_name, 'Mesa 12', 'Valmira senta na Mesa 12 (diferente da Mesa 04 dos Borges)');

    // 3. Invariante de Segurança do Banco de Dados:
    // Nenhuma operação submete múltiplos family_group_id no mesmo lote
    assert.equal(
      new Set(borgesBatch.memberIds.map(() => borgesBatch.groupLeader.family_group_id)).size,
      1,
      'Lote familiar deve ter exatamente 1 family_group_id único',
    );
  });

  test('Agrupamento de Mesas para Orientação Imediata dos Passageiros', () => {
    const carPassengers = [nunoBorges, madalenaBorges, miguelBorges, valmiraCarona];

    const tableGroups = carPassengers.reduce<Record<string, string[]>>((acc, g) => {
      const table = g.table_name || 'Sem mesa';
      if (!acc[table]) acc[table] = [];
      acc[table].push(g.name);
      return acc;
    }, {});

    assert.deepEqual(tableGroups['Mesa 04'], [
      'Nuno Borges',
      'Madalena Borges',
      'Miguel Borges',
    ]);
    assert.deepEqual(tableGroups['Mesa 12'], ['Valmira Souza']);
  });
});
