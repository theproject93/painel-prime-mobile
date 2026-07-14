import { assertEquals, assertFalse } from 'jsr:@std/assert@1';

import {
  getEventPersonaCopy,
  normalizeInternalEventKind,
} from './eventPersona.ts';

Deno.test('normalizes canonical event kinds and historical Portuguese aliases', () => {
  assertEquals(normalizeInternalEventKind('wedding'), 'wedding');
  assertEquals(normalizeInternalEventKind('casamento'), 'wedding');
  assertEquals(normalizeInternalEventKind('15 anos'), 'debutante');
  assertEquals(normalizeInternalEventKind('quinze_anos'), 'debutante');
  assertEquals(normalizeInternalEventKind('aniversário infantil'), 'birthday');
  assertEquals(normalizeInternalEventKind('corporativo'), 'corporate');
  assertEquals(normalizeInternalEventKind('evento empresarial'), 'corporate');
});

Deno.test('uses a neutral generic fallback instead of assuming a wedding', () => {
  for (const value of [null, undefined, '', 'formatura']) {
    const copy = getEventPersonaCopy(value);
    assertEquals(copy.kind, 'generic');
    assertEquals(copy.principalNamePlaceholder, 'Nome do cliente');
    const serialized = JSON.stringify(copy).toLocaleLowerCase('pt-BR');
    assertFalse(serialized.includes('casal'));
    assertFalse(serialized.includes('noivo'));
    assertFalse(serialized.includes('noiva'));
  }
});

Deno.test('returns complete wedding copy', () => {
  const copy = getEventPersonaCopy('casamento');
  assertEquals(copy.kind, 'wedding');
  assertEquals(copy.principalNamePlaceholder, 'Nome do casal');
  assertEquals(copy.budgetTitle, 'Quanto o casal pode investir');
  assertEquals(copy.budgetEditDescription, 'Informe o limite que o casal separou para realizar este evento.');
  assertEquals(copy.timelineActivityPlaceholder, 'Ex.: Entrada dos noivos');
  assertEquals(copy.tableNamePlaceholder, 'Nome da mesa (ex.: Família dos noivos)');
  assertEquals(copy.analyticsRecipient, 'ao casal');
});

Deno.test('returns complete debutante copy', () => {
  const copy = getEventPersonaCopy('debutante');
  assertEquals(copy.principalNamePlaceholder, 'Nome da debutante');
  assertEquals(copy.budgetTitle, 'Quanto foi reservado para a debutante');
  assertEquals(copy.timelineActivityPlaceholder, 'Ex.: Entrada da debutante');
  assertEquals(copy.analyticsRecipient, 'à debutante');
  assertEquals(copy.giftManagementDescription, 'A debutante ou seus responsáveis registram o QR Code e confirmam manualmente o recebimento depois de conferir o extrato Pix.');
});

Deno.test('returns complete birthday copy without inferring gender', () => {
  const copy = getEventPersonaCopy('aniversário');
  assertEquals(copy.principalNamePlaceholder, 'Nome do aniversariante');
  assertEquals(copy.budgetTitle, 'Orçamento disponível para o aniversário');
  assertEquals(copy.budgetEditDescription, 'Informe o limite reservado para realizar este aniversário.');
  assertEquals(copy.analyticsRecipient, 'ao aniversariante');
});

Deno.test('returns complete corporate copy', () => {
  const copy = getEventPersonaCopy('corporate');
  assertEquals(copy.principalNamePlaceholder, 'Nome do cliente ou empresa');
  assertEquals(copy.budgetTitle, 'Quanto o cliente pode investir');
  assertEquals(copy.timelineActivityPlaceholder, 'Ex.: Chegada dos representantes');
  assertEquals(copy.tableNamePlaceholder, 'Nome da mesa (ex.: Diretoria)');
});
