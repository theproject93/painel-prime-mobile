import {
  groupMeetings,
  parseBrazilianDateTime,
  shouldOfferAtaRetry,
} from './meetingUtils.ts';

const meeting = (status: string, overrides: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  status,
  updated_at: '2026-07-10T10:00:00.000Z',
  meeting_minutes: [],
  ...overrides,
});

Deno.test('groups active, scheduled and historical meetings without dropping failures', () => {
  const grouped = groupMeetings([
    meeting('scheduled'),
    meeting('active'),
    meeting('completed'),
    meeting('ata_failed'),
  ]);

  if (grouped.active.length !== 1) throw new Error('active meeting missing');
  if (grouped.scheduled.length !== 1) throw new Error('scheduled meeting missing');
  if (grouped.history.length !== 2) throw new Error('meeting history incomplete');
});

Deno.test('parses a Brazilian meeting date and rejects impossible values', () => {
  const parsed = parseBrazilianDateTime('11/07/2026 14:30');
  if (parsed.getFullYear() !== 2026 || parsed.getMonth() !== 6 || parsed.getDate() !== 11) {
    throw new Error('date parsed incorrectly');
  }
  if (parsed.getHours() !== 14 || parsed.getMinutes() !== 30) {
    throw new Error('time parsed incorrectly');
  }

  let rejected = false;
  try {
    parseBrazilianDateTime('31/02/2026 14:30');
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error('impossible date was accepted');
});

Deno.test('offers ATA retry for failures and completed meetings older than ten minutes', () => {
  const now = new Date('2026-07-10T10:20:01.000Z').getTime();
  if (!shouldOfferAtaRetry(meeting('ata_failed'), now)) {
    throw new Error('failed ATA should be retryable');
  }
  if (!shouldOfferAtaRetry(meeting('completed'), now)) {
    throw new Error('stale completed ATA should be retryable');
  }
  if (shouldOfferAtaRetry(meeting('completed'), new Date('2026-07-10T10:05:00.000Z').getTime())) {
    throw new Error('fresh completed ATA should still be processing');
  }
  if (shouldOfferAtaRetry(meeting('completed', { meeting_minutes: [{ pdf_url: 'file-id' }] }), now)) {
    throw new Error('completed ATA with PDF should not be retried');
  }
});

Deno.test('wires the complete meetings control center into the event workspace', async () => {
  const sourceRoot = new URL('../../', import.meta.url);
  const routes = await Deno.readTextFile(new URL('navigation/eventRouteTypes.ts', sourceRoot));
  const details = await Deno.readTextFile(new URL('screens/EventDetailsScreen.tsx', sourceRoot));
  const center = await Deno.readTextFile(new URL('features/meetings/MeetingCenter.tsx', sourceRoot));
  const service = await Deno.readTextFile(new URL('features/meetings/meetingService.ts', sourceRoot));
  const implementation = `${center}\n${service}`;

  if (!routes.includes("key: 'meetings'") || !routes.includes("label: 'Reuniões'")) {
    throw new Error('meetings module is not registered');
  }
  if (!details.includes('MeetingCenter') || !details.includes("activeTab === 'meetings'")) {
    throw new Error('meetings module is not rendered');
  }

  for (const action of ['create', 'host-link', 'save-notes', 'complete', 'retry-ata']) {
    if (!implementation.includes(`'${action}'`)) throw new Error(`missing action ${action}`);
  }
  for (const capability of [
    'WebBrowser.openBrowserAsync',
    'Share.share',
    'getPrivateFileDownloadUrl',
    'KeyboardAvoidingView',
    'keyboardShouldPersistTaps="handled"',
    '.channel(',
  ]) {
    if (!implementation.includes(capability)) throw new Error(`missing capability ${capability}`);
  }
  if (!center.includes('styles.modalErrorText')) {
    throw new Error('schedule errors are hidden behind the modal');
  }
});
