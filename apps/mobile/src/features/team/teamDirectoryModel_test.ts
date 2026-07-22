import { assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { buildMemberPayload, normalizeTeamSummary } from './teamDirectoryModel.ts';

Deno.test('team summary stays operational and bounded', () => {
  const summary = normalizeTeamSummary({ active_member_count: 2, upcoming_event_count: 3, members: [{ id: 'm1', team_id: 't1', team_name: 'Recepção', name: 'Ana', upcoming_event_count: 2, access_status: 'active' }] });
  assertEquals(summary.activeMemberCount, 2);
  assertEquals(summary.members[0].upcomingEventCount, 2);
});

Deno.test('member payload trims editable fields', () => {
  assertEquals(buildMemberPayload({ name: ' Ana ', role: ' Recepção ', phone: ' ', email: ' ANA@EXAMPLE.COM ', teamId: 't1' }), { name: 'Ana', role: 'Recepção', phone: null, email: 'ana@example.com', team_id: 't1' });
});

Deno.test('team directory scopes and bounds the team list query', async () => {
  const screenSource = await Deno.readTextFile(
    new URL('../../screens/TeamDirectoryScreen.tsx', import.meta.url),
  );
  assertStringIncludes(screenSource, ".eq('tenant_id', nextTenantId)");
  assertStringIncludes(screenSource, ".order('created_at').limit(100)");
});
