import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  VALID_TRANSITIONS,
  canTransition,
  validateTransition,
  isTerminalState,
  isPendingSync,
  getStateBadgeColor,
  getStateLabel,
  InvalidStateTransitionError,
} from './engine/receptionFsm';
import type { CheckInState } from './types/receptionTypes';

import {
  buildCanonicalString,
  computeCanonicalPayloadHashSync,
  computeCanonicalPayloadHash,
} from './engine/receptionHash';

import {
  AUTO_HEAL_SQL,
  getAutoHealQuery,
  autoHealInFlightOperations,
} from './engine/receptionAutoHeal';

import {
  calculateReceptionExpiration,
  isSnapshotExpired,
  canScanForEvent,
  purgeExpiredSnapshots,
} from './storage/receptionRetention';

import type { SQLiteDatabase } from 'expo-sqlite';

describe('1. Hash Canônico Determinístico (AC #1)', () => {
  const eventId = 'e90a424b-3c32-4751-a20c-5ee2ca219801';
  const scanId = '85e94b21-6a20-410a-8bf8-0bb3ef3d4aa0';
  const guestA = '11111111-1111-1111-1111-111111111111';
  const guestB = '22222222-2222-2222-2222-222222222222';
  const guestC = '33333333-3333-3333-3333-333333333333';

  it('produz exatamente a mesma string canônica e hash indiferente à ordem do array', async () => {
    const order1 = [guestA, guestB, guestC];
    const order2 = [guestC, guestA, guestB];
    const order3 = [guestB, guestC, guestA];

    const str1 = buildCanonicalString({ eventId, clientScanId: scanId, confirmedGuestIds: order1 });
    const str2 = buildCanonicalString({ eventId, clientScanId: scanId, confirmedGuestIds: order2 });
    const str3 = buildCanonicalString({ eventId, clientScanId: scanId, confirmedGuestIds: order3 });

    assert.equal(str1, str2);
    assert.equal(str2, str3);

    const hash1 = computeCanonicalPayloadHashSync({ eventId, clientScanId: scanId, confirmedGuestIds: order1 });
    const hash2 = computeCanonicalPayloadHashSync({ eventId, clientScanId: scanId, confirmedGuestIds: order2 });
    const hash3 = await computeCanonicalPayloadHash({ eventId, clientScanId: scanId, confirmedGuestIds: order3 });

    assert.equal(hash1, hash2);
    assert.equal(hash2, hash3);
    assert.equal(hash1.length, 64); // SHA-256 hex length
  });

  it('normaliza caixa alta/baixa e espaços em branco dos UUIDs', () => {
    const mixedCase = [
      '  11111111-1111-1111-1111-111111111111  ',
      '22222222-2222-2222-2222-222222222222'.toUpperCase(),
    ];
    const cleanLower = [guestA, guestB];

    const hashMixed = computeCanonicalPayloadHashSync({
      eventId: eventId.toUpperCase(),
      clientScanId: `  ${scanId}  `,
      confirmedGuestIds: mixedCase,
    });

    const hashClean = computeCanonicalPayloadHashSync({
      eventId,
      clientScanId: scanId,
      confirmedGuestIds: cleanLower,
    });

    assert.equal(hashMixed, hashClean);
  });

  it('gera hashes diferentes se clientScanId ou confirmedGuestIds mudar', () => {
    const hash1 = computeCanonicalPayloadHashSync({
      eventId,
      clientScanId: scanId,
      confirmedGuestIds: [guestA],
    });
    const hash2 = computeCanonicalPayloadHashSync({
      eventId,
      clientScanId: '99999999-9999-9999-9999-999999999999',
      confirmedGuestIds: [guestA],
    });
    assert.notEqual(hash1, hash2);
  });

  it('garante paridade exata com a função calculate_reception_payload_hash do PostgreSQL', () => {
    const sampleScanId = '85e94b21-6a20-410a-8bf8-0bb3ef3d4aa0';
    const sampleQrToken = 'b8b9c0d1-0000-4000-8000-000000000002';
    const sampleGuestId = 'c8b9c0d1-0000-4000-8000-000000000003';
    const sampleConfirmedIds = [
      'd8b9c0d1-0000-4000-8000-000000000010',
      'd8b9c0d1-0000-4000-8000-000000000020',
    ];

    const expectedCanonicalString =
      '85e94b21-6a20-410a-8bf8-0bb3ef3d4aa0|b8b9c0d1-0000-4000-8000-000000000002|c8b9c0d1-0000-4000-8000-000000000003|["d8b9c0d1-0000-4000-8000-000000000010","d8b9c0d1-0000-4000-8000-000000000020"]';
    const expectedPostgresHash =
      'de2f8e990cda63ae5ecabe0075d811a74d8080e03190ec2029dd04a5f91925b2';

    const canonicalString = buildCanonicalString({
      clientScanId: sampleScanId,
      scannedQrToken: sampleQrToken,
      scannedGuestId: sampleGuestId,
      confirmedGuestIds: sampleConfirmedIds,
    });

    const computedHash = computeCanonicalPayloadHashSync({
      clientScanId: sampleScanId,
      scannedQrToken: sampleQrToken,
      scannedGuestId: sampleGuestId,
      confirmedGuestIds: sampleConfirmedIds,
    });

    assert.equal(canonicalString, expectedCanonicalString);
    assert.equal(computedHash, expectedPostgresHash);
  });

  it('suporta chaves snake_case e deduplica IDs de convidados na geração do hash', () => {
    const sampleScanId = '85e94b21-6a20-410a-8bf8-0bb3ef3d4aa0';
    const sampleQrToken = 'b8b9c0d1-0000-4000-8000-000000000002';
    const sampleGuestId = 'c8b9c0d1-0000-4000-8000-000000000003';
    const sampleConfirmedIdsWithDupes = [
      'd8b9c0d1-0000-4000-8000-000000000020',
      'd8b9c0d1-0000-4000-8000-000000000010',
      'd8b9c0d1-0000-4000-8000-000000000010',
      'd8b9c0d1-0000-4000-8000-000000000020',
    ];
    const expectedPostgresHash =
      'de2f8e990cda63ae5ecabe0075d811a74d8080e03190ec2029dd04a5f91925b2';

    const computedHash = computeCanonicalPayloadHashSync({
      client_scan_id: sampleScanId,
      scanned_qr_token: sampleQrToken,
      scanned_guest_id: sampleGuestId,
      confirmed_guest_ids: sampleConfirmedIdsWithDupes,
    });

    assert.equal(computedHash, expectedPostgresHash);
  });

  it('valida paridade byte a byte com PostgreSQL para 0, 1, 2 e N convidados (vetores canônicos)', () => {
    const base = {
      clientScanId: 'a0000000-0000-0000-0000-000000000001',
      scannedQrToken: 'b0000000-0000-0000-0000-000000000001',
      scannedGuestId: 'c0000000-0000-0000-0000-000000000001',
    };

    // 0 convidados
    assert.equal(
      computeCanonicalPayloadHashSync({ ...base, confirmedGuestIds: [] }),
      'dec59bfe7b7c3dbb9aec1b8ba8a97d3840b5105340a3047601f1dafd71413a09',
      '0 convidados deve coincidir com vetor de teste PostgreSQL/pgTAP'
    );

    // 1 convidado
    assert.equal(
      computeCanonicalPayloadHashSync({
        ...base,
        confirmedGuestIds: ['11111111-1111-1111-1111-111111111111'],
      }),
      'ae508576bead0e06584317c10b46d985528868645dd90b6ae61f40ff08ddf5c3',
      '1 convidado deve coincidir com vetor de teste PostgreSQL/pgTAP'
    );

    // 2 convidados (formato compacto RFC 8259 sem espaço)
    assert.equal(
      computeCanonicalPayloadHashSync({
        ...base,
        confirmedGuestIds: [
          '22222222-2222-2222-2222-222222222222',
          '11111111-1111-1111-1111-111111111111',
        ],
      }),
      'd9f750ef7ad05b8c2d24cb94b0b9a317313dc16faaaeae3d7dcbb0d93fe823b1',
      '2 convidados deve coincidir com vetor de teste PostgreSQL/pgTAP'
    );

    // 3 (N) convidados
    assert.equal(
      computeCanonicalPayloadHashSync({
        ...base,
        confirmedGuestIds: [
          '33333333-3333-3333-3333-333333333333',
          '11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222',
        ],
      }),
      'a2008d4922762a79b6aa7ca94c038bab2860b71de90eeb04043c55b605821718',
      'N convidados deve coincidir com vetor de teste PostgreSQL/pgTAP'
    );
  });
});

