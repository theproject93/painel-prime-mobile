export const EVENT_IMPORT_LIMITS = Object.freeze({
  maxPdfBytes: 25 * 1024 * 1024,
  maxGuestXlsxBytes: 10 * 1024 * 1024,
  maxFilesPerSession: 20,
  maxBytesPerSession: 100 * 1024 * 1024,
  maxActiveSessionsPerCreator: 3,
  maxActiveSessionsPerTenant: 10,
  retentionDays: 7,
});

export const EVENT_IMPORT_CATEGORIES = [
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
] as const;

export type EventImportCategory = (typeof EVENT_IMPORT_CATEGORIES)[number];
export type EventImportFileKind = 'pdf' | 'guest_xlsx';
export type EventImportConfidence = 'high' | 'medium' | 'low';

export type EventImportSessionStatus =
  | 'collecting_files'
  | 'queued'
  | 'processing'
  | 'needs_review'
  | 'confirming'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'discarded';

export type EventImportFileStatus =
  | 'stored'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'removed';

export type EventImportJobStatus =
  | 'queued'
  | 'processing'
  | 'retry_scheduled'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type EventImportSourceReference = Readonly<{
  fileId: string;
  fileName: string;
  page?: number;
  sheet?: string;
  row?: number;
}>;

export type EventImportReviewItem<
  TValue extends Readonly<Record<string, unknown>> = Readonly<
    Record<string, unknown>
  >,
> = Readonly<{
  id: string;
  included: boolean;
  value: TValue;
  confidence: EventImportConfidence;
  warnings: readonly string[];
  sources: readonly EventImportSourceReference[];
}>;

export type EventImportCategoryDraft = Readonly<{
  category: EventImportCategory;
  included: boolean;
  status: 'imported' | 'warning' | 'empty';
  items: readonly EventImportReviewItem[];
}>;

export type EventImportConflict = Readonly<{
  id: string;
  category: EventImportCategory;
  message: string;
  required: boolean;
  resolved: boolean;
}>;

export type EventImportDraftPayload = Readonly<{
  schemaVersion: 1;
  sourceRevision: number;
  categories: Partial<
    Readonly<Record<EventImportCategory, EventImportCategoryDraft>>
  >;
  conflicts: readonly EventImportConflict[];
}>;

export type EventImportSelectionErrorCode =
  | 'too_many_files'
  | 'pdf_too_large'
  | 'guest_xlsx_too_large'
  | 'session_too_large';

const SESSION_TRANSITIONS: Readonly<
  Record<EventImportSessionStatus, readonly EventImportSessionStatus[]>
> = {
  collecting_files: ['queued', 'expired', 'discarded'],
  queued: ['processing', 'failed', 'expired', 'discarded'],
  processing: ['needs_review', 'failed', 'expired', 'discarded'],
  needs_review: ['confirming', 'expired', 'discarded'],
  confirming: ['completed', 'needs_review', 'failed', 'expired'],
  completed: [],
  failed: ['queued', 'expired', 'discarded'],
  expired: [],
  discarded: [],
};

const ACTIVE_SESSION_STATUSES = new Set<EventImportSessionStatus>([
  'collecting_files',
  'queued',
  'processing',
  'needs_review',
  'confirming',
  'failed',
]);

const PDF_MIME_TYPE = 'application/pdf';
const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function isEventImportCategory(
  value: string,
): value is EventImportCategory {
  return (EVENT_IMPORT_CATEGORIES as readonly string[]).includes(value);
}

export function canTransitionEventImportSession(
  current: EventImportSessionStatus,
  next: EventImportSessionStatus,
): boolean {
  return SESSION_TRANSITIONS[current].includes(next);
}

export function isEventImportSessionActive(
  status: EventImportSessionStatus,
): boolean {
  return ACTIVE_SESSION_STATUSES.has(status);
}

export function getEventImportFileKind(input: {
  fileName: string;
  mimeType: string;
}): EventImportFileKind | null {
  const fileName = input.fileName.trim().toLocaleLowerCase('pt-BR');
  const mimeType = input.mimeType.trim().toLocaleLowerCase('en-US');

  if (fileName.endsWith('.pdf') && mimeType === PDF_MIME_TYPE) {
    return 'pdf';
  }

  if (fileName.endsWith('.xlsx') && mimeType === XLSX_MIME_TYPE) {
    return 'guest_xlsx';
  }

  return null;
}

export function validateEventImportSelection(
  files: readonly Readonly<{
    kind: EventImportFileKind;
    sizeBytes: number;
  }>[],
):
  | Readonly<{ valid: true; code: null }>
  | Readonly<{ valid: false; code: EventImportSelectionErrorCode }> {
  if (files.length > EVENT_IMPORT_LIMITS.maxFilesPerSession) {
    return { valid: false, code: 'too_many_files' };
  }

  let totalBytes = 0;

  for (const file of files) {
    if (
      file.kind === 'pdf' &&
      file.sizeBytes > EVENT_IMPORT_LIMITS.maxPdfBytes
    ) {
      return { valid: false, code: 'pdf_too_large' };
    }

    if (
      file.kind === 'guest_xlsx' &&
      file.sizeBytes > EVENT_IMPORT_LIMITS.maxGuestXlsxBytes
    ) {
      return { valid: false, code: 'guest_xlsx_too_large' };
    }

    totalBytes += file.sizeBytes;
  }

  if (totalBytes > EVENT_IMPORT_LIMITS.maxBytesPerSession) {
    return { valid: false, code: 'session_too_large' };
  }

  return { valid: true, code: null };
}
