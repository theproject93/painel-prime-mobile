export type MeetingMinuteLike = {
  pdf_url?: string | null;
};

export type MeetingLike = {
  status: string;
  updated_at?: string | null;
  meeting_minutes?: MeetingMinuteLike[] | null;
};

export function groupMeetings<T extends MeetingLike>(meetings: T[]) {
  return {
    active: meetings.filter((meeting) => meeting.status === 'active'),
    scheduled: meetings.filter((meeting) => meeting.status === 'scheduled'),
    history: meetings.filter(
      (meeting) => meeting.status === 'completed' || meeting.status === 'ata_failed'
    ),
  };
}

export function parseBrazilianDateTime(value: string) {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) throw new Error('Use o formato DD/MM/AAAA HH:mm.');

  const [, dayText, monthText, yearText, hourText, minuteText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    throw new Error('Informe uma data e hora válidas.');
  }

  return date;
}

export function shouldOfferAtaRetry(meeting: MeetingLike, nowMs = Date.now()) {
  if (meeting.meeting_minutes?.some((minute) => Boolean(minute.pdf_url))) return false;
  if (meeting.status === 'ata_failed') return true;
  if (meeting.status !== 'completed') return false;

  const updatedAt = meeting.updated_at ? new Date(meeting.updated_at).getTime() : nowMs;
  return nowMs - updatedAt >= 10 * 60 * 1000;
}
