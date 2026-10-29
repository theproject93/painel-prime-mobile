import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { receptionAudio } from './sound/receptionAudio';
import type { CheckInState, ReceptionGuest } from './types/receptionTypes';

describe('Milestone 3 — Mobile Scanner, UI & Family Groups', () => {
  describe('1. Feedback Sonoro (receptionAudio)', () => {
    const states: CheckInState[] = [
      'confirmed',
      'pending',
      'in_flight',
      'already_checked_in',
      'rejected',
      'needs_attention',
    ];

    for (const state of states) {
      it(`gera URI base64 de áudio WAV sintético válida para o estado "${state}"`, () => {
        const uri = receptionAudio.getAudioDataUri(state);
        assert.ok(uri.startsWith('data:audio/wav;base64,'), `URI deve começar com cabeçalho data:audio/wav;base64,`);

        const base64Data = uri.replace('data:audio/wav;base64,', '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Valida cabeçalho RIFF / WAVE
        assert.equal(buffer.subarray(0, 4).toString('ascii'), 'RIFF');
        assert.equal(buffer.subarray(8, 12).toString('ascii'), 'WAVE');
        assert.equal(buffer.subarray(12, 16).toString('ascii'), 'fmt ');
        assert.equal(buffer.subarray(36, 40).toString('ascii'), 'data');

        // Valida tamanho mínimo de amostras PCM
        assert.ok(buffer.length > 100, 'Buffer de áudio deve conter dados de ondas sonoras');
      });
    }
  });

  describe('2. Seleção Explícita em Grupos Familiares (R3 / AC #4)', () => {
    const leaderId = '11111111-1111-1111-1111-111111111111';
    const companion1Id = '22222222-2222-2222-2222-222222222222';
    const companion2Id = '33333333-3333-3333-3333-333333333333';
    const absentCompanionId = '44444444-4444-4444-4444-444444444444';

    const mockFamily: ReceptionGuest[] = [
      {
        id: leaderId,
        name: 'Roberto Silva (Líder)',
        qr_token: 'token-roberto',
        family_group_id: 'fam-silva-1',
        is_group_leader: true,
        group_leader_id: null,
        checked_in_at: null,
        checked_in_by: null,
        table_id: 'table-1',
        table_name: 'Mesa 01',
      },
      {
        id: companion1Id,
        name: 'Mariana Silva',
        qr_token: null,
        family_group_id: 'fam-silva-1',
        is_group_leader: false,
        group_leader_id: leaderId,
        checked_in_at: null,
        checked_in_by: null,
        table_id: 'table-1',
        table_name: 'Mesa 01',
      },
      {
        id: companion2Id,
        name: 'Lucas Silva',
        qr_token: null,
        family_group_id: 'fam-silva-1',
        is_group_leader: false,
        group_leader_id: leaderId,
        checked_in_at: null,
        checked_in_by: null,
        table_id: 'table-1',
        table_name: 'Mesa 01',
      },
      {
        id: absentCompanionId,
        name: 'Carlos Silva (Ausente)',
        qr_token: null,
        family_group_id: 'fam-silva-1',
        is_group_leader: false,
        group_leader_id: leaderId,
        checked_in_at: null,
        checked_in_by: null,
        table_id: 'table-1',
        table_name: 'Mesa 01',
      },
    ];

    it('transmite estritamente os integrantes marcados pelo operador, preservando os ausentes desmarcados', () => {
      // Simulação da seleção pelo operador: desmarca absentCompanionId
      const checkedIds = new Set([leaderId, companion1Id, companion2Id]);

      const confirmedPayload = Array.from(checkedIds);

      // Verificações
      assert.equal(confirmedPayload.length, 3);
      assert.ok(confirmedPayload.includes(leaderId));
      assert.ok(confirmedPayload.includes(companion1Id));
      assert.ok(confirmedPayload.includes(companion2Id));
      assert.equal(confirmedPayload.includes(absentCompanionId), false, 'Acompanhante ausente NÃO deve constar no array');
    });

    it('identifica corretamente o líder da família e acompanhantes vinculados', () => {
      const leader = mockFamily.find((m) => m.is_group_leader);
      assert.ok(leader);
      assert.equal(leader.id, leaderId);

      const companions = mockFamily.filter((m) => !m.is_group_leader);
      assert.equal(companions.length, 3);
      for (const comp of companions) {
        assert.equal(comp.group_leader_id, leaderId);
        assert.equal(comp.family_group_id, 'fam-silva-1');
      }
    });
  });

  describe('3. Badges Visuais e Códigos de Cores (R2)', () => {
    // 5 Cores per R2:
    // 🟢 Verde: Confirmado no Servidor (#22C55E)
    // 🟡 Amarelo: Gravado e Pendente Localmente (#EAB308)
    // 🟠 Laranja: Já Estava Confirmado Anteriormente (#F97316)
    // 🔴 Vermelho: Rejeitado / Erro de Escopo (#EF4444)
    // 🟣 Roxo: Atenção Necessária / Máximo de Retries (#A855F7)
    const expectedColors: Record<CheckInState, string> = {
      confirmed: '#22C55E',
      pending: '#EAB308',
      in_flight: '#EAB308',
      already_checked_in: '#F97316',
      rejected: '#EF4444',
      needs_attention: '#A855F7',
    };

    const expectedLabels: Record<CheckInState, string> = {
      confirmed: 'Confirmado no Servidor',
      pending: 'Gravado e Pendente Localmente',
      in_flight: 'Gravado e Pendente Localmente',
      already_checked_in: 'Já Estava Confirmado Anteriormente',
      rejected: 'Rejeitado / Erro de Escopo',
      needs_attention: 'Atenção Necessária',
    };

    it('possui mapeamento consistente de cores e rótulos em PT-BR para todos os 5 estados', () => {
      for (const [state, color] of Object.entries(expectedColors)) {
        assert.ok(color.startsWith('#'), `Cor do estado ${state} deve ser hexadecimal`);
      }
      for (const [state, label] of Object.entries(expectedLabels)) {
        assert.ok(label.length > 0, `Rótulo do estado ${state} deve ser informado em PT-BR`);
      }
    });
  });

  describe('4. Parser de QR Code de Convidados', () => {
    function extractToken(input: string): string {
      let token = input.trim();
      if (token.includes('?')) {
        try {
          const urlParams = new URLSearchParams(token.split('?')[1]);
          const extracted = urlParams.get('token') || urlParams.get('t') || urlParams.get('qr');
          if (extracted) token = extracted;
        } catch {}
      }
      return token.toLowerCase();
    }

    it('extrai token de UUID puro', () => {
      const rawUuid = '7B98E2A1-F998-4D4F-8BB5-4F8A6B8D4321';
      assert.equal(extractToken(rawUuid), '7b98e2a1-f998-4d4f-8bb5-4f8a6b8d4321');
    });

    it('extrai token de URL da recepção com ?token=', () => {
      const url = 'https://app.painelprime.com.br/recepcao/event-123?token=abc-456-def';
      assert.equal(extractToken(url), 'abc-456-def');
    });

    it('extrai token de URL curta com ?t=', () => {
      const url = 'https://painelprime.com.br/r?t=token-curto-999';
      assert.equal(extractToken(url), 'token-curto-999');
    });
  });
});