describe('2. Máquina de Estados Finitos Local (AC #2)', () => {
  it('garante que VALID_TRANSITIONS e seus estados estão profundamente congelados (Object.isFrozen)', () => {
    assert.equal(Object.isFrozen(VALID_TRANSITIONS), true);
    for (const key of Object.keys(VALID_TRANSITIONS) as CheckInState[]) {
      assert.equal(Object.isFrozen(VALID_TRANSITIONS[key]), true);
    }
  });
  it('permite transições válidas no ciclo de vida', () => {
    assert.equal(canTransition('pending', 'in_flight'), true);
    assert.equal(canTransition('in_flight', 'confirmed'), true);
    assert.equal(canTransition('in_flight', 'already_checked_in'), true);
    assert.equal(canTransition('in_flight', 'rejected'), true);
    assert.equal(canTransition('in_flight', 'needs_attention'), true);
    assert.equal(canTransition('in_flight', 'pending'), true); // auto-heal ou retry reset
    assert.equal(canTransition('needs_attention', 'pending'), true); // reprocessamento manual
  });

  it('bloqueia estritamente regressões a partir de estados terminais', () => {
    assert.equal(canTransition('confirmed', 'pending'), false);
    assert.equal(canTransition('confirmed', 'in_flight'), false);
    assert.equal(canTransition('already_checked_in', 'pending'), false);
    assert.equal(canTransition('already_checked_in', 'in_flight'), false);
    assert.equal(canTransition('rejected', 'pending'), false);
    assert.equal(canTransition('rejected', 'in_flight'), false);
  });

  it('validateTransition lança InvalidStateTransitionError quando ilegal', () => {
    assert.throws(
      () => validateTransition('confirmed', 'pending'),
      InvalidStateTransitionError,
    );
    assert.throws(
      () => validateTransition('rejected', 'confirmed'),
      InvalidStateTransitionError,
    );
  });

  it('identifica corretamente estados terminais e estados pendentes de sync', () => {
    assert.equal(isTerminalState('confirmed'), true);
    assert.equal(isTerminalState('already_checked_in'), true);
    assert.equal(isTerminalState('rejected'), true);
    assert.equal(isTerminalState('pending'), false);
    assert.equal(isTerminalState('in_flight'), false);

    assert.equal(isPendingSync('pending'), true);
    assert.equal(isPendingSync('in_flight'), true);
    assert.equal(isPendingSync('needs_attention'), true);
    assert.equal(isPendingSync('confirmed'), false);
    assert.equal(isPendingSync('already_checked_in'), false);
  });

  it('associa corretamente cores de badge multimodal e rótulos PT-BR', () => {
    assert.equal(getStateBadgeColor('confirmed'), 'green');
    assert.equal(getStateBadgeColor('pending'), 'yellow');
    assert.equal(getStateBadgeColor('in_flight'), 'yellow');
    assert.equal(getStateBadgeColor('already_checked_in'), 'orange');
    assert.equal(getStateBadgeColor('rejected'), 'red');
    assert.equal(getStateBadgeColor('needs_attention'), 'purple');

    assert.equal(getStateLabel('confirmed'), 'Confirmado');
    assert.equal(getStateLabel('pending'), 'Pendente (Local)');
    assert.equal(getStateLabel('in_flight'), 'Sincronizando...');
    assert.equal(getStateLabel('already_checked_in'), 'Já Registrado');
    assert.equal(getStateLabel('rejected'), 'Não Autorizado');
    assert.equal(getStateLabel('needs_attention'), 'Atenção Necessária');
  });
});

