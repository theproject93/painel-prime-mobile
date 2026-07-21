const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const optional = (value: unknown) => text(value).trim() || null;
const count = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0;

export type TeamMemberSummary = {
  id: string; teamId: string; teamName: string; name: string; role: string | null;
  phone: string | null; email: string | null; photoFileId: string | null;
  photoUrl: string | null; accessStatus: string; upcomingEventCount: number;
  hasConflict: boolean; isLeader: boolean; nextEvent: { name: string; eventDate: string } | null;
};

export function normalizeTeamSummary(value: unknown) {
  const source = record(value);
  const members = Array.isArray(source.members) ? source.members.flatMap((entry): TeamMemberSummary[] => {
    const row = record(entry);
    if (!text(row.id) || !text(row.team_id) || !text(row.name)) return [];
    const next = record(row.next_event);
    return [{ id: text(row.id), teamId: text(row.team_id), teamName: text(row.team_name), name: text(row.name), role: optional(row.role), phone: optional(row.phone), email: optional(row.email), photoFileId: optional(row.photo_file_id), photoUrl: optional(row.photo_url), accessStatus: text(row.access_status) || 'not_granted', upcomingEventCount: count(row.upcoming_event_count), hasConflict: row.has_conflict === true, isLeader: row.is_leader === true, nextEvent: text(next.name) && text(next.event_date) ? { name: text(next.name), eventDate: text(next.event_date) } : null }];
  }) : [];
  return { activeMemberCount: count(source.active_member_count), upcomingEventCount: count(source.upcoming_event_count), conflictCount: count(source.conflict_count), unassignedMemberCount: count(source.unassigned_member_count), members };
}

export function buildMemberPayload(input: { name: string; role: string; phone: string; email: string; teamId: string }) {
  return { name: input.name.trim(), role: optional(input.role), phone: optional(input.phone), email: optional(input.email)?.toLowerCase() ?? null, team_id: input.teamId };
}
