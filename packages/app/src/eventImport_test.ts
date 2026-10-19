import {
  assert,
  assertEquals,
  assertFalse,
} from 'jsr:@std/assert@1';

import {
  EVENT_IMPORT_CATEGORIES,
  EVENT_IMPORT_LIMITS,
  canTransitionEventImportSession,
  getEventImportFileKind,
  isEventImportCategory,
  isEventImportSessionActive,
  validateEventImportSelection,
  type EventImportDraftPayload,
} from './eventImport.ts';

Deno.test('define os limites duráveis da sessão de importação', () => {
  assertEquals(EVENT_IMPORT_LIMITS.maxPdfBytes, 25 * 1024 * 1024);
  assertEquals(EVENT_IMPORT_LIMITS.maxGuestXlsxBytes, 10 * 1024 * 1024);
  assertEquals(EVENT_IMPORT_LIMITS.maxFilesPerSession, 20);
  assertEquals(EVENT_IMPORT_LIMITS.maxBytesPerSession, 100 * 1024 * 1024);
  assertEquals(EVENT_IMPORT_LIMITS.maxActiveSessionsPerCreator, 3);
  assertEquals(EVENT_IMPORT_LIMITS.maxActiveSessionsPerTenant, 10);
  assertEquals(EVENT_IMPORT_LIMITS.retentionDays, 7);
});

Deno.test('aceita PDF e reserva XLSX exclusivamente para convidados', () => {
  assertEquals(
    getEventImportFileKind({
      fileName: 'Roteiro do evento.PDF',
      mimeType: 'application/pdf',
    }),
    'pdf',
  );
  assertEquals(
    getEventImportFileKind({
      fileName: 'Lista de convidados.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    'guest_xlsx',
  );
  assertEquals(
    getEventImportFileKind({
      fileName: 'convidados.xls',
      mimeType: 'application/vnd.ms-excel',
    }),
    null,
  );
  assertEquals(
    getEventImportFileKind({
      fileName: 'roteiro.pdf',
      mimeType: 'application/octet-stream',
    }),
    null,
  );
});

Deno.test('expõe todas as categorias revisáveis sem duplicação', () => {
  assertEquals(new Set(EVENT_IMPORT_CATEGORIES).size, EVENT_IMPORT_CATEGORIES.length);
  for (
    const category of [
      'basic_info',
      'clients',
      'venue',
      'schedule',
      'tasks',
      'briefing',
      'vendors',
      'notes',
      'guests',
      'source_documents',
    ]
  ) {
    assert(isEventImportCategory(category));
  }
  assertFalse(isEventImportCategory('raw_gemini_json'));
});

Deno.test('permite somente transições válidas da sessão', () => {
  assert(canTransitionEventImportSession('collecting_files', 'queued'));
  assert(canTransitionEventImportSession('queued', 'processing'));
  assert(canTransitionEventImportSession('processing', 'needs_review'));
  assert(canTransitionEventImportSession('needs_review', 'confirming'));
  assert(canTransitionEventImportSession('confirming', 'completed'));
  assert(canTransitionEventImportSession('confirming', 'expired'));
  assert(canTransitionEventImportSession('failed', 'queued'));
  assert(canTransitionEventImportSession('collecting_files', 'discarded'));
  assertFalse(canTransitionEventImportSession('completed', 'processing'));
  assertFalse(canTransitionEventImportSession('discarded', 'queued'));
  assertFalse(canTransitionEventImportSession('needs_review', 'completed'));
});

Deno.test('identifica apenas estados que ainda podem ser retomados', () => {
  for (
    const status of [
      'collecting_files',
      'queued',
      'processing',
      'needs_review',
      'confirming',
      'failed',
    ] as const
  ) {
    assert(isEventImportSessionActive(status));
  }
  for (const status of ['completed', 'expired', 'discarded'] as const) {
    assertFalse(isEventImportSessionActive(status));
  }
});

Deno.test('valida quantidade, tamanho individual e total da seleção', () => {
  assertEquals(
    validateEventImportSelection([
      { kind: 'pdf', sizeBytes: 1024 },
      { kind: 'guest_xlsx', sizeBytes: 2048 },
    ]),
    { valid: true, code: null },
  );

  assertEquals(
    validateEventImportSelection([
      { kind: 'pdf', sizeBytes: EVENT_IMPORT_LIMITS.maxPdfBytes + 1 },
    ]),
    { valid: false, code: 'pdf_too_large' },
  );

  assertEquals(
    validateEventImportSelection([
      {
        kind: 'guest_xlsx',
        sizeBytes: EVENT_IMPORT_LIMITS.maxGuestXlsxBytes + 1,
      },
    ]),
    { valid: false, code: 'guest_xlsx_too_large' },
  );

  assertEquals(
    validateEventImportSelection(
      Array.from({ length: EVENT_IMPORT_LIMITS.maxFilesPerSession + 1 }, () => ({
        kind: 'pdf' as const,
        sizeBytes: 1,
      })),
    ),
    { valid: false, code: 'too_many_files' },
  );

  assertEquals(
    validateEventImportSelection([
      {
        kind: 'pdf',
        sizeBytes: EVENT_IMPORT_LIMITS.maxPdfBytes,
      },
      {
        kind: 'pdf',
        sizeBytes: EVENT_IMPORT_LIMITS.maxPdfBytes,
      },
      {
        kind: 'pdf',
        sizeBytes: EVENT_IMPORT_LIMITS.maxPdfBytes,
      },
      {
        kind: 'pdf',
        sizeBytes: EVENT_IMPORT_LIMITS.maxPdfBytes,
      },
      { kind: 'pdf', sizeBytes: 1 },
    ]),
    { valid: false, code: 'session_too_large' },
  );
});

Deno.test('representa revisão, confiança e origem sem conteúdo binário', () => {
  const draft: EventImportDraftPayload = {
    schemaVersion: 1,
    sourceRevision: 2,
    categories: {
      schedule: {
        category: 'schedule',
        included: true,
        status: 'warning',
        items: [
          {
            id: 'schedule-1',
            included: true,
            value: {
              title: 'Entrada principal',
              scheduledAt: '2026-08-10T19:00:00-03:00',
            },
            confidence: 'low',
            warnings: ['Horário com baixa legibilidade'],
            sources: [
              {
                fileId: '00000000-0000-0000-0000-000000000001',
                fileName: 'Roteiro.pdf',
                page: 3,
              },
            ],
          },
        ],
      },
    },
    conflicts: [],
  };

  assertEquals(draft.categories.schedule?.items[0]?.confidence, 'low');
  assertEquals(draft.categories.schedule?.items[0]?.sources[0]?.page, 3);
});