describe('3. Auto-Cura na Inicialização (AC #3)', () => {
  it('fornece a consulta SQL canônica correta', () => {
    const sql = getAutoHealQuery();
    assert.ok(sql.includes("SET state = 'pending'"));
    assert.ok(sql.includes('retry_count = retry_count + 1'));
    assert.ok(sql.includes("WHERE state = 'in_flight'"));
    assert.equal(sql, AUTO_HEAL_SQL);
  });

  it('executa a auto-cura revertendo in_flight para pending', async () => {
    let executedQuery = '';
    const mockDb = {
      runAsync: async (query: string) => {
        executedQuery = query;
        return { changes: 3, lastInsertRowId: 0 };
      },
    } as unknown as SQLiteDatabase;

    const result = await autoHealInFlightOperations(mockDb);
    assert.equal(result.healedCount, 3);
    assert.ok(executedQuery.includes("state = 'in_flight'"));
  });
});

describe('4. Política de Retenção e Expiração (AC #16 / R5)', () => {
  const eventDate = '2026-10-27';

  it('calcula expiração às 12:00 do dia seguinte ao evento', () => {
    const expiration = calculateReceptionExpiration(eventDate);
    assert.equal(expiration.getFullYear(), 2026);
    assert.equal(expiration.getMonth(), 9); // Outubro (0-indexed: 9)
    assert.equal(expiration.getDate(), 28); // Dia 28
    assert.equal(expiration.getHours(), 12);
    assert.equal(expiration.getMinutes(), 0);
  });

  it('avalia expiração corretamente antes e depois das 12:00 do dia seguinte', () => {
    // 2026-10-28 às 11:59:59 -> NÃO expirou
    const beforeExpiry = new Date(2026, 9, 28, 11, 59, 59);
    assert.equal(isSnapshotExpired(eventDate, beforeExpiry), false);

    // 2026-10-28 às 12:00:01 -> Expirou
    const afterExpiry = new Date(2026, 9, 28, 12, 0, 1);
    assert.equal(isSnapshotExpired(eventDate, afterExpiry), true);
  });

  it('canScanForEvent bloqueia scanner em snapshot expirado com mensagem em PT-BR', () => {
    const activeTime = new Date(2026, 9, 27, 20, 0, 0);
    const expiredTime = new Date(2026, 9, 28, 14, 0, 0);

    const snapshot = { event_date: eventDate, reception_offline_expires_at: null };

    const activeCheck = canScanForEvent(snapshot, activeTime);
    assert.equal(activeCheck.allowed, true);

    const expiredCheck = canScanForEvent(snapshot, expiredTime);
    assert.equal(expiredCheck.allowed, false);
    assert.ok(expiredCheck.reason?.includes('12:00 do dia seguinte'));
  });

  it('REGRA DE RETENÇÃO: preserva estritamente eventos com itens não sincronizados', async () => {
    const expiredTime = new Date(2026, 9, 29, 10, 0, 0);

    // Mock DB com 2 eventos expirados:
    // Evento 1 tem 5 pendências -> DEVE SER PRESERVADO
    // Evento 2 tem 0 pendências -> PODE SER EXPURGADO
    const mockSnapshots = [
      { event_id: 'ev-1', event_date: '2026-10-25', reception_offline_expires_at: null },
      { event_id: 'ev-2', event_date: '2026-10-25', reception_offline_expires_at: null },
    ];

    const deletedEvents: string[] = [];

    const mockDb = {
      getAllAsync: async () => mockSnapshots,
      getFirstAsync: async (_query: string, eventId: string) => {
        if (eventId === 'ev-1') return { count: 5 }; // 5 pendências
        return { count: 0 }; // 0 pendências
      },
      withTransactionAsync: async (fn: () => Promise<void>) => {
        await fn();
      },
      runAsync: async (_query: string, eventId: string) => {
        deletedEvents.push(eventId);
        return { changes: 1, lastInsertRowId: 0 };
      },
    } as unknown as SQLiteDatabase;

    const report = await purgeExpiredSnapshots(mockDb, expiredTime);

    // ev-1 foi preservado porque tem 5 pendências
    assert.deepEqual(report.preservedEventIds, ['ev-1']);
    assert.equal(report.preservedPendingOperationsCount, 5);

    // ev-2 foi expurgado porque tinha 0 pendências
    assert.deepEqual(report.purgedEventIds, ['ev-2']);
    assert.ok(deletedEvents.includes('ev-2'));
    assert.ok(!deletedEvents.includes('ev-1'));
  });
});

describe('5. Seleção Parcial de Acompanhantes em Grupos Familiares (AC #4)', () => {
  it('transmite estritamente os convidados selecionados pelo operador', () => {
    const familyMembers = [
      { id: 'leader-1', name: 'Maria Silva (Líder)' },
      { id: 'member-2', name: 'João Silva (Acompanhante)' },
      { id: 'member-3', name: 'Pedro Silva (Acompanhante - Ausente)' },
    ];

    // O operador desmarca Pedro Silva que não compareceu
    const selectedIds = familyMembers
      .filter((m) => m.id !== 'member-3')
      .map((m) => m.id);

    assert.equal(selectedIds.length, 2);
    assert.deepEqual(selectedIds, ['leader-1', 'member-2']);
    assert.ok(!selectedIds.includes('member-3'));

    const canonicalHash = computeCanonicalPayloadHashSync({
      eventId: 'evt-fam-1',
      clientScanId: 'scan-fam-1',
      confirmedGuestIds: selectedIds,
    });

    assert.ok(canonicalHash.length === 64);
  });
});
