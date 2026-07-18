import { assertEquals } from 'jsr:@std/assert@1';

import {
  combineDateTime,
  composePaymentNote,
  normalizeAiSuggestion,
  normalizePaymentMethod,
  parsePaymentNote,
} from './eventDetailsUtils.ts';

Deno.test('payment note metadata survives extraction without changing the visible note', () => {
  const stored = composePaymentNote('Comprovante validado', { receipt_document_id: 'doc-42' });

  assertEquals(parsePaymentNote(stored), {
    userNote: 'Comprovante validado',
    meta: { receipt_document_id: 'doc-42' },
  });
  assertEquals(parsePaymentNote('nota [[PP_META:{inválido}]]'), {
    userNote: 'nota [[PP_META:{inválido}]]',
    meta: {},
  });
});

Deno.test('event detail normalizers preserve payment and AI fallbacks', () => {
  assertEquals(normalizePaymentMethod(' CRÉDITO '), 'pix');
  assertEquals(normalizePaymentMethod('transferencia'), 'transferencia');
  assertEquals(
    normalizeAiSuggestion(
      {
        titulo: 'Confirmar chegada',
        motivo: 'Fornecedor sem atualização',
        atividade: 'Telefonar para o fornecedor',
        responsavel: 'Cerimonial',
        prioridade: 'alta',
        hora: '8:05',
      },
      0,
    ),
    {
      id: 'ai-0-confirmar-chegada',
      title: 'Confirmar chegada',
      reason: 'Fornecedor sem atualização',
      activity: 'Telefonar para o fornecedor',
      time: '08:05',
      assignee: 'Cerimonial',
      priority: 'high',
      source: 'ai',
    },
  );
});

Deno.test('event command date composition keeps the selected local date and time', () => {
  const combined = combineDateTime('2026-07-18T00:00:00', '14:35');

  assertEquals(combined?.getFullYear(), 2026);
  assertEquals(combined?.getMonth(), 6);
  assertEquals(combined?.getDate(), 18);
  assertEquals(combined?.getHours(), 14);
  assertEquals(combined?.getMinutes(), 35);
});
