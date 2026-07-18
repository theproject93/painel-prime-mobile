import { assert, assertFalse } from 'jsr:@std/assert@1';

const featureUrl = new URL('.', import.meta.url);

Deno.test('event action hooks preserve storage, timeline and command boundaries', async () => {
  const [uploads, timeline, command] = await Promise.all([
    Deno.readTextFile(new URL('useEventUploads.ts', featureUrl)),
    Deno.readTextFile(new URL('useEventTimeline.ts', featureUrl)),
    Deno.readTextFile(new URL('useEventCommandCenter.ts', featureUrl)),
  ]);

  assert(uploads.includes("entityType: 'event_document'"));
  assert(uploads.includes("entityType: 'event_photo'"));
  assert(uploads.includes("entityType: 'event_invite_whatsapp_image'"));
  assert(uploads.includes("entityType: 'event_team_member_photo'"));
  assert(uploads.includes(".from('event_documents')"));
  assert(uploads.includes(".from('event_team_members')"));

  assert(timeline.includes(".from('event_timeline').insert("));
  assert(timeline.includes("supabase.functions.invoke('timeline-ai'"));
  assert(timeline.includes("current_timeline: data.timeline.slice(0, 20)"));

  assert(command.includes(".from('event_vendor_status')"));
  assert(command.includes(".from('event_command_incidents')"));
  assert(command.includes(".from('event_command_config')"));
  assertFalse(command.includes('Alert.alert('));
});
